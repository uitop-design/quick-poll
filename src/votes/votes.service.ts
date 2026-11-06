import { BadRequestException, ConflictException, GoneException, Injectable } from '@nestjs/common';
import { ForeignKeyViolationError, UniqueViolationError } from 'objection';
import type { PollResults } from '../polls/dto/poll-results.dto.js';
import { PollNotFoundException } from '../polls/poll-not-found.exception.js';
import { isPollClosed } from '../polls/poll-results.mapper.js';
import { PollsRepository } from '../polls/polls.repository.js';
import { PollsService } from '../polls/polls.service.js';
import { PollsGateway } from '../realtime/polls.gateway.js';
import type { CastVoteDto } from './dto/cast-vote.dto.js';
import { VoteRateLimiter } from './vote-rate-limiter.js';
import { VotesRepository } from './votes.repository.js';

@Injectable()
export class VotesService {
  constructor(
    private readonly rateLimiter: VoteRateLimiter,
    private readonly pollsRepository: PollsRepository,
    private readonly votesRepository: VotesRepository,
    private readonly pollsService: PollsService,
    private readonly gateway: PollsGateway,
  ) {}

  async vote(
    pollId: string,
    { optionId, voterId }: CastVoteDto,
    clientIp: string,
  ): Promise<PollResults> {
    await this.rateLimiter.consume(clientIp);

    const poll = await this.pollsRepository.findWithOptions(pollId);
    if (!poll) {
      throw new PollNotFoundException(pollId);
    }
    if (isPollClosed(poll.closesAt, new Date())) {
      throw new GoneException('Poll is closed');
    }
    if (!poll.options?.some((option) => option.id === optionId)) {
      throw new BadRequestException('Option does not belong to this poll');
    }

    try {
      await this.votesRepository.cast({ pollId, optionId, voterId });
    } catch (error) {
      if (error instanceof UniqueViolationError) {
        throw new ConflictException('This voter has already voted in this poll');
      }
      if (error instanceof ForeignKeyViolationError) {
        throw new PollNotFoundException(pollId);
      }
      throw error;
    }

    const results = await this.pollsService.refreshResults(pollId);
    this.gateway.broadcastResults(results);
    return results;
  }
}
