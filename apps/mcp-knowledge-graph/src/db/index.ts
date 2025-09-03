import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { nodes, edges } from './schema.js';
import { eq, and, like, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import type { Node, Edge, CreateNode, CreateEdge, QueryNodes, QueryEdges } from '../types/schema.js';

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
        if (pkg.workspaces || pkg.name === 'dev-atlas' || fs.existsSync(path.join(currentPath, 'turbo.json'))) {
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

export class KnowledgeGraphDB {
  private db: ReturnType<typeof drizzle>;
  private sqlite: Database.Database;

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

    this.sqlite = new Database(targetPath);
    this.db = drizzle(this.sqlite);
    this.initializeTables();

    console.error(`[KnowledgeGraph] Database initialized successfully`);
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

  // Update operations
  async updateNode(id: string, updates: { label?: string; properties?: any }): Promise<Node | null> {
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

  async updateEdge(id: string, updates: { type?: string; properties?: any; weight?: number }): Promise<Edge | null> {
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

  async deleteEdge(id: string): Promise<Edge | null> {
    const edge = await this.getEdge(id);
    if (!edge) return null;

    await this.db.delete(edges).where(eq(edges.id, id));
    return edge;
  }

  // Bulk operations
  async bulkCreateNodes(nodeData: CreateNode[]): Promise<Node[]> {
    const newNodes: Node[] = nodeData.map(data => ({
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertData = newNodes.map(node => ({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: JSON.stringify(node.properties || {}),
    }));

    await this.db.insert(nodes).values(insertData);
    return newNodes;
  }

  async bulkCreateEdges(edgeData: CreateEdge[]): Promise<Edge[]> {
    const newEdges: Edge[] = edgeData.map(data => ({
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertData = newEdges.map(edge => ({
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

  // Search operations
  async searchNodes(query: string, options: { limit?: number; types?: string[] } = {}): Promise<Node[]> {
    let dbQuery = this.db.select().from(nodes);

    // Build search conditions
    const searchPattern = `%${query.toLowerCase()}%`;
    const conditions = [
      like(nodes.label, searchPattern),
    ];

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
    return results.map(node => ({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: node.properties ? JSON.parse(node.properties as string) : {},
      createdAt: node.createdAt || undefined,
      updatedAt: node.updatedAt || undefined,
    }));
  }

  // Graph algorithms
  async findPath(fromNodeId: string, toNodeId: string, maxDepth: number = 6): Promise<Node[] | null> {
    // Simple BFS implementation to find shortest path
    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: fromNodeId, path: [fromNodeId] }];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

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

  async getSubgraph(centerNodeIds: string[], depth: number = 2, includeEdgeTypes?: string[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const resultNodes: Node[] = [];
    const resultEdges: Edge[] = [];

    // BFS to collect nodes and edges within depth
    const queue: { nodeId: string; currentDepth: number }[] = centerNodeIds.map(id => ({ nodeId: id, currentDepth: 0 }));

    while (queue.length > 0) {
      const { nodeId, currentDepth } = queue.shift()!;

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
  async analyzeFile(filePath: string, language?: string, createNodes: boolean = false): Promise<any> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();

      // Auto-detect language if not provided
      if (!language) {
        language = this.detectLanguage(ext);
      }

      const analysis = {
        filePath,
        language,
        size: content.length,
        lines: content.split('\n').length,
        functions: [] as any[],
        classes: [] as any[],
        imports: [] as any[],
        exports: [] as any[],
        comments: [] as any[],
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
      throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async extractDependencies(filePath: string, createNodes: boolean = false, projectNodeId?: string): Promise<any> {
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
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
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
      throw new Error(`Failed to extract dependencies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async mapDirectory(directoryPath: string, maxDepth: number = 3, includeFiles: boolean = true, createNodes: boolean = false): Promise<any> {
    try {
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }

      const structure = this.buildDirectoryTree(directoryPath, 0, maxDepth, includeFiles);

      if (createNodes) {
        // Create nodes for the directory structure
        await this.createDirectoryNodes(structure, null);
      }

      return structure;
    } catch (error) {
      throw new Error(`Failed to map directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getGraphStats(): Promise<any> {
    const nodeStats = await this.db.select().from(nodes);
    const edgeStats = await this.db.select().from(edges);

    // Count by type
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};

    nodeStats.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });

    edgeStats.forEach(edge => {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    });

    return {
      totalNodes: nodeStats.length,
      totalEdges: edgeStats.length,
      nodesByType,
      edgesByType,
      avgEdgesPerNode: edgeStats.length / nodeStats.length || 0,
    };
  }

  async exportGraph(format: 'json' | 'dot' | 'csv', options: { includeNodes?: boolean; includeEdges?: boolean; nodeTypes?: string[] } = {}): Promise<string> {
    const { includeNodes = true, includeEdges = true, nodeTypes } = options;

    let nodes: any[] = [];
    let edges: any[] = [];

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

      case 'dot':
        let dot = 'digraph KnowledgeGraph {\n';
        nodes.forEach(node => {
          dot += `  "${node.id}" [label="${node.label}" type="${node.type}"];\n`;
        });
        edges.forEach(edge => {
          dot += `  "${edge.sourceId}" -> "${edge.targetId}" [label="${edge.type}"];\n`;
        });
        dot += '}';
        return dot;

      case 'csv':
        let csv = 'Type,ID,Label,SourceID,TargetID,EdgeType\n';
        nodes.forEach(node => {
          csv += `NODE,${node.id},"${node.label}",,,""\n`;
        });
        edges.forEach(edge => {
          csv += `EDGE,${edge.id},"",${edge.sourceId},${edge.targetId},${edge.type}\n`;
        });
        return csv;

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

  private extractJSFunctions(content: string): any[] {
    const functions = [];
    const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>|(\w+)\s*:\s*(?:async\s+)?(?:function|\([^)]*\)|\w+)\s*=>)/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) {
        functions.push({
          name,
          type: 'function',
          line: content.substring(0, match.index).split('\n').length,
        });
      }
    }

    return functions;
  }

  private extractJSClasses(content: string): any[] {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        type: 'class',
        line: content.substring(0, match.index).split('\n').length,
      });
    }

    return classes;
  }

  private extractJSImports(content: string): any[] {
    const imports = [];
    const importRegex = /import\s+(?:{[^}]+}|[^,\s{]+|[^,\s{]+\s*,\s*{[^}]+}|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        module: match[1],
        type: 'import',
        line: content.substring(0, match.index).split('\n').length,
      });
    }

    return imports;
  }

  private extractJSExports(content: string): any[] {
    const exports = [];
    const exportRegex = /export\s+(?:default\s+)?(?:function\s+(\w+)|class\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3] || match[4] || match[5];
      if (name) {
        exports.push({
          name,
          type: 'export',
          line: content.substring(0, match.index).split('\n').length,
        });
      }
    }

    return exports;
  }

  private extractPythonFunctions(content: string): any[] {
    const functions = [];
    const functionRegex = /def\s+(\w+)/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      functions.push({
        name: match[1],
        type: 'function',
        line: content.substring(0, match.index).split('\n').length,
      });
    }

    return functions;
  }

  private extractPythonClasses(content: string): any[] {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        type: 'class',
        line: content.substring(0, match.index).split('\n').length,
      });
    }

    return classes;
  }

  private extractPythonImports(content: string): any[] {
    const imports = [];
    const importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const module = match[1] || match[2].split(',')[0].trim();
      imports.push({
        module,
        type: 'import',
        line: content.substring(0, match.index).split('\n').length,
      });
    }

    return imports;
  }

  private buildDirectoryTree(dirPath: string, currentDepth: number, maxDepth: number, includeFiles: boolean): any {
    if (currentDepth > maxDepth) return null;

    const stats = fs.statSync(dirPath);
    const name = path.basename(dirPath);

    if (stats.isDirectory()) {
      const children = [];
      try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          if (item.startsWith('.')) continue; // Skip hidden files

          const itemPath = path.join(dirPath, item);
          const itemStats = fs.statSync(itemPath);

          if (itemStats.isDirectory() || includeFiles) {
            const child = this.buildDirectoryTree(itemPath, currentDepth + 1, maxDepth, includeFiles);
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
    } else if (includeFiles) {
      return {
        name,
        type: 'file',
        path: dirPath,
        size: stats.size,
      };
    }

    return null;
  }

  private async createDirectoryNodes(structure: any, parentNodeId: string | null): Promise<string> {
    const node = await this.createNode({
      type: structure.type === 'directory' ? 'Directory' : 'File',
      label: structure.name,
      properties: {
        path: structure.path,
        ...(structure.size && { size: structure.size }),
      },
    });

    if (parentNodeId) {
      await this.createEdge({
        sourceId: parentNodeId,
        targetId: node.id,
        type: 'contains',
      });
    }

    if (structure.children) {
      for (const child of structure.children) {
        await this.createDirectoryNodes(child, node.id);
      }
    }

    return node.id;
  }

  // Advanced analysis tools
  async detectPatterns(directoryPath: string, options: { patternTypes?: string[]; createNodes?: boolean; language?: string } = {}): Promise<any[]> {
    try {
      const { patternTypes = ['design', 'architectural', 'code_smells'], createNodes = false, language } = options;
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
            for (const fileNodeId of pattern.fileNodes) {
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
      throw new Error(`Failed to detect patterns: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async extractTodos(directoryPath: string, options: { includeTypes?: string[]; createNodes?: boolean; assignToFiles?: boolean } = {}): Promise<any[]> {
    try {
      const { includeTypes = ['TODO', 'FIXME', 'HACK', 'NOTE', 'BUG'], createNodes = false, assignToFiles = true } = options;
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
          const todoNode = await this.createNode({
            type: 'Todo',
            label: `${todo.type}: ${todo.text.substring(0, 50)}...`,
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

            const matchingFile = fileNodes.find(node =>
              node.properties?.path === todo.filePath
            );

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
      throw new Error(`Failed to extract todos: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private changeMonitors = new Map<string, any>();
  private lastSyncTimes = new Map<string, number>();

  async monitorChanges(directoryPath: string, action: 'start' | 'stop' | 'status' | 'sync', options: { includePatterns?: string[]; excludePatterns?: string[] } = {}): Promise<any> {
    try {
      const { includePatterns = ['**/*.js', '**/*.ts', '**/*.py', '**/*.java'], excludePatterns = ['**/node_modules/**', '**/dist/**', '**/*.log'] } = options;

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
            status: 'active'
          });

          this.lastSyncTimes.set(directoryPath, Date.now());

          return {
            status: 'monitoring_started',
            directory: directoryPath,
            patterns: { include: includePatterns, exclude: excludePatterns }
          };

        case 'stop':
          if (!this.changeMonitors.has(directoryPath)) {
            return { status: 'not_monitoring', directory: directoryPath };
          }

          this.changeMonitors.delete(directoryPath);
          this.lastSyncTimes.delete(directoryPath);

          return { status: 'monitoring_stopped', directory: directoryPath };

        case 'status':
          const monitor = this.changeMonitors.get(directoryPath);
          return {
            isMonitoring: !!monitor,
            directory: directoryPath,
            ...(monitor && {
              startTime: monitor.startTime,
              lastSync: this.lastSyncTimes.get(directoryPath),
              patterns: { include: monitor.includePatterns, exclude: monitor.excludePatterns }
            })
          };

        case 'sync':
          // Detect changes since last sync and update graph
          const lastSync = this.lastSyncTimes.get(directoryPath) || 0;
          const changedFiles = this.detectChangedFiles(directoryPath, lastSync, includePatterns, excludePatterns);

          let processed = 0;
          for (const file of changedFiles) {
            try {
              // Re-analyze changed file
              await this.analyzeFile(file.path, undefined, true);
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
            filesProcessed: processed
          };

        default:
          throw new Error(`Unknown monitor action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Failed to monitor changes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async semanticAnalysis(nodeIds: string[], analysisType: 'similarity' | 'clustering' | 'naming' | 'usage_patterns', options: { createRelationships?: boolean; threshold?: number } = {}): Promise<any> {
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

      let results: any = {};

      switch (analysisType) {
        case 'similarity':
          results = await this.analyzeSimilarity(nodes, threshold, createRelationships);
          break;

        case 'clustering':
          results = await this.analyzeClustering(nodes, createRelationships);
          break;

        case 'naming':
          results = await this.analyzeNaming(nodes);
          break;

        case 'usage_patterns':
          results = await this.analyzeUsagePatterns(nodes, createRelationships);
          break;
      }

      return {
        analysisType,
        nodeCount: nodes.length,
        threshold,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed semantic analysis: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods for pattern detection
  private detectDesignPatterns(filePath: string, content: string, language: string): any[] {
    const patterns = [];

    // Singleton pattern detection
    if (content.includes('getInstance') && (content.includes('private constructor') || content.includes('private static'))) {
      patterns.push({
        type: 'Design Pattern',
        name: 'Singleton',
        filePath,
        confidence: 0.8,
        line: this.findPatternLine(content, 'getInstance'),
        description: 'Singleton pattern implementation detected'
      });
    }

    // Observer pattern detection
    if (content.includes('addListener') || content.includes('addEventListener') || content.includes('subscribe')) {
      patterns.push({
        type: 'Design Pattern',
        name: 'Observer',
        filePath,
        confidence: 0.7,
        line: this.findPatternLine(content, 'addListener|addEventListener|subscribe'),
        description: 'Observer pattern usage detected'
      });
    }

    // Factory pattern detection
    if (content.includes('createInstance') || content.includes('factory') || content.includes('Factory')) {
      patterns.push({
        type: 'Design Pattern',
        name: 'Factory',
        filePath,
        confidence: 0.75,
        line: this.findPatternLine(content, 'createInstance|factory|Factory'),
        description: 'Factory pattern implementation detected'
      });
    }

    return patterns;
  }

  private detectArchitecturalPatterns(filePath: string, content: string, language: string): any[] {
    const patterns = [];

    // MVC pattern detection
    if (filePath.includes('/controllers/') || filePath.includes('Controller.')) {
      patterns.push({
        type: 'Architectural Pattern',
        name: 'MVC - Controller',
        filePath,
        confidence: 0.9,
        description: 'MVC Controller component detected'
      });
    }

    if (filePath.includes('/models/') || filePath.includes('Model.')) {
      patterns.push({
        type: 'Architectural Pattern',
        name: 'MVC - Model',
        filePath,
        confidence: 0.9,
        description: 'MVC Model component detected'
      });
    }

    if (filePath.includes('/views/') || filePath.includes('View.') || filePath.includes('.vue') || filePath.includes('.jsx')) {
      patterns.push({
        type: 'Architectural Pattern',
        name: 'MVC - View',
        filePath,
        confidence: 0.8,
        description: 'MVC View component detected'
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
        description: 'Microservice endpoint detected'
      });
    }

    return patterns;
  }

  private detectCodeSmells(filePath: string, content: string, language: string): any[] {
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
          description: `Method ${func.name} is too long (${funcContent.split('\n').length} lines)`
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
        description: `File is very large (${lines.length} lines)`
      });
    }

    // TODO comments as potential technical debt
    const todoRegex = /\/\/\s*(TODO|FIXME|HACK)/gi;
    let match;
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      if ((match = todoRegex.exec(line)) !== null) {
        smells.push({
          type: 'Code Smell',
          name: 'Technical Debt',
          filePath,
          confidence: 0.6,
          line: lineNum,
          description: `TODO/FIXME comment indicates unfinished work: ${line.trim()}`
        });
      }
    }

    return smells;
  }

  private extractTodosFromContent(content: string, filePath: string, includeTypes: string[]): any[] {
    const todos = [];
    const lines = content.split('\n');

    const todoRegex = new RegExp(`(?://|#|<!--)\\s*(${includeTypes.join('|')})(?:\\s*:)?\\s*(.*)`, 'gi');

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
          extractedAt: new Date().toISOString()
        });
      }
    }

    return todos;
  }

  private detectChangedFiles(directoryPath: string, sinceTime: number, includePatterns: string[], excludePatterns: string[]): any[] {
    const changedFiles = [];

    try {
      const files = this.walkDirectory(directoryPath, 10);

      for (const file of files) {
        try {
          const stats = fs.statSync(file);
          if (stats.mtimeMs > sinceTime) {
            // Check if file matches patterns
            if (this.matchesPatterns(file, includePatterns) && !this.matchesPatterns(file, excludePatterns)) {
              changedFiles.push({
                path: file,
                lastModified: stats.mtimeMs,
                size: stats.size
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
  private async analyzeSimilarity(nodes: any[], threshold: number, createRelationships: boolean): Promise<any> {
    const similarities = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = this.calculateSimilarity(nodes[i], nodes[j]);
        if (similarity >= threshold) {
          similarities.push({
            node1: nodes[i].id,
            node2: nodes[j].id,
            similarity,
            reasons: this.getSimilarityReasons(nodes[i], nodes[j])
          });

          if (createRelationships) {
            await this.createEdge({
              sourceId: nodes[i].id,
              targetId: nodes[j].id,
              type: 'similar_to',
              weight: similarity,
              properties: { confidence: similarity }
            });
          }
        }
      }
    }

    return { similarities, threshold };
  }

  private async analyzeClustering(nodes: any[], createRelationships: boolean): Promise<any> {
    // Simple clustering by type and properties
    const clusters = new Map<string, any[]>();

    for (const node of nodes) {
      const clusterKey = `${node.type}_${node.properties?.category || 'default'}`;
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(node);
    }

    const results = Array.from(clusters.entries()).map(([key, nodeList]) => ({
      cluster: key,
      nodes: nodeList.map(n => n.id),
      size: nodeList.length
    }));

    return { clusters: results };
  }

  private async analyzeNaming(nodes: any[]): Promise<any> {
    const namingPatterns = {
      camelCase: 0,
      snake_case: 0,
      PascalCase: 0,
      'kebab-case': 0,
      inconsistent: [] as any[]
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
          suggestion: this.suggestNamingImprovement(label)
        });
      }
    }

    return namingPatterns;
  }

  private async analyzeUsagePatterns(nodes: any[], createRelationships: boolean): Promise<any> {
    const patterns = {
      highlyConnected: [] as any[],
      isolated: [] as any[],
      hubs: [] as any[]
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
    const sourceExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'];
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
      functionContent += line + '\n';

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
    return patterns.some(pattern => {
      // Simple glob matching - in production you'd use a proper glob library
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      return regex.test(filePath);
    });
  }

  private calculateSimilarity(node1: any, node2: any): number {
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

  private getSimilarityReasons(node1: any, node2: any): string[] {
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

  private objectSimilarity(obj1: any, obj2: any): number {
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

  close() {
    // Clean up any active monitors
    this.changeMonitors.clear();
    this.lastSyncTimes.clear();
    this.sqlite.close();
  }
}