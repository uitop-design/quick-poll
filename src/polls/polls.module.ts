import { Module } from '@nestjs/common';
import { PollResultsCache } from './poll-results.cache.js';
import { PollsController } from './polls.controller.js';
import { PollsRepository } from './polls.repository.js';
import { PollsService } from './polls.service.js';

@Module({
  controllers: [PollsController],
  providers: [PollsService, PollsRepository, PollResultsCache],
  exports: [PollsService, PollsRepository],
})
export class PollsModule {}
