import * as vscode from 'vscode';

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

export class KnowledgeGraphProvider implements vscode.TreeDataProvider<KnowledgeGraphNode | KnowledgeGraphEdge> {
  private _onDidChangeTreeData: vscode.EventEmitter<KnowledgeGraphNode | KnowledgeGraphEdge | undefined | null | void> = new vscode.EventEmitter<KnowledgeGraphNode | KnowledgeGraphEdge | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<KnowledgeGraphNode | KnowledgeGraphEdge | undefined | null | void> = this._onDidChangeTreeData.event;

  private nodes: KnowledgeGraphNode[] = [];
  private edges: KnowledgeGraphEdge[] = [];

  constructor() {
    this.loadSampleData();
  }

  private loadSampleData() {
    // Sample data for demonstration
    this.nodes = [
      new KnowledgeGraphNode('React', 'Technology', 'node-1', vscode.TreeItemCollapsibleState.Collapsed),
      new KnowledgeGraphNode('TypeScript', 'Language', 'node-2', vscode.TreeItemCollapsibleState.Collapsed),
      new KnowledgeGraphNode('Node.js', 'Runtime', 'node-3', vscode.TreeItemCollapsibleState.Collapsed),
    ];

    this.edges = [
      new KnowledgeGraphEdge('Built with', 'uses', 'edge-1', 'node-1', 'node-2'),
      new KnowledgeGraphEdge('Runs on', 'runs_on', 'edge-2', 'node-1', 'node-3'),
    ];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KnowledgeGraphNode | KnowledgeGraphEdge): vscode.TreeItem {
    return element;
  }

  getChildren(element?: KnowledgeGraphNode | KnowledgeGraphEdge): Thenable<(KnowledgeGraphNode | KnowledgeGraphEdge)[]> {
    if (!element) {
      // Return root level items (nodes)
      return Promise.resolve(this.nodes);
    }

    if (element instanceof KnowledgeGraphNode) {
      // Return edges connected to this node
      const connectedEdges = this.edges.filter(
        edge => edge.sourceId === element.id || edge.targetId === element.id
      );
      return Promise.resolve(connectedEdges);
    }

    return Promise.resolve([]);
  }

  // Method to add a new node
  addNode(label: string, type: string, id: string): void {
    const newNode = new KnowledgeGraphNode(
      label,
      type,
      id,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    this.nodes.push(newNode);
    this.refresh();
  }

  // Method to add a new edge
  addEdge(label: string, type: string, id: string, sourceId: string, targetId: string): void {
    const newEdge = new KnowledgeGraphEdge(label, type, id, sourceId, targetId);
    this.edges.push(newEdge);
    this.refresh();
  }
}