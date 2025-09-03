import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { nodes, edges } from './schema.js';
import { eq, and, like, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge, CreateNode, CreateEdge, QueryNodes, QueryEdges } from '../types/schema.js';

export class KnowledgeGraphDB {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;

  constructor(dbPath: string = './knowledge-graph.db') {
    this.sqlite = new Database(dbPath);
    this.db = drizzle(this.sqlite);
    this.initializeTables();
  }

  private initializeTables() {
    // Create tables if they don't exist
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

    // Create indexes for better performance
    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes (type);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes (label);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges (source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges (target_id);
      CREATE INDEX IF NOT EXISTS idx_edges_type ON edges (type);
    `);
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

    await this.db.insert(nodes).values({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: JSON.stringify(node.properties || {}),
    });

    return node;
  }

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

    return results.map(node => ({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: node.properties ? JSON.parse(node.properties as string) : {},
      createdAt: node.createdAt || undefined,
      updatedAt: node.updatedAt || undefined,
    }));
  }

  // Edge operations
  async createEdge(data: CreateEdge): Promise<Edge> {
    const id = uuidv4();
    const edge = {
      id,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(edges).values({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type,
      properties: JSON.stringify(edge.properties || {}),
      weight: edge.weight,
    });

    return edge;
  }

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

    return results.map(edge => ({
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
  async getNeighbors(nodeId: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<{ node: Node; edge: Edge }[]> {
    let results: any[] = [];

    if (direction === 'in' || direction === 'both') {
      const inResults = await this.db
        .select({ node: nodes, edge: edges })
        .from(edges)
        .innerJoin(nodes, eq(edges.sourceId, nodes.id))
        .where(eq(edges.targetId, nodeId));
      results = results.concat(inResults);
    }

    if (direction === 'out' || direction === 'both') {
      const outResults = await this.db
        .select({ node: nodes, edge: edges })
        .from(edges)
        .innerJoin(nodes, eq(edges.targetId, nodes.id))
        .where(eq(edges.sourceId, nodeId));
      results = results.concat(outResults);
    }

    return results.map(result => ({
      node: {
        id: result.node.id,
        type: result.node.type,
        label: result.node.label,
        properties: result.node.properties ? JSON.parse(result.node.properties as string) : {},
        createdAt: result.node.createdAt || undefined,
        updatedAt: result.node.updatedAt || undefined,
      },
      edge: {
        id: result.edge.id,
        sourceId: result.edge.sourceId,
        targetId: result.edge.targetId,
        type: result.edge.type,
        properties: result.edge.properties ? JSON.parse(result.edge.properties as string) : {},
        weight: result.edge.weight || undefined,
        createdAt: result.edge.createdAt || undefined,
        updatedAt: result.edge.updatedAt || undefined,
      },
    }));
  }

  close() {
    this.sqlite.close();
  }
}