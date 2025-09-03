import * as vscode from 'vscode';
import { z } from 'zod';
import { log } from '../extension';
import type { KnowledgeGraphProvider } from '../views/KnowledgeGraphProvider';

// Global provider type
type GlobalWithProvider = typeof globalThis & {
  devAtlasKnowledgeGraphProvider?: KnowledgeGraphProvider;
};

const CreateNodeSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  label: z.string().min(1, 'Label is required'),
  properties: z.record(z.any()).optional(),
});

/**
 * VS Code command for creating a new node in the knowledge graph.
 * Prompts the user for node type, label, and optional properties through input boxes.
 * Validates the input and creates the node using the knowledge graph provider.
 */
export async function createNodeCommand() {
  log('Create node command started');
  try {
    // Show input box for node type
    const type = await vscode.window.showInputBox({
      prompt: 'Enter node type',
      placeHolder: 'e.g., Technology, Person, Concept',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Type is required';
        }
        return null;
      },
    });

    if (!type) {
      return;
    }

    // Show input box for node label
    const label = await vscode.window.showInputBox({
      prompt: 'Enter node label',
      placeHolder: 'e.g., React, John Doe, Machine Learning',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Label is required';
        }
        return null;
      },
    });

    if (!label) {
      return;
    }

    // Show input box for properties (optional)
    const propertiesInput = await vscode.window.showInputBox({
      prompt: 'Enter properties as JSON (optional)',
      placeHolder: '{"description": "A JavaScript library", "version": "18.0"}',
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

    // Validate the complete node data
    const nodeData = CreateNodeSchema.parse({
      type: type.trim(),
      label: label.trim(),
      properties,
    });

    // Get the knowledge graph provider from the extension
    const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
    if (!knowledgeGraphProvider) {
      vscode.window.showErrorMessage('Knowledge graph provider not available');
      log('Knowledge graph provider not found', 'error');
      return;
    }

    // Create the node using the provider
    await knowledgeGraphProvider.addNode(nodeData.label, nodeData.type, nodeData.properties);
    log(`Node created: ${nodeData.label} (${nodeData.type})`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      vscode.window.showErrorMessage(`Validation error: ${errorMessage}`);
      log(`Validation error: ${errorMessage}`, 'error');
    } else {
      vscode.window.showErrorMessage(`Error creating node: ${error}`);
      log(`Error creating node: ${error}`, 'error');
    }
  }
}
