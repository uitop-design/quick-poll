import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RateLimitExceededException } from '../common/errors/rate-limit-exceeded.exception.js';
import type { RedisService } from '../redis/redis.service.js';
import { createConfig } from '../testing/fixtures.js';
import { VoteRateLimiter } from './vote-rate-limiter.js';

type ExecResult = [Error | null, unknown][] | null;

const usage = (count: number, ttlMs: number): ExecResult => [
  [null, count],
  [null, 1],
  [null, ttlMs],
];

describe('VoteRateLimiter', () => {
  const ip = '203.0.113.7';
  const key = `rate-limit:votes:${ip}`;
  let exec: jest.Mock<() => Promise<ExecResult>>;
  let pipeline: Record<'incr' | 'expire' | 'pttl', jest.Mock>;
  let limiter: VoteRateLimiter;

  beforeEach(() => {
    exec = jest.fn();
    pipeline = { incr: jest.fn(), expire: jest.fn(), pttl: jest.fn() };
    const chain = { ...pipeline, exec };
    for (const method of Object.values(pipeline)) {
      method.mockReturnValue(chain);
    }
    const redis = { client: { multi: () => chain } } as unknown as RedisService;
    limiter = new VoteRateLimiter(
      redis,
      createConfig({ VOTE_RATE_LIMIT_MAX: 10, VOTE_RATE_LIMIT_WINDOW_SECONDS: 60 }),
    );
  });

  it('allows votes up to the limit and starts the window on the first one', async () => {
    exec.mockResolvedValue(usage(10, 60_000));

    await expect(limiter.consume(ip)).resolves.toBeUndefined();
    expect(pipeline.incr).toHaveBeenCalledWith(key);
    expect(pipeline.expire).toHaveBeenCalledWith(key, 60, 'NX');
  });

  it('rejects votes over the limit with the time left in the window', async () => {
    exec.mockResolvedValue(usage(11, 41_200));

    const error = await limiter.consume(ip).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RateLimitExceededException);
    expect(error).toMatchObject({ retryAfterSeconds: 42 });
  });

  it('never asks to retry after less than one second', async () => {
    exec.mockResolvedValue(usage(12, -1));

    await expect(limiter.consume(ip)).rejects.toMatchObject({ retryAfterSeconds: 1 });
  });

  it('lets votes through when redis is unavailable', async () => {
    exec.mockRejectedValue(new Error("Stream isn't writeable"));

    await expect(limiter.consume(ip)).resolves.toBeUndefined();
  });

  it('lets votes through when a redis command fails', async () => {
    exec.mockResolvedValue([
      [new Error('OOM'), null],
      [null, 1],
      [null, 1000],
    ]);

    await expect(limiter.consume(ip)).resolves.toBeUndefined();
  });
});
