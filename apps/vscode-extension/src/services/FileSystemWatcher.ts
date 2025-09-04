import * as vscode from 'vscode';
import { log } from '../extension';
import type { WorkspaceScanner } from './WorkspaceScanner';

/**
 * Watches file system changes and automatically updates the knowledge graph.
 * Integrates with VS Code's file system watcher API to provide real-time updates.
 */
export class FileSystemWatcher {
  private watchers: vscode.FileSystemWatcher[] = [];
  private scanner: WorkspaceScanner;
  private isWatching = false;

  constructor(scanner: WorkspaceScanner) {
    this.scanner = scanner;
  }

  /**
   * Starts watching the workspace for file changes.
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      log('File system watcher is already running');
      return;
    }

    try {
      log('Starting file system watcher...');

      // Watch for file creations, changes, and deletions
      const patterns = [
        '**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,css,scss,html,md,json,xml,yaml,yml}',
        '**/package.json',
        '**/tsconfig.json',
        '**/README.md',
      ];

      for (const pattern of patterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // File created
        watcher.onDidCreate(async (uri) => {
          log(`File created: ${uri.fsPath}`);
          await this.handleFileCreated(uri);
        });

        // File changed
        watcher.onDidChange(async (uri) => {
          log(`File changed: ${uri.fsPath}`);
          await this.handleFileChanged(uri);
        });

        // File deleted
        watcher.onDidDelete(async (uri) => {
          log(`File deleted: ${uri.fsPath}`);
          await this.handleFileDeleted(uri);
        });

        this.watchers.push(watcher);
      }

      // Watch for workspace folder changes
      vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
        log('Workspace folders changed');
        await this.handleWorkspaceFoldersChanged(event);
      });

      this.isWatching = true;
      log(`File system watcher started with ${this.watchers.length} watchers`);
    } catch (error) {
      log(`Failed to start file system watcher: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Stops watching the workspace for file changes.
   */
  stopWatching(): void {
    if (!this.isWatching) {
      return;
    }

    log('Stopping file system watcher...');

    // Dispose all watchers
    for (const watcher of this.watchers) {
      watcher.dispose();
    }

    this.watchers = [];
    this.isWatching = false;
    log('File system watcher stopped');
  }

  /**
   * Handles file creation events.
   */
  private async handleFileCreated(uri: vscode.Uri): Promise<void> {
    try {
      // Add delay to ensure file is fully written
      await this.delay(500);

      const success = await this.scanner.scanFile(uri);
      if (success) {
        // Notify the knowledge graph provider to refresh
        vscode.commands.executeCommand('dev-atlas.refreshKnowledgeGraph');

        // Show notification for important files
        if (this.isImportantFile(uri)) {
          vscode.window.showInformationMessage(
            `Dev Atlas: Added ${vscode.workspace.asRelativePath(uri)} to knowledge graph`
          );
        }
      }
    } catch (error) {
      log(`Error handling file creation for ${uri.fsPath}: ${error}`, 'error');
    }
  }

  /**
   * Handles file change events.
   */
  private async handleFileChanged(uri: vscode.Uri): Promise<void> {
    try {
      // Add delay to ensure file changes are complete
      await this.delay(1000);

      const success = await this.scanner.scanFile(uri);
      if (success) {
        // Refresh the knowledge graph view
        vscode.commands.executeCommand('dev-atlas.refreshKnowledgeGraph');

        log(`Updated knowledge graph for changed file: ${vscode.workspace.asRelativePath(uri)}`);
      }
    } catch (error) {
      log(`Error handling file change for ${uri.fsPath}: ${error}`, 'error');
    }
  }

  /**
   * Handles file deletion events.
   */
  private async handleFileDeleted(uri: vscode.Uri): Promise<void> {
    try {
      const success = await this.scanner.removeFile(uri);
      if (success) {
        // Refresh the knowledge graph view
        vscode.commands.executeCommand('dev-atlas.refreshKnowledgeGraph');

        // Show notification for important files
        if (this.isImportantFile(uri)) {
          vscode.window.showInformationMessage(
            `Dev Atlas: Removed ${vscode.workspace.asRelativePath(uri)} from knowledge graph`
          );
        }
      }
    } catch (error) {
      log(`Error handling file deletion for ${uri.fsPath}: ${error}`, 'error');
    }
  }

  /**
   * Handles workspace folder changes.
   */
  private async handleWorkspaceFoldersChanged(
    event: vscode.WorkspaceFoldersChangeEvent
  ): Promise<void> {
    try {
      log(`Workspace folders changed: +${event.added.length}, -${event.removed.length}`);

      // Scan newly added folders
      for (const folder of event.added) {
        log(`Scanning new workspace folder: ${folder.name}`);
        // Note: We'd need to expose the scanFolder method or create a new public method
        // For now, we'll trigger a full workspace scan
        vscode.commands.executeCommand('dev-atlas.scanWorkspace');
      }

      // Remove nodes from removed folders
      for (const folder of event.removed) {
        log(`Workspace folder removed: ${folder.name}`);
        // This would require a method to clean up nodes from a specific folder
        // For now, we'll just log it
      }
    } catch (error) {
      log(`Error handling workspace folder changes: ${error}`, 'error');
    }
  }

  /**
   * Determines if a file is important enough to show notifications.
   */
  private isImportantFile(uri: vscode.Uri): boolean {
    const fileName = uri.fsPath.toLowerCase();
    const importantFiles = [
      'package.json',
      'tsconfig.json',
      'readme.md',
      'index.ts',
      'index.js',
      'main.ts',
      'main.js',
      'app.ts',
      'app.js',
    ];

    return importantFiles.some((important) => fileName.endsWith(important));
  }

  /**
   * Utility method to add delays.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets the current watching status.
   */
  isCurrentlyWatching(): boolean {
    return this.isWatching;
  }

  /**
   * Gets the number of active watchers.
   */
  getWatcherCount(): number {
    return this.watchers.length;
  }

  /**
   * Disposes all resources.
   */
  dispose(): void {
    this.stopWatching();
  }
}
