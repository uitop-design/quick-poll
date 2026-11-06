import type { Poll } from '../database/models/poll.model.js';
import type { PollResults, PollSummary } from './dto/poll-results.dto.js';

export function isPollClosed(closesAt: Date | string | null, now: Date): boolean {
  return closesAt !== null && new Date(closesAt).getTime() <= now.getTime();
}

export function calculatePercent(votes: number, totalVotes: number): number {
  return totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 1000) / 10;
}

export function toPollSummary(poll: Poll, now: Date): PollSummary {
  return {
    id: poll.id,
    question: poll.question,
    closesAt: poll.closesAt?.toISOString() ?? null,
    isClosed: isPollClosed(poll.closesAt, now),
    totalVotes: poll.totalVotes ?? 0,
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  };
}

export function toPollResults(poll: Poll, now: Date): PollResults {
  const options = [...(poll.options ?? [])].toSorted((a, b) => a.position - b.position);
  const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
  return {
    ...toPollSummary(poll, now),
    totalVotes,
    options: options.map((option) => ({
      id: option.id,
      text: option.text,
      position: option.position,
      votes: option.votes,
      percent: calculatePercent(option.votes, totalVotes),
    })),
  };
}

export function withCurrentClosedState(results: PollResults, now: Date): PollResults {
  return { ...results, isClosed: isPollClosed(results.closesAt, now) };
}
