import { Model } from 'objection';

export class Vote extends Model {
  static override tableName = 'votes';

  declare id: string;
  declare pollId: string;
  declare optionId: string;
  declare voterId: string;
  declare createdAt: Date;
}
