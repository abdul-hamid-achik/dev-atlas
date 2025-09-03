import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { and, desc, eq, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { log } from '../extension';
import { edges, nodes } from './schema';
import type { CreateEdge, CreateNode, Edge, Node, QueryEdges, QueryNodes } from './schema';

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

function findDatabasePath(): string {
  // Check workspace folders first (VS Code specific)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    for (const folder of workspaceFolders) {
      const dbPath = path.join(folder.uri.fsPath, 'knowledge-graph.db');
      if (fs.existsSync(dbPath)) {
        log(`Found database in workspace folder: ${dbPath}`);
        return dbPath;
      }
    }
  }

  // Check for explicit directory from environment variable
  const envDir = process.env.KNOWLEDGE_GRAPH_DIR;
  if (envDir) {
    const envPath = path.resolve(envDir, 'knowledge-graph.db');
    if (fs.existsSync(envPath)) {
      log(`Found database via KNOWLEDGE_GRAPH_DIR: ${envPath}`);
      return envPath;
    }
  }

  // Find project root and check there
  const projectRoot = findProjectRoot();
  const rootDbPath = path.join(projectRoot, 'knowledge-graph.db');
  if (fs.existsSync(rootDbPath)) {
    log(`Found database at project root: ${rootDbPath}`);
    return rootDbPath;
  }

  // Check MCP app location
  const mcpDbPath = path.join(projectRoot, 'apps', 'mcp-knowledge-graph', 'knowledge-graph.db');
  if (fs.existsSync(mcpDbPath)) {
    log(`Found database in MCP app: ${mcpDbPath}`);
    return mcpDbPath;
  }

  // Default fallback - create in project root
  log(`No existing database found, will create at: ${rootDbPath}`, 'warn');
  return rootDbPath;
}

export class KnowledgeGraphDB {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    try {
      this.dbPath = dbPath || findDatabasePath();

      log(`Initializing database at: ${this.dbPath}`);
      log(`Current working directory: ${process.cwd()}`);

      // Create directory if it doesn't exist
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        log(`Created database directory: ${dbDir}`);
      }

      this.sqlite = new Database(this.dbPath);
      this.db = drizzle(this.sqlite);
      this.initializeTables();

      log(`Database initialized successfully at: ${this.dbPath}`);
    } catch (error) {
      log(`Failed to initialize database: ${error}`, 'error');
      throw error;
    }
  }

  private initializeTables() {
    try {
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

      log('Database tables and indexes created successfully');
    } catch (error) {
      log(`Failed to initialize tables: ${error}`, 'error');
      throw error;
    }
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  // Node operations
  async createNode(data: CreateNode): Promise<Node> {
    try {
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

      log(`Created node: ${node.label} (${node.type})`);
      return node;
    } catch (error) {
      log(`Failed to create node: ${error}`, 'error');
      throw error;
    }
  }

  async getNode(id: string): Promise<Node | null> {
    try {
      const result = await this.db.select().from(nodes).where(eq(nodes.id, id)).limit(1);

      if (result.length === 0) return null;

      const node = result[0];
      return {
        id: node.id,
        type: node.type,
        label: node.label,
        properties: node.properties ? JSON.parse(node.properties as string) : {},
        createdAt: node.createdAt ? new Date(node.createdAt * 1000) : undefined,
        updatedAt: node.updatedAt ? new Date(node.updatedAt * 1000) : undefined,
      };
    } catch (error) {
      log(`Failed to get node ${id}: ${error}`, 'error');
      return null;
    }
  }

  async queryNodes(query: QueryNodes = {}): Promise<Node[]> {
    try {
      let sql = 'SELECT * FROM nodes';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (query.type) {
        conditions.push('type = ?');
        params.push(query.type);
      }

      if (query.label) {
        conditions.push('label LIKE ?');
        params.push(`%${query.label}%`);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      sql += ' ORDER BY created_at DESC';

      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);
      }

      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }

      const stmt = this.sqlite.prepare(sql);
      const results = stmt.all(...params);

      return results.map((node: Record<string, unknown>) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        properties: node.properties ? JSON.parse(node.properties) : {},
        createdAt: node.created_at ? new Date(node.created_at * 1000) : undefined,
        updatedAt: node.updated_at ? new Date(node.updated_at * 1000) : undefined,
      }));
    } catch (error) {
      log(`Failed to query nodes: ${error}`, 'error');
      return [];
    }
  }

  // Edge operations
  async createEdge(data: CreateEdge): Promise<Edge> {
    try {
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

      log(`Created edge: ${edge.sourceId} -> ${edge.targetId} (${edge.type})`);
      return edge;
    } catch (error) {
      log(`Failed to create edge: ${error}`, 'error');
      throw error;
    }
  }

  async queryEdges(query: QueryEdges = {}): Promise<Edge[]> {
    try {
      let sql = 'SELECT * FROM edges';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (query.sourceId) {
        conditions.push('source_id = ?');
        params.push(query.sourceId);
      }

      if (query.targetId) {
        conditions.push('target_id = ?');
        params.push(query.targetId);
      }

      if (query.type) {
        conditions.push('type = ?');
        params.push(query.type);
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      sql += ' ORDER BY created_at DESC';

      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);
      }

      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }

      const stmt = this.sqlite.prepare(sql);
      const results = stmt.all(...params);

      return results.map((edge: Record<string, unknown>) => ({
        id: edge.id,
        sourceId: edge.source_id,
        targetId: edge.target_id,
        type: edge.type,
        properties: edge.properties ? JSON.parse(edge.properties) : {},
        weight: edge.weight ?? undefined,
        createdAt: edge.created_at ? new Date(edge.created_at * 1000) : undefined,
        updatedAt: edge.updated_at ? new Date(edge.updated_at * 1000) : undefined,
      }));
    } catch (error) {
      log(`Failed to query edges: ${error}`, 'error');
      return [];
    }
  }

  close() {
    try {
      this.sqlite.close();
      log('Database connection closed');
    } catch (error) {
      log(`Failed to close database: ${error}`, 'error');
    }
  }
}
