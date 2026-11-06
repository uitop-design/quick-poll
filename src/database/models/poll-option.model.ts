import { Model } from 'objection';

export class PollOption extends Model {
  static override tableName = 'poll_options';

  declare id: string;
  declare pollId: string;
  declare text: string;
  declare position: number;
  declare votes: number;
}
