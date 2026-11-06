import { Model, type RelationMappings } from 'objection';
import { PollOption } from './poll-option.model.js';

export class Poll extends Model {
  static override tableName = 'polls';

  declare id: string;
  declare question: string;
  declare closesAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare options?: PollOption[];
  declare totalVotes?: number;

  static override get relationMappings(): RelationMappings {
    return {
      options: {
        relation: Model.HasManyRelation,
        modelClass: PollOption,
        join: { from: 'polls.id', to: 'poll_options.pollId' },
      },
    };
  }
}
