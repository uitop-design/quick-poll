import { Module } from '@nestjs/common';
import { PollsModule } from '../polls/polls.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { VoteRateLimiter } from './vote-rate-limiter.js';
import { VotesController } from './votes.controller.js';
import { VotesRepository } from './votes.repository.js';
import { VotesService } from './votes.service.js';

@Module({
  imports: [PollsModule, RealtimeModule],
  controllers: [VotesController],
  providers: [VotesService, VotesRepository, VoteRateLimiter],
})
export class VotesModule {}
