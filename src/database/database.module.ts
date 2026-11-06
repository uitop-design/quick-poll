import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import knex, { type Knex } from 'knex';
import { Model } from 'objection';
import { AppConfigService } from '../config/app-config.service.js';
import { KNEX } from './database.constants.js';
import { createKnexConfig } from './knex.config.js';

@Global()
@Module({
  providers: [
    {
      provide: KNEX,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Knex => {
        const connection = knex(createKnexConfig(config.get('DATABASE_URL')));
        Model.knex(connection);
        return connection;
      },
    },
  ],
  exports: [KNEX],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(KNEX) private readonly knex: Knex) {}

  async onApplicationShutdown(): Promise<void> {
    await this.knex.destroy();
  }
}
