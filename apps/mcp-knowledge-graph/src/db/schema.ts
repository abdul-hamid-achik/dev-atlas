import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  properties: text('properties', { mode: 'json' }),
  // Vector embedding for semantic search (stored as JSON array for now)
  embedding: text('embedding'),
  embeddingModel: text('embedding_model'), // Track which model generated the embedding
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
  // Vector embedding for relationship semantics
  embedding: text('embedding'),
  embeddingModel: text('embedding_model'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

// Vector similarity search results table for caching
export const vectorSearchCache = sqliteTable('vector_search_cache', {
  id: text('id').primaryKey(),
  queryHash: text('query_hash').notNull().unique(),
  queryEmbedding: text('query_embedding').notNull(),
  results: text('results', { mode: 'json' }).notNull(),
  model: text('model').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
});
