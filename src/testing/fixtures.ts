import { wrapError } from 'objection';
import type { AppConfigService } from '../config/app-config.service.js';
import type { Env } from '../config/env.schema.js';
import { PollOption } from '../database/models/poll-option.model.js';
import { Poll } from '../database/models/poll.model.js';

export const POLL_ID = '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';
export const OTHER_POLL_ID = '7a2b3c4d-5e6f-4a71-8b82-a3c4d5e6f708';
export const OPTION_IDS = [
  '1a2b3c4d-0000-4000-8000-000000000001',
  '1a2b3c4d-0000-4000-8000-000000000002',
  '1a2b3c4d-0000-4000-8000-000000000003',
] as const;
export const VOTER_ID = '9c8b7a6f-5e4d-4c3b-9a29-18f7e6d5c4b3';
export const CREATED_AT = new Date('2026-11-06T10:00:00.000Z');

type PollFields = Pick<Poll, 'id' | 'question' | 'closesAt' | 'createdAt' | 'updatedAt'>;

export function buildPoll(overrides: Partial<PollFields> = {}, votes: number[] = [3, 1, 0]): Poll {
  const id = overrides.id ?? POLL_ID;
  return Object.assign(new Poll(), {
    id,
    question: 'Which language should we use?',
    closesAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
    options: votes.map((count, position) =>
      Object.assign(new PollOption(), {
        id: OPTION_IDS[position],
        pollId: id,
        text: `Option ${position + 1}`,
        position,
        votes: count,
      }),
    ),
  });
}

export function createConfig(overrides: Partial<Env> = {}): AppConfigService {
  const env: Env = {
    NODE_ENV: 'test',
    PORT: 3200,
    TRUST_PROXY: false,
    DATABASE_URL: 'postgres://quick_poll:quick_poll@localhost:5435/quick_poll',
    REDIS_URL: 'redis://localhost:6381',
    RESULTS_CACHE_TTL_SECONDS: 60,
    VOTE_RATE_LIMIT_MAX: 10,
    VOTE_RATE_LIMIT_WINDOW_SECONDS: 60,
    ...overrides,
  };
  return { get: <K extends keyof Env>(key: K): Env[K] => env[key] } as AppConfigService;
}

export function postgresError(code: string, fields: Record<string, string> = {}): unknown {
  return wrapError(
    Object.assign(new Error(`postgres error ${code}`), {
      code,
      severity: 'ERROR',
      internalQuery: undefined,
      table: 'votes',
      ...fields,
    }),
  );
}

export const uniqueViolation = (): unknown =>
  postgresError('23505', {
    constraint: 'votes_poll_id_voter_id_unique',
    detail: `Key (poll_id, voter_id)=(${POLL_ID}, ${VOTER_ID}) already exists.`,
  });

export const foreignKeyViolation = (): unknown =>
  postgresError('23503', {
    constraint: 'votes_poll_id_foreign',
    detail: `Key (poll_id)=(${POLL_ID}) is not present in table "polls".`,
  });
