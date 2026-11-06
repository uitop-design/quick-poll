import { join } from 'node:path';
import type { Knex } from 'knex';
import { knexSnakeCaseMappers } from 'objection';
import { DirectoryMigrationSource } from './directory-migration-source.js';

export function createKnexConfig(connectionString: string): Knex.Config {
  return {
    client: 'pg',
    connection: { connectionString, connectionTimeoutMillis: 5000 },
    pool: { min: 0, max: 10 },
    acquireConnectionTimeout: 5000,
    migrations: {
      migrationSource: new DirectoryMigrationSource(join(import.meta.dirname, 'migrations')),
    },
    ...knexSnakeCaseMappers(),
  };
}
