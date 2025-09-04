import * as vscode from 'vscode';
import * as path from 'path';
import { z } from 'zod';
import type { KnowledgeGraphDB } from '../db/index';
import { log } from '../extension';

// Global provider type
type GlobalWithProvider = typeof globalThis & {
  devAtlasKnowledgeGraphProvider?: any;
};

/**
 * Adds a file or folder to the knowledge graph from the file explorer.
 */
export async function addToKnowledgeGraphCommand(uri?: vscode.Uri) {
  log('Add to knowledge graph command started');

  try {
    // Get the selected file/folder URI
    const targetUri = uri || await getSelectedFileUri();
    if (!targetUri) {
      vscode.window.showWarningMessage('No file or folder selected');
      return;
    }

    const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
    if (!knowledgeGraphProvider) {
      vscode.window.showErrorMessage('Knowledge graph provider not available');
      return;
    }

    const db = knowledgeGraphProvider.getDatabase();
    if (!db) {
      vscode.window.showErrorMessage('Database not available');
      return;
    }

    // Get file/folder information
    const stat = await vscode.workspace.fs.stat(targetUri);
    const isDirectory = stat.type === vscode.FileType.Directory;
    const fileName = path.basename(targetUri.fsPath);
    const relativePath = vscode.workspace.asRelativePath(targetUri);

    // Check if node already exists
    const existingNodes = await db.queryNodes({ label: fileName });
    const existingNode = existingNodes.find((node: any) => 
      node.properties?.path === relativePath
    );

    if (existingNode) {
      vscode.window.showInformationMessage(`"${fileName}" is already in the knowledge graph`);
      return;
    }

    // Create node based on type
    let nodeType = isDirectory ? 'Folder' : 'File';
    
    if (!isDirectory) {
      const extension = path.extname(fileName);
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h'].includes(extension)) {
        nodeType = 'SourceFile';
      } else if (['.json', '.yaml', '.yml', '.xml'].includes(extension)) {
        nodeType = 'ConfigFile';
      } else if (['.md', '.txt', '.doc'].includes(extension)) {
        nodeType = 'DocumentFile';
      }
    }

    // Get additional properties from user
    const properties = await getAdditionalProperties(fileName, nodeType, isDirectory);
    if (properties === null) {
      return; // User cancelled
    }

    // Create the node
    const node = await db.createNode({
      type: nodeType,
      label: fileName,
      properties: {
        path: relativePath,
        fullPath: targetUri.fsPath,
        size: stat.size,
        isDirectory,
        addedManually: true,
        addedAt: new Date().toISOString(),
        ...properties,
      },
    });

    // If it's a directory, offer to scan its contents
    if (isDirectory) {
      const scanContents = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        {
          placeHolder: 'Scan folder contents and add to knowledge graph?',
          title: 'Folder Scanning',
        }
      );

      if (scanContents === 'Yes') {
        await scanFolderContents(targetUri, db, node.id);
      }
    }

    // Refresh the knowledge graph view
    await knowledgeGraphProvider.refresh();
    
    vscode.window.showInformationMessage(`Added "${fileName}" to knowledge graph`);
    log(`Added node to knowledge graph: ${fileName} (${nodeType})`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to add to knowledge graph: ${error}`);
    log(`Add to knowledge graph error: ${error}`, 'error');
  }
}

/**
 * Creates a relationship between two files in the knowledge graph.
 */
export async function createRelationshipCommand(uri?: vscode.Uri) {
  log('Create relationship command started');

  try {
    const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
    if (!knowledgeGraphProvider) {
      vscode.window.showErrorMessage('Knowledge graph provider not available');
      return;
    }

    const db = knowledgeGraphProvider.getDatabase();
    if (!db) {
      vscode.window.showErrorMessage('Database not available');
      return;
    }

    // Get source file
    const sourceUri = uri || await getSelectedFileUri();
    if (!sourceUri) {
      vscode.window.showWarningMessage('No source file selected');
      return;
    }

    const sourceFileName = path.basename(sourceUri.fsPath);
    const sourceRelativePath = vscode.workspace.asRelativePath(sourceUri);

    // Find source node
    const sourceNodes = await db.queryNodes({ label: sourceFileName });
    const sourceNode = sourceNodes.find((node: any) => 
      node.properties?.path === sourceRelativePath
    );

    if (!sourceNode) {
      const addSource = await vscode.window.showQuickPick(
        ['Yes', 'No'],
        {
          placeHolder: `"${sourceFileName}" is not in the knowledge graph. Add it first?`,
        }
      );

      if (addSource === 'Yes') {
        await addToKnowledgeGraphCommand(sourceUri);
        return createRelationshipCommand(uri); // Retry
      } else {
        return;
      }
    }

    // Get all nodes for target selection
    const allNodes = await db.queryNodes({ limit: 100 });
    
    interface TargetOption extends vscode.QuickPickItem {
      node: any;
    }
    
    const targetOptions: TargetOption[] = allNodes
      .filter((node: any) => node.id !== sourceNode.id)
      .map((node: any) => ({
        label: `${node.label} (${node.type})`,
        description: node.properties?.path || '',
        node,
      }));

    if (targetOptions.length === 0) {
      vscode.window.showInformationMessage('No other nodes available for relationship creation');
      return;
    }

    // Select target node
    const targetSelection = await vscode.window.showQuickPick(targetOptions, {
      placeHolder: 'Select target node for relationship',
      title: 'Create Relationship',
    }) as TargetOption | undefined;

    if (!targetSelection) {
      return;
    }

    const targetNode = targetSelection.node;

    // Select relationship type
    const relationshipType = await vscode.window.showQuickPick(
      [
        { label: 'depends_on', description: 'Source depends on target' },
        { label: 'imports', description: 'Source imports from target' },
        { label: 'extends', description: 'Source extends target' },
        { label: 'implements', description: 'Source implements target' },
        { label: 'uses', description: 'Source uses target' },
        { label: 'contains', description: 'Source contains target' },
        { label: 'related_to', description: 'Source is related to target' },
        { label: 'custom', description: 'Enter custom relationship type' },
      ],
      {
        placeHolder: 'Select relationship type',
        title: 'Relationship Type',
      }
    );

    if (!relationshipType) {
      return;
    }

    let finalRelationshipType = relationshipType.label;
    if (relationshipType.label === 'custom') {
      const customType = await vscode.window.showInputBox({
        prompt: 'Enter custom relationship type',
        placeHolder: 'e.g., calls, references, configures',
      });

      if (!customType) {
        return;
      }
      finalRelationshipType = customType;
    }

    // Get optional description
    const description = await vscode.window.showInputBox({
      prompt: 'Enter relationship description (optional)',
      placeHolder: 'Brief description of the relationship',
    });

    // Create the edge
    await db.createEdge({
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      type: finalRelationshipType,
      properties: {
        description: description || '',
        createdManually: true,
        createdAt: new Date().toISOString(),
      },
    });

    // Refresh the knowledge graph view
    await knowledgeGraphProvider.refresh();

    vscode.window.showInformationMessage(
      `Created relationship: "${sourceNode.label}" ${finalRelationshipType} "${targetNode.label}"`
    );
    
    log(`Created relationship: ${sourceNode.id} -> ${targetNode.id} (${finalRelationshipType})`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create relationship: ${error}`);
    log(`Create relationship error: ${error}`, 'error');
  }
}

