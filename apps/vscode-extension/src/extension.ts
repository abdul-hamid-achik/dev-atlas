import * as vscode from 'vscode';
import { KnowledgeGraphProvider } from './views/KnowledgeGraphProvider';
import { createNodeCommand } from './commands/createNode';
import { createEdgeCommand } from './commands/createEdge';

export function activate(context: vscode.ExtensionContext) {
  console.log('Dev Atlas extension is now active!');

  // Register the knowledge graph provider
  const provider = new KnowledgeGraphProvider();
  vscode.window.registerTreeDataProvider('dev-atlas-knowledge-graph', provider);

  // Register commands
  const openKnowledgeGraphCommand = vscode.commands.registerCommand(
    'dev-atlas.openKnowledgeGraph',
    () => {
      vscode.window.showInformationMessage('Knowledge Graph opened!');
    }
  );

  const createNodeCmd = vscode.commands.registerCommand(
    'dev-atlas.createNode',
    createNodeCommand
  );

  const createEdgeCmd = vscode.commands.registerCommand(
    'dev-atlas.createEdge',
    createEdgeCommand
  );

  // Add commands to context
  context.subscriptions.push(
    openKnowledgeGraphCommand,
    createNodeCmd,
    createEdgeCmd
  );

  // Refresh the view when configuration changes
  vscode.workspace.onDidChangeConfiguration(() => {
    provider.refresh();
  });
}

export function deactivate() {
  console.log('Dev Atlas extension is now deactivated!');
}