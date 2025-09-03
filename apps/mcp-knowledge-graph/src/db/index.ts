import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { and, desc, eq, isNull, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type {
  CreateEdge,
  CreateNode,
  Edge,
  Node,
  QueryEdges,
  QueryNodes,
} from '../types/schema.js';
import { edges, nodes, vectorSearchCache } from './schema.js';
import { 
  EmbeddingProviderFactory, 
  logEmbeddingSetup,
  type EmbeddingResult 
} from '../providers/embedding-providers.js';

// Zod schemas for runtime validation and type safety
const DbNodeResultSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  properties: z.string().nullable(),
  created_at: z.number().nullable(),
  updated_at: z.number().nullable(),
});

const DbEdgeResultSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  target_id: z.string(),
  type: z.string(),
  properties: z.string().nullable(),
  weight: z.number().nullable(),
  created_at: z.number().nullable(),
  updated_at: z.number().nullable(),
});

// Define the interface first to avoid circular reference
interface FileSystemStructure {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  children?: FileSystemStructure[];
}

const FileSystemStructureSchema: z.ZodType<FileSystemStructure> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(['file', 'directory']),
    path: z.string(),
    size: z.number().optional(),
    children: z.array(FileSystemStructureSchema).optional(),
  })
);

const ExtractedFunctionSchema = z.object({
  name: z.string(),
  line: z.number(),
  type: z.string(),
});

const ExtractedClassSchema = z.object({
  name: z.string(),
  line: z.number(),
  type: z.string(),
});

const ExtractedImportSchema = z.object({
  module: z.string(),
  line: z.number(),
  type: z.string(),
});

const DetectedPatternSchema = z.object({
  type: z.string(),
  name: z.string(),
  fileNodes: z.array(z.string()).optional(),
  confidence: z.number(),
});

const ExtractedTodoSchema = z.object({
  type: z.string(),
  text: z.string(),
  filePath: z.string(),
  line: z.number(),
});

const ChangedFileSchema = z.object({
  path: z.string(),
  type: z.string(),
});

const ExtractedCommentSchema = z.object({
  content: z.string(),
  line: z.number(),
  type: z.string(),
});

// Inferred types from schemas
type DbNodeResult = z.infer<typeof DbNodeResultSchema>;
type DbEdgeResult = z.infer<typeof DbEdgeResultSchema>;
// Remove this line since FileSystemStructure is now defined as interface above
type ExtractedFunction = z.infer<typeof ExtractedFunctionSchema>;
type ExtractedClass = z.infer<typeof ExtractedClassSchema>;
type ExtractedImport = z.infer<typeof ExtractedImportSchema>;
type DetectedPattern = z.infer<typeof DetectedPatternSchema>;
type ExtractedTodo = z.infer<typeof ExtractedTodoSchema>;
type ChangedFile = z.infer<typeof ChangedFileSchema>;
type ExtractedComment = z.infer<typeof ExtractedCommentSchema>;

function findProjectRoot(startPath: string = process.cwd()): string {
  let currentPath = path.resolve(startPath);

  while (currentPath !== path.dirname(currentPath)) {
    // Check for project root indicators
    if (fs.existsSync(path.join(currentPath, 'package.json'))) {
      const packageJson = path.join(currentPath, 'package.json');
      try {
        const content = fs.readFileSync(packageJson, 'utf8');
        const pkg = JSON.parse(content);
        // Look for indicators this is the main project root (not a nested package)
        if (
          pkg.workspaces ||
          pkg.name === 'dev-atlas' ||
          fs.existsSync(path.join(currentPath, 'turbo.json'))
        ) {
          return currentPath;
        }
      } catch (e) {
        // Continue searching if we can't read package.json
      }
    }

    currentPath = path.dirname(currentPath);
  }

  // Fallback to current working directory if no project root found
  return process.cwd();
}

/**
 * KnowledgeGraphDB provides a comprehensive interface for managing a knowledge graph
 * stored in SQLite using Drizzle ORM. It supports CRUD operations, advanced search,
 * vector embeddings, code analysis, and graph traversal algorithms.
 */
export class KnowledgeGraphDB {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;
  private vectorExtensionAvailable = false;
  private embeddingFactory: EmbeddingProviderFactory;

  /**
   * Creates a new instance of KnowledgeGraphDB.
   *
   * @param dbPath Optional path to the SQLite database file. If not provided,
   *               will attempt to locate the database using various strategies.
   */
  constructor(dbPath?: string) {
    // Check for explicit directory from environment variable first
    const envDir = process.env.KNOWLEDGE_GRAPH_DIR;
    let targetPath: string;

    if (dbPath) {
      targetPath = dbPath;
    } else if (envDir) {
      targetPath = path.resolve(envDir, 'knowledge-graph.db');
    } else {
      const projectRoot = findProjectRoot();
      targetPath = path.join(projectRoot, 'knowledge-graph.db');
    }

    // Log database initialization info
    console.error(`[KnowledgeGraph] Current working directory: ${process.cwd()}`);
    if (envDir) {
      console.error(`[KnowledgeGraph] Using KNOWLEDGE_GRAPH_DIR: ${envDir}`);
    } else {
      const projectRoot = findProjectRoot();
      console.error(`[KnowledgeGraph] Project root detected: ${projectRoot}`);
    }
    console.error(`[KnowledgeGraph] Database path: ${targetPath}`);

    // Initialize SQLite with proper settings for concurrent access
    this.sqlite = new Database(targetPath, {
      // Enable WAL mode for better concurrent read/write performance
      fileMustExist: false,
      timeout: 30000, // 30 second timeout for database operations
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });

    // Configure SQLite for better concurrency
    this.sqlite.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging
    this.sqlite.pragma('synchronous = NORMAL'); // Balance between safety and performance
    this.sqlite.pragma('cache_size = 1000'); // Increase cache size
    this.sqlite.pragma('temp_store = memory'); // Store temporary data in memory
    this.sqlite.pragma('mmap_size = 268435456'); // Enable memory-mapped I/O (256MB)

    // Set a busy timeout to handle concurrent access
    this.sqlite.pragma('busy_timeout = 30000'); // 30 second busy timeout

    this.db = drizzle(this.sqlite);

    // Initialize tables with retry logic
    this.initializeTablesWithRetry();

    // Initialize embedding providers
    this.embeddingFactory = EmbeddingProviderFactory.getInstance();
    logEmbeddingSetup();

    console.error('[KnowledgeGraph] Database initialized successfully');
  }

