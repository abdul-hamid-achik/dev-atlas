import * as vscode from 'vscode';
import { createEdgeCommand } from './commands/createEdge';
import { createNodeCommand } from './commands/createNode';
import {
  advancedSearchCommand,
  searchKnowledgeGraphCommand,
  vectorSearchCommand,
} from './commands/searchKnowledgeGraph';
import { GraphVisualizerPanel } from './views/GraphVisualizerPanel';
import { KnowledgeGraphProvider } from './views/KnowledgeGraphProvider';

/**
 * Global provider interface for commands to access the knowledge graph provider.
 * This allows commands to interact with the shared provider instance.
 */
type GlobalWithProvider = typeof globalThis & {
  devAtlasKnowledgeGraphProvider?: KnowledgeGraphProvider;
};

/** VS Code output channel for logging Dev Atlas extension messages */
const outputChannel = vscode.window.createOutputChannel('Dev Atlas');

/**
 * Logs messages to both the VS Code output channel and console.
 *
 * @param message The message to log
 * @param level The log level (info, warn, or error)
 */
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

/**
 * Activates the Dev Atlas VS Code extension.
 * Sets up the knowledge graph provider, registers commands, and configures the UI.
 *
 * @param context The VS Code extension context providing access to extension lifecycle and resources
 */
export function activate(context: vscode.ExtensionContext) {
  log('Dev Atlas extension is now active!');
  log(`Extension path: ${context.extensionPath}`);
  log(
    `Workspace folders: ${vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath).join(', ') || 'None'}`
  );

  // Register the knowledge graph provider
  const provider = new KnowledgeGraphProvider();
  vscode.window.registerTreeDataProvider('dev-atlas-knowledge-graph', provider);

  // Store provider globally for commands to access
  (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider = provider;

  log('Knowledge graph provider registered');

  // Register commands
  const openKnowledgeGraphCommand = vscode.commands.registerCommand(
    'dev-atlas.openKnowledgeGraph',
    () => {
      log('Opening knowledge graph visualizer');
      GraphVisualizerPanel.createOrShow(context.extensionUri, provider, context);
    }
  );

  const createNodeCmd = vscode.commands.registerCommand('dev-atlas.createNode', () => {
    log('Create node command triggered');
    createNodeCommand();
  });

  const createEdgeCmd = vscode.commands.registerCommand('dev-atlas.createEdge', () => {
    log('Create edge command triggered');
    createEdgeCommand();
  });

  const configureFilePrefixCmd = vscode.commands.registerCommand(
    'dev-atlas.configureFilePrefix',
    async () => {
      log('Configure file prefix command triggered');
      const config = vscode.workspace.getConfiguration('devAtlas');
      const currentPrefix = config.get<string>('filePathPrefix', '@');

      const newPrefix = await vscode.window.showInputBox({
        prompt: 'Enter file path prefix for clipboard copying',
        value: currentPrefix,
        placeHolder: 'e.g., @ for Cursor, # for others, or empty for no prefix',
        validateInput: (value) => {
          // Allow any string including empty
          return null;
        },
      });

      if (newPrefix !== undefined) {
        await config.update('filePathPrefix', newPrefix, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`File path prefix updated to: "${newPrefix}"`);
        log(`File path prefix updated to: "${newPrefix}"`);
      }
    }
  );

  const searchKnowledgeGraphCmd = vscode.commands.registerCommand(
    'dev-atlas.searchKnowledgeGraph',
    () => {
      log('Search knowledge graph command triggered');
      searchKnowledgeGraphCommand();
    }
  );

  const advancedSearchCmd = vscode.commands.registerCommand('dev-atlas.advancedSearch', () => {
    log('Advanced search command triggered');
    advancedSearchCommand();
  });

  const vectorSearchCmd = vscode.commands.registerCommand('dev-atlas.vectorSearch', () => {
    log('Vector search command triggered');
    vectorSearchCommand();
  });

  const filterTreeViewCmd = vscode.commands.registerCommand(
    'dev-atlas.filterTreeView',
    async () => {
      log('Filter tree view command triggered');

      const filterType = await vscode.window.showQuickPick(
        [
          { label: '🔍 Search Filter', description: 'Filter by search term', value: 'search' },
          { label: '🏷️ Type Filter', description: 'Filter by node type', value: 'type' },
        ],
        {
          placeHolder: 'Choose filter type',
        }
      );

      if (!filterType) {
        return;
      }

      if (filterType.value === 'search') {
        const searchTerm = await vscode.window.showInputBox({
          prompt: 'Enter search term to filter tree view',
          placeHolder: 'Filter nodes by label or type',
        });

        if (searchTerm !== undefined) {
          provider.setSearchFilter(searchTerm);
          vscode.window.showInformationMessage(
            searchTerm ? `Tree filtered by: "${searchTerm}"` : 'Search filter cleared'
          );
        }
      } else {
        const typeTerm = await vscode.window.showInputBox({
          prompt: 'Enter node type to filter by',
          placeHolder: 'e.g., Framework, Language, Tool',
        });

        if (typeTerm !== undefined) {
          provider.setTypeFilter(typeTerm);
          vscode.window.showInformationMessage(
            typeTerm ? `Tree filtered by type: "${typeTerm}"` : 'Type filter cleared'
          );
        }
      }
    }
  );

  const clearTreeFiltersCmd = vscode.commands.registerCommand('dev-atlas.clearTreeFilters', () => {
    log('Clear tree filters command triggered');
    provider.clearFilters();
    vscode.window.showInformationMessage('Tree view filters cleared');
  });

  // Add commands to context
  context.subscriptions.push(
    openKnowledgeGraphCommand,
    createNodeCmd,
    createEdgeCmd,
    configureFilePrefixCmd,
    searchKnowledgeGraphCmd,
    advancedSearchCmd,
    vectorSearchCmd,
    filterTreeViewCmd,
    clearTreeFiltersCmd,
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

/**
 * Deactivates the Dev Atlas VS Code extension.
 * Performs cleanup by disposing of the provider and clearing global references.
 */
export function deactivate() {
  log('Dev Atlas extension is being deactivated');

  // Clean up resources
  const provider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
  if (provider?.dispose) {
    provider.dispose();
    log('Provider disposed');
  }

  (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider = undefined;
  console.log('Dev Atlas extension is now deactivated!');
}
