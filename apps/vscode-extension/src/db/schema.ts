import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  properties: text('properties'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

export const edges = sqliteTable('edges', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  targetId: text('target_id').notNull(),
  type: text('type').notNull(),
  properties: text('properties'),
  weight: real('weight'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

export type Node = {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Edge = {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties?: Record<string, unknown>;
  weight?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateNode = {
  type: string;
  label: string;
  properties?: Record<string, unknown>;
};

export type CreateEdge = {
  sourceId: string;
  targetId: string;
  type: string;
  properties?: Record<string, unknown>;
  weight?: number;
};

export type QueryNodes = {
  type?: string;
  label?: string;
  limit?: number;
  offset?: number;
};

export type QueryEdges = {
  sourceId?: string;
  targetId?: string;
  type?: string;
  limit?: number;
  offset?: number;
};
