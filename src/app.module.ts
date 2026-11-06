import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE, RouterModule } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { PollsModule } from './polls/polls.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    PollsModule,
    RouterModule.register([{ path: 'api', children: [PollsModule] }]),
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
