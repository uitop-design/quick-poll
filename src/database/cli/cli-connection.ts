import { Logger } from '@nestjs/common';
import knex, { type Knex } from 'knex';
import { envSchema, parseEnv } from '../../config/env.schema.js';
import { createKnexConfig } from '../knex.config.js';

export async function runWithKnex(
  name: string,
  task: (connection: Knex, logger: Logger) => Promise<void>,
): Promise<void> {
  const logger = new Logger(name);
  const { DATABASE_URL } = parseEnv(envSchema.pick({ DATABASE_URL: true }), process.env);
  const connection = knex(createKnexConfig(DATABASE_URL));
  try {
    await task(connection, logger);
  } catch (error) {
    logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  } finally {
    await connection.destroy();
  }
}
