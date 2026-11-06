import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('polls', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('question', 200).notNullable();
    table.timestamp('closes_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['created_at', 'id']);
  });

  await knex.schema.createTable('poll_options', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('poll_id').notNullable().references('id').inTable('polls').onDelete('CASCADE');
    table.string('text', 100).notNullable();
    table.integer('position').notNullable();
    table.integer('votes').notNullable().defaultTo(0);
    table.unique(['poll_id', 'position']);
    table.check('?? >= 0', ['votes'], 'poll_options_votes_non_negative');
  });

  await knex.schema.createTable('votes', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('poll_id').notNullable().references('id').inTable('polls').onDelete('CASCADE');
    table
      .uuid('option_id')
      .notNullable()
      .references('id')
      .inTable('poll_options')
      .onDelete('CASCADE');
    table.uuid('voter_id').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['poll_id', 'voter_id']);
    table.index(['option_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('votes');
  await knex.schema.dropTable('poll_options');
  await knex.schema.dropTable('polls');
}
