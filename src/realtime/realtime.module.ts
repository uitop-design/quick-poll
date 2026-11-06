import { Module } from '@nestjs/common';
import { PollsModule } from '../polls/polls.module.js';
import { PollsGateway } from './polls.gateway.js';

@Module({
  imports: [PollsModule],
  providers: [PollsGateway],
  exports: [PollsGateway],
})
export class RealtimeModule {}
