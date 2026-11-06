import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildPoll, POLL_ID } from '../testing/fixtures.js';
import { PollNotFoundException } from './poll-not-found.exception.js';
import type { PollResultsCache } from './poll-results.cache.js';
import { toPollResults } from './poll-results.mapper.js';
import type { PollsRepository } from './polls.repository.js';
import { PollsService } from './polls.service.js';

describe('PollsService', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');
  let repository: jest.Mocked<
    Pick<PollsRepository, 'create' | 'findPage' | 'findWithOptions' | 'delete'>
  >;
  let cache: jest.Mocked<Pick<PollResultsCache, 'get' | 'set' | 'delete'>>;
  let service: PollsService;

  beforeEach(() => {
    jest.useFakeTimers({ now });
    repository = {
      create: jest.fn(),
      findPage: jest.fn(),
      findWithOptions: jest.fn(),
      delete: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
    service = new PollsService(
      repository as unknown as PollsRepository,
      cache as unknown as PollResultsCache,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('creates a poll that closes after ttlSeconds', async () => {
      const poll = buildPoll({ closesAt: new Date(now.getTime() + 3600_000) }, [0, 0]);
      repository.create.mockResolvedValue(poll);

      const results = await service.create({
        question: poll.question,
        options: ['Option 1', 'Option 2'],
        ttlSeconds: 3600,
      });

      expect(repository.create).toHaveBeenCalledWith({
        question: poll.question,
        options: ['Option 1', 'Option 2'],
        closesAt: new Date('2026-11-06T13:00:00.000Z'),
      });
      expect(results).toMatchObject({ id: POLL_ID, totalVotes: 0, isClosed: false });
      expect(results.options).toHaveLength(2);
    });

    it('creates a poll without deadline when ttlSeconds is omitted', async () => {
      repository.create.mockResolvedValue(buildPoll({}, [0, 0]));

      const results = await service.create({ question: 'Open forever?', options: ['Yes', 'No'] });

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ closesAt: null }));
      expect(results.closesAt).toBeNull();
    });
  });

  describe('list', () => {
    it('returns a page of summaries with totals and closed state', async () => {
      const open = Object.assign(buildPoll(), { totalVotes: 4 });
      const closed = Object.assign(
        buildPoll({
          id: '2f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7',
          closesAt: new Date(now.getTime() - 1),
        }),
        { totalVotes: 0 },
      );
      repository.findPage.mockResolvedValue({ polls: [open, closed], total: 12 });

      const page = await service.list({ page: 2, limit: 2 });

      expect(repository.findPage).toHaveBeenCalledWith(2, 2);
      expect(page).toMatchObject({ total: 12, page: 2, limit: 2 });
      expect(page.items.map(({ totalVotes, isClosed }) => ({ totalVotes, isClosed }))).toEqual([
        { totalVotes: 4, isClosed: false },
        { totalVotes: 0, isClosed: true },
      ]);
      expect(page.items[0]).not.toHaveProperty('options');
    });
  });

  describe('getResults', () => {
    it('returns cached results without touching the database', async () => {
      const cached = toPollResults(buildPoll(), now);
      cache.get.mockResolvedValue(cached);

      await expect(service.getResults(POLL_ID)).resolves.toEqual(cached);
      expect(repository.findWithOptions).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('reports a cached poll as closed once its deadline has passed', async () => {
      const cached = toPollResults(buildPoll({ closesAt: new Date(now.getTime() + 1000) }), now);
      cache.get.mockResolvedValue(cached);
      jest.setSystemTime(now.getTime() + 1000);

      await expect(service.getResults(POLL_ID)).resolves.toMatchObject({ isClosed: true });
    });

    it('loads results from the database on a cache miss and caches them', async () => {
      const poll = buildPoll({}, [3, 1, 0]);
      cache.get.mockResolvedValue(null);
      repository.findWithOptions.mockResolvedValue(poll);

      const results = await service.getResults(POLL_ID);

      expect(repository.findWithOptions).toHaveBeenCalledWith(POLL_ID);
      expect(results).toEqual(toPollResults(poll, now));
      expect(cache.set).toHaveBeenCalledWith(results, now);
    });

    it('throws 404 when the poll does not exist', async () => {
      cache.get.mockResolvedValue(null);
      repository.findWithOptions.mockResolvedValue(undefined);

      await expect(service.getResults(POLL_ID)).rejects.toBeInstanceOf(PollNotFoundException);
      expect(cache.set).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes the poll and invalidates its cached results', async () => {
      repository.delete.mockResolvedValue(true);

      await service.delete(POLL_ID);

      expect(repository.delete).toHaveBeenCalledWith(POLL_ID);
      expect(cache.delete).toHaveBeenCalledWith(POLL_ID);
    });

    it('throws 404 for an unknown poll', async () => {
      repository.delete.mockResolvedValue(false);

      await expect(service.delete(POLL_ID)).rejects.toBeInstanceOf(PollNotFoundException);
      expect(cache.delete).not.toHaveBeenCalled();
    });
  });
});
