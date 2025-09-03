import * as vscode from 'vscode';
import { z } from 'zod';

const CreateNodeSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  label: z.string().min(1, 'Label is required'),
  properties: z.record(z.any()).optional(),
});

export async function createNodeCommand() {
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

    // Generate a unique ID
    const id = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Here you would typically call your MCP server or database
    // For now, we'll just show a success message
    vscode.window.showInformationMessage(
      `Node created successfully!\nID: ${id}\nType: ${nodeData.type}\nLabel: ${nodeData.label}`
    );

    // Log the node data for debugging
    console.log('Created node:', { id, ...nodeData });

    // TODO: Integrate with MCP server to actually create the node
    // await mcpClient.callTool('create_node', nodeData);

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      vscode.window.showErrorMessage(`Validation error: ${errorMessage}`);
    } else {
      vscode.window.showErrorMessage(`Error creating node: ${error}`);
    }
  }
}