import { Injectable } from '@nestjs/common';
import type { CreatePollDto } from './dto/create-poll.dto.js';
import type { ListPollsQueryDto } from './dto/list-polls-query.dto.js';
import type { PollPage, PollResults } from './dto/poll-results.dto.js';
import { PollNotFoundException } from './poll-not-found.exception.js';
import { PollResultsCache } from './poll-results.cache.js';
import { toPollResults, toPollSummary, withCurrentClosedState } from './poll-results.mapper.js';
import { PollsRepository } from './polls.repository.js';

@Injectable()
export class PollsService {
  constructor(
    private readonly repository: PollsRepository,
    private readonly cache: PollResultsCache,
  ) {}

  async create(dto: CreatePollDto): Promise<PollResults> {
    const now = new Date();
    const poll = await this.repository.create({
      question: dto.question,
      options: dto.options,
      closesAt:
        dto.ttlSeconds === undefined ? null : new Date(now.getTime() + dto.ttlSeconds * 1000),
    });
    return toPollResults(poll, now);
  }

  async list({ page, limit }: ListPollsQueryDto): Promise<PollPage> {
    const now = new Date();
    const { polls, total } = await this.repository.findPage(page, limit);
    return { items: polls.map((poll) => toPollSummary(poll, now)), total, page, limit };
  }

  async getResults(pollId: string): Promise<PollResults> {
    const cached = await this.cache.get(pollId);
    if (cached) {
      return withCurrentClosedState(cached, new Date());
    }
    return this.refreshResults(pollId);
  }

  async refreshResults(pollId: string): Promise<PollResults> {
    const now = new Date();
    const poll = await this.repository.findWithOptions(pollId);
    if (!poll) {
      throw new PollNotFoundException(pollId);
    }
    const results = toPollResults(poll, now);
    await this.cache.set(results, now);
    return results;
  }

  async delete(pollId: string): Promise<void> {
    const deleted = await this.repository.delete(pollId);
    if (!deleted) {
      throw new PollNotFoundException(pollId);
    }
    await this.cache.delete(pollId);
  }
}
