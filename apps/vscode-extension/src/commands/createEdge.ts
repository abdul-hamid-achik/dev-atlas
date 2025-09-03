import * as vscode from 'vscode';
import { z } from 'zod';

const CreateEdgeSchema = z.object({
  sourceId: z.string().min(1, 'Source ID is required'),
  targetId: z.string().min(1, 'Target ID is required'),
  type: z.string().min(1, 'Edge type is required'),
  properties: z.record(z.any()).optional(),
  weight: z.number().optional(),
});

export async function createEdgeCommand() {
  try {
    // Show input box for source node ID
    const sourceId = await vscode.window.showInputBox({
      prompt: 'Enter source node ID',
      placeHolder: 'e.g., node-1, person-123',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Source ID is required';
        }
        return null;
      },
    });

    if (!sourceId) {
      return;
    }

    // Show input box for target node ID
    const targetId = await vscode.window.showInputBox({
      prompt: 'Enter target node ID',
      placeHolder: 'e.g., node-2, concept-456',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Target ID is required';
        }
        if (value === sourceId) {
          return 'Target ID must be different from source ID';
        }
        return null;
      },
    });

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
        const num = parseFloat(value);
        if (isNaN(num)) {
          return 'Weight must be a number';
        }
        return null;
      },
    });

    let weight: number | undefined;
    if (weightInput && weightInput.trim().length > 0) {
      weight = parseFloat(weightInput);
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

    // Generate a unique ID
    const id = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Here you would typically call your MCP server or database
    // For now, we'll just show a success message
    vscode.window.showInformationMessage(
      `Edge created successfully!\nID: ${id}\nType: ${edgeData.type}\nFrom: ${edgeData.sourceId} -> To: ${edgeData.targetId}`
    );

    // Log the edge data for debugging
    console.log('Created edge:', { id, ...edgeData });

    // TODO: Integrate with MCP server to actually create the edge
    // await mcpClient.callTool('create_edge', edgeData);

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      vscode.window.showErrorMessage(`Validation error: ${errorMessage}`);
    } else {
      vscode.window.showErrorMessage(`Error creating edge: ${error}`);
    }
  }
}