import { z } from 'zod';

// ========== VECTOR SEARCH SCHEMAS ==========

// Base embedding schema
export const EmbeddingSchema = z
  .array(z.number())
  .min(1, 'Embedding must have at least 1 dimension');

// Vector search request schemas
export const VectorSearchOptionsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional().default(20),
    threshold: z.number().min(0).max(1).optional().default(0.1),
    model: z.string().min(1).optional().default('simple'),
    nodeTypes: z.array(z.string().min(1)).optional().default([]),
  })
  .strict();

export const VectorSearchRequestSchema = z
  .object({
    query: z.string().min(1, 'Query cannot be empty'),
    ...VectorSearchOptionsSchema.shape,
  })
  .strict();

// Vector search result schemas
export const VectorSearchResultSchema = z
  .object({
    node: z
      .object({
        id: z.string().uuid(),
        type: z.string().min(1),
        label: z.string(),
        properties: z.record(z.unknown()).optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
      })
      .strict(),
    similarity: z.number().min(0).max(1),
  })
  .strict();

// Embedding generation schemas
export const EmbeddingGenerationOptionsSchema = z
  .object({
    model: z.string().min(1).optional().default('simple'),
    nodeIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export const EmbeddingGenerationResultSchema = z
  .object({
    processed: z.number().int().min(0),
    errors: z.number().int().min(0),
  })
  .strict();

// Hybrid similarity search schemas
const HybridSearchOptionsBase = {
  vectorWeight: z.number().min(0).max(1).optional().default(0.6),
  traditionalWeight: z.number().min(0).max(1).optional().default(0.4),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  model: z.string().min(1).optional().default('simple'),
};

export const HybridSearchOptionsSchema = z
  .object(HybridSearchOptionsBase)
  .strict()
  .refine(
    (data) => Math.abs((data.vectorWeight ?? 0.6) + (data.traditionalWeight ?? 0.4) - 1.0) < 0.001,
    {
      message: 'vectorWeight and traditionalWeight must sum to 1.0',
      path: ['vectorWeight', 'traditionalWeight'],
    }
  );

export const HybridSearchRequestSchema = z
  .object({
    type: z.string().min(1),
    label: z.string().min(1),
    properties: z.record(z.unknown()).optional(),
    ...HybridSearchOptionsBase,
  })
  .strict()
  .refine(
    (data) => Math.abs((data.vectorWeight ?? 0.6) + (data.traditionalWeight ?? 0.4) - 1.0) < 0.001,
    {
      message: 'vectorWeight and traditionalWeight must sum to 1.0',
      path: ['vectorWeight', 'traditionalWeight'],
    }
  );

// ========== SMART MERGE SCHEMAS ==========

export const MergeStrategySchema = z.enum(['skip', 'update', 'merge']);

export const SmartNodeMergeOptionsSchema = z
  .object({
    mergeStrategy: MergeStrategySchema.optional().default('merge'),
    similarityThreshold: z.number().min(0).max(1).optional().default(0.8),
    matchFields: z
      .array(z.enum(['type', 'label', 'properties']))
      .optional()
      .default(['type', 'label']),
    useVectorSimilarity: z.boolean().optional().default(true),
    embeddingModel: z.string().min(1).optional().default('simple'),
  })
  .strict();

export const SmartNodeMergeRequestSchema = z
  .object({
    type: z.string().min(1),
    label: z.string().min(1),
    properties: z.record(z.unknown()).optional(),
    ...SmartNodeMergeOptionsSchema.shape,
  })
  .strict();

export const SmartNodeMergeResultSchema = z
  .object({
    node: z
      .object({
        id: z.string().uuid(),
        type: z.string().min(1),
        label: z.string(),
        properties: z.record(z.unknown()).optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
      })
      .strict(),
    action: z.enum(['created', 'merged', 'skipped']),
  })
  .strict();

export const SmartEdgeMergeOptionsSchema = z
  .object({
    mergeStrategy: MergeStrategySchema.optional().default('merge'),
    allowMultipleTypes: z.boolean().optional().default(false),
  })
  .strict();

export const SmartEdgeMergeRequestSchema = z
  .object({
    sourceId: z.string().uuid(),
    targetId: z.string().uuid(),
    type: z.string().min(1),
    properties: z.record(z.unknown()).optional(),
    weight: z.number().min(0).max(1).optional(),
    ...SmartEdgeMergeOptionsSchema.shape,
  })
  .strict();

export const SmartEdgeMergeResultSchema = z
  .object({
    edge: z
      .object({
        id: z.string().uuid(),
        sourceId: z.string().uuid(),
        targetId: z.string().uuid(),
        type: z.string().min(1),
        properties: z.record(z.unknown()).optional(),
        weight: z.number().min(0).max(1).optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
      })
      .strict(),
    action: z.enum(['created', 'merged', 'skipped']),
  })
  .strict();

// ========== CONTEXTUAL INFORMATION SCHEMAS ==========

export const ContextualInfoOptionsSchema = z
  .object({
    includeRelated: z.boolean().optional().default(true),
    relationshipDepth: z.number().int().min(1).max(5).optional().default(2),
    contextTypes: z.array(z.string().min(1)).optional().default([]),
    limit: z.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export const ContextualInfoRequestSchema = z
  .object({
    query: z.string().min(1),
    ...ContextualInfoOptionsSchema.shape,
  })
  .strict();

export const RelatedNodeSchema = z
  .object({
    node: z
      .object({
        id: z.string().uuid(),
        type: z.string().min(1),
        label: z.string(),
        properties: z.record(z.unknown()).optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional(),
      })
      .strict(),
    relationship: z.string().min(1),
    distance: z.number().int().min(1),
  })
  .strict();

export const ContextualInfoSummarySchema = z
  .object({
    totalNodes: z.number().int().min(0),
    nodeTypes: z.record(z.number().int().min(0)),
    keyRelationships: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const ContextualInfoResultSchema = z
  .object({
    directMatches: z.array(VectorSearchResultSchema.shape.node),
    relatedNodes: z.array(RelatedNodeSchema),
    summary: ContextualInfoSummarySchema,
  })
  .strict();

// ========== RICH CONTEXT SCHEMAS ==========

export const RichContextOptionsSchema = z
  .object({
    includeProperties: z.boolean().optional().default(true),
    includeNeighbors: z.boolean().optional().default(true),
    neighborDepth: z.number().int().min(1).max(3).optional().default(1),
    includeMetadata: z.boolean().optional().default(true),
  })
  .strict();

export const RichContextRequestSchema = z
  .object({
    nodeIds: z.array(z.string().uuid()).min(1, 'At least one node ID required'),
    ...RichContextOptionsSchema.shape,
  })
  .strict();

export const NodeMetadataSchema = z
  .object({
    connectionCount: z.number().int().min(0),
    centralityScore: z.number().min(0).max(1),
    lastActivity: z.date().optional(),
  })
  .strict();

export const RichNodeContextSchema = z
  .object({
    node: VectorSearchResultSchema.shape.node,
    neighbors: z
      .array(
        z
          .object({
            node: VectorSearchResultSchema.shape.node,
            edge: z
              .object({
                id: z.string().uuid(),
                sourceId: z.string().uuid(),
                targetId: z.string().uuid(),
                type: z.string().min(1),
                properties: z.record(z.unknown()).optional(),
                weight: z.number().min(0).max(1).optional(),
              })
              .strict(),
            direction: z.enum(['in', 'out']),
          })
          .strict()
      )
      .optional(),
    metadata: NodeMetadataSchema.optional(),
  })
  .strict();

export const NetworkSummarySchema = z
  .object({
    totalConnections: z.number().int().min(0),
    strongestConnections: z.array(
      z
        .object({
          fromId: z.string().uuid(),
          toId: z.string().uuid(),
          weight: z.number().min(0),
          type: z.string().min(1),
        })
        .strict()
    ),
    clusterInfo: z.array(z.string().min(1)),
  })
  .strict();

export const RichContextResultSchema = z
  .object({
    nodes: z.array(RichNodeContextSchema),
    networkSummary: NetworkSummarySchema,
  })
  .strict();

// ========== SIMILARITY ANALYSIS SCHEMAS ==========

export const SimilarityAnalysisRequestSchema = z
  .object({
    nodeIds: z.array(z.string().uuid()).min(2, 'At least 2 nodes required for similarity analysis'),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
  .strict();

export const SimilarityPairSchema = z
  .object({
    node1: z
      .object({
        id: z.string().uuid(),
        label: z.string(),
      })
      .strict(),
    node2: z
      .object({
        id: z.string().uuid(),
        label: z.string(),
      })
      .strict(),
    similarity: z.number().min(0).max(1),
    percentage: z.string().regex(/^\d+\.\d%$/, 'Percentage must be in format XX.X%'),
  })
  .strict();

export const SimilarityAnalysisResultSchema = z
  .object({
    model: z.string().min(1),
    nodeCount: z.number().int().min(2),
    similarities: z.array(SimilarityPairSchema),
  })
  .strict();

// ========== UTILITY VALIDATION FUNCTIONS ==========

export function validateEmbedding(embedding: unknown): number[] {
  return EmbeddingSchema.parse(embedding);
}

export function validateVectorSearchRequest(
  request: unknown
): z.infer<typeof VectorSearchRequestSchema> {
  return VectorSearchRequestSchema.parse(request);
}

export function validateHybridSearchRequest(
  request: unknown
): z.infer<typeof HybridSearchRequestSchema> {
  return HybridSearchRequestSchema.parse(request);
}

export function validateSmartMergeRequest(
  request: unknown
): z.infer<typeof SmartNodeMergeRequestSchema> {
  return SmartNodeMergeRequestSchema.parse(request);
}

export function validateContextualInfoRequest(
  request: unknown
): z.infer<typeof ContextualInfoRequestSchema> {
  return ContextualInfoRequestSchema.parse(request);
}

export function validateRichContextRequest(
  request: unknown
): z.infer<typeof RichContextRequestSchema> {
  return RichContextRequestSchema.parse(request);
}

export function validateSimilarityAnalysisRequest(
  request: unknown
): z.infer<typeof SimilarityAnalysisRequestSchema> {
  return SimilarityAnalysisRequestSchema.parse(request);
}

// ========== TYPE EXPORTS ==========

export type VectorSearchOptions = z.infer<typeof VectorSearchOptionsSchema>;
export type VectorSearchRequest = z.infer<typeof VectorSearchRequestSchema>;
export type VectorSearchResult = z.infer<typeof VectorSearchResultSchema>;
export type EmbeddingGenerationOptions = z.infer<typeof EmbeddingGenerationOptionsSchema>;
export type EmbeddingGenerationResult = z.infer<typeof EmbeddingGenerationResultSchema>;
export type HybridSearchOptions = z.infer<typeof HybridSearchOptionsSchema>;
export type HybridSearchRequest = z.infer<typeof HybridSearchRequestSchema>;
export type SmartNodeMergeOptions = z.infer<typeof SmartNodeMergeOptionsSchema>;
export type SmartNodeMergeRequest = z.infer<typeof SmartNodeMergeRequestSchema>;
export type SmartNodeMergeResult = z.infer<typeof SmartNodeMergeResultSchema>;
export type SmartEdgeMergeOptions = z.infer<typeof SmartEdgeMergeOptionsSchema>;
export type SmartEdgeMergeRequest = z.infer<typeof SmartEdgeMergeRequestSchema>;
export type SmartEdgeMergeResult = z.infer<typeof SmartEdgeMergeResultSchema>;
export type ContextualInfoOptions = z.infer<typeof ContextualInfoOptionsSchema>;
export type ContextualInfoRequest = z.infer<typeof ContextualInfoRequestSchema>;
export type ContextualInfoResult = z.infer<typeof ContextualInfoResultSchema>;
export type RichContextOptions = z.infer<typeof RichContextOptionsSchema>;
export type RichContextRequest = z.infer<typeof RichContextRequestSchema>;
export type RichContextResult = z.infer<typeof RichContextResultSchema>;
export type SimilarityAnalysisRequest = z.infer<typeof SimilarityAnalysisRequestSchema>;
export type SimilarityAnalysisResult = z.infer<typeof SimilarityAnalysisResultSchema>;
