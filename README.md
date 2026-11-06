# Quick Poll

Backend for quick polls with voting and live results. Create a poll, share its id, collect votes
over HTTP and stream updated results to subscribers over WebSocket.

The service is API-only: REST endpoints are documented with Swagger, live updates go through
Socket.IO.

## Stack

- Node.js 24, TypeScript (strict), NestJS 12 (ESM)
- PostgreSQL 18 with Knex (migrations, seed) and Objection.js (models)
- Redis 8 via ioredis for the results cache and the vote rate limit
- Socket.IO through `@nestjs/websockets` for live results
- Zod with `nestjs-zod` for validation, DTOs and the OpenAPI schema
- Jest, oxlint, Prettier
- Docker multi-stage image and Docker Compose

## Data model

| Table          | Columns                                                                   | Constraints                                                     |
| -------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `polls`        | `id` uuid, `question`, `closes_at` (nullable), `created_at`, `updated_at` | `closes_at = null` means the poll never closes                  |
| `poll_options` | `id` uuid, `poll_id`, `text`, `position`, `votes` (default 0)             | FK to `polls` with cascade delete, unique `(poll_id, position)` |
| `votes`        | `id` uuid, `poll_id`, `option_id`, `voter_id` uuid, `created_at`          | FKs with cascade delete, unique `(poll_id, voter_id)`           |

`poll_options.votes` is a denormalized counter that is updated in the same transaction as the
vote insert, so results are read without aggregating the `votes` table.

## Business rules

- `question`: 3–200 characters after trimming.
- `options`: 2–10 items, each 1–100 characters after trimming, no duplicates (case-insensitive).
- `ttlSeconds`: optional integer from 60 seconds to 30 days. Without it the poll never closes.
- Unknown fields in request bodies are rejected with `400`.
- UUIDs are accepted in any letter case and normalized to lower case.
- One vote per `voterId` in a poll. The unique index guarantees it even for parallel requests:
  exactly one of them gets `201`, the rest get `409`.
- A vote inserts a `votes` row and increments `poll_options.votes` atomically in one transaction.
- Voting in a closed poll returns `410 Gone`. The deadline is always checked against PostgreSQL,
  never against cached results.
- An `optionId` that does not belong to the poll returns `400`, an unknown poll returns `404`.
- No more than 10 votes per minute from one IP address, otherwise `429` with `Retry-After`.

## REST API

All endpoints are prefixed with `/api`. Swagger UI is available at
[http://localhost:3200/docs](http://localhost:3200/docs), the raw document at `/docs-json`.

| Method   | Path                   | Description                                         | Success |
| -------- | ---------------------- | --------------------------------------------------- | ------- |
| `POST`   | `/api/polls`           | Create a poll `{ question, options, ttlSeconds? }`  | `201`   |
| `GET`    | `/api/polls`           | List polls, newest first: `?page=1&limit=20`        | `200`   |
| `GET`    | `/api/polls/:id`       | Poll with options, votes and percentages            | `200`   |
| `DELETE` | `/api/polls/:id`       | Delete a poll with its options, votes and cache     | `204`   |
| `POST`   | `/api/polls/:id/votes` | Vote `{ optionId, voterId }`, returns fresh results | `201`   |
| `GET`    | `/api/health`          | Check PostgreSQL and Redis                          | `200`   |

`page` defaults to 1, `limit` defaults to 20 and is capped at 100. The list response is
`{ items, total, page, limit }`, every item has `totalVotes` and `isClosed`.

Poll results, returned by `GET /api/polls/:id`, `POST /api/polls` and `POST /api/polls/:id/votes`:

```json
{
  "id": "0d1f5c3e-8a43-4f0e-9a43-2a7f0b8f6c11",
  "question": "Which language should we use for the next internal tool?",
  "closesAt": "2026-11-13T12:00:00.000Z",
  "isClosed": false,
  "totalVotes": 3,
  "createdAt": "2026-11-06T12:00:00.000Z",
  "updatedAt": "2026-11-06T12:00:00.000Z",
  "options": [
    { "id": "5b0c…", "text": "TypeScript", "position": 0, "votes": 2, "percent": 66.7 },
    { "id": "9e4a…", "text": "Go", "position": 1, "votes": 1, "percent": 33.3 }
  ]
}
```

`percent` is rounded to one decimal place, so the sum may differ from 100 by a fraction.

### Errors

Every error, including validation and WebSocket errors, has the same shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["question: Too small: expected string to have >=3 characters"],
  "path": "/api/polls",
  "timestamp": "2026-11-06T12:00:00.000Z"
}
```

- Validation errors return `400` with a list of messages.
- Database errors are mapped: unique violation → `409`, foreign key or invalid data → `400`,
  missing row → `404`.
- Anything unexpected returns `500` with a generic message; details go to the log only.

## WebSocket

Socket.IO namespace `/polls` on the same port as the HTTP API.

| Direction       | Event         | Payload      | Acknowledgement                                                    |
| --------------- | ------------- | ------------ | ------------------------------------------------------------------ |
| client → server | `subscribe`   | `{ pollId }` | Current results, or an error object for an invalid or unknown poll |
| client → server | `unsubscribe` | `{ pollId }` | `{ pollId }`                                                       |
| server → client | `results`     | Poll results | —                                                                  |

After every successful vote the server emits `results` to everyone subscribed to the poll, with
the same payload as `GET /api/polls/:id`. Events of parallel votes may arrive out of order;
clients can keep the payload with the highest `totalVotes`.

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3200/polls');
const results = await socket.emitWithAck('subscribe', { pollId });
if ('statusCode' in results) throw new Error(results.message);
socket.on('results', (update) => render(update));
```

