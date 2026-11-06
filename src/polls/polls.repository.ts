import { Injectable } from '@nestjs/common';
import { raw } from 'objection';
import { Poll } from '../database/models/poll.model.js';

export interface CreatePollInput {
  question: string;
  options: string[];
  closesAt: Date | null;
}

export interface PollPageResult {
  polls: Poll[];
  total: number;
}

@Injectable()
export class PollsRepository {
  async create(input: CreatePollInput): Promise<Poll> {
    return Poll.transaction(async (trx) =>
      Poll.query(trx).insertGraphAndFetch({
        question: input.question,
        closesAt: input.closesAt,
        options: input.options.map((text, position) => ({ text, position })),
      }),
    );
  }

  async findPage(page: number, limit: number): Promise<PollPageResult> {
    const { results, total } = await Poll.query()
      .select(
        'polls.*',
        Poll.relatedQuery('options')
          .select(raw('coalesce(sum(??), 0)::int', ['votes']))
          .as('totalVotes'),
      )
      .orderBy([
        { column: 'polls.createdAt', order: 'desc' },
        { column: 'polls.id', order: 'desc' },
      ])
      .page(page - 1, limit);
    return { polls: results, total };
  }

  async findWithOptions(id: string): Promise<Poll | undefined> {
    return Poll.query().findById(id).withGraphFetched('options');
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await Poll.query().deleteById(id);
    return deleted > 0;
  }
}
