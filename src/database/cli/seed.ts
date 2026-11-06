import { seed } from '../seeds/demo-polls.seed.js';
import { runWithKnex } from './cli-connection.js';

const reset = process.argv.includes('--reset');

await runWithKnex('Seed', async (connection, logger) => {
  const existing = await connection('polls').first('id');
  if (existing && !reset) {
    logger.log('Polls already exist, skipping seed (use --reset to replace them)');
    return;
  }
  await seed(connection);
  logger.log('Demo polls seeded');
});
