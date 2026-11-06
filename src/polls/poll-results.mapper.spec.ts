import { describe, expect, it } from '@jest/globals';
import { buildPoll, CREATED_AT } from '../testing/fixtures.js';
import {
  calculatePercent,
  isPollClosed,
  toPollResults,
  withCurrentClosedState,
} from './poll-results.mapper.js';

describe('poll results mapper', () => {
  const now = new Date('2026-11-06T12:00:00.000Z');

  it('rounds percentages to one decimal place', () => {
    expect(calculatePercent(1, 3)).toBe(33.3);
    expect(calculatePercent(2, 3)).toBe(66.7);
    expect(calculatePercent(0, 0)).toBe(0);
  });

  it('treats a poll as closed from the moment it closes', () => {
    expect(isPollClosed(null, now)).toBe(false);
    expect(isPollClosed(new Date(now.getTime() + 1), now)).toBe(false);
    expect(isPollClosed(now, now)).toBe(true);
    expect(isPollClosed(new Date(now.getTime() - 1).toISOString(), now)).toBe(true);
  });

  it('builds results sorted by option position with totals', () => {
    const poll = buildPoll({}, [1, 2, 0]);
    poll.options?.reverse();

    const results = toPollResults(poll, now);

    expect(results).toEqual({
      id: poll.id,
      question: poll.question,
      closesAt: null,
      isClosed: false,
      totalVotes: 3,
      createdAt: CREATED_AT.toISOString(),
      updatedAt: CREATED_AT.toISOString(),
      options: [
        expect.objectContaining({ position: 0, votes: 1, percent: 33.3 }),
        expect.objectContaining({ position: 1, votes: 2, percent: 66.7 }),
        expect.objectContaining({ position: 2, votes: 0, percent: 0 }),
      ],
    });
  });

  it('recalculates the closed state of cached results', () => {
    const results = toPollResults(buildPoll({ closesAt: new Date('2026-11-06T11:59:00Z') }), now);
    const stale = { ...results, isClosed: false };

    expect(withCurrentClosedState(stale, now).isClosed).toBe(true);
  });
});
