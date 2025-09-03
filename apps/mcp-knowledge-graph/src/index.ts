#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { KnowledgeGraphDB } from './db/index.js';
import {
  CreateNodeSchema,
  CreateEdgeSchema,
  QueryNodesSchema,
  QueryEdgesSchema
} from './types/schema.js';

class KnowledgeGraphMCPServer {
  private server: Server;
  private db: KnowledgeGraphDB;

  constructor() {
    console.error('[MCP Server] Starting Knowledge Graph MCP Server...');

    this.server = new Server({
      name: 'knowledge-graph-mcp',
      version: '0.2.0',
    });

    this.db = new KnowledgeGraphDB();
    this.setupToolHandlers();

    console.error('[MCP Server] Knowledge Graph MCP Server initialized');
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_node',
            description: 'Create a new node in the knowledge graph',
            inputSchema: {
              type: 'object',
              properties: {
                type: { type: 'string', description: 'Type of the node' },
                label: { type: 'string', description: 'Label for the node' },
                properties: { type: 'object', description: 'Additional properties' },
              },
              required: ['type', 'label'],
            },
          },
          {
            name: 'create_edge',
            description: 'Create a new edge between two nodes',
            inputSchema: {
              type: 'object',
              properties: {
                sourceId: { type: 'string', description: 'Source node ID' },
                targetId: { type: 'string', description: 'Target node ID' },
                type: { type: 'string', description: 'Type of the edge' },
                properties: { type: 'object', description: 'Additional properties' },
                weight: { type: 'number', description: 'Weight of the edge' },
              },
              required: ['sourceId', 'targetId', 'type'],
            },
          },
          {
            name: 'get_node',
            description: 'Get a node by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Node ID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'get_edge',
            description: 'Get an edge by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Edge ID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'query_nodes',
            description: 'Query nodes with filters',
            inputSchema: {
              type: 'object',
              properties: {
                type: { type: 'string', description: 'Filter by node type' },
                label: { type: 'string', description: 'Filter by label (partial match)' },
                limit: { type: 'number', description: 'Maximum number of results' },
                offset: { type: 'number', description: 'Number of results to skip' },
              },
            },
          },
          {
            name: 'query_edges',
            description: 'Query edges with filters',
            inputSchema: {
              type: 'object',
              properties: {
                sourceId: { type: 'string', description: 'Filter by source node ID' },
                targetId: { type: 'string', description: 'Filter by target node ID' },
                type: { type: 'string', description: 'Filter by edge type' },
                limit: { type: 'number', description: 'Maximum number of results' },
                offset: { type: 'number', description: 'Number of results to skip' },
              },
            },
          },
          {
            name: 'get_neighbors',
            description: 'Get neighboring nodes of a given node',
            inputSchema: {
              type: 'object',
              properties: {
                nodeId: { type: 'string', description: 'Node ID to get neighbors for' },
                direction: {
                  type: 'string',
                  enum: ['in', 'out', 'both'],
                  description: 'Direction of edges to follow',
                  default: 'both'
                },
              },
              required: ['nodeId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_node': {
            const validatedArgs = CreateNodeSchema.parse(args);
            const node = await this.db.createNode(validatedArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: `Created node: ${JSON.stringify(node, null, 2)}`,
                },
              ],
            };
          }

          case 'create_edge': {
            const validatedArgs = CreateEdgeSchema.parse(args);
            const edge = await this.db.createEdge(validatedArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: `Created edge: ${JSON.stringify(edge, null, 2)}`,
                },
              ],
            };
          }

          case 'get_node': {
            const { id } = args as { id: string };
            const node = await this.db.getNode(id);
            if (!node) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Node with ID ${id} not found`,
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `Node: ${JSON.stringify(node, null, 2)}`,
                },
              ],
            };
          }

          case 'get_edge': {
            const { id } = args as { id: string };
            const edge = await this.db.getEdge(id);
            if (!edge) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Edge with ID ${id} not found`,
                  },
                ],
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `Edge: ${JSON.stringify(edge, null, 2)}`,
                },
              ],
            };
          }

          case 'query_nodes': {
            const validatedArgs = QueryNodesSchema.parse(args);
            const nodes = await this.db.queryNodes(validatedArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${nodes.length} nodes:\n${JSON.stringify(nodes, null, 2)}`,
                },
              ],
            };
          }

          case 'query_edges': {
            const validatedArgs = QueryEdgesSchema.parse(args);
            const edges = await this.db.queryEdges(validatedArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${edges.length} edges:\n${JSON.stringify(edges, null, 2)}`,
                },
              ],
            };
          }

          case 'get_neighbors': {
            const { nodeId, direction = 'both' } = args as {
              nodeId: string;
              direction?: 'in' | 'out' | 'both'
            };
            const neighbors = await this.db.getNeighbors(nodeId, direction);
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${neighbors.length} neighbors (${direction}):\n${JSON.stringify(neighbors, null, 2)}`,
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[MCP Server] Knowledge Graph MCP Server running on stdio');
    console.error('[MCP Server] Ready to accept requests');
  }
}

const server = new KnowledgeGraphMCPServer();
server.run().catch(console.error);