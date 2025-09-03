import * as vscode from 'vscode';
import { KnowledgeGraphDB } from '../db/index';
import type { Edge, Node } from '../db/schema';
import { log } from '../extension';

/**
 * Represents a knowledge graph node in the VS Code tree view.
 * Extends TreeItem to integrate with VS Code's explorer interface.
 */
export class KnowledgeGraphNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: string,
    public readonly id: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label} (${this.type})`;
    this.description = this.type;
    this.contextValue = 'knowledgeGraphNode';
  }

  iconPath = new vscode.ThemeIcon('circle-outline');
}

/**
 * Represents a knowledge graph edge in the VS Code tree view.
 * Shows relationships between nodes in the explorer interface.
 */
export class KnowledgeGraphEdge extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: string,
    public readonly id: string,
    public readonly sourceId: string,
    public readonly targetId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.label}: ${this.sourceId} -> ${this.targetId}`;
    this.description = `${this.sourceId} -> ${this.targetId}`;
    this.contextValue = 'knowledgeGraphEdge';
  }

  iconPath = new vscode.ThemeIcon('arrow-right');
}

/**
 * Provides data for the knowledge graph tree view in VS Code.
 * Implements TreeDataProvider to display nodes and edges in the explorer panel.
 * Handles data loading, refresh, and interaction with the knowledge graph database.
 */