## Results cache

`GET /api/polls/:id` reads `poll:{id}:results` from Redis first. On a miss it loads the poll from
PostgreSQL and stores the results with a TTL of `RESULTS_CACHE_TTL_SECONDS` (60 by default), never
longer than the time left until the poll closes, so cached results of an open poll do not outlive
it. `isClosed` is recalculated from `closesAt` on every read.

- After a vote the key is rewritten with fresh results. The write is a small Lua script that
  skips the update when Redis already holds results with more votes, so a slower parallel
  request cannot overwrite newer data.
- Deleting a poll removes its key.
- When Redis comes back after an outage, all cached results are dropped, because votes accepted
  in the meantime were not reflected in the cache.

## Rate limit

Each vote request increments `rate-limit:votes:{ip}` (`INCR`) and starts a 60-second window on the
first hit (`EXPIRE … NX`). Requests above `VOTE_RATE_LIMIT_MAX` (10) in the window get `429` with
a `Retry-After` header holding the seconds left in the window. Requests rejected by validation are
not counted.

The client IP is taken from the socket. Set `TRUST_PROXY=true` only when the service runs behind
a reverse proxy that sets `X-Forwarded-For`, otherwise clients could spoof their address.

## Redis outage

Redis is optional at runtime. The client fails fast instead of queueing commands, so when Redis
is down the API keeps serving everything from PostgreSQL, the rate limit is skipped and
`GET /api/health` returns `503` with the failed dependency in `message`. Connection state changes
are logged once.

## Running with Docker Compose

```bash
docker compose up -d --build
```

| Service    | Purpose                                        | Host port |
| ---------- | ---------------------------------------------- | --------- |
| `app`      | API and WebSocket                              | 3200      |
| `postgres` | PostgreSQL 18                                  | 5435      |
| `redis`    | Redis 8                                        | 6381      |
| `migrate`  | One-off job: runs migrations and the demo seed | —         |

The app starts after `migrate` completes. The seed creates four demo polls (an open poll with
votes, a poll without deadline, a poll with a deadline and a closed poll) and is skipped when the
database already has polls.

Reset the database to a clean seed:

```bash
docker compose down -v && docker compose up -d
```

## Running locally

Requires Node.js 22+ and running PostgreSQL and Redis, for example from Compose:

```bash
docker compose up -d postgres redis
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run start:dev
```

| Script                       | Description                            |
| ---------------------------- | -------------------------------------- |
| `npm run db:migrate`         | Apply pending migrations               |
| `npm run db:rollback`        | Roll back the last batch               |
| `npm run db:seed`            | Seed demo polls into an empty database |
| `npm run db:seed -- --reset` | Replace all polls with the demo seed   |
| `npm run build`              | Compile to `dist`                      |
| `npm run start:prod`         | Run the compiled app                   |

### Environment

| Variable                         | Default       | Description                               |
| -------------------------------- | ------------- | ----------------------------------------- |
| `DATABASE_URL`                   | —             | PostgreSQL connection string              |
| `REDIS_URL`                      | —             | Redis connection string                   |
| `PORT`                           | `3200`        | HTTP and WebSocket port                   |
| `TRUST_PROXY`                    | `false`       | Trust `X-Forwarded-For` for the client IP |
| `RESULTS_CACHE_TTL_SECONDS`      | `60`          | Maximum lifetime of cached results        |
| `VOTE_RATE_LIMIT_MAX`            | `10`          | Votes allowed per IP in one window        |
| `VOTE_RATE_LIMIT_WINDOW_SECONDS` | `60`          | Rate limit window                         |
| `NODE_ENV`                       | `development` | `development`, `production` or `test`     |

The environment is validated with Zod on startup; the app refuses to start with an invalid one.

## Tests and linting

```bash
npm test          # unit tests
npm run test:cov  # unit tests with coverage
npm run lint      # oxlint and Prettier check
npm run format    # apply Prettier
npm run typecheck # tsc --noEmit
```

Unit tests mock Knex/Objection repositories, Redis and the Socket.IO server, and cover poll
creation, voting rules (success, repeated vote, closed poll, foreign option, rate limit), the
results cache (hit, miss, invalidation), results broadcasting, deletion and the exception filter.

## Project structure

```
src/
  common/      error format, exception filter, shared schemas
  config/      environment schema and typed config service
  database/    Knex config, migrations, seed, Objection models, CLI
  redis/       ioredis client with connection state tracking
  polls/       poll endpoints, repository, results cache
  votes/       voting endpoint, transaction, rate limiter
  realtime/    Socket.IO gateway
  health/      health check
```
