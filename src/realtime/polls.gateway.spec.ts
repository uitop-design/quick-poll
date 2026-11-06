import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Socket } from 'socket.io';
import { PollNotFoundException } from '../polls/poll-not-found.exception.js';
import { toPollResults } from '../polls/poll-results.mapper.js';
import type { PollsService } from '../polls/polls.service.js';
import { buildPoll, POLL_ID } from '../testing/fixtures.js';
import { PollsGateway, RESULTS_EVENT } from './polls.gateway.js';

describe('PollsGateway', () => {
  const results = toPollResults(buildPoll(), new Date('2026-11-06T12:00:00.000Z'));
  let pollsService: jest.Mocked<Pick<PollsService, 'getResults'>>;
  let client: {
    join: jest.Mock<(room: string) => Promise<void>>;
    leave: jest.Mock<(room: string) => Promise<void>>;
  };
  let emit: jest.Mock;
  let to: jest.Mock;
  let gateway: PollsGateway;

  beforeEach(() => {
    pollsService = { getResults: jest.fn() };
    client = { join: jest.fn(), leave: jest.fn() };
    emit = jest.fn();
    to = jest.fn().mockReturnValue({ emit });
    gateway = new PollsGateway(pollsService as unknown as PollsService);
    Object.assign(gateway, { server: { to } });
  });

  it('joins the poll room and acknowledges with current results', async () => {
    pollsService.getResults.mockResolvedValue(results);

    await expect(
      gateway.subscribe(client as unknown as Socket, { pollId: POLL_ID }),
    ).resolves.toEqual(results);
    expect(client.join).toHaveBeenCalledWith(`poll:${POLL_ID}`);
  });

  it('does not join the room of an unknown poll', async () => {
    pollsService.getResults.mockRejectedValue(new PollNotFoundException(POLL_ID));

    await expect(
      gateway.subscribe(client as unknown as Socket, { pollId: POLL_ID }),
    ).rejects.toBeInstanceOf(PollNotFoundException);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('leaves the poll room on unsubscribe', async () => {
    await expect(
      gateway.unsubscribe(client as unknown as Socket, { pollId: POLL_ID }),
    ).resolves.toEqual({ pollId: POLL_ID });
    expect(client.leave).toHaveBeenCalledWith(`poll:${POLL_ID}`);
  });

  it('broadcasts results to subscribers of the poll', () => {
    gateway.broadcastResults(results);

    expect(to).toHaveBeenCalledWith(`poll:${POLL_ID}`);
    expect(emit).toHaveBeenCalledWith(RESULTS_EVENT, results);
  });
});