export class KnowledgeGraphProvider
  implements vscode.TreeDataProvider<KnowledgeGraphNode | KnowledgeGraphEdge> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    KnowledgeGraphNode | KnowledgeGraphEdge | undefined | null | undefined
  > = new vscode.EventEmitter<
    KnowledgeGraphNode | KnowledgeGraphEdge | undefined | null | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<
    KnowledgeGraphNode | KnowledgeGraphEdge | undefined | null | undefined
  > = this._onDidChangeTreeData.event;

  private nodes: KnowledgeGraphNode[] = [];
  private edges: KnowledgeGraphEdge[] = [];
  private db: KnowledgeGraphDB | null = null;
  private searchFilter: string = '';
  private typeFilter: string = '';

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      log('Initializing database connection...');
      this.db = new KnowledgeGraphDB();
      log(`Database connected at: ${this.db.getDatabasePath()}`);

      // Load data from database
      await this.loadDataFromDatabase();

      // If no data exists, create some sample data
      const nodeCount = this.nodes.length;
      if (nodeCount === 0) {
        log('No nodes found in database, creating sample data...');
        await this.createSampleData();
        await this.loadDataFromDatabase();
      }

      log(`Loaded ${this.nodes.length} nodes and ${this.edges.length} edges from database`);
      this._onDidChangeTreeData.fire(undefined);
    } catch (error) {
      log(`Failed to initialize database: ${error}`, 'error');
      vscode.window.showErrorMessage(`Dev Atlas: Failed to connect to database: ${error}`);
      // Fall back to sample data if database fails
      this.loadSampleDataFallback();
    }
  }

  private async loadDataFromDatabase() {
    if (!this.db) return;

    try {
      // Load nodes from database
      const dbNodes = await this.db.queryNodes({ limit: 100 });
      this.nodes = dbNodes.map(
        (node) =>
          new KnowledgeGraphNode(
            node.label,
            node.type,
            node.id,
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );

      // Load edges from database
      const dbEdges = await this.db.queryEdges({ limit: 500 });
      this.edges = dbEdges.map(
        (edge) =>
          new KnowledgeGraphEdge(`${edge.type}`, edge.type, edge.id, edge.sourceId, edge.targetId)
      );

      log(`Loaded ${this.nodes.length} nodes and ${this.edges.length} edges from database`);
    } catch (error) {
      log(`Failed to load data from database: ${error}`, 'error');
      throw error;
    }
  }

  private async createSampleData() {
    if (!this.db) return;

    try {
      log('Creating sample nodes and edges...');

      // Create sample nodes
      const nodeIds: Record<string, string> = {};
      const sampleNodes = [
        { type: 'Framework', label: 'React' },
        { type: 'Language', label: 'TypeScript' },
        { type: 'Runtime', label: 'Node.js' },
        { type: 'Tool', label: 'VS Code' },
        { type: 'Library', label: 'D3.js' },
        { type: 'Tool', label: 'Webpack' },
        { type: 'Language', label: 'JavaScript' },
        { type: 'Concept', label: 'Graph Visualization' },
        { type: 'Technology', label: 'MCP Protocol' },
        { type: 'Technology', label: 'SQLite' },
      ];

      for (const nodeData of sampleNodes) {
        const node = await this.db.createNode(nodeData);
        nodeIds[nodeData.label] = node.id;
      }

      // Create sample edges
      const sampleEdges = [
        { source: 'React', target: 'TypeScript', type: 'uses', label: 'Built with' },
        { source: 'React', target: 'Node.js', type: 'runs_on', label: 'Runs on' },
        { source: 'React', target: 'VS Code', type: 'uses', label: 'Developed in' },
        { source: 'Graph Visualization', target: 'D3.js', type: 'uses', label: 'Visualizes with' },
        { source: 'React', target: 'Webpack', type: 'uses', label: 'Bundles with' },
        { source: 'TypeScript', target: 'JavaScript', type: 'compiles_to', label: 'Compiles to' },
        { source: 'Graph Visualization', target: 'React', type: 'implements', label: 'Implements' },
        { source: 'VS Code', target: 'MCP Protocol', type: 'uses', label: 'Communicates via' },
        { source: 'MCP Protocol', target: 'SQLite', type: 'uses', label: 'Stores data in' },
        { source: 'MCP Protocol', target: 'VS Code', type: 'extends', label: 'Extension for' },
      ];

      for (const edgeData of sampleEdges) {
        if (nodeIds[edgeData.source] && nodeIds[edgeData.target]) {
          await this.db.createEdge({
            sourceId: nodeIds[edgeData.source],
            targetId: nodeIds[edgeData.target],
            type: edgeData.type,
            properties: { label: edgeData.label },
          });
        }
      }

      log('Sample data created successfully');
    } catch (error) {
      log(`Failed to create sample data: ${error}`, 'error');
      throw error;
    }
  }

  private loadSampleDataFallback() {
    log('Using fallback sample data', 'warn');
    // Enhanced sample data for demonstration (fallback only)
    this.nodes = [
      new KnowledgeGraphNode(
        'React',
        'Framework',
        'node-1',
        vscode.TreeItemCollapsibleState.Collapsed
      ),
      new KnowledgeGraphNode(
        'TypeScript',
        'Language',
        'node-2',
        vscode.TreeItemCollapsibleState.Collapsed
      ),
      new KnowledgeGraphNode(
        'Node.js',
        'Runtime',
        'node-3',
        vscode.TreeItemCollapsibleState.Collapsed
      ),
      new KnowledgeGraphNode(
        'VS Code',
        'Tool',
        'node-4',
        vscode.TreeItemCollapsibleState.Collapsed
      ),
      new KnowledgeGraphNode(
        'D3.js',
        'Library',
        'node-5',
        vscode.TreeItemCollapsibleState.Collapsed
      ),
    ];

    this.edges = [
      new KnowledgeGraphEdge('Built with', 'uses', 'edge-1', 'node-1', 'node-2'),
      new KnowledgeGraphEdge('Runs on', 'runs_on', 'edge-2', 'node-1', 'node-3'),
      new KnowledgeGraphEdge('Developed in', 'uses', 'edge-3', 'node-1', 'node-4'),
    ];
  }

  async refresh(): Promise<void> {
    log('Refreshing knowledge graph data...');
    try {
      if (this.db) {
        await this.loadDataFromDatabase();
        log('Data refreshed successfully');
      }
      this._onDidChangeTreeData.fire(undefined);
    } catch (error) {
      log(`Failed to refresh data: ${error}`, 'error');
      vscode.window.showErrorMessage(`Dev Atlas: Failed to refresh data: ${error}`);
    }
  }

  getTreeItem(element: KnowledgeGraphNode | KnowledgeGraphEdge): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: KnowledgeGraphNode | KnowledgeGraphEdge
  ): Thenable<(KnowledgeGraphNode | KnowledgeGraphEdge)[]> {
    if (!element) {
      // Return filtered root level items (nodes)
      const filteredNodes = this._applyFilters(this.nodes);
      return Promise.resolve(filteredNodes);
    }

    if (element instanceof KnowledgeGraphNode) {
      // Return edges connected to this node
      const connectedEdges = this.edges.filter(
        (edge) => edge.sourceId === element.id || edge.targetId === element.id
      );
      return Promise.resolve(connectedEdges);
    }

    return Promise.resolve([]);
  }

  /**
   * Applies current search and type filters to the nodes list.
   */
  private _applyFilters(nodes: KnowledgeGraphNode[]): KnowledgeGraphNode[] {
    let filtered = nodes;

    // Apply search filter
    if (this.searchFilter) {
      const searchTerm = this.searchFilter.toLowerCase();
      filtered = filtered.filter(node =>
        node.label.toLowerCase().includes(searchTerm) ||
        node.type.toLowerCase().includes(searchTerm)
      );
    }

    // Apply type filter
    if (this.typeFilter) {
      filtered = filtered.filter(node =>
        node.type.toLowerCase() === this.typeFilter.toLowerCase()
      );
    }

    return filtered;
  }

  /**
   * Sets the search filter and refreshes the tree view.
   */
  setSearchFilter(filter: string): void {
    this.searchFilter = filter;
    this._onDidChangeTreeData.fire(undefined);
    log(`Search filter applied: "${filter}"`);
  }

  /**
   * Sets the type filter and refreshes the tree view.
   */
  setTypeFilter(filter: string): void {
    this.typeFilter = filter;
    this._onDidChangeTreeData.fire(undefined);
    log(`Type filter applied: "${filter}"`);
  }

  /**
   * Clears all filters and refreshes the tree view.
   */
  clearFilters(): void {
    this.searchFilter = '';
    this.typeFilter = '';
    this._onDidChangeTreeData.fire(undefined);
    log('All filters cleared');
  }

  /**
   * Gets current filter status.
   */
  getFilterStatus(): { searchFilter: string; typeFilter: string; hasFilters: boolean } {
    return {
      searchFilter: this.searchFilter,
      typeFilter: this.typeFilter,
      hasFilters: !!(this.searchFilter || this.typeFilter)
    };
  }

  // Method to add a new node
  async addNode(label: string, type: string, properties?: Record<string, unknown>): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      log(`Adding new node: ${label} (${type})`);
      const node = await this.db.createNode({ label, type, properties });

      const newNode = new KnowledgeGraphNode(
        node.label,
        node.type,
        node.id,
        vscode.TreeItemCollapsibleState.Collapsed
      );

      this.nodes.push(newNode);
      await this.refresh();
      vscode.window.showInformationMessage(`Node "${label}" created successfully!`);
    } catch (error) {
      log(`Failed to add node: ${error}`, 'error');
      vscode.window.showErrorMessage(`Failed to create node: ${error}`);
    }
  }

  // Method to add a new edge
  async addEdge(sourceId: string, targetId: string, type: string, properties?: Record<string, unknown>, weight?: number): Promise<void> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      log(`Adding new edge: ${sourceId} -> ${targetId} (${type})`);
      const edge = await this.db.createEdge({
        sourceId,
        targetId,
        type,
        properties,
        weight
      });

      const newEdge = new KnowledgeGraphEdge(
        type,
        edge.type,
        edge.id,
        edge.sourceId,
        edge.targetId
      );
      this.edges.push(newEdge);
      await this.refresh();
      vscode.window.showInformationMessage(`Edge "${type}" created successfully!`);
    } catch (error) {
      log(`Failed to add edge: ${error}`, 'error');
      vscode.window.showErrorMessage(`Failed to create edge: ${error}`);
    }
  }

  // Getter methods for external access to data
  getNodes(): Node[] {
    return this.nodes.map(node => ({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: {},
    }));
  }

  getEdges(): KnowledgeGraphEdge[] {
    return [...this.edges];
  }

  // Get database instance for external use
  getDatabase(): KnowledgeGraphDB | null {
    return this.db;
  }

  // Cleanup method
  dispose(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      log('Database connection closed');
    }
  }
}
