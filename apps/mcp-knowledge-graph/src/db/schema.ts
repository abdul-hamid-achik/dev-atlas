import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  properties: text('properties', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const edges = sqliteTable('edges', {
  id: text('id').primaryKey(),
  sourceId: text('source_id')
    .notNull()
    .references(() => nodes.id),
  targetId: text('target_id')
    .notNull()
    .references(() => nodes.id),
  type: text('type').notNull(),
  properties: text('properties', { mode: 'json' }),
  weight: real('weight'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});