/**
 * Shows knowledge graph information for a selected file.
 */
export async function showFileInfoCommand(uri?: vscode.Uri) {
  log('Show file info command started');

  try {
    const targetUri = uri || await getSelectedFileUri();
    if (!targetUri) {
      vscode.window.showWarningMessage('No file selected');
      return;
    }

    const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
    if (!knowledgeGraphProvider) {
      vscode.window.showErrorMessage('Knowledge graph provider not available');
      return;
    }

    const db = knowledgeGraphProvider.getDatabase();
    if (!db) {
      vscode.window.showErrorMessage('Database not available');
      return;
    }

    const fileName = path.basename(targetUri.fsPath);
    const relativePath = vscode.workspace.asRelativePath(targetUri);

    // Find the node
    const nodes = await db.queryNodes({ label: fileName });
    const node = nodes.find((n: any) => n.properties?.path === relativePath);

    if (!node) {
      vscode.window.showInformationMessage(
        `"${fileName}" is not in the knowledge graph. Use "Add to Knowledge Graph" to add it.`
      );
      return;
    }

    // Get connected edges
    const incomingEdges = await db.queryEdges({ targetId: node.id });
    const outgoingEdges = await db.queryEdges({ sourceId: node.id });

    // Build info display
    let info = `# Knowledge Graph Info: ${node.label}\n\n`;
    info += `**Type:** ${node.type}\n`;
    info += `**Path:** ${relativePath}\n`;
    info += `**Node ID:** ${node.id}\n\n`;

    if (node.properties) {
      info += `## Properties\n`;
      for (const [key, value] of Object.entries(node.properties)) {
        info += `- **${key}:** ${value}\n`;
      }
      info += '\n';
    }

    if (outgoingEdges.length > 0) {
      info += `## Outgoing Relationships (${outgoingEdges.length})\n`;
      for (const edge of outgoingEdges.slice(0, 10)) {
        const targetNode = await db.getNode(edge.targetId);
        info += `- **${edge.type}** → ${targetNode?.label || edge.targetId}\n`;
      }
      if (outgoingEdges.length > 10) {
        info += `- ... and ${outgoingEdges.length - 10} more\n`;
      }
      info += '\n';
    }

    if (incomingEdges.length > 0) {
      info += `## Incoming Relationships (${incomingEdges.length})\n`;
      for (const edge of incomingEdges.slice(0, 10)) {
        const sourceNode = await db.getNode(edge.sourceId);
        info += `- ${sourceNode?.label || edge.sourceId} **${edge.type}** → this\n`;
      }
      if (incomingEdges.length > 10) {
        info += `- ... and ${incomingEdges.length - 10} more\n`;
      }
      info += '\n';
    }

    if (incomingEdges.length === 0 && outgoingEdges.length === 0) {
      info += `## Relationships\nNo relationships found.\n\n`;
    }

    // Show in a new document
    const doc = await vscode.workspace.openTextDocument({
      content: info,
      language: 'markdown',
    });
    
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to show file info: ${error}`);
    log(`Show file info error: ${error}`, 'error');
  }
}

/**
 * Gets additional properties for a node from the user.
 */
async function getAdditionalProperties(
  fileName: string,
  nodeType: string,
  isDirectory: boolean
): Promise<Record<string, unknown> | null> {
  const properties: Record<string, unknown> = {};

  // Ask for description
  const description = await vscode.window.showInputBox({
    prompt: `Enter description for "${fileName}" (optional)`,
    placeHolder: `Brief description of this ${isDirectory ? 'folder' : 'file'}`,
  });

  if (description) {
    properties.description = description;
  }

  // Ask for tags
  const tags = await vscode.window.showInputBox({
    prompt: 'Enter tags (optional, comma-separated)',
    placeHolder: 'e.g., utility, component, config',
  });

  if (tags) {
    properties.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
  }

  // For source files, ask for additional info
  if (nodeType === 'SourceFile') {
    const importance = await vscode.window.showQuickPick(
      ['Low', 'Medium', 'High', 'Critical'],
      {
        placeHolder: 'Select importance level (optional)',
        title: 'File Importance',
      }
    );

    if (importance) {
      properties.importance = importance.toLowerCase();
    }
  }

  return properties;
}

/**
 * Gets the currently selected file URI from the explorer.
 */
async function getSelectedFileUri(): Promise<vscode.Uri | undefined> {
  // Try to get from active editor first
  if (vscode.window.activeTextEditor) {
    return vscode.window.activeTextEditor.document.uri;
  }

  // If no active editor, ask user to select a file
  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
  });

  return files?.[0];
}

/**
 * Scans folder contents and adds them to the knowledge graph.
 */
async function scanFolderContents(
  folderUri: vscode.Uri,
  db: KnowledgeGraphDB,
  parentNodeId: string
): Promise<void> {
  try {
    const files = await vscode.workspace.fs.readDirectory(folderUri);
    
    for (const [name, type] of files) {
      // Skip hidden files and common ignore patterns
      if (name.startsWith('.') || name === 'node_modules' || name === 'dist') {
        continue;
      }

      const childUri = vscode.Uri.joinPath(folderUri, name);
      const isDirectory = type === vscode.FileType.Directory;
      
      // Create child node
      const childNode = await db.createNode({
        type: isDirectory ? 'Folder' : 'File',
        label: name,
        properties: {
          path: vscode.workspace.asRelativePath(childUri),
          fullPath: childUri.fsPath,
          isDirectory,
          scannedAt: new Date().toISOString(),
        },
      });

      // Connect to parent
      await db.createEdge({
        sourceId: parentNodeId,
        targetId: childNode.id,
        type: 'contains',
        properties: {
          relationship: 'parent contains child',
        },
      });

      log(`Added child node: ${name} (${isDirectory ? 'folder' : 'file'})`);
    }
  } catch (error) {
    log(`Failed to scan folder contents: ${error}`, 'error');
    throw error;
  }
}
