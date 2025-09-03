import { z } from 'zod';

// Common types that can be shared between MCP and VS Code extension
export const NodeTypeSchema = z.enum([
  'Technology',
  'Language',
  'Framework',
  'Library',
  'Tool',
  'Concept',
  'Person',
  'Project',
  'Organization',
  'Documentation',
  'Tutorial',
  'Other',
]);

export const EdgeTypeSchema = z.enum([
  'uses',
  'depends_on',
  'related_to',
  'implements',
  'extends',
  'imports',
  'exports',
  'collaborates_with',
  'authored_by',
  'maintains',
  'contributes_to',
  'references',
  'other',
]);

export type NodeType = z.infer<typeof NodeTypeSchema>;
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

// Common properties that nodes might have
export const CommonNodePropertiesSchema = z.object({
  description: z.string().optional(),
  url: z.string().url().optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'deprecated', 'experimental', 'archived']).optional(),
  priority: z.number().min(1).max(10).optional(),
});

// Common properties that edges might have
export const CommonEdgePropertiesSchema = z.object({
  strength: z.enum(['weak', 'medium', 'strong']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  frequency: z.number().min(0).optional(),
  context: z.string().optional(),
});

export type CommonNodeProperties = z.infer<typeof CommonNodePropertiesSchema>;
export type CommonEdgeProperties = z.infer<typeof CommonEdgePropertiesSchema>;
