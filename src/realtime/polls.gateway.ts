import { UseFilters, UsePipes } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ZodValidationPipe } from 'nestjs-zod';
import type { Namespace, Socket } from 'socket.io';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import type { PollResults } from '../polls/dto/poll-results.dto.js';
import { PollsService } from '../polls/polls.service.js';
import { PollSubscriptionDto } from './dto/poll-subscription.dto.js';

export const RESULTS_EVENT = 'results';

export const pollRoom = (pollId: string): string => `poll:${pollId}`;

@WebSocketGateway({ namespace: '/polls', cors: { origin: '*' } })
@UseFilters(AllExceptionsFilter)
@UsePipes(ZodValidationPipe)
export class PollsGateway {
  @WebSocketServer()
  private readonly server!: Namespace;

  constructor(private readonly pollsService: PollsService) {}

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() { pollId }: PollSubscriptionDto,
  ): Promise<PollResults> {
    const results = await this.pollsService.getResults(pollId);
    await client.join(pollRoom(pollId));
    return results;
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() { pollId }: PollSubscriptionDto,
  ): Promise<{ pollId: string }> {
    await client.leave(pollRoom(pollId));
    return { pollId };
  }

  broadcastResults(results: PollResults): void {
    this.server.to(pollRoom(results.id)).emit(RESULTS_EVENT, results);
  }
}
