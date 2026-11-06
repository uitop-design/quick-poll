import { BadRequestException, ConflictException, GoneException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RateLimitExceededException } from '../common/errors/rate-limit-exceeded.exception.js';
import { PollNotFoundException } from '../polls/poll-not-found.exception.js';
import { toPollResults } from '../polls/poll-results.mapper.js';
import type { PollsRepository } from '../polls/polls.repository.js';
import type { PollsService } from '../polls/polls.service.js';
import type { PollsGateway } from '../realtime/polls.gateway.js';
import {
  buildPoll,
  foreignKeyViolation,
  OPTION_IDS,
  OTHER_POLL_ID,
  POLL_ID,
  uniqueViolation,
  VOTER_ID,
} from '../testing/fixtures.js';
import type { VoteRateLimiter } from './vote-rate-limiter.js';
import type { VotesRepository } from './votes.repository.js';
import { VotesService } from './votes.service.js';

describe('VotesService', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');
  const clientIp = '203.0.113.7';
  const dto = { optionId: OPTION_IDS[0], voterId: VOTER_ID };
  let rateLimiter: jest.Mocked<Pick<VoteRateLimiter, 'consume'>>;
  let pollsRepository: jest.Mocked<Pick<PollsRepository, 'findWithOptions'>>;
  let votesRepository: jest.Mocked<Pick<VotesRepository, 'cast'>>;
  let pollsService: jest.Mocked<Pick<PollsService, 'refreshResults'>>;
  let gateway: jest.Mocked<Pick<PollsGateway, 'broadcastResults'>>;
  let service: VotesService;

  beforeEach(() => {
    jest.useFakeTimers({ now });
    rateLimiter = { consume: jest.fn<VoteRateLimiter['consume']>().mockResolvedValue() };
    pollsRepository = {
      findWithOptions: jest.fn<PollsRepository['findWithOptions']>().mockResolvedValue(buildPoll()),
    };
    votesRepository = { cast: jest.fn<VotesRepository['cast']>().mockResolvedValue() };
    pollsService = { refreshResults: jest.fn() };
    gateway = { broadcastResults: jest.fn() };
    service = new VotesService(
      rateLimiter as unknown as VoteRateLimiter,
      pollsRepository as unknown as PollsRepository,
      votesRepository as unknown as VotesRepository,
      pollsService as unknown as PollsService,
      gateway as unknown as PollsGateway,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records the vote, refreshes cached results and broadcasts them', async () => {
    const results = toPollResults(buildPoll({}, [4, 1, 0]), now);
    pollsService.refreshResults.mockResolvedValue(results);

    await expect(service.vote(POLL_ID, dto, clientIp)).resolves.toEqual(results);

    expect(rateLimiter.consume).toHaveBeenCalledWith(clientIp);
    expect(votesRepository.cast).toHaveBeenCalledWith({ pollId: POLL_ID, ...dto });
    expect(pollsService.refreshResults).toHaveBeenCalledWith(POLL_ID);
    expect(gateway.broadcastResults).toHaveBeenCalledWith(results);
  });

  it('rejects a repeated vote of the same voter with 409', async () => {
    votesRepository.cast.mockRejectedValue(uniqueViolation());

    await expect(service.vote(POLL_ID, dto, clientIp)).rejects.toBeInstanceOf(ConflictException);
    expect(gateway.broadcastResults).not.toHaveBeenCalled();
  });

  it('rejects a vote in a closed poll with 410', async () => {
    pollsRepository.findWithOptions.mockResolvedValue(buildPoll({ closesAt: now }));

    await expect(service.vote(POLL_ID, dto, clientIp)).rejects.toBeInstanceOf(GoneException);
    expect(votesRepository.cast).not.toHaveBeenCalled();
  });

  it('rejects an option of another poll with 400', async () => {
    pollsRepository.findWithOptions.mockResolvedValue(buildPoll({ id: OTHER_POLL_ID }, [0, 0]));

    await expect(
      service.vote(POLL_ID, { ...dto, optionId: OPTION_IDS[2] }, clientIp),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(votesRepository.cast).not.toHaveBeenCalled();
  });

  it('rejects a vote for an unknown poll with 404', async () => {
    pollsRepository.findWithOptions.mockResolvedValue(undefined);

    await expect(service.vote(POLL_ID, dto, clientIp)).rejects.toBeInstanceOf(
      PollNotFoundException,
    );
  });

  it('reports 404 when the poll is deleted while voting', async () => {
    votesRepository.cast.mockRejectedValue(foreignKeyViolation());

    await expect(service.vote(POLL_ID, dto, clientIp)).rejects.toBeInstanceOf(
      PollNotFoundException,
    );
  });

  it('stops before touching the database when the rate limit is exceeded', async () => {
    rateLimiter.consume.mockRejectedValue(new RateLimitExceededException(42));

    await expect(service.vote(POLL_ID, dto, clientIp)).rejects.toMatchObject({
      retryAfterSeconds: 42,
    });
    expect(pollsRepository.findWithOptions).not.toHaveBeenCalled();
    expect(votesRepository.cast).not.toHaveBeenCalled();
  });

  it('rethrows unexpected database errors', async () => {
    const failure = new Error('connection reset');
    votesRepository.cast.mockRejectedValue(failure);

    await expect(service.vote(POLL_ID, dto, clientIp)).rejects.toBe(failure);
  });
});
