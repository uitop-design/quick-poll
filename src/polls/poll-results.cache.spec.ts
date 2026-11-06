import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { RedisService } from '../redis/redis.service.js';
import { buildPoll, createConfig, POLL_ID } from '../testing/fixtures.js';
import { PollResultsCache } from './poll-results.cache.js';
import { toPollResults } from './poll-results.mapper.js';

describe('PollResultsCache', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');
  const key = `poll:${POLL_ID}:results`;
  let client: {
    get: jest.Mock<(key: string) => Promise<string | null>>;
    eval: jest.Mock<(...args: unknown[]) => Promise<number>>;
    del: jest.Mock<(key: string) => Promise<number>>;
    unlink: jest.Mock<(...keys: string[]) => Promise<number>>;
    scanStream: jest.Mock<(options: { match: string; count: number }) => Readable>;
  };
  let onRecovery: jest.Mock<(listener: () => Promise<void>) => void>;
  let cache: PollResultsCache;

  beforeEach(() => {
    client = {
      get: jest.fn(),
      eval: jest.fn<(...args: unknown[]) => Promise<number>>().mockResolvedValue(1),
      del: jest.fn<(key: string) => Promise<number>>().mockResolvedValue(1),
      unlink: jest.fn<(...keys: string[]) => Promise<number>>().mockResolvedValue(1),
      scanStream: jest.fn(),
    };
    onRecovery = jest.fn();
    const redis = { client, onRecovery } as unknown as RedisService;
    cache = new PollResultsCache(redis, createConfig({ RESULTS_CACHE_TTL_SECONDS: 60 }));
  });

  it('returns parsed results on a cache hit', async () => {
    const results = toPollResults(buildPoll(), now);
    client.get.mockResolvedValue(JSON.stringify(results));

    await expect(cache.get(POLL_ID)).resolves.toEqual(results);
    expect(client.get).toHaveBeenCalledWith(key);
  });

  it('returns null on a cache miss', async () => {
    client.get.mockResolvedValue(null);

    await expect(cache.get(POLL_ID)).resolves.toBeNull();
  });

  it('treats an unavailable redis as a cache miss', async () => {
    client.get.mockRejectedValue(new Error('Connection is closed.'));

    await expect(cache.get(POLL_ID)).resolves.toBeNull();
  });

  it('stores results with the default ttl for polls without deadline', async () => {
    const results = toPollResults(buildPoll(), now);

    await cache.set(results, now);

    expect(client.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      key,
      JSON.stringify(results),
      results.totalVotes,
      60_000,
    );
  });

  it('never caches open poll results longer than the poll lives', async () => {
    const results = toPollResults(buildPoll({ closesAt: new Date(now.getTime() + 15_000) }), now);

    await cache.set(results, now);

    expect(client.eval.mock.calls[0]?.[5]).toBe(15_000);
  });

  it('ignores write failures', async () => {
    client.eval.mockRejectedValue(new Error('Connection is closed.'));

    await expect(cache.set(toPollResults(buildPoll(), now), now)).resolves.toBeUndefined();
  });

  it('invalidates the poll key', async () => {
    await cache.delete(POLL_ID);

    expect(client.del).toHaveBeenCalledWith(key);
  });

  it('clears all cached results when redis recovers', async () => {
    client.scanStream.mockReturnValue(Readable.from([[key, 'poll:other:results'], []]));
    cache.onModuleInit();
    const listener = onRecovery.mock.calls[0]?.[0];

    await listener?.();

    expect(client.scanStream).toHaveBeenCalledWith({ match: 'poll:*:results', count: 500 });
    expect(client.unlink).toHaveBeenCalledTimes(1);
    expect(client.unlink).toHaveBeenCalledWith(key, 'poll:other:results');
  });
});
