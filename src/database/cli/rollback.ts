import { runWithKnex } from './cli-connection.js';

await runWithKnex('Migrations', async (connection, logger) => {
  const [batch, reverted] = (await connection.migrate.rollback()) as [number, string[]];
  logger.log(
    reverted.length === 0
      ? 'Nothing to roll back'
      : `Batch ${batch} rolled back: ${reverted.join(', ')}`,
  );
});
