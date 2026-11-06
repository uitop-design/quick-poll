import { readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Knex } from 'knex';

const MIGRATION_FILE = /^(?!.*\.d\.ts$).+\.(ts|js)$/;

export class DirectoryMigrationSource implements Knex.MigrationSource<string> {
  constructor(private readonly directory: string) {}

  async getMigrations(): Promise<string[]> {
    const files = await this.listMigrationFiles();
    return [...new Set(files.map((file) => parse(file).name))].sort();
  }

  getMigrationName(migration: string): string {
    return migration;
  }

  async getMigration(migration: string): Promise<Knex.Migration> {
    const files = await this.listMigrationFiles();
    const file = files.find((candidate) => parse(candidate).name === migration);
    if (!file) {
      throw new Error(`Migration file not found: ${migration}`);
    }
    return (await import(pathToFileURL(join(this.directory, file)).href)) as Knex.Migration;
  }

  private async listMigrationFiles(): Promise<string[]> {
    const files = await readdir(this.directory);
    return files.filter((file) => MIGRATION_FILE.test(file));
  }
}