  private initializeTablesWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.initializeTables();
        return; // Success, exit retry loop
      } catch (error) {
        console.error(`[KnowledgeGraph] Database initialization attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          throw new Error(
            `Failed to initialize database after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Wait before retrying (synchronous sleep)
        const delay = 2 ** attempt * 1000; // Exponential backoff
        console.error(`[KnowledgeGraph] Retrying database initialization in ${delay}ms...`);

        // Use a synchronous sleep approach
        const start = Date.now();
        while (Date.now() - start < delay) {
          // Busy wait - not ideal but necessary for synchronous constructor
        }
      }
    }
  }

  private initializeTables() {
    // Create base tables if they don't exist
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        properties TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT,
        weight REAL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (source_id) REFERENCES nodes (id),
        FOREIGN KEY (target_id) REFERENCES nodes (id)
      );
    `);

    // Migrate schema to add new vector search columns
    this.migrateToVectorSearch();

    // Create vector search cache table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS vector_search_cache (
        id TEXT PRIMARY KEY,
        query_hash TEXT NOT NULL UNIQUE,
        query_embedding TEXT NOT NULL,
        results TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER
      );
    `);

    // Create indexes for better performance
    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes (type);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes (label);
      CREATE INDEX IF NOT EXISTS idx_nodes_embedding_model ON nodes (embedding_model);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges (source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges (target_id);
      CREATE INDEX IF NOT EXISTS idx_edges_type ON edges (type);
      CREATE INDEX IF NOT EXISTS idx_edges_embedding_model ON edges (embedding_model);
      CREATE INDEX IF NOT EXISTS idx_vector_cache_hash ON vector_search_cache (query_hash);
      CREATE INDEX IF NOT EXISTS idx_vector_cache_model ON vector_search_cache (model);
    `);

    // Try to load vector search extension if available
    this.initializeVectorExtensions();
  }

  // Migrate existing database to support vector search
  private migrateToVectorSearch() {
    try {
      // Check if embedding column exists in nodes table
      const nodesInfo = this.sqlite.prepare('PRAGMA table_info(nodes)').all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: unknown;
        pk: number;
      }>;

      const hasEmbeddingColumn = nodesInfo.some((col) => col.name === 'embedding');
      const hasEmbeddingModelColumn = nodesInfo.some((col) => col.name === 'embedding_model');

      if (!hasEmbeddingColumn) {
        console.error('[KnowledgeGraph] Adding embedding column to nodes table');
        this.sqlite.exec('ALTER TABLE nodes ADD COLUMN embedding TEXT');
      }

      if (!hasEmbeddingModelColumn) {
        console.error('[KnowledgeGraph] Adding embedding_model column to nodes table');
        this.sqlite.exec('ALTER TABLE nodes ADD COLUMN embedding_model TEXT');
      }

      // Check if embedding columns exist in edges table
      const edgesInfo = this.sqlite.prepare('PRAGMA table_info(edges)').all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: unknown;
        pk: number;
      }>;

      const edgeHasEmbeddingColumn = edgesInfo.some((col) => col.name === 'embedding');
      const edgeHasEmbeddingModelColumn = edgesInfo.some((col) => col.name === 'embedding_model');

      if (!edgeHasEmbeddingColumn) {
        console.error('[KnowledgeGraph] Adding embedding column to edges table');
        this.sqlite.exec('ALTER TABLE edges ADD COLUMN embedding TEXT');
      }

      if (!edgeHasEmbeddingModelColumn) {
        console.error('[KnowledgeGraph] Adding embedding_model column to edges table');
        this.sqlite.exec('ALTER TABLE edges ADD COLUMN embedding_model TEXT');
      }

      console.error('[KnowledgeGraph] Vector search schema migration completed successfully');
    } catch (error) {
      console.error('[KnowledgeGraph] Schema migration failed:', error);
      throw new Error(
        `Failed to migrate database schema: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Initialize vector search extensions
  private initializeVectorExtensions() {
    // Note: Vector extensions like sqlite-vec can be added for production use
    // For now, we use the JavaScript implementation which works well for most use cases
    //
    // To add native vector support in the future:
    // 1. Install sqlite-vec or vectorlite extension
    // 2. Uncomment the code below and update the extension loading logic
    //
    // try {
    //   this.sqlite.loadExtension('vec');
    //   console.error('[KnowledgeGraph] Loaded vec extension for vector search');
    //   this.vectorExtensionAvailable = true;
    // } catch (error) {
    //   console.error('[KnowledgeGraph] No vector extension available, using JavaScript implementation');
    //   this.vectorExtensionAvailable = false;
    // }

    this.vectorExtensionAvailable = false;
    console.error('[KnowledgeGraph] Using JavaScript-based vector search implementation');
  }

  // Node operations
  async createNode(data: CreateNode): Promise<Node> {
    const id = uuidv4();
    const node = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use retry wrapper for database write operation
    await this.executeWithRetry(
      () =>
        this.db.insert(nodes).values({
          id: node.id,
          type: node.type,
          label: node.label,
          properties: JSON.stringify(node.properties || {}),
        }),
      'createNode'
    );

    return node;
  }

  // Smart node creation with optional merging (now with local/cloud provider support)
  async createOrMergeNode(
    data: CreateNode,
    options: {
      mergeStrategy?: 'skip' | 'update' | 'merge';
      similarityThreshold?: number;
      matchFields?: ('type' | 'label' | 'properties')[];
      useVectorSimilarity?: boolean;
      embeddingProvider?: string;
      embeddingModel?: string;
    } = {}
  ): Promise<{ node: Node; action: 'created' | 'merged' | 'skipped' }> {
    const {
      mergeStrategy = 'merge',
      similarityThreshold = 0.8,
      matchFields = ['type', 'label'],
      useVectorSimilarity = true,
      embeddingModel,
      embeddingProvider,
    } = options;

    let candidates: Node[] = [];

    // Use hybrid similarity search if vector similarity is enabled
    if (useVectorSimilarity) {
      try {
        candidates = await this.hybridSimilaritySearch(data, {
          threshold: similarityThreshold,
          provider: embeddingProvider,
          model: embeddingModel,
        });
      } catch (error) {
        console.error('[VectorSearch] Hybrid search failed, falling back to traditional:', error);
        candidates = await this.findSimilarNodes(data, matchFields, similarityThreshold);
      }
    } else {
      candidates = await this.findSimilarNodes(data, matchFields, similarityThreshold);
    }

    if (candidates.length === 0) {
      // No similar nodes found, create new one with embedding
      const node = await this.createNode(data);

      // Generate embedding for the new node
      try {
        await this.generateNodeEmbedding(node.id, { 
          provider: embeddingProvider, 
          model: embeddingModel 
        });
      } catch (error) {
        console.error(
          `[VectorSearch] Failed to generate embedding for new node ${node.id}:`,
          error
        );
      }

      return { node, action: 'created' };
    }

    const bestMatch = candidates[0]; // Most similar node

    switch (mergeStrategy) {
      case 'skip':
        return { node: bestMatch, action: 'skipped' };

      case 'update': {
        const updated = await this.updateNode(bestMatch.id, {
          label: data.label,
          properties: data.properties,
        });

        // Regenerate embedding after update
        try {
          await this.generateNodeEmbedding(bestMatch.id, { 
          provider: embeddingProvider, 
          model: embeddingModel 
        });
        } catch (error) {
          console.error(
            `[VectorSearch] Failed to regenerate embedding for updated node ${bestMatch.id}:`,
            error
          );
        }

        if (!updated) throw new Error('Failed to update node');
        return { node: updated, action: 'merged' };
      }
      default: {
        const merged = await this.mergeNodeProperties(bestMatch.id, data);

        // Regenerate embedding after merge
        try {
          await this.generateNodeEmbedding(bestMatch.id, { 
          provider: embeddingProvider, 
          model: embeddingModel 
        });
        } catch (error) {
          console.error(
            `[VectorSearch] Failed to regenerate embedding for merged node ${bestMatch.id}:`,
            error
          );
        }

        return { node: merged, action: 'merged' };
      }
    }
  }

  // Find nodes similar to the provided data
  private async findSimilarNodes(
    data: CreateNode,
    matchFields: ('type' | 'label' | 'properties')[],
    threshold: number
  ): Promise<Node[]> {
    const candidates: Node[] = [];

    // First, get nodes with same type if type matching is enabled
    if (matchFields.includes('type')) {
      const sameTypeNodes = await this.queryNodes({ type: data.type });

      for (const node of sameTypeNodes) {
        let similarity = 0;
        let factors = 0;

        // Type similarity (already matched)
        if (matchFields.includes('type')) {
          similarity += 0.3;
          factors++;
        }

        // Label similarity
        if (matchFields.includes('label')) {
          const labelSim = this.stringSimilarity(data.label, node.label);
          similarity += labelSim * 0.4;
          factors++;
        }

        // Properties similarity
        if (matchFields.includes('properties') && data.properties && node.properties) {
          const propSim = this.objectSimilarity(data.properties, node.properties);
          similarity += propSim * 0.3;
          factors++;
        }

        const normalizedSimilarity = factors > 0 ? similarity / factors : 0;

        if (normalizedSimilarity >= threshold) {
          candidates.push(node);
        }
      }
    }

    // Sort by similarity (most similar first)
    return candidates.sort((a, b) => {
      const simA = this.calculateNodeSimilarity(data, a);
      const simB = this.calculateNodeSimilarity(data, b);
      return simB - simA;
    });
  }

  // Calculate similarity between CreateNode data and existing Node
  private calculateNodeSimilarity(data: CreateNode, node: Node): number {
    let similarity = 0;

    // Type similarity
    if (data.type === node.type) similarity += 0.3;

    // Label similarity
    const labelSim = this.stringSimilarity(data.label, node.label);
    similarity += labelSim * 0.4;

    // Properties similarity
    if (data.properties && node.properties) {
      const propSim = this.objectSimilarity(data.properties, node.properties);
      similarity += propSim * 0.3;
    }

    return Math.min(similarity, 1.0);
  }

  // Merge properties from new data into existing node
  private async mergeNodeProperties(nodeId: string, newData: CreateNode): Promise<Node> {
    const existing = await this.getNode(nodeId);
    if (!existing) throw new Error(`Node ${nodeId} not found`);

    const mergedProperties = this.deepMergeProperties(
      existing.properties || {},
      newData.properties || {}
    );

    const updated = await this.updateNode(nodeId, {
      label: newData.label, // Update label to the newer one
      properties: mergedProperties,
    });

    return updated!;
  }

  // Deep merge two property objects
  private deepMergeProperties(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...existing };

    for (const [key, value] of Object.entries(incoming)) {
      if (key in result) {
        // Handle conflicts
        if (Array.isArray(result[key]) && Array.isArray(value)) {
          // Merge arrays and remove duplicates
          result[key] = [...new Set([...(result[key] as unknown[]), ...value])];
        } else if (
          typeof result[key] === 'object' &&
          typeof value === 'object' &&
          result[key] !== null &&
          value !== null &&
          !Array.isArray(result[key]) &&
          !Array.isArray(value)
        ) {
          // Recursively merge objects
          result[key] = this.deepMergeProperties(
            result[key] as Record<string, unknown>,
            value as Record<string, unknown>
          );
        } else {
          // For primitives, use the incoming value (newer takes precedence)
          result[key] = value;
        }
      } else {
        // New property, just add it
        result[key] = value;
      }
    }

    return result;
  }

    // ========== VECTOR EMBEDDING & SEARCH METHODS ==========

  // Generate text embedding using the configured provider (Ollama local by default)
  private async generateEmbedding(
    text: string, 
    options: { provider?: string; model?: string } = {}
  ): Promise<EmbeddingResult> {
    return await this.embeddingFactory.generateEmbedding(text, options);
  }



  // Calculate cosine similarity between two vectors
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // Generate and store embedding for a node using the configured provider
  async generateNodeEmbedding(
    nodeId: string, 
    options: { provider?: string; model?: string } = {}
  ): Promise<EmbeddingResult> {
    const node = await this.getNode(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    // Create embedding text from node data
    const embeddingText = [node.type, node.label, JSON.stringify(node.properties || {})].join(' ');

    const result = await this.generateEmbedding(embeddingText, options);

    await this.db
      .update(nodes)
      .set({
        embedding: JSON.stringify(result.embedding),
        embeddingModel: `${result.provider}:${result.model}`,
      })
      .where(eq(nodes.id, nodeId));

    return result;
  }

  // Generate and store embedding for an edge using the configured provider
  async generateEdgeEmbedding(
    edgeId: string, 
    options: { provider?: string; model?: string } = {}
  ): Promise<EmbeddingResult> {
    const edge = await this.getEdge(edgeId);
    if (!edge) throw new Error(`Edge ${edgeId} not found`);

    // Get source and target nodes for context
    const sourceNode = await this.getNode(edge.sourceId);
    const targetNode = await this.getNode(edge.targetId);

    // Create embedding text from edge and context
    const embeddingText = [
      edge.type,
      sourceNode?.label || '',
      targetNode?.label || '',
      JSON.stringify(edge.properties || {}),
    ].join(' ');

    const result = await this.generateEmbedding(embeddingText, options);

    await this.db
      .update(edges)
      .set({
        embedding: JSON.stringify(result.embedding),
        embeddingModel: `${result.provider}:${result.model}`,
      })
      .where(eq(edges.id, edgeId));

    return result;
  }

  // Semantic search using vector similarity with configurable provider
  async vectorSearchNodes(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      provider?: string;
      model?: string;
      nodeTypes?: string[];
    } = {}
  ): Promise<Array<{ node: Node; similarity: number }>> {
    const { 
      limit = 20, 
      threshold = 0.1, 
      provider, 
      model, 
      nodeTypes = [] 
    } = options;

    // Generate query embedding using the configured provider
    const queryResult = await this.generateEmbedding(query, { provider, model });
    const queryEmbedding = queryResult.embedding;

    // Get all nodes with embeddings
    let dbQuery = this.db.select().from(nodes);

    if (nodeTypes.length > 0) {
      // For simplicity, filter by first type (could be enhanced for multiple types)
      dbQuery = dbQuery.where(eq(nodes.type, nodeTypes[0]));
    }

    const allNodes = await dbQuery;
    const results: Array<{ node: Node; similarity: number }> = [];

    for (const dbNode of allNodes) {
      if (!dbNode.embedding) continue;

      try {
        const nodeEmbedding = JSON.parse(dbNode.embedding as string);
        const similarity = this.cosineSimilarity(queryEmbedding, nodeEmbedding);

        if (similarity >= threshold) {
          const node: Node = {
            id: dbNode.id,
            type: dbNode.type,
            label: dbNode.label,
            properties: dbNode.properties ? JSON.parse(dbNode.properties as string) : {},
            createdAt: dbNode.createdAt || undefined,
            updatedAt: dbNode.updatedAt || undefined,
          };

          results.push({ node, similarity });
        }
      } catch (error) { }
    }

    // Sort by similarity (highest first) and limit results
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  // Enhanced similarity matching using both traditional and vector similarity
  async hybridSimilaritySearch(
    data: CreateNode,
    options: {
      vectorWeight?: number;
      traditionalWeight?: number;
      threshold?: number;
      provider?: string;
      model?: string;
    } = {}
  ): Promise<Node[]> {
    const {
      vectorWeight = 0.6,
      traditionalWeight = 0.4,
      threshold = 0.7,
      provider,
      model,
    } = options;

    // Get traditional similarity results
    const traditionalResults = await this.findSimilarNodes(
      data,
      ['type', 'label', 'properties'],
      0.1 // Lower threshold for traditional search
    );

    // Generate query embedding using configured provider
    const queryText = [data.type, data.label, JSON.stringify(data.properties || {})].join(' ');
    const queryResult = await this.generateEmbedding(queryText, { provider, model });
    const queryEmbedding = queryResult.embedding;

    // Calculate hybrid similarities
    const hybridResults: Array<{ node: Node; similarity: number }> = [];

    for (const node of traditionalResults) {
      let combinedSimilarity = 0;

      // Traditional similarity
      const traditionalSim = this.calculateNodeSimilarity(data, node);
      combinedSimilarity += traditionalSim * traditionalWeight;

      // Vector similarity (if embedding exists)
      if (node.properties?.embedding) {
        try {
          const nodeEmbedding = JSON.parse(node.properties.embedding as string);
          const vectorSim = this.cosineSimilarity(queryEmbedding, nodeEmbedding);
          combinedSimilarity += vectorSim * vectorWeight;
        } catch (error) {
          // If embedding is invalid, use only traditional similarity
          combinedSimilarity = traditionalSim;
        }
      } else {
        // No embedding available, use only traditional similarity
        combinedSimilarity = traditionalSim;
      }

      if (combinedSimilarity >= threshold) {
        hybridResults.push({ node, similarity: combinedSimilarity });
      }
    }

    // Sort by similarity and return nodes
    return hybridResults.sort((a, b) => b.similarity - a.similarity).map((result) => result.node);
  }

  // Batch generate embeddings for all nodes without embeddings
  async generateMissingEmbeddings(
    options: string | { provider?: string; model?: string } = {}
  ): Promise<{ processed: number; errors: number; provider?: string; model?: string }> {
    let processed = 0;
    let errors = 0;

    // Find nodes without embeddings
    const nodesWithoutEmbeddings = await this.db
      .select()
      .from(nodes)
      .where(isNull(nodes.embedding));

    console.error(
      `[VectorSearch] Generating embeddings for ${nodesWithoutEmbeddings.length} nodes...`
    );

    const embeddingOptions = typeof options === 'string' ? { model: options } : options;
    let usedProvider = '';
    let usedModel = '';

    for (const node of nodesWithoutEmbeddings) {
      try {
        const result = await this.generateNodeEmbedding(node.id, embeddingOptions);
        if (!usedProvider) {
          usedProvider = result.provider;
          usedModel = result.model;
          console.error(`[VectorSearch] Using provider: ${result.provider} with model: ${result.model}`);
        }
        processed++;

        if (processed % 100 === 0) {
          console.error(
            `[VectorSearch] Processed ${processed}/${nodesWithoutEmbeddings.length} nodes`
          );
        }
      } catch (error) {
        console.error(`[VectorSearch] Failed to generate embedding for node ${node.id}:`, error);
        errors++;
      }
    }

    // Find edges without embeddings
    const edgesWithoutEmbeddings = await this.db
      .select()
      .from(edges)
      .where(isNull(edges.embedding));

    console.error(
      `[VectorSearch] Generating embeddings for ${edgesWithoutEmbeddings.length} edges...`
    );

    for (const edge of edgesWithoutEmbeddings) {
      try {
        await this.generateEdgeEmbedding(edge.id, embeddingOptions);
        processed++;

        if (processed % 100 === 0) {
          console.error(`[VectorSearch] Processed ${processed} total embeddings`);
        }
      } catch (error) {
        console.error(`[VectorSearch] Failed to generate embedding for edge ${edge.id}:`, error);
        errors++;
      }
    }

    console.error(
      `[VectorSearch] Embedding generation complete. Processed: ${processed}, Errors: ${errors}`
    );
    return { processed, errors, provider: usedProvider, model: usedModel };
  }

  // Get embedding provider information
  async getEmbeddingProviderInfo(): Promise<Array<{
    name: string;
    available: boolean;
    defaultModel: string;
    supportedModels: string[];
  }>> {
    return await this.embeddingFactory.getProviderInfo();
  }

  /**
   * Retrieves a node by its ID.
   *
   * @param id The unique identifier of the node
   * @returns Promise resolving to the node if found, null otherwise
   */
  async getNode(id: string): Promise<Node | null> {
    const result = await this.db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

    if (result.length === 0) return null;

    const node = result[0];
    return {
      id: node.id,
      type: node.type,
      label: node.label,
      properties: node.properties ? JSON.parse(node.properties as string) : {},
      createdAt: node.createdAt || undefined,
      updatedAt: node.updatedAt || undefined,
    };
  }

  /**
   * Queries nodes based on filtering criteria.
   *
   * @param query Query parameters including optional filters for type, label, limit, and offset
   * @returns Promise resolving to array of matching nodes
   */
  async queryNodes(query: QueryNodes): Promise<Node[]> {
    let dbQuery = this.db.select().from(nodes);

    if (query.type) {
      dbQuery = dbQuery.where(eq(nodes.type, query.type));
    }

    if (query.label) {
      dbQuery = dbQuery.where(like(nodes.label, `%${query.label}%`));
    }

    dbQuery = dbQuery.orderBy(desc(nodes.createdAt));

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    if (query.offset) {
      dbQuery = dbQuery.offset(query.offset);
    }

    const results = await dbQuery;

    return results.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: node.properties ? JSON.parse(node.properties as string) : {},
      createdAt: node.createdAt || undefined,
      updatedAt: node.updatedAt || undefined,
    }));
  }

  // Edge operations
  /**
   * Creates a new edge (relationship) between two nodes in the knowledge graph.
   *
   * @param data The edge data including sourceId, targetId, type, and optional properties/weight
   * @returns Promise resolving to the created edge with generated ID
   * @throws Error if source or target nodes don't exist or if edge creation fails
   */
  async createEdge(data: CreateEdge): Promise<Edge> {
    const id = uuidv4();
    const edge = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use retry wrapper for database write operation
    await this.executeWithRetry(
      () =>
        this.db.insert(edges).values({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          type: edge.type,
          properties: JSON.stringify(edge.properties || {}),
          weight: edge.weight,
        }),
      'createEdge'
    );

    return edge;
  }

  // Smart edge creation with conflict resolution
  async createOrMergeEdge(
    data: CreateEdge,
    options: {
      mergeStrategy?: 'skip' | 'update' | 'merge';
      allowMultipleTypes?: boolean;
    } = {}
  ): Promise<{ edge: Edge; action: 'created' | 'merged' | 'skipped' }> {
    const { mergeStrategy = 'merge', allowMultipleTypes = false } = options;

    // Check for existing edge between same nodes
    const existingEdges = await this.queryEdges({
      sourceId: data.sourceId,
      targetId: data.targetId,
      type: data.type, // Always filter by type initially
    });

    if (existingEdges.length === 0) {
      // No existing edge of this type between these nodes
      if (allowMultipleTypes) {
        // When multiple types are allowed, just create the new edge
        const edge = await this.createEdge(data);
        return { edge, action: 'created' };
      }
      // When multiple types are not allowed, check for any edge between nodes
      const anyExistingEdges = await this.queryEdges({
        sourceId: data.sourceId,
        targetId: data.targetId,
      });

      if (anyExistingEdges.length === 0) {
        // No edge at all, create new one
        const edge = await this.createEdge(data);
        return { edge, action: 'created' };
      }

      // Use first existing edge as best match for merging
      const bestMatch = anyExistingEdges[0];

      switch (mergeStrategy) {
        case 'skip':
          return { edge: bestMatch, action: 'skipped' };

        case 'update': {
          const updated = await this.updateEdge(bestMatch.id, {
            type: data.type,
            properties: data.properties,
            weight: data.weight,
          });
          return { edge: updated!, action: 'merged' };
        }
        default: {
          const merged = await this.mergeEdgeProperties(bestMatch.id, data);
          return { edge: merged, action: 'merged' };
        }
      }
    }

    // Found existing edge of same type - merge based on strategy
    const bestMatch = existingEdges[0];

    switch (mergeStrategy) {
      case 'skip':
        return { edge: bestMatch, action: 'skipped' };

      case 'update': {
        const updated = await this.updateEdge(bestMatch.id, {
          type: data.type,
          properties: data.properties,
          weight: data.weight,
        });
        return { edge: updated!, action: 'merged' };
      }
      default: {
        const merged = await this.mergeEdgeProperties(bestMatch.id, data);
        return { edge: merged, action: 'merged' };
      }
    }
  }

  // Merge properties from new edge data into existing edge
  private async mergeEdgeProperties(edgeId: string, newData: CreateEdge): Promise<Edge> {
    const existing = await this.getEdge(edgeId);
    if (!existing) throw new Error(`Edge ${edgeId} not found`);

    const mergedProperties = this.deepMergeProperties(
      existing.properties || {},
      newData.properties || {}
    );

    // For weight, use the newer value or average if both exist
    let mergedWeight = newData.weight;
    if (existing.weight !== undefined && newData.weight !== undefined) {
      mergedWeight = (existing.weight + newData.weight) / 2;
    } else if (existing.weight !== undefined && newData.weight === undefined) {
      mergedWeight = existing.weight;
    }

    const updated = await this.updateEdge(edgeId, {
      type: newData.type, // Use the newer type
      properties: mergedProperties,
      weight: mergedWeight,
    });

    return updated!;
  }

  /**
   * Retrieves an edge by its ID.
   *
   * @param id The unique identifier of the edge
   * @returns Promise resolving to the edge if found, null otherwise
   */
  async getEdge(id: string): Promise<Edge | null> {
    const result = await this.db.select().from(edges).where(eq(edges.id, id)).limit(1);

    if (result.length === 0) return null;

    const edge = result[0];
    return {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type,
      properties: edge.properties ? JSON.parse(edge.properties as string) : {},
      weight: edge.weight ?? undefined,
      createdAt: edge.createdAt || undefined,
      updatedAt: edge.updatedAt || undefined,
    };
  }

  /**
   * Queries edges based on filtering criteria.
   *
   * @param query Query parameters including optional filters for sourceId, targetId, type, limit, and offset
   * @returns Promise resolving to array of matching edges
   */
  async queryEdges(query: QueryEdges): Promise<Edge[]> {
    let dbQuery = this.db.select().from(edges);

    const conditions = [];
    if (query.sourceId) conditions.push(eq(edges.sourceId, query.sourceId));
    if (query.targetId) conditions.push(eq(edges.targetId, query.targetId));
    if (query.type) conditions.push(eq(edges.type, query.type));

    if (conditions.length > 0) {
      dbQuery = dbQuery.where(and(...conditions));
    }

    dbQuery = dbQuery.orderBy(desc(edges.createdAt));

    if (query.limit) {
      dbQuery = dbQuery.limit(query.limit);
    }

    if (query.offset) {
      dbQuery = dbQuery.offset(query.offset);
    }

    const results = await dbQuery;

    return results.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type,
      properties: edge.properties ? JSON.parse(edge.properties as string) : {},
      weight: edge.weight ?? undefined,
      createdAt: edge.createdAt || undefined,
      updatedAt: edge.updatedAt || undefined,
    }));
  }

  // Graph traversal
  /**
   * Gets neighboring nodes connected to a given node.
   *
   * @param nodeId The ID of the central node
   * @param direction Direction of edges to follow: 'in' (incoming), 'out' (outgoing), or 'both'
   * @returns Promise resolving to array of neighbor nodes with their connecting edges
   */
  async getNeighbors(
    nodeId: string,
    direction: 'in' | 'out' | 'both' = 'both'
  ): Promise<{ node: Node; edge: Edge }[]> {
    let results: { node: Node; edge: Edge }[] = [];

    if (direction === 'in' || direction === 'both') {
      const inResults = await this.db
        .select({ node: nodes, edge: edges })
        .from(edges)
        .innerJoin(nodes, eq(edges.sourceId, nodes.id))
        .where(eq(edges.targetId, nodeId));
      results = results.concat(
        inResults.map((r) => ({
          node: {
            id: r.node.id,
            type: r.node.type,
            label: r.node.label,
            properties: r.node.properties ? JSON.parse(r.node.properties as string) : {},
            createdAt: r.node.createdAt ?? undefined,
            updatedAt: r.node.updatedAt ?? undefined,
          } as Node,
          edge: {
            id: r.edge.id,
            sourceId: r.edge.sourceId,
            targetId: r.edge.targetId,
            type: r.edge.type,
            properties: r.edge.properties ? JSON.parse(r.edge.properties as string) : {},
            weight: r.edge.weight ?? undefined,
            createdAt: r.edge.createdAt ?? undefined,
            updatedAt: r.edge.updatedAt ?? undefined,
          } as Edge,
        }))
      );
    }

    if (direction === 'out' || direction === 'both') {
      const outResults = await this.db
        .select({ node: nodes, edge: edges })
        .from(edges)
        .innerJoin(nodes, eq(edges.targetId, nodes.id))
        .where(eq(edges.sourceId, nodeId));
      results = results.concat(
        outResults.map((r) => ({
          node: {
            id: r.node.id,
            type: r.node.type,
            label: r.node.label,
            properties: r.node.properties ? JSON.parse(r.node.properties as string) : {},
            createdAt: r.node.createdAt ?? undefined,
            updatedAt: r.node.updatedAt ?? undefined,
          } as Node,
          edge: {
            id: r.edge.id,
            sourceId: r.edge.sourceId,
            targetId: r.edge.targetId,
            type: r.edge.type,
            properties: r.edge.properties ? JSON.parse(r.edge.properties as string) : {},
            weight: r.edge.weight ?? undefined,
            createdAt: r.edge.createdAt ?? undefined,
            updatedAt: r.edge.updatedAt ?? undefined,
          } as Edge,
        }))
      );
    }

    return results.map((result) => ({
      node: {
        id: result.node.id,
        type: result.node.type,
        label: result.node.label,
        properties:
          typeof result.node.properties === 'string'
            ? JSON.parse(result.node.properties)
            : (result.node.properties as Record<string, unknown>) || {},
        createdAt: result.node.createdAt || undefined,
        updatedAt: result.node.updatedAt || undefined,
      },
      edge: {
        id: result.edge.id,
        sourceId: result.edge.sourceId,
        targetId: result.edge.targetId,
        type: result.edge.type,
        properties:
          typeof result.edge.properties === 'string'
            ? JSON.parse(result.edge.properties)
            : (result.edge.properties as Record<string, unknown>) || {},
        weight: result.edge.weight || undefined,
        createdAt: result.edge.createdAt || undefined,
        updatedAt: result.edge.updatedAt || undefined,
      },
    }));
  }

  // Update operations
  /**
   * Updates an existing node with new data.
   *
   * @param id The unique identifier of the node to update
   * @param updates Object containing the fields to update (label and/or properties)
   * @returns Promise resolving to the updated node if found, null otherwise
   */
  async updateNode(
    id: string,
    updates: { label?: string; properties?: Record<string, unknown> }
  ): Promise<Node | null> {
    const existing = await this.getNode(id);
    if (!existing) return null;

    const updatedNode = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.db
      .update(nodes)
      .set({
        label: updatedNode.label,
        properties: JSON.stringify(updatedNode.properties || {}),
      })
      .where(eq(nodes.id, id));

    return updatedNode;
  }

  /**
   * Updates an existing edge with new data.
   *
   * @param id The unique identifier of the edge to update
   * @param updates Object containing the fields to update (type, properties, and/or weight)
   * @returns Promise resolving to the updated edge if found, null otherwise
   */
  async updateEdge(
    id: string,
    updates: { type?: string; properties?: Record<string, unknown>; weight?: number }
  ): Promise<Edge | null> {
    const existing = await this.getEdge(id);
    if (!existing) return null;

    const updatedEdge = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await this.db
      .update(edges)
      .set({
        type: updatedEdge.type,
        properties: JSON.stringify(updatedEdge.properties || {}),
        weight: updatedEdge.weight,
      })
      .where(eq(edges.id, id));

    return updatedEdge;
  }

  // Delete operations
  /**
   * Deletes a node and all its connected edges from the knowledge graph.
   *
   * @param id The unique identifier of the node to delete
   * @returns Promise resolving to an object with count of deleted edges, or null if node not found
   */
  async deleteNode(id: string): Promise<{ deletedEdges: number } | null> {
    const node = await this.getNode(id);
    if (!node) return null;

    // First delete all connected edges (where this node is either source or target)
    const deletedEdges1 = await this.db.delete(edges).where(eq(edges.sourceId, id));
    const deletedEdges2 = await this.db.delete(edges).where(eq(edges.targetId, id));

    // Then delete the node
    await this.db.delete(nodes).where(eq(nodes.id, id));

    return { deletedEdges: deletedEdges1.changes + deletedEdges2.changes };
  }

  /**
   * Deletes an edge from the knowledge graph.
   *
   * @param id The unique identifier of the edge to delete
   * @returns Promise resolving to the deleted edge if found, null otherwise
   */
  async deleteEdge(id: string): Promise<Edge | null> {
    const edge = await this.getEdge(id);
    if (!edge) return null;

    await this.db.delete(edges).where(eq(edges.id, id));
    return edge;
  }

  // Bulk operations
  async bulkCreateNodes(nodeData: CreateNode[]): Promise<Node[]> {
    const newNodes: Node[] = nodeData.map((data) => ({
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertData = newNodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: JSON.stringify(node.properties || {}),
    }));

    await this.db.insert(nodes).values(insertData);
    return newNodes;
  }

  async bulkCreateEdges(edgeData: CreateEdge[]): Promise<Edge[]> {
    const newEdges: Edge[] = edgeData.map((data) => ({
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertData = newEdges.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type,
      properties: JSON.stringify(edge.properties || {}),
      weight: edge.weight,
    }));

    await this.db.insert(edges).values(insertData);
    return newEdges;
  }

  // Enhanced context querying for LLM collaboration
  async getContextualInformation(
    query: string,
    options: {
      includeRelated?: boolean;
      relationshipDepth?: number;
      contextTypes?: string[];
      limit?: number;
    } = {}
  ): Promise<{
    directMatches: Node[];
    relatedNodes: { node: Node; relationship: string; distance: number }[];
    summary: {
      totalNodes: number;
      nodeTypes: Record<string, number>;
      keyRelationships: string[];
      confidence: number;
    };
  }> {
    const { includeRelated = true, relationshipDepth = 2, contextTypes = [], limit = 20 } = options;

    // Find direct matches
    const directMatches = await this.searchNodes(query, { limit, types: contextTypes });

    const relatedNodes: { node: Node; relationship: string; distance: number }[] = [];

    if (includeRelated && directMatches.length > 0) {
      // Get related nodes within specified depth
      const visited = new Set<string>();
      const queue = directMatches.map((n) => ({ node: n, distance: 0, relationship: 'direct' }));

      while (queue.length > 0 && relatedNodes.length < limit * 2) {
        const current = queue.shift()!;

        if (visited.has(current.node.id) || current.distance >= relationshipDepth) {
          continue;
        }

        visited.add(current.node.id);

        if (current.distance > 0) {
          relatedNodes.push({
            node: current.node,
            relationship: current.relationship,
            distance: current.distance,
          });
        }

        // Get neighbors
        const neighbors = await this.getNeighbors(current.node.id, 'both');
        for (const { node: neighbor, edge } of neighbors) {
          if (!visited.has(neighbor.id)) {
            queue.push({
              node: neighbor,
              distance: current.distance + 1,
              relationship: edge.type,
            });
          }
        }
      }
    }

    // Generate summary
    const allNodes = [...directMatches, ...relatedNodes.map((r) => r.node)];
    const nodeTypes: Record<string, number> = {};
    const relationships = new Set<string>();

    for (const node of allNodes) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    for (const related of relatedNodes) {
      relationships.add(related.relationship);
    }

    const summary = {
      totalNodes: allNodes.length,
      nodeTypes,
      keyRelationships: Array.from(relationships),
      confidence: directMatches.length / Math.max(limit, 1),
    };

    return {
      directMatches,
      relatedNodes: relatedNodes.slice(0, limit),
      summary,
    };
  }

  // Get rich context around specific nodes (useful for LLM context)
  async getRichNodeContext(
    nodeIds: string[],
    options: {
      includeProperties?: boolean;
      includeNeighbors?: boolean;
      neighborDepth?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<{
    nodes: Array<{
      node: Node;
      neighbors?: Array<{ node: Node; edge: Edge; direction: 'in' | 'out' }>;
      metadata?: {
        connectionCount: number;
        centralityScore: number;
        lastActivity?: Date;
      };
    }>;
    networkSummary: {
      totalConnections: number;
      strongestConnections: Array<{ fromId: string; toId: string; weight: number; type: string }>;
      clusterInfo: string[];
    };
  }> {
    const {
      includeProperties = true,
      includeNeighbors = true,
      neighborDepth = 1,
      includeMetadata = true,
    } = options;

    const results = [];
    const allConnections: Array<{ fromId: string; toId: string; weight: number; type: string }> =
      [];

    for (const nodeId of nodeIds) {
      const node = await this.getNode(nodeId);
      if (!node) continue;

      const nodeResult: any = { node };

      if (includeNeighbors) {
        const neighbors = await this.getNeighbors(nodeId, 'both');
        nodeResult.neighbors = neighbors.map(({ node: n, edge }) => ({
          node: n,
          edge,
          direction: edge.sourceId === nodeId ? 'out' : ('in' as 'in' | 'out'),
        }));

        // Collect connection data
        for (const { edge } of neighbors) {
          allConnections.push({
            fromId: edge.sourceId,
            toId: edge.targetId,
            weight: edge.weight || 1,
            type: edge.type,
          });
        }
      }

      if (includeMetadata) {
        const connectionCount = includeNeighbors
          ? nodeResult.neighbors.length
          : (await this.getNeighbors(nodeId, 'both')).length;

        // Simple centrality score based on connections
        const centralityScore = connectionCount / Math.max(nodeIds.length, 1);

        nodeResult.metadata = {
          connectionCount,
          centralityScore,
          lastActivity: node.updatedAt,
        };
      }

      results.push(nodeResult);
    }

    // Find strongest connections
    const strongestConnections = allConnections.sort((a, b) => b.weight - a.weight).slice(0, 10);

    // Generate cluster info
    const nodeTypeGroups = new Map<string, string[]>();
    for (const result of results) {
      const type = result.node.type;
      if (!nodeTypeGroups.has(type)) {
        nodeTypeGroups.set(type, []);
      }
      nodeTypeGroups.get(type)?.push(result.node.id);
    }

    const clusterInfo = Array.from(nodeTypeGroups.entries()).map(
      ([type, ids]) => `${type}: ${ids.length} nodes`
    );

    return {
      nodes: results,
      networkSummary: {
        totalConnections: allConnections.length,
        strongestConnections,
        clusterInfo,
      },
    };
  }

  // Search operations
  async searchNodes(
    query: string,
    options: { limit?: number; types?: string[] } = {}
  ): Promise<Node[]> {
    let dbQuery = this.db.select().from(nodes);

    // Build search conditions
    const searchPattern = `%${query.toLowerCase()}%`;
    const conditions = [like(nodes.label, searchPattern)];

    // Add type filter if specified
    if (options.types && options.types.length > 0) {
      // For now, we'll use a simple approach - in a real implementation, you might want to use SQL 'IN' clause
      conditions.push(eq(nodes.type, options.types[0])); // Simplified for this example
    }

    // For now, we'll search in label only - in a more advanced implementation,
    // you could also search in properties JSON
    dbQuery = dbQuery.where(like(nodes.label, searchPattern));

    if (options.limit) {
      dbQuery = dbQuery.limit(options.limit);
    }

    const results = await dbQuery;
    return results.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: node.properties ? JSON.parse(node.properties as string) : {},
      createdAt: node.createdAt || undefined,
      updatedAt: node.updatedAt || undefined,
    }));
  }

  // Graph algorithms
  async findPath(fromNodeId: string, toNodeId: string, maxDepth = 6): Promise<Node[] | null> {
    // Simple BFS implementation to find shortest path
    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [
      { nodeId: fromNodeId, path: [fromNodeId] },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const { nodeId, path } = current;

      if (nodeId === toNodeId) {
        // Found target - return the path as Node objects
        const pathNodes: Node[] = [];
        for (const id of path) {
          const node = await this.getNode(id);
          if (node) pathNodes.push(node);
        }
        return pathNodes;
      }

      if (path.length >= maxDepth || visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      // Get neighbors and add to queue
      const neighbors = await this.getNeighbors(nodeId, 'out');
      for (const { node } of neighbors) {
        if (!visited.has(node.id)) {
          queue.push({ nodeId: node.id, path: [...path, node.id] });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Extracts a subgraph centered around specified nodes up to a certain depth.
   *
   * @param centerNodeIds Array of node IDs to use as subgraph centers
   * @param depth Maximum depth to traverse from center nodes (default: 2)
   * @param includeEdgeTypes Optional array of edge types to include in traversal
   * @returns Promise resolving to object containing nodes and edges in the subgraph
   */
  async getSubgraph(
    centerNodeIds: string[],
    depth = 2,
    includeEdgeTypes?: string[]
  ): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const resultNodes: Node[] = [];
    const resultEdges: Edge[] = [];

    // BFS to collect nodes and edges within depth
    const queue: { nodeId: string; currentDepth: number }[] = centerNodeIds.map((id) => ({
      nodeId: id,
      currentDepth: 0,
    }));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const { nodeId, currentDepth } = current;

      if (visitedNodes.has(nodeId) || currentDepth > depth) {
        continue;
      }

      visitedNodes.add(nodeId);

      // Add the node
      const node = await this.getNode(nodeId);
      if (node) {
        resultNodes.push(node);
      }

      if (currentDepth < depth) {
        // Get neighbors and their edges
        const neighbors = await this.getNeighbors(nodeId, 'both');

        for (const { node: neighborNode, edge } of neighbors) {
          // Filter by edge type if specified
          if (includeEdgeTypes && !includeEdgeTypes.includes(edge.type)) {
            continue;
          }

          // Add edge if not already added
          if (!visitedEdges.has(edge.id)) {
            visitedEdges.add(edge.id);
            resultEdges.push(edge);
          }

          // Add neighbor to queue for next level
          if (!visitedNodes.has(neighborNode.id)) {
            queue.push({ nodeId: neighborNode.id, currentDepth: currentDepth + 1 });
          }
        }
      }
    }

    return { nodes: resultNodes, edges: resultEdges };
  }

  // Code analysis tools
  async analyzeFile(
    filePath: string,
    language?: string,
    createNodes = false
  ): Promise<Record<string, unknown> | null> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();

      // Auto-detect language if not provided
      let detectedLanguage = language;
      if (!detectedLanguage) {
        detectedLanguage = this.detectLanguage(ext);
      }

      const analysis = {
        filePath,
        language: detectedLanguage,
        size: content.length,
        lines: content.split('\n').length,
        functions: [] as ExtractedFunction[],
        classes: [] as ExtractedClass[],
        imports: [] as ExtractedImport[],
        exports: [] as ExtractedFunction[],
        comments: [] as ExtractedComment[],
        fileNodeId: undefined as string | undefined,
      };

      // Basic analysis based on file type
      switch (language) {
        case 'javascript':
        case 'typescript':
          analysis.functions = this.extractJSFunctions(content);
          analysis.classes = this.extractJSClasses(content);
          analysis.imports = this.extractJSImports(content);
          analysis.exports = this.extractJSExports(content);
          break;
        case 'python':
          analysis.functions = this.extractPythonFunctions(content);
          analysis.classes = this.extractPythonClasses(content);
          analysis.imports = this.extractPythonImports(content);
          break;
      }

      // Create nodes if requested
      if (createNodes) {
        const fileNode = await this.createNode({
          type: 'File',
          label: path.basename(filePath),
          properties: {
            path: filePath,
            language,
            size: analysis.size,
            lines: analysis.lines,
          },
        });

        analysis.fileNodeId = fileNode.id;

        // Create nodes for functions
        for (const func of analysis.functions) {
          const funcNode = await this.createNode({
            type: 'Function',
            label: func.name,
            properties: {
              ...func,
              filePath,
            },
          });

          // Link function to file
          await this.createEdge({
            sourceId: fileNode.id,
            targetId: funcNode.id,
            type: 'contains',
          });
        }

        // Create nodes for classes
        for (const cls of analysis.classes) {
          const classNode = await this.createNode({
            type: 'Class',
            label: cls.name,
            properties: {
              ...cls,
              filePath,
            },
          });

          // Link class to file
          await this.createEdge({
            sourceId: fileNode.id,
            targetId: classNode.id,
            type: 'contains',
          });
        }
      }

      return analysis;
    } catch (error) {
      throw new Error(
        `Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async extractDependencies(
    filePath: string,
    createNodes = false,
    projectNodeId?: string
  ): Promise<Record<string, unknown> | null> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const filename = path.basename(filePath);
      const dependencies = { dependencies: [] as string[], devDependencies: [] as string[] };

      if (filename === 'package.json') {
        const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        dependencies.dependencies = Object.keys(pkg.dependencies || {});
        dependencies.devDependencies = Object.keys(pkg.devDependencies || {});
      } else if (filename === 'requirements.txt') {
        const content = fs.readFileSync(filePath, 'utf8');
        dependencies.dependencies = content
          .split('\n')
          .filter((line) => line.trim() && !line.startsWith('#'))
          .map((line) => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
      }

      if (createNodes && projectNodeId) {
        // Create nodes for each dependency
        for (const dep of [...dependencies.dependencies, ...dependencies.devDependencies]) {
          const depNode = await this.createNode({
            type: 'Library',
            label: dep,
            properties: {
              source: filename,
              isDev: dependencies.devDependencies.includes(dep),
            },
          });

          // Link project to dependency
          await this.createEdge({
            sourceId: projectNodeId,
            targetId: depNode.id,
            type: 'depends_on',
            properties: {
              isDev: dependencies.devDependencies.includes(dep),
            },
          });
        }
      }

      return dependencies;
    } catch (error) {
      throw new Error(
        `Failed to extract dependencies: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async mapDirectory(
    directoryPath: string,
    maxDepth = 3,
    includeFiles = true,
    createNodes = false
  ): Promise<Record<string, unknown> | null> {
    try {
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }

      const structure = this.buildDirectoryTree(directoryPath, 0, maxDepth, includeFiles);

      if (structure && createNodes) {
        // Create nodes for the directory structure
        await this.createDirectoryNodes(
          structure as FileSystemStructure & Record<string, unknown>,
          null
        );
      }

      return structure as unknown as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        `Failed to map directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getGraphStats(): Promise<Record<string, unknown>> {
    const nodeStats = await this.db.select().from(nodes);
    const edgeStats = await this.db.select().from(edges);

    // Count by type
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};

    for (const node of nodeStats) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    for (const edge of edgeStats) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }

    return {
      totalNodes: nodeStats.length,
      totalEdges: edgeStats.length,
      nodesByType,
      edgesByType,
      avgEdgesPerNode: edgeStats.length / nodeStats.length || 0,
    };
  }

  async exportGraph(
    format: 'json' | 'dot' | 'csv',
    options: { includeNodes?: boolean; includeEdges?: boolean; nodeTypes?: string[] } = {}
  ): Promise<string> {
    const { includeNodes = true, includeEdges = true, nodeTypes } = options;

    let nodes: Node[] = [];
    let edges: Edge[] = [];

    if (includeNodes) {
      if (nodeTypes && nodeTypes.length > 0) {
        // Query each node type separately and combine results
        for (const type of nodeTypes) {
          const typeNodes = await this.queryNodes({ type });
          nodes.push(...typeNodes);
        }
      } else {
        nodes = await this.queryNodes({});
      }
    }

    if (includeEdges) {
      edges = await this.queryEdges({});
    }

    switch (format) {
      case 'json':
        return JSON.stringify({ nodes, edges }, null, 2);

      case 'dot': {
        let dot = 'digraph KnowledgeGraph {\n';
        for (const node of nodes) {
          dot += `  "${node.id}" [label="${node.label}" type="${node.type}"];\n`;
        }
        for (const edge of edges) {
          dot += `  "${edge.sourceId}" -> "${edge.targetId}" [label="${edge.type}"];\n`;
        }
        dot += '}';
        return dot;
      }

      case 'csv': {
        let csv = 'Type,ID,Label,SourceID,TargetID,EdgeType\n';
        for (const node of nodes) {
          csv += `NODE,${node.id},"${node.label}",,,""\n`;
        }
        for (const edge of edges) {
          csv += `EDGE,${edge.id},"",${edge.sourceId},${edge.targetId},${edge.type}\n`;
        }
        return csv;
      }

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Helper methods for code analysis
  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
    };
    return langMap[ext] || 'unknown';
  }

  private extractJSFunctions(content: string): ExtractedFunction[] {
    const functions: ExtractedFunction[] = [];
    const functionRegex =
      /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>|(\w+)\s*:\s*(?:async\s+)?(?:function|\([^)]*\)|\w+)\s*=>)/g;
    let match: RegExpExecArray | null = functionRegex.exec(content);

    while (match !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) {
        functions.push({
          name,
          type: 'function',
          line: content.substring(0, match.index).split('\n').length,
        });
      }
      match = functionRegex.exec(content);
    }

    return functions;
  }

  private extractJSClasses(content: string): ExtractedClass[] {
    const classes: ExtractedClass[] = [];
    const classRegex = /class\s+(\w+)/g;
    let match: RegExpExecArray | null = classRegex.exec(content);

    while (match !== null) {
      classes.push({
        name: match[1],
        type: 'class',
        line: content.substring(0, match.index).split('\n').length,
      });
      match = classRegex.exec(content);
    }

    return classes;
  }

  private extractJSImports(content: string): ExtractedImport[] {
    const imports: ExtractedImport[] = [];
    const importRegex =
      /import\s+(?:{[^}]+}|[^,\s{]+|[^,\s{]+\s*,\s*{[^}]+}|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null = importRegex.exec(content);

    while (match !== null) {
      imports.push({
        module: match[1],
        type: 'import',
        line: content.substring(0, match.index).split('\n').length,
      });
      match = importRegex.exec(content);
    }

    return imports;
  }

  private extractJSExports(content: string): ExtractedFunction[] {
    const exports: Array<{ name: string; line: number; type: string }> = [];
    const exportRegex =
      /export\s+(?:default\s+)?(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g;
    let match: RegExpExecArray | null = exportRegex.exec(content);

    while (match !== null) {
      const name = match[1] || match[2] || match[3] || match[4] || match[5];
      if (name) {
        exports.push({
          name,
          type: 'export',
          line: content.substring(0, match.index).split('\n').length,
        });
      }
      match = exportRegex.exec(content);
    }

    return exports;
  }

  private extractPythonFunctions(content: string): ExtractedFunction[] {
    const functions: ExtractedFunction[] = [];
    const functionRegex = /def\s+(\w+)/g;
    let match: RegExpExecArray | null = functionRegex.exec(content);

    while (match !== null) {
      functions.push({
        name: match[1],
        type: 'function',
        line: content.substring(0, match.index).split('\n').length,
      });
      match = functionRegex.exec(content);
    }

    return functions;
  }

  private extractPythonClasses(content: string): ExtractedClass[] {
    const classes: ExtractedClass[] = [];
    const classRegex = /class\s+(\w+)/g;
    let match: RegExpExecArray | null = classRegex.exec(content);

    while (match !== null) {
      classes.push({
        name: match[1],
        type: 'class',
        line: content.substring(0, match.index).split('\n').length,
      });
      match = classRegex.exec(content);
    }

    return classes;
  }

  private extractPythonImports(
    content: string
  ): Array<{ module: string; line: number; type: string }> {
    const imports: ExtractedImport[] = [];
    const importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
    let match: RegExpExecArray | null = importRegex.exec(content);

    while (match !== null) {
      const module = match[1] || match[2].split(',')[0].trim();
      imports.push({
        module,
        type: 'import',
        line: content.substring(0, match.index).split('\n').length,
      });
      match = importRegex.exec(content);
    }

    return imports;
  }

  private buildDirectoryTree(
    dirPath: string,
    currentDepth: number,
    maxDepth: number,
    includeFiles: boolean
  ): FileSystemStructure | null {
    if (currentDepth > maxDepth) return null;

    const stats = fs.statSync(dirPath);
    const name = path.basename(dirPath);

    if (stats.isDirectory()) {
      const children: FileSystemStructure[] = [];
      try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          if (item.startsWith('.')) continue; // Skip hidden files

          const itemPath = path.join(dirPath, item);
          const itemStats = fs.statSync(itemPath);

          if (itemStats.isDirectory() || includeFiles) {
            const child = this.buildDirectoryTree(
              itemPath,
              currentDepth + 1,
              maxDepth,
              includeFiles
            );
            if (child) children.push(child);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }

      return {
        name,
        type: 'directory',
        path: dirPath,
        children,
      };
    }
    if (includeFiles) {
      return {
        name,
        type: 'file',
        path: dirPath,
        size: stats.size,
      };
    }

    return null;
  }

  private async createDirectoryNodes(
    structure: Record<string, unknown>,
    parentNodeId: string | null
  ): Promise<string> {
    const node = await this.createNode({
      type: structure.type === 'directory' ? 'Directory' : 'File',
      label: structure.name as string,
      properties: {
        path: structure.path,
        ...('size' in structure && structure.size ? { size: structure.size as number } : {}),
      },
    });

    if (parentNodeId) {
      await this.createEdge({
        sourceId: parentNodeId,
        targetId: node.id,
        type: 'contains',
      });
    }

    if (structure.children && Array.isArray(structure.children)) {
      for (const child of structure.children) {
        await this.createDirectoryNodes(child, node.id);
      }
    }

    return node.id;
  }

  // Advanced analysis tools
  async detectPatterns(
    directoryPath: string,
    options: { patternTypes?: string[]; createNodes?: boolean; language?: string } = {}
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const {
        patternTypes = ['design', 'architectural', 'code_smells'],
        createNodes = false,
        language,
      } = options;
      const patterns = [];

      // Walk through directory and analyze files
      const files = this.walkDirectory(directoryPath, 5);

      for (const file of files) {
        if (this.isSourceFile(file)) {
          const content = fs.readFileSync(file, 'utf8');
          const fileLanguage = language || this.detectLanguage(path.extname(file));

          // Detect different pattern types
          if (patternTypes.includes('design')) {
            patterns.push(...this.detectDesignPatterns(file, content, fileLanguage));
          }

          if (patternTypes.includes('architectural')) {
            patterns.push(...this.detectArchitecturalPatterns(file, content, fileLanguage));
          }

          if (patternTypes.includes('code_smells')) {
            patterns.push(...this.detectCodeSmells(file, content, fileLanguage));
          }
        }
      }

      // Create nodes if requested
      if (createNodes) {
        for (const pattern of patterns) {
          const patternNode = await this.createNode({
            type: 'Pattern',
            label: `${pattern.type}: ${pattern.name}`,
            properties: {
              ...pattern,
              detectedAt: new Date().toISOString(),
            },
          });

          // Link to relevant files
          if (pattern.fileNodes) {
            const validatedPattern = DetectedPatternSchema.parse(pattern);
            for (const fileNodeId of validatedPattern.fileNodes || []) {
              await this.createEdge({
                sourceId: fileNodeId,
                targetId: patternNode.id,
                type: 'contains_pattern',
                properties: { confidence: pattern.confidence },
              });
            }
          }
        }
      }

      return patterns;
    } catch (error) {
      throw new Error(
        `Failed to detect patterns: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async extractTodos(
    directoryPath: string,
    options: { includeTypes?: string[]; createNodes?: boolean; assignToFiles?: boolean } = {}
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const {
        includeTypes = ['TODO', 'FIXME', 'HACK', 'NOTE', 'BUG'],
        createNodes = false,
        assignToFiles = true,
      } = options;
      const todos = [];

      const files = this.walkDirectory(directoryPath, 10);

      for (const file of files) {
        if (this.isSourceFile(file)) {
          const content = fs.readFileSync(file, 'utf8');
          const fileTodos = this.extractTodosFromContent(content, file, includeTypes);
          todos.push(...fileTodos);
        }
      }

      // Create nodes if requested
      if (createNodes) {
        for (const todo of todos) {
          const validatedTodo = ExtractedTodoSchema.parse(todo);
          const todoNode = await this.createNode({
            type: 'Todo',
            label: `${validatedTodo.type}: ${validatedTodo.text.substring(0, 50)}...`,
            properties: {
              ...todo,
              extractedAt: new Date().toISOString(),
            },
          });

          // Link to file if requested and file node exists
          if (assignToFiles) {
            const fileNodes = await this.queryNodes({
              type: 'File',
              // Note: This is a simplified search - in reality you'd want more sophisticated matching
            });

            const matchingFile = fileNodes.find((node) => node.properties?.path === todo.filePath);

            if (matchingFile) {
              await this.createEdge({
                sourceId: matchingFile.id,
                targetId: todoNode.id,
                type: 'contains_todo',
                properties: { line: todo.line },
              });
            }
          }
        }
      }

      return todos;
    } catch (error) {
      throw new Error(
        `Failed to extract todos: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private changeMonitors = new Map<string, Record<string, unknown>>();
  private lastSyncTimes = new Map<string, number>();

  async monitorChanges(
    directoryPath: string,
    action: 'start' | 'stop' | 'status' | 'sync',
    options: { includePatterns?: string[]; excludePatterns?: string[] } = {}
  ): Promise<Record<string, unknown> | null> {
    try {
      const {
        includePatterns = ['**/*.js', '**/*.ts', '**/*.py', '**/*.java'],
        excludePatterns = ['**/node_modules/**', '**/dist/**', '**/*.log'],
      } = options;

      switch (action) {
        case 'start':
          if (this.changeMonitors.has(directoryPath)) {
            return { status: 'already_monitoring', directory: directoryPath };
          }

          // In a real implementation, you'd use fs.watch or a library like chokidar
          // For now, we'll store the monitoring configuration
          this.changeMonitors.set(directoryPath, {
            startTime: Date.now(),
            includePatterns,
            excludePatterns,
            status: 'active',
          });

          this.lastSyncTimes.set(directoryPath, Date.now());

          return {
            status: 'monitoring_started',
            directory: directoryPath,
            patterns: { include: includePatterns, exclude: excludePatterns },
          };

        case 'stop':
          if (!this.changeMonitors.has(directoryPath)) {
            return { status: 'not_monitoring', directory: directoryPath };
          }

          this.changeMonitors.delete(directoryPath);
          this.lastSyncTimes.delete(directoryPath);

          return { status: 'monitoring_stopped', directory: directoryPath };

        case 'status': {
          const monitor = this.changeMonitors.get(directoryPath);
          return {
            isMonitoring: !!monitor,
            directory: directoryPath,
            ...(monitor && {
              startTime: monitor.startTime,
              lastSync: this.lastSyncTimes.get(directoryPath),
              patterns: { include: monitor.includePatterns, exclude: monitor.excludePatterns },
            }),
          };
        }

        case 'sync': {
          // Detect changes since last sync and update graph
          const lastSync = this.lastSyncTimes.get(directoryPath) || 0;
          const changedFiles = this.detectChangedFiles(
            directoryPath,
            lastSync,
            includePatterns,
            excludePatterns
          );

          let processed = 0;
          for (const file of changedFiles) {
            try {
              // Re-analyze changed file
              const validatedFile = ChangedFileSchema.parse(file);
              await this.analyzeFile(validatedFile.path, undefined, true);
              processed++;
            } catch (err) {
              console.error(`Failed to re-analyze ${file.path}:`, err);
            }
          }

          this.lastSyncTimes.set(directoryPath, Date.now());

          return {
            status: 'sync_completed',
            directory: directoryPath,
            filesChanged: changedFiles.length,
            filesProcessed: processed,
          };
        }

        default:
          throw new Error(`Unknown monitor action: ${action}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to monitor changes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async semanticAnalysis(
    nodeIds: string[],
    analysisType: 'similarity' | 'clustering' | 'naming' | 'usage_patterns',
    options: { createRelationships?: boolean; threshold?: number } = {}
  ): Promise<Record<string, unknown> | null> {
    try {
      const { createRelationships = false, threshold = 0.7 } = options;

      // Get nodes for analysis
      const nodes = [];
      for (const id of nodeIds) {
        const node = await this.getNode(id);
        if (node) nodes.push(node);
      }

      if (nodes.length === 0) {
        return { error: 'No valid nodes found for analysis' };
      }

      let results: Record<string, unknown> = {};

      switch (analysisType) {
        case 'similarity':
          results = (await this.analyzeSimilarity(nodes, threshold, createRelationships)) || {};
          break;

        case 'clustering':
          results = (await this.analyzeClustering(nodes, createRelationships)) || {};
          break;

        case 'naming':
          results = (await this.analyzeNaming(nodes)) || {};
          break;

        case 'usage_patterns':
          results = (await this.analyzeUsagePatterns(nodes, createRelationships)) || {};
          break;
      }

      return {
        analysisType,
        nodeCount: nodes.length,
        threshold,
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed semantic analysis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Helper methods for pattern detection
  private detectDesignPatterns(
    filePath: string,
    content: string,
    language: string
  ): Array<Record<string, unknown>> {
    const patterns = [];

    // Singleton pattern detection
    if (
      content.includes('getInstance') &&
      (content.includes('private constructor') || content.includes('private static'))
    ) {
      patterns.push({
        type: 'Design Pattern',
        name: 'Singleton',
        filePath,
        confidence: 0.8,
        line: this.findPatternLine(content, 'getInstance'),
        description: 'Singleton pattern implementation detected',
      });
    }

    // Observer pattern detection
    if (
      content.includes('addListener') ||
      content.includes('addEventListener') ||
      content.includes('subscribe')
    ) {
      patterns.push({
        type: 'Design Pattern',
        name: 'Observer',
        filePath,
        confidence: 0.7,
        line: this.findPatternLine(content, 'addListener|addEventListener|subscribe'),
        description: 'Observer pattern usage detected',
      });
    }

    // Factory pattern detection
    if (
      content.includes('createInstance') ||
      content.includes('factory') ||
      content.includes('Factory')
    ) {
      patterns.push({
        type: 'Design Pattern',
        name: 'Factory',
        filePath,
        confidence: 0.75,
        line: this.findPatternLine(content, 'createInstance|factory|Factory'),
        description: 'Factory pattern implementation detected',
      });
    }

    return patterns;
  }

  private detectArchitecturalPatterns(
    filePath: string,
    content: string,
    language: string
  ): Array<Record<string, unknown>> {
    const patterns = [];

    // MVC pattern detection
    if (filePath.includes('/controllers/') || filePath.includes('Controller.')) {
      patterns.push({
        type: 'Architectural Pattern',
        name: 'MVC - Controller',
        filePath,
        confidence: 0.9,
        description: 'MVC Controller component detected',
      });
    }

    if (filePath.includes('/models/') || filePath.includes('Model.')) {
      patterns.push({
        type: 'Architectural Pattern',
        name: 'MVC - Model',
        filePath,
        confidence: 0.9,
        description: 'MVC Model component detected',
      });
    }

    if (
      filePath.includes('/views/') ||
      filePath.includes('View.') ||
      filePath.includes('.vue') ||
      filePath.includes('.jsx')
    ) {
      patterns.push({
        type: 'Architectural Pattern',
        name: 'MVC - View',
        filePath,
        confidence: 0.8,
        description: 'MVC View component detected',
      });
    }

    // Microservice patterns
    if (content.includes('express') && content.includes('app.listen')) {
      patterns.push({
        type: 'Architectural Pattern',
        name: 'Microservice',
        filePath,
        confidence: 0.8,
        line: this.findPatternLine(content, 'app.listen'),
        description: 'Microservice endpoint detected',
      });
    }

    return patterns;
  }

  private detectCodeSmells(
    filePath: string,
    content: string,
    language: string
  ): Array<Record<string, unknown>> {
    const smells = [];
    const lines = content.split('\n');

    // Long method detection
    const functions = this.extractJSFunctions(content);
    for (const func of functions) {
      const funcContent = this.extractFunctionContent(content, func.line);
      if (funcContent.split('\n').length > 50) {
        smells.push({
          type: 'Code Smell',
          name: 'Long Method',
          filePath,
          confidence: 0.8,
          line: func.line,
          description: `Method ${func.name} is too long (${funcContent.split('\n').length} lines)`,
        });
      }
    }

    // Large file detection
    if (lines.length > 500) {
      smells.push({
        type: 'Code Smell',
        name: 'Large File',
        filePath,
        confidence: 0.7,
        description: `File is very large (${lines.length} lines)`,
      });
    }

    // TODO comments as potential technical debt
    const todoRegex = /\/\/\s*(TODO|FIXME|HACK)/gi;
    let match: RegExpExecArray | null;
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      match = todoRegex.exec(line);
      if (match !== null) {
        smells.push({
          type: 'Code Smell',
          name: 'Technical Debt',
          filePath,
          confidence: 0.6,
          line: lineNum,
          description: `TODO/FIXME comment indicates unfinished work: ${line.trim()}`,
        });
      }
    }

    return smells;
  }

  private extractTodosFromContent(
    content: string,
    filePath: string,
    includeTypes: string[]
  ): Array<Record<string, unknown>> {
    const todos = [];
    const lines = content.split('\n');

    const todoRegex = new RegExp(
      `(?://|#|<!--)\\s*(${includeTypes.join('|')})(?:\\s*:)?\\s*(.*)`,
      'gi'
    );

    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const match = todoRegex.exec(line);
      if (match) {
        todos.push({
          type: match[1].toUpperCase(),
          text: match[2].trim(),
          filePath,
          line: lineNum,
          fullLine: line.trim(),
          extractedAt: new Date().toISOString(),
        });
      }
    }

    return todos;
  }

  private detectChangedFiles(
    directoryPath: string,
    sinceTime: number,
    includePatterns: string[],
    excludePatterns: string[]
  ): Array<Record<string, unknown>> {
    const changedFiles = [];

    try {
      const files = this.walkDirectory(directoryPath, 10);

      for (const file of files) {
        try {
          const stats = fs.statSync(file);
          if (stats.mtimeMs > sinceTime) {
            // Check if file matches patterns
            if (
              this.matchesPatterns(file, includePatterns) &&
              !this.matchesPatterns(file, excludePatterns)
            ) {
              changedFiles.push({
                path: file,
                lastModified: stats.mtimeMs,
                size: stats.size,
              });
            }
          }
        } catch (err) {
          // Skip files we can't access
        }
      }
    } catch (error) {
      console.error('Error detecting changed files:', error);
    }

    return changedFiles;
  }

  // Semantic analysis helper methods
  private async analyzeSimilarity(
    nodes: Node[],
    threshold: number,
    createRelationships: boolean
  ): Promise<Record<string, unknown> | null> {
    const similarities = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = this.calculateSimilarity(nodes[i], nodes[j]);
        if (similarity >= threshold) {
          similarities.push({
            node1: nodes[i].id,
            node2: nodes[j].id,
            similarity,
            reasons: this.getSimilarityReasons(nodes[i], nodes[j]),
          });

          if (createRelationships) {
            await this.createEdge({
              sourceId: nodes[i].id,
              targetId: nodes[j].id,
              type: 'similar_to',
              weight: similarity,
              properties: { confidence: similarity },
            });
          }
        }
      }
    }

    return { similarities, threshold };
  }

  private async analyzeClustering(
    nodes: Node[],
    createRelationships: boolean
  ): Promise<Record<string, unknown> | null> {
    // Simple clustering by type and properties
    const clusters = new Map<string, Node[]>();

    for (const node of nodes) {
      const clusterKey = `${node.type}_${node.properties?.category || 'default'}`;
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)?.push(node);
    }

    const results = Array.from(clusters.entries()).map(([key, nodeList]) => ({
      cluster: key,
      nodes: nodeList.map((n) => n.id),
      size: nodeList.length,
    }));

    return { clusters: results };
  }

  private async analyzeNaming(nodes: Node[]): Promise<Record<string, unknown> | null> {
    const namingPatterns = {
      camelCase: 0,
      snake_case: 0,
      PascalCase: 0,
      'kebab-case': 0,
      inconsistent: [] as Array<Record<string, unknown>>,
    };

    for (const node of nodes) {
      const label = node.label;
      if (/^[a-z][a-zA-Z0-9]*$/.test(label)) {
        namingPatterns.camelCase++;
      } else if (/^[a-z][a-z0-9_]*$/.test(label)) {
        namingPatterns.snake_case++;
      } else if (/^[A-Z][a-zA-Z0-9]*$/.test(label)) {
        namingPatterns.PascalCase++;
      } else if (/^[a-z][a-z0-9-]*$/.test(label)) {
        namingPatterns['kebab-case']++;
      } else {
        namingPatterns.inconsistent.push({
          nodeId: node.id,
          label: label,
          suggestion: this.suggestNamingImprovement(label),
        });
      }
    }

    return namingPatterns;
  }

  private async analyzeUsagePatterns(
    nodes: Node[],
    createRelationships: boolean
  ): Promise<Record<string, unknown> | null> {
    const patterns = {
      highlyConnected: [] as Array<Record<string, unknown>>,
      isolated: [] as string[],
      hubs: [] as Array<Record<string, unknown>>,
    };

    for (const node of nodes) {
      const neighbors = await this.getNeighbors(node.id, 'both');
      const connectionCount = neighbors.length;

      if (connectionCount === 0) {
        patterns.isolated.push(node.id);
      } else if (connectionCount > 10) {
        patterns.highlyConnected.push({ nodeId: node.id, connections: connectionCount });
      } else if (connectionCount > 5) {
        patterns.hubs.push({ nodeId: node.id, connections: connectionCount });
      }
    }

    return patterns;
  }

  // Utility helper methods
  private walkDirectory(dir: string, maxDepth: number, currentDepth = 0): string[] {
    if (currentDepth > maxDepth) return [];

    const files: string[] = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.')) continue;

        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          files.push(...this.walkDirectory(fullPath, maxDepth, currentDepth + 1));
        } else if (stats.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }

    return files;
  }

  private isSourceFile(filePath: string): boolean {
    const sourceExts = [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.cs',
      '.php',
      '.rb',
      '.go',
      '.rs',
    ];
    return sourceExts.includes(path.extname(filePath).toLowerCase());
  }

  private findPatternLine(content: string, pattern: string): number {
    const regex = new RegExp(pattern, 'i');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        return i + 1;
      }
    }
    return 1;
  }

  private extractFunctionContent(content: string, startLine: number): string {
    const lines = content.split('\n');
    let braceCount = 0;
    let functionContent = '';
    let started = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      functionContent += `${line}\n`;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        break;
      }
    }

    return functionContent;
  }

  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      // Simple glob matching - in production you'd use a proper glob library
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      return regex.test(filePath);
    });
  }

  private calculateSimilarity(node1: Node, node2: Node): number {
    let similarity = 0;

    // Type similarity
    if (node1.type === node2.type) similarity += 0.3;

    // Label similarity (simple Levenshtein-based)
    const labelSim = this.stringSimilarity(node1.label, node2.label);
    similarity += labelSim * 0.4;

    // Properties similarity
    if (node1.properties && node2.properties) {
      const propSim = this.objectSimilarity(node1.properties, node2.properties);
      similarity += propSim * 0.3;
    }

    return Math.min(similarity, 1.0);
  }

  private getSimilarityReasons(node1: Node, node2: Node): string[] {
    const reasons = [];

    if (node1.type === node2.type) {
      reasons.push('Same node type');
    }

    if (this.stringSimilarity(node1.label, node2.label) > 0.6) {
      reasons.push('Similar names');
    }

    return reasons;
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private objectSimilarity(obj1: Record<string, unknown>, obj2: Record<string, unknown>): number {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    const allKeys = new Set([...keys1, ...keys2]);

    let matches = 0;
    for (const key of allKeys) {
      if (obj1[key] === obj2[key]) {
        matches++;
      }
    }

    return allKeys.size > 0 ? matches / allKeys.size : 0;
  }

  private suggestNamingImprovement(name: string): string {
    // Simple naming suggestions
    if (name.includes('_') && name.includes('-')) {
      return 'Use consistent separator (either _ or -)';
    }
    if (/[A-Z].*[A-Z]/.test(name) && name.includes('_')) {
      return 'Use either camelCase or snake_case consistently';
    }
    return 'Consider using a consistent naming convention';
  }

  // Database operation wrapper with retry logic for write operations
  private executeWithRetry<T>(operation: () => T, operationName: string, maxRetries = 3): T {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return operation();
      } catch (error: unknown) {
        const errorMessage = (error as Error)?.message || String(error);

        // Check if it's a database busy/locked error
        if (
          errorMessage.includes('database is locked') ||
          errorMessage.includes('readonly database') ||
          errorMessage.includes('SQLITE_BUSY')
        ) {
          console.error(
            `[KnowledgeGraph] ${operationName} attempt ${attempt} failed (database busy):`,
            errorMessage
          );

          if (attempt === maxRetries) {
            throw new Error(
              `${operationName} failed after ${maxRetries} attempts due to database lock: ${errorMessage}`
            );
          }

          // Wait before retrying with exponential backoff
          const delay = 2 ** attempt * 500; // Start with 1s, then 2s, then 4s
          console.error(`[KnowledgeGraph] Retrying ${operationName} in ${delay}ms...`);

          const start = Date.now();
          while (Date.now() - start < delay) {
            // Synchronous wait
          }
        } else {
          // For non-lock errors, don't retry
          throw error;
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error(`Unexpected error in executeWithRetry for ${operationName}`);
  }

  close() {
    try {
      // Clean up any active monitors
      this.changeMonitors.clear();
      this.lastSyncTimes.clear();

      // Close the database connection gracefully
      if (this.sqlite) {
        console.error('[KnowledgeGraph] Closing database connection...');
        this.sqlite.close();
        console.error('[KnowledgeGraph] Database connection closed successfully');
      }
    } catch (error) {
      console.error('[KnowledgeGraph] Error closing database:', error);
    }
  }

  // Expose sqlite for testing (only for test environment)
  getSqliteForTesting(): Database.Database {
    if (process.env.NODE_ENV === 'test') {
      return this.sqlite;
    }
    throw new Error('SQLite access only available in test environment');
  }
}
