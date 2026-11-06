import { runWithKnex } from './cli-connection.js';

await runWithKnex('Migrations', async (connection, logger) => {
  const [batch, applied] = (await connection.migrate.latest()) as [number, string[]];
  logger.log(
    applied.length === 0
      ? 'Database is already up to date'
      : `Batch ${batch} applied: ${applied.join(', ')}`,
  );
});
