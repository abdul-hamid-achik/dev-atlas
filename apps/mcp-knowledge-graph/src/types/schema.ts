import { z } from 'zod';

// Knowledge Graph Node Schema
export const NodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  properties: z.record(z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Knowledge Graph Edge Schema
export const EdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  properties: z.record(z.any()).optional(),
  weight: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Query schemas
export const CreateNodeSchema = z.object({
  type: z.string(),
  label: z.string(),
  properties: z.record(z.any()).optional(),
});

export const CreateEdgeSchema = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  properties: z.record(z.any()).optional(),
  weight: z.number().optional(),
});

export const QueryNodesSchema = z.object({
  type: z.string().optional(),
  label: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export const QueryEdgesSchema = z.object({
  sourceId: z.string().optional(),
  targetId: z.string().optional(),
  type: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type CreateNode = z.infer<typeof CreateNodeSchema>;
export type CreateEdge = z.infer<typeof CreateEdgeSchema>;
export type QueryNodes = z.infer<typeof QueryNodesSchema>;
export type QueryEdges = z.infer<typeof QueryEdgesSchema>;