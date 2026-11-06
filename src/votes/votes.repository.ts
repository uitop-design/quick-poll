import { Injectable } from '@nestjs/common';
import { PollOption } from '../database/models/poll-option.model.js';
import { Vote } from '../database/models/vote.model.js';

export interface CastVoteInput {
  pollId: string;
  optionId: string;
  voterId: string;
}

@Injectable()
export class VotesRepository {
  async cast({ pollId, optionId, voterId }: CastVoteInput): Promise<void> {
    await Vote.transaction(async (trx) => {
      await Vote.query(trx).insert({ pollId, optionId, voterId });
      await PollOption.query(trx).findById(optionId).increment('votes', 1);
    });
  }
}
