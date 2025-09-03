import * as vscode from 'vscode';
import {
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    type KnowledgeGraphProvider,
} from './KnowledgeGraphProvider';

/**
 * Manages the webview panel for visualizing the knowledge graph.
 * Provides an interactive D3.js-based graph visualization with zoom, pan,
 * and node/edge interaction capabilities. Implements the singleton pattern
 * to ensure only one visualizer panel is active at a time.
 */
export class GraphVisualizerPanel {
    public static currentPanel: GraphVisualizerPanel | undefined;
    public static readonly viewType = 'dev-atlas-graph-visualizer';

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private readonly provider: KnowledgeGraphProvider,
        context: vscode.ExtensionContext
    ) {
        this._panel = panel;
        this._context = context;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        return;
                    case 'nodeClicked':
                        this._handleNodeClick(message.nodeId, message.nodeData);
                        return;
                    case 'edgeClicked':
                        vscode.window.showInformationMessage(`Edge clicked: ${message.edgeId}`);
                        return;
                    case 'refreshGraph':
                        this._update(); // Refresh the webview content
                        vscode.window.showInformationMessage('Graph data refreshed');
                        return;
                    case 'globalSearch':
                        vscode.commands.executeCommand('dev-atlas.searchKnowledgeGraph');
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Creates a new GraphVisualizerPanel or shows the existing one.
     * Implements singleton pattern to ensure only one panel exists.
     * 
     * @param extensionUri The URI of the extension for loading resources
     * @param provider The knowledge graph provider for data access
     */
    public static createOrShow(extensionUri: vscode.Uri, provider: KnowledgeGraphProvider, context: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (GraphVisualizerPanel.currentPanel) {
            GraphVisualizerPanel.currentPanel._panel.reveal(column);
            GraphVisualizerPanel.currentPanel._update();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            GraphVisualizerPanel.viewType,
            'Knowledge Graph Visualizer',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
            }
        );

        GraphVisualizerPanel.currentPanel = new GraphVisualizerPanel(panel, extensionUri, provider, context);
    }

    public dispose() {
        GraphVisualizerPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    /**
     * Handles node click events from the graph visualization.
     * Detects file-related nodes and prompts user for file opening preferences.
     */
    private async _handleNodeClick(nodeId: string, nodeData: any) {
        try {
            // Check if this node represents a file
            const isFileNode = this._isFileNode(nodeData);

            if (isFileNode) {
                await this._handleFileNodeClick(nodeData);
            } else {
                // Regular node click behavior
                vscode.window.showInformationMessage(`Node clicked: ${nodeData.label} (${nodeData.type})`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error handling node click: ${error}`);
        }
    }

    /**
     * Determines if a node represents a file based on its properties.
     */
    private _isFileNode(nodeData: any): boolean {
        // Check various indicators that suggest this node represents a file
        const type = nodeData.type?.toLowerCase() || '';
        const label = nodeData.label?.toLowerCase() || '';
        const properties = nodeData.properties || {};

        // Check if type indicates a file
        if (['file', 'source-file', 'document', 'script', 'configuration'].includes(type)) {
            return true;
        }

        // Check if label has file extension
        if (label.match(/\.(ts|js|jsx|tsx|py|java|cpp|c|h|css|scss|html|md|json|xml|yaml|yml|config|env)$/)) {
            return true;
        }

        // Check if properties indicate a file
        if (properties.filePath || properties.fileName || properties.extension || properties.isFile) {
            return true;
        }

        // Check if label contains file path patterns
        if (label.includes('/') && (label.includes('.') || label.startsWith('src/') || label.startsWith('app/'))) {
            return true;
        }

        return false;
    }

    /**
     * Handles clicks on file nodes, managing user preferences for file opening and copying.
     */
    private async _handleFileNodeClick(nodeData: any) {
        // Get configuration settings
        const config = vscode.workspace.getConfiguration('devAtlas');
        const defaultAction = config.get<string>('defaultFileAction', 'ask');
        const autoOpenFiles = config.get<boolean>('autoOpenFiles', false);

        // Extract potential file paths from node data
        const filePaths = this._extractFilePaths(nodeData);

        if (filePaths.length === 0) {
            vscode.window.showInformationMessage(`File node: ${nodeData.label} (no valid file paths found)`);
            return;
        }

        // Handle based on configuration
        switch (defaultAction) {
            case 'open':
                await this._openFiles(filePaths);
                break;
            case 'copy':
                await this._copyFilesToClipboard(filePaths);
                break;
            case 'both':
                await this._openFiles(filePaths);
                await this._copyFilesToClipboard(filePaths);
                break;
            default: // 'ask'
                await this._showFileActionDialog(filePaths);
                break;
        }
    }

    /**
     * Extracts potential file paths from node data.
     */
    private _extractFilePaths(nodeData: any): string[] {
        const paths: string[] = [];
        const label = nodeData.label || '';
        const properties = nodeData.properties || {};

        // Check if properties contain explicit file paths
        if (properties.filePath) {
            if (Array.isArray(properties.filePath)) {
                paths.push(...properties.filePath);
            } else {
                paths.push(properties.filePath);
            }
        }

        if (properties.fileName) {
            paths.push(properties.fileName);
        }

        // If label looks like a file path, add it
        if (label.includes('/') || label.includes('.')) {
            // Try to resolve relative to workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                const fullPath = require('path').resolve(workspaceRoot, label);
                paths.push(fullPath);
            }

            // Also add the raw label as a potential path
            paths.push(label);
        }

        return paths.filter(path => path && path.trim().length > 0);
    }

    /**
     * Shows dialog for file actions (open, copy, both) and handles user selection.
     */
    private async _showFileActionDialog(filePaths: string[]) {
        // Create action options
        const actionOptions: vscode.QuickPickItem[] = [
            {
                label: "$(file) Open Files",
                description: "Open selected files in editor",
                detail: "Opens files in VSCode for editing"
            },
            {
                label: "$(clippy) Copy to Clipboard",
                description: "Copy file paths to clipboard with prefix",
                detail: "Copies with configured prefix for quick pasting in other tools"
            },
            {
                label: "$(multiple-windows) Open & Copy",
                description: "Both open files and copy to clipboard",
                detail: "Combines both actions for maximum convenience"
            }
        ];

        const selectedAction = await vscode.window.showQuickPick(actionOptions, {
            placeHolder: 'Choose action for file paths',
            title: `File Action for ${filePaths.length} file(s)`
        });

        if (!selectedAction) {
            return;
        }

        // Show file selection dialog
        const fileOptions: vscode.QuickPickItem[] = filePaths.map(path => ({
            label: require('path').basename(path),
            description: path,
            picked: true // Default to selected
        }));

        // Add preference options for remembering choice
        const preferenceItems: vscode.QuickPickItem[] = [
            {
                label: "$(gear) Remember this choice for file nodes",
                description: "Set this as the default action for future file clicks",
                picked: false
            }
        ];

        const allItems = [...fileOptions, { kind: vscode.QuickPickItemKind.Separator, label: 'Preferences' }, ...preferenceItems];

        const selected = await vscode.window.showQuickPick(allItems, {
            canPickMany: true,
            placeHolder: 'Select files to process (uncheck to exclude)',
            title: `Select Files - ${selectedAction.label.replace(/\$\([^)]+\)\s*/, '')}`
        });

        if (!selected || selected.length === 0) {
            return;
        }

        // Check if user wants to remember this choice
        const rememberChoice = selected.some(item => item.label.includes("Remember this choice"));

        // Get selected files
        const selectedFiles = selected
            .filter(item => !item.label.startsWith('$('))
            .map(item => item.description!)
            .filter(Boolean);

        if (selectedFiles.length === 0) {
            return;
        }

        // Execute the selected action
        if (selectedAction.label.includes("Open Files") || selectedAction.label.includes("Open & Copy")) {
            await this._openFiles(selectedFiles);
        }

        if (selectedAction.label.includes("Copy to Clipboard") || selectedAction.label.includes("Open & Copy")) {
            await this._copyFilesToClipboard(selectedFiles);
        }

        // Remember choice if requested
        if (rememberChoice) {
            const config = vscode.workspace.getConfiguration('devAtlas');
            let defaultAction = 'ask';

            if (selectedAction.label.includes("Open & Copy")) {
                defaultAction = 'both';
            } else if (selectedAction.label.includes("Copy to Clipboard")) {
                defaultAction = 'copy';
            } else if (selectedAction.label.includes("Open Files")) {
                defaultAction = 'open';
            }

            await config.update('defaultFileAction', defaultAction, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Default file action set to: ${defaultAction}`);
        }
    }

    /**
     * Legacy function - keeping for backwards compatibility
     */
    private async _showFileOpeningDialog(filePaths: string[], currentPrefs: any) {
        const PREF_KEY = 'dev-atlas.fileOpeningPreferences';

        // Create options for the dialog
        const options: vscode.QuickPickItem[] = filePaths.map(path => ({
            label: require('path').basename(path),
            description: path,
            picked: true // Default to selected
        }));

        // Add preference options
        const preferenceItems: vscode.QuickPickItem[] = [
            {
                label: "$(gear) Don't ask again - always open files",
                description: "Set preference to automatically open file nodes",
                picked: false
            },
            {
                label: "$(x) Don't ask again - never open files",
                description: "Set preference to never open file nodes",
                picked: false
            }
        ];

        const allItems = [...options, { kind: vscode.QuickPickItemKind.Separator, label: 'Preferences' }, ...preferenceItems];

        const selected = await vscode.window.showQuickPick(allItems, {
            canPickMany: true,
            placeHolder: 'Select files to open (uncheck to exclude)',
            title: 'Open Files from Knowledge Graph Node'
        });

        if (!selected || selected.length === 0) {
            return;
        }

        // Check if user selected a preference option
        const alwaysOpenSelected = selected.some(item => item.label.includes("always open files"));
        const neverOpenSelected = selected.some(item => item.label.includes("never open files"));

        if (alwaysOpenSelected) {
            await this._context.globalState.update(PREF_KEY, {
                ...currentPrefs,
                askBeforeOpening: false,
                autoOpenFileNodes: true
            });
            vscode.window.showInformationMessage('File opening preference updated: will always open files');

            // Open all files
            await this._openFiles(filePaths);
        } else if (neverOpenSelected) {
            await this._context.globalState.update(PREF_KEY, {
                ...currentPrefs,
                askBeforeOpening: false,
                autoOpenFileNodes: false
            });
            vscode.window.showInformationMessage('File opening preference updated: will never open files');
        } else {
            // Open only selected files
            const filesToOpen = selected
                .filter(item => !item.label.startsWith('$('))
                .map(item => item.description!)
                .filter(Boolean);

            if (filesToOpen.length > 0) {
                await this._openFiles(filesToOpen);
            }
        }
    }

    /**
     * Opens the specified files in VSCode editor.
     */
    private async _openFiles(filePaths: string[]) {
        let openedCount = 0;

        for (const filePath of filePaths) {
            try {
                // Check if file exists
                const fs = require('fs');
                if (!fs.existsSync(filePath)) {
                    vscode.window.showWarningMessage(`File not found: ${filePath}`);
                    continue;
                }

                // Open the file
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
                openedCount++;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open ${filePath}: ${error}`);
            }
        }

        if (openedCount > 0) {
            vscode.window.showInformationMessage(`Opened ${openedCount} file(s)`);
        }
    }

    /**
     * Copies file paths to clipboard with configurable prefix.
     */
    private async _copyFilesToClipboard(filePaths: string[]) {
        try {
            const config = vscode.workspace.getConfiguration('devAtlas');
            const prefix = config.get<string>('filePathPrefix', '@');

            // Filter existing files
            const fs = require('fs');
            const existingFiles = filePaths.filter(path => {
                if (!fs.existsSync(path)) {
                    vscode.window.showWarningMessage(`File not found: ${path}`);
                    return false;
                }
                return true;
            });

            if (existingFiles.length === 0) {
                vscode.window.showErrorMessage('No valid files to copy');
                return;
            }

            // Convert to relative paths if possible
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const processedPaths = existingFiles.map(filePath => {
                let relativePath = filePath;

                // Try to make relative to workspace if possible
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const workspaceRoot = workspaceFolders[0].uri.fsPath;
                    const path = require('path');

                    if (filePath.startsWith(workspaceRoot)) {
                        relativePath = path.relative(workspaceRoot, filePath);
                    }
                }

                // Add prefix if configured
                if (prefix && prefix.trim().length > 0) {
                    return `${prefix}${relativePath}`;
                }

                return relativePath;
            });

            // Join paths with newlines for multi-file copying
            const clipboardContent = processedPaths.join('\n');

            // Copy to clipboard
            await vscode.env.clipboard.writeText(clipboardContent);

            // Show success message with preview
            const previewText = processedPaths.length > 3
                ? `${processedPaths.slice(0, 3).join(', ')}... (+${processedPaths.length - 3} more)`
                : processedPaths.join(', ');

            vscode.window.showInformationMessage(
                `Copied ${processedPaths.length} file path(s) to clipboard: ${previewText}`
            );

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy to clipboard: ${error}`);
        }
    }

    private _update() {
        const webview = this._panel.webview;

        this._panel.title = 'Knowledge Graph Visualizer';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the graph data from the provider
        const nodes = this.provider.getNodes();
        const edges = this.provider.getEdges();

        // Convert to JSON for the webview
        const graphData = {
            nodes: nodes.map((node) => ({
                id: node.id,
                label: node.label,
                type: node.type,
                group: this._getNodeGroup(node.type),
            })),
            edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.sourceId,
                target: edge.targetId,
                label: edge.label,
                type: edge.type,
            })),
        };

        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Knowledge Graph Visualizer</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                font-family: var(--vscode-font-family);
                overflow: hidden;
            }
            
            #graph-container {
                width: 100vw;
                height: 100vh;
                position: relative;
            }
            
            .controls {
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 1000;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 6px 12px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            }
            
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
            
            .info-panel {
                position: absolute;
                top: 10px;
                right: 10px;
                background-color: var(--vscode-panel-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 5px;
                padding: 10px;
                max-width: 250px;
                display: none;
            }
            
            .info-title {
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .info-content {
                font-size: 12px;
                line-height: 1.4;
            }
            
            .legend {
                position: absolute;
                bottom: 10px;
                left: 10px;
                background-color: var(--vscode-panel-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 5px;
                padding: 10px;
                max-width: 220px;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .legend-title {
                font-weight: bold;
                margin-bottom: 8px;
                font-size: 12px;
            }
            
            .legend-item {
                display: flex;
                align-items: center;
                margin-bottom: 4px;
                font-size: 11px;
            }
            
            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 6px;
            }
            
            .stats {
                position: absolute;
                top: 10px;
                right: 270px;
                background-color: var(--vscode-panel-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 5px;
                padding: 10px;
                font-size: 11px;
                min-width: 120px;
            }
            
            .stats-title {
                font-weight: bold;
                margin-bottom: 5px;
            }
        </style>
        <script src="https://d3js.org/d3.v7.min.js"></script>
    </head>
    <body>
        <div id="graph-container">
            <div class="controls">
                <button onclick="resetZoom()">Reset View</button>
                <button onclick="togglePhysics()">Toggle Physics</button>
                <button onclick="fitToWindow()">Fit to Window</button>
                <button onclick="refreshGraph()">Refresh Data</button>
                <button onclick="globalSearch()" title="Open global search with advanced options">🔍 Global Search</button>
                <input type="text" id="search-input" placeholder="Search visible nodes..." style="padding: 4px 8px; margin-left: 8px; border: 1px solid var(--vscode-input-border); background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px;">
                <button onclick="searchNodes()">Highlight</button>
                <button onclick="clearSearch()">Clear</button>
            </div>
            
            <div class="info-panel" id="info-panel">
                <div class="info-title" id="info-title"></div>
                <div class="info-content" id="info-content"></div>
            </div>
            
            <div class="stats">
                <div class="stats-title">Graph Stats</div>
                <div>Nodes: ${graphData.nodes.length}</div>
                <div>Edges: ${graphData.edges.length}</div>
                <div>Density: ${((2 * graphData.edges.length) / (graphData.nodes.length * (graphData.nodes.length - 1))).toFixed(3)}</div>
            </div>
            
            <div class="legend">
                <div class="legend-title">Node Types</div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #1f77b4;"></div>
                    <span>Technology</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #ff7f0e;"></div>
                    <span>Language</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #2ca02c;"></div>
                    <span>Runtime</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #d62728;"></div>
                    <span>Framework</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #9467bd;"></div>
                    <span>Library</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #8c564b;"></div>
                    <span>Tool</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #e377c2;"></div>
                    <span>Concept</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #7f7f7f;"></div>
                    <span>Person</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #98df8a;"></div>
                    <span>Other</span>
                </div>
            </div>
            
            <svg id="graph-svg"></svg>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let graphData = ${JSON.stringify(graphData)};
            let simulation;
            let svg, g, link, node;
            let physicsEnabled = true;
            
            // Color mapping for different node types
            const nodeColors = {
                'Technology': '#1f77b4',
                'Language': '#ff7f0e',
                'Runtime': '#2ca02c',
                'Framework': '#d62728',
                'Library': '#9467bd',
                'Tool': '#8c564b',
                'Concept': '#e377c2',
                'Person': '#7f7f7f',
                'Project': '#bcbd22',
                'Organization': '#17becf',
                'Documentation': '#aec7e8',
                'Tutorial': '#ffbb78',
                'Other': '#98df8a'
            };
            
            function initializeGraph() {
                const container = document.getElementById('graph-container');
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                svg = d3.select('#graph-svg')
                    .attr('width', width)
                    .attr('height', height);
                    
                svg.selectAll('*').remove(); // Clear existing content
                
                // Add zoom and pan
                const zoom = d3.zoom()
                    .scaleExtent([0.1, 10])
                    .on('zoom', function(event) {
                        g.attr('transform', event.transform);
                    });
                    
                svg.call(zoom);
                
                g = svg.append('g');
                
                // Create arrow markers for directed edges
                svg.append('defs').selectAll('marker')
                    .data(['end'])
                    .enter().append('marker')
                    .attr('id', 'arrowhead')
                    .attr('viewBox', '0 -5 10 10')
                    .attr('refX', 20)
                    .attr('refY', 0)
                    .attr('markerWidth', 6)
                    .attr('markerHeight', 6)
                    .attr('orient', 'auto')
                    .append('path')
                    .attr('d', 'M0,-5L10,0L0,5')
                    .attr('fill', '#999');
                
                // Create force simulation with improved parameters
                simulation = d3.forceSimulation(graphData.nodes)
                    .force('link', d3.forceLink(graphData.edges).id(d => d.id).distance(d => {
                        // Vary link distance based on node types
                        const source = d.source.type || 'Other';
                        const target = d.target.type || 'Other';
                        if (source === target) return 80; // Same type nodes closer
                        return 120; // Different type nodes farther
                    }).strength(0.8))
                    .force('charge', d3.forceManyBody().strength(d => {
                        // More central nodes (with more connections) have stronger repulsion
                        const connections = graphData.edges.filter(edge => 
                            edge.source === d.id || edge.target === d.id).length;
                        return -300 - (connections * 50);
                    }))
                    .force('center', d3.forceCenter(width / 2, height / 2))
                    .force('collision', d3.forceCollide().radius(d => {
                        // Bigger nodes for nodes with more connections
                        const connections = graphData.edges.filter(edge => 
                            edge.source === d.id || edge.target === d.id).length;
                        return Math.max(20, 15 + connections * 3);
                    }).strength(0.9))
                    .force('x', d3.forceX(width / 2).strength(0.05))
                    .force('y', d3.forceY(height / 2).strength(0.05));
                
                // Create edges
                link = g.append('g')
                    .selectAll('.link')
                    .data(graphData.edges)
                    .enter().append('line')
                    .attr('class', 'link')
                    .attr('stroke', '#999')
                    .attr('stroke-width', 2)
                    .attr('stroke-opacity', 0.6)
                    .attr('marker-end', 'url(#arrowhead)')
                    .on('click', function(event, d) {
                        vscode.postMessage({
                            command: 'edgeClicked',
                            edgeId: d.id
                        });
                    });
                
                // Create edge labels
                const edgeLabels = g.append('g')
                    .selectAll('.edge-label')
                    .data(graphData.edges)
                    .enter().append('text')
                    .attr('class', 'edge-label')
                    .attr('font-size', '10px')
                    .attr('fill', '#666')
                    .attr('text-anchor', 'middle')
                    .text(d => d.label || d.type);
                
                // Create nodes
                node = g.append('g')
                    .selectAll('.node')
                    .data(graphData.nodes)
                    .enter().append('g')
                    .attr('class', 'node')
                    .call(d3.drag()
                        .on('start', dragstarted)
                        .on('drag', dragged)
                        .on('end', dragended));
                
                // Add circles for nodes with dynamic sizing
                node.append('circle')
                    .attr('r', d => {
                        // Dynamic node size based on connections
                        const connections = graphData.edges.filter(edge => 
                            edge.source === d.id || edge.target === d.id).length;
                        return Math.max(12, 10 + connections * 2);
                    })
                    .attr('fill', d => nodeColors[d.type] || nodeColors['Other'])
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 2)
                    .style('cursor', 'pointer');
                
                // Add labels for nodes
                node.append('text')
                    .attr('dy', '.35em')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '10px')
                    .attr('font-weight', 'bold')
                    .attr('fill', '#fff')
                    .text(d => d.label);
                
                // Add tooltips
                node.append('title')
                    .text(d => \`\${d.label} (\${d.type})\`);
                
                // Node click handler
                node.on('click', function(event, d) {
                    showInfo(d);
                    vscode.postMessage({
                        command: 'nodeClicked',
                        nodeId: d.id,
                        nodeData: d
                    });
                });
                
                // Update positions on simulation tick
                simulation.on('tick', () => {
                    link
                        .attr('x1', d => d.source.x)
                        .attr('y1', d => d.source.y)
                        .attr('x2', d => d.target.x)
                        .attr('y2', d => d.target.y);
                    
                    edgeLabels
                        .attr('x', d => (d.source.x + d.target.x) / 2)
                        .attr('y', d => (d.source.y + d.target.y) / 2);
                    
                    node
                        .attr('transform', d => \`translate(\${d.x},\${d.y})\`);
                });
            }
            
            function dragstarted(event, d) {
                if (!event.active && physicsEnabled) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }
            
            function dragged(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            }
            
            function dragended(event, d) {
                if (!event.active && physicsEnabled) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }
            
            function showInfo(nodeData) {
                const panel = document.getElementById('info-panel');
                const title = document.getElementById('info-title');
                const content = document.getElementById('info-content');
                
                title.textContent = nodeData.label;
                content.innerHTML = \`
                    <strong>Type:</strong> \${nodeData.type}<br>
                    <strong>ID:</strong> \${nodeData.id}
                \`;
                
                panel.style.display = 'block';
                
                // Hide after 3 seconds
                setTimeout(() => {
                    panel.style.display = 'none';
                }, 3000);
            }
            
            function resetZoom() {
                const svg = d3.select('#graph-svg');
                svg.transition().duration(750).call(
                    d3.zoom().transform,
                    d3.zoomIdentity
                );
            }
            
            function togglePhysics() {
                physicsEnabled = !physicsEnabled;
                if (physicsEnabled) {
                    simulation.alphaTarget(0.3).restart();
                } else {
                    simulation.stop();
                }
            }
            
            function fitToWindow() {
                if (graphData.nodes.length === 0) return;
                
                const bounds = g.node().getBBox();
                const parent = svg.node().parentElement;
                const fullWidth = parent.clientWidth;
                const fullHeight = parent.clientHeight;
                const width = bounds.width;
                const height = bounds.height;
                const midX = bounds.x + width / 2;
                const midY = bounds.y + height / 2;
                
                if (width === 0 || height === 0) return; // nothing to fit
                
                const scale = 0.8 / Math.max(width / fullWidth, height / fullHeight);
                const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
                
                svg.transition().duration(750).call(
                    d3.zoom().transform,
                    d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
                );
            }
            
            function searchNodes() {
                const searchTerm = document.getElementById('search-input').value.toLowerCase();
                if (!searchTerm) return;
                
                // Reset all node styles
                clearSearch();
                
                // Find matching nodes
                const matchingNodes = graphData.nodes.filter(node => 
                    node.label.toLowerCase().includes(searchTerm) || 
                    node.type.toLowerCase().includes(searchTerm)
                );
                
                if (matchingNodes.length === 0) {
                    vscode.postMessage({
                        command: 'alert',
                        text: 'No nodes found matching: ' + searchTerm
                    });
                    return;
                }
                
                // Highlight matching nodes
                node.selectAll('circle')
                    .style('opacity', d => {
                        const matches = d.label.toLowerCase().includes(searchTerm) || 
                                      d.type.toLowerCase().includes(searchTerm);
                        return matches ? 1.0 : 0.3;
                    })
                    .style('stroke-width', d => {
                        const matches = d.label.toLowerCase().includes(searchTerm) || 
                                      d.type.toLowerCase().includes(searchTerm);
                        return matches ? 4 : 2;
                    });
                
                // Dim non-matching edges
                link.style('opacity', d => {
                    const sourceMatches = d.source.label.toLowerCase().includes(searchTerm) || 
                                        d.source.type.toLowerCase().includes(searchTerm);
                    const targetMatches = d.target.label.toLowerCase().includes(searchTerm) || 
                                        d.target.type.toLowerCase().includes(searchTerm);
                    return sourceMatches || targetMatches ? 0.8 : 0.2;
                });
                
                // Focus on first matching node
                if (matchingNodes.length > 0) {
                    const firstMatch = matchingNodes[0];
                    const transform = d3.zoomTransform(svg.node());
                    const x = firstMatch.x * transform.k + transform.x;
                    const y = firstMatch.y * transform.k + transform.y;
                    
                    const container = document.getElementById('graph-container');
                    const centerX = container.clientWidth / 2;
                    const centerY = container.clientHeight / 2;
                    
                    const newTransform = d3.zoomIdentity
                        .translate(centerX - firstMatch.x * transform.k, centerY - firstMatch.y * transform.k)
                        .scale(transform.k);
                    
                    svg.transition().duration(750).call(
                        d3.zoom().transform,
                        newTransform
                    );
                }
            }
            
            function clearSearch() {
                document.getElementById('search-input').value = '';
                
                // Reset all styles
                node.selectAll('circle')
                    .style('opacity', 1.0)
                    .style('stroke-width', 2);
                
                link.style('opacity', 0.6);
            }
            
            function refreshGraph() {
                vscode.postMessage({
                    command: 'refreshGraph'
                });
            }
            
            function globalSearch() {
                vscode.postMessage({
                    command: 'globalSearch'
                });
            }
            
            // Handle window resize
            window.addEventListener('resize', () => {
                const container = document.getElementById('graph-container');
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                svg.attr('width', width).attr('height', height);
                simulation.force('center', d3.forceCenter(width / 2, height / 2));
                simulation.alpha(0.3).restart();
            });
            
            // Handle Enter key in search input
            document.addEventListener('DOMContentLoaded', function() {
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.addEventListener('keypress', function(event) {
                        if (event.key === 'Enter') {
                            searchNodes();
                        }
                    });
                }
            });
            
            // Initialize the graph when the page loads
            initializeGraph();
        </script>
    </body>
    </html>`;
    }

    private _getNodeGroup(nodeType: string): number {
        // Map node types to numeric groups for visualization
        const typeMap: { [key: string]: number } = {
            Technology: 1,
            Language: 2,
            Runtime: 3,
            Framework: 4,
            Library: 5,
            Tool: 6,
            Concept: 7,
            Person: 8,
            Project: 9,
            Organization: 10,
            Documentation: 11,
            Tutorial: 12,
            Other: 0,
        };
        return typeMap[nodeType] || 0;
    }
}
