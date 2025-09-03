import * as vscode from 'vscode';
import { z } from 'zod';
import type { Node } from '../db/schema';
import { log } from '../extension';
import type { KnowledgeGraphProvider } from '../views/KnowledgeGraphProvider';

// Global provider type
type GlobalWithProvider = typeof globalThis & {
  devAtlasKnowledgeGraphProvider?: KnowledgeGraphProvider;
};

const CreateEdgeSchema = z.object({
  sourceId: z.string().min(1, 'Source ID is required'),
  targetId: z.string().min(1, 'Target ID is required'),
  type: z.string().min(1, 'Edge type is required'),
  properties: z.record(z.unknown()).optional(),
  weight: z.number().optional(),
});

export async function createEdgeCommand() {
  log('Create edge command started');
  try {
    // Get available nodes first
    const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
    if (!knowledgeGraphProvider) {
      vscode.window.showErrorMessage('Knowledge graph provider not available');
      log('Knowledge graph provider not found', 'error');
      return;
    }

    const nodes = knowledgeGraphProvider.getNodes();
    if (nodes.length < 2) {
      vscode.window.showErrorMessage(
        'At least 2 nodes are required to create an edge. Create some nodes first.'
      );
      log('Not enough nodes to create edge', 'warn');
      return;
    }

    // Show quick pick for source node
    interface NodeQuickPickItem extends vscode.QuickPickItem {
      nodeId: string;
    }

    const sourceNodeItems: NodeQuickPickItem[] = nodes.map((node: Node) => ({
      label: node.label,
      description: `${node.type} - ${node.id}`,
      detail: node.id,
      nodeId: node.id,
    }));

    const selectedSourceNode = await vscode.window.showQuickPick(sourceNodeItems, {
      placeHolder: 'Select source node',
    });

    if (!selectedSourceNode) {
      return;
    }

    const sourceId = selectedSourceNode.nodeId;

    if (!sourceId) {
      return;
    }

    // Show quick pick for target node (excluding source node)
    const targetNodeItems: NodeQuickPickItem[] = nodes
      .filter((node: Node) => node.id !== sourceId)
      .map((node: Node) => ({
        label: node.label,
        description: `${node.type} - ${node.id}`,
        detail: node.id,
        nodeId: node.id,
      }));

    const selectedTargetNode = await vscode.window.showQuickPick(targetNodeItems, {
      placeHolder: 'Select target node',
    });

    if (!selectedTargetNode) {
      return;
    }

    const targetId = selectedTargetNode.nodeId;

    if (!targetId) {
      return;
    }

    // Show input box for edge type
    const type = await vscode.window.showInputBox({
      prompt: 'Enter edge type',
      placeHolder: 'e.g., uses, depends_on, related_to',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Edge type is required';
        }
        return null;
      },
    });

    if (!type) {
      return;
    }

    // Show input box for weight (optional)
    const weightInput = await vscode.window.showInputBox({
      prompt: 'Enter edge weight (optional)',
      placeHolder: 'e.g., 0.8, 1.0',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return null; // Weight is optional
        }
        const num = Number.parseFloat(value);
        if (Number.isNaN(num)) {
          return 'Weight must be a number';
        }
        return null;
      },
    });

    let weight: number | undefined;
    if (weightInput && weightInput.trim().length > 0) {
      weight = Number.parseFloat(weightInput);
    }

    // Show input box for properties (optional)
    const propertiesInput = await vscode.window.showInputBox({
      prompt: 'Enter properties as JSON (optional)',
      placeHolder: '{"strength": "strong", "confidence": 0.9}',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return null; // Properties are optional
        }
        try {
          JSON.parse(value);
          return null;
        } catch {
          return 'Invalid JSON format';
        }
      },
    });

    let properties = {};
    if (propertiesInput && propertiesInput.trim().length > 0) {
      try {
        properties = JSON.parse(propertiesInput);
      } catch (error) {
        vscode.window.showErrorMessage('Invalid JSON format for properties');
        return;
      }
    }

    // Validate the complete edge data
    const edgeData = CreateEdgeSchema.parse({
      sourceId: sourceId.trim(),
      targetId: targetId.trim(),
      type: type.trim(),
      properties,
      weight,
    });

    // Create the edge using the provider
    await knowledgeGraphProvider.addEdge(edgeData.sourceId, edgeData.targetId, edgeData.type);
    log(`Edge created: ${edgeData.sourceId} -> ${edgeData.targetId} (${edgeData.type})`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      vscode.window.showErrorMessage(`Validation error: ${errorMessage}`);
      log(`Validation error: ${errorMessage}`, 'error');
    } else {
      vscode.window.showErrorMessage(`Error creating edge: ${error}`);
      log(`Error creating edge: ${error}`, 'error');
    }
  }
}
