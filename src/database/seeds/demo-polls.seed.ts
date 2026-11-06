import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';

interface SeedPoll {
  question: string;
  createdMinutesAgo: number;
  closesInMinutes: number | null;
  options: { text: string; votes: number }[];
}

const MINUTE_MS = 60_000;

const SEED_POLLS: SeedPoll[] = [
  {
    question: 'Which language should we use for the next internal tool?',
    createdMinutesAgo: 240,
    closesInMinutes: 7 * 24 * 60,
    options: [
      { text: 'TypeScript', votes: 5 },
      { text: 'Go', votes: 3 },
      { text: 'Rust', votes: 2 },
      { text: 'Python', votes: 1 },
    ],
  },
  {
    question: 'What should the team lunch be on Friday?',
    createdMinutesAgo: 180,
    closesInMinutes: null,
    options: [
      { text: 'Pizza', votes: 0 },
      { text: 'Sushi', votes: 0 },
      { text: 'Burgers', votes: 0 },
    ],
  },
  {
    question: 'Which time slot works best for the weekly sync?',
    createdMinutesAgo: 120,
    closesInMinutes: 24 * 60,
    options: [
      { text: 'Monday 10:00', votes: 0 },
      { text: 'Tuesday 14:00', votes: 0 },
      { text: 'Thursday 11:00', votes: 0 },
    ],
  },
  {
    question: 'Should we move the retro to a fortnightly schedule?',
    createdMinutesAgo: 3 * 24 * 60,
    closesInMinutes: -24 * 60,
    options: [
      { text: 'Yes', votes: 4 },
      { text: 'No', votes: 2 },
    ],
  },
];

export async function seed(knex: Knex): Promise<void> {
  const now = Date.now();
  await knex.transaction(async (trx) => {
    await trx('polls').del();
    for (const poll of SEED_POLLS) {
      const createdAt = new Date(now - poll.createdMinutesAgo * MINUTE_MS);
      const [{ id: pollId }] = await trx('polls')
        .insert({
          question: poll.question,
          closesAt:
            poll.closesInMinutes === null ? null : new Date(now + poll.closesInMinutes * MINUTE_MS),
          createdAt,
          updatedAt: createdAt,
        })
        .returning<{ id: string }[]>('id');

      for (const [position, option] of poll.options.entries()) {
        const [{ id: optionId }] = await trx('pollOptions')
          .insert({ pollId, text: option.text, position, votes: option.votes })
          .returning<{ id: string }[]>('id');
        const votes = Array.from({ length: option.votes }, () => ({
          pollId,
          optionId,
          voterId: randomUUID(),
          createdAt,
        }));
        if (votes.length > 0) {
          await trx('votes').insert(votes);
        }
      }
    }
  });
}
