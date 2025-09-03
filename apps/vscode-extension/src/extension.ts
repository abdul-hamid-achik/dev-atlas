import * as vscode from 'vscode';
import { KnowledgeGraphProvider } from './views/KnowledgeGraphProvider';
import { GraphVisualizerPanel } from './views/GraphVisualizerPanel';
import { createNodeCommand } from './commands/createNode';
import { createEdgeCommand } from './commands/createEdge';

// Create output channel for logging
const outputChannel = vscode.window.createOutputChannel('Dev Atlas');

export function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  outputChannel.appendLine(logMessage);

  // Also log to console for development
  switch (level) {
    case 'error':
      console.error(`[Dev Atlas] ${message}`);
      break;
    case 'warn':
      console.warn(`[Dev Atlas] ${message}`);
      break;
    default:
      console.log(`[Dev Atlas] ${message}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  log('Dev Atlas extension is now active!');
  log(`Extension path: ${context.extensionPath}`);
  log(`Workspace folders: ${vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath).join(', ') || 'None'}`);

  // Register the knowledge graph provider
  const provider = new KnowledgeGraphProvider();
  vscode.window.registerTreeDataProvider('dev-atlas-knowledge-graph', provider);

  // Store provider globally for commands to access
  (global as any).devAtlasKnowledgeGraphProvider = provider;

  log('Knowledge graph provider registered');

  // Register commands
  const openKnowledgeGraphCommand = vscode.commands.registerCommand(
    'dev-atlas.openKnowledgeGraph',
    () => {
      log('Opening knowledge graph visualizer');
      GraphVisualizerPanel.createOrShow(context.extensionUri, provider);
    }
  );

  const createNodeCmd = vscode.commands.registerCommand(
    'dev-atlas.createNode',
    () => {
      log('Create node command triggered');
      createNodeCommand();
    }
  );

  const createEdgeCmd = vscode.commands.registerCommand(
    'dev-atlas.createEdge',
    () => {
      log('Create edge command triggered');
      createEdgeCommand();
    }
  );

  // Add commands to context
  context.subscriptions.push(
    openKnowledgeGraphCommand,
    createNodeCmd,
    createEdgeCmd,
    outputChannel
  );
  log('Commands registered successfully');

  // Refresh the view when configuration changes
  vscode.workspace.onDidChangeConfiguration(() => {
    log('Configuration changed, refreshing provider');
    provider.refresh();
  });

  log('Dev Atlas extension activation completed');
}

export function deactivate() {
  log('Dev Atlas extension is being deactivated');

  // Clean up resources
  const provider = (global as any).devAtlasKnowledgeGraphProvider;
  if (provider && typeof provider.dispose === 'function') {
    provider.dispose();
    log('Provider disposed');
  }

  delete (global as any).devAtlasKnowledgeGraphProvider;
  console.log('Dev Atlas extension is now deactivated!');
}