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
          {
            name: 'update_node',
            description: 'Update an existing node',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Node ID to update' },
                label: { type: 'string', description: 'New label for the node' },
                properties: { type: 'object', description: 'New properties for the node' },
              },
              required: ['id'],
            },
          },
          {
            name: 'update_edge',
            description: 'Update an existing edge',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Edge ID to update' },
                type: { type: 'string', description: 'New type for the edge' },
                properties: { type: 'object', description: 'New properties for the edge' },
                weight: { type: 'number', description: 'New weight for the edge' },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_node',
            description: 'Delete a node and all its connected edges',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Node ID to delete' },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_edge',
            description: 'Delete an edge',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Edge ID to delete' },
              },
              required: ['id'],
            },
          },
          {
            name: 'bulk_create_nodes',
            description: 'Create multiple nodes at once for better efficiency',
            inputSchema: {
              type: 'object',
              properties: {
                nodes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', description: 'Type of the node' },
                      label: { type: 'string', description: 'Label for the node' },
                      properties: { type: 'object', description: 'Additional properties' },
                    },
                    required: ['type', 'label'],
                  },
                  description: 'Array of nodes to create',
                },
              },
              required: ['nodes'],
            },
          },
          {
            name: 'bulk_create_edges',
            description: 'Create multiple edges at once for better efficiency',
            inputSchema: {
              type: 'object',
              properties: {
                edges: {
                  type: 'array',
                  items: {
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
                  description: 'Array of edges to create',
                },
              },
              required: ['edges'],
            },
          },
          {
            name: 'search_nodes',
            description: 'Search nodes by text content in labels and properties',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query text' },
                limit: { type: 'number', description: 'Maximum number of results', default: 20 },
                types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by node types'
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'find_path',
            description: 'Find shortest path between two nodes',
            inputSchema: {
              type: 'object',
              properties: {
                fromNodeId: { type: 'string', description: 'Starting node ID' },
                toNodeId: { type: 'string', description: 'Target node ID' },
                maxDepth: { type: 'number', description: 'Maximum search depth', default: 6 },
              },
              required: ['fromNodeId', 'toNodeId'],
            },
          },
          {
            name: 'get_subgraph',
            description: 'Get a subgraph around specific nodes within a certain depth',
            inputSchema: {
              type: 'object',
              properties: {
                nodeIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Center node IDs for the subgraph'
                },
                depth: { type: 'number', description: 'Depth to traverse from center nodes', default: 2 },
                includeEdgeTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Only include edges of these types'
                },
              },
              required: ['nodeIds'],
            },
          },
          {
            name: 'analyze_file',
            description: 'Analyze a source code file and extract entities (functions, classes, imports)',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Path to the source code file' },
                language: { type: 'string', description: 'Programming language (js, ts, py, etc.)' },
                createNodes: { type: 'boolean', description: 'Whether to create nodes for discovered entities', default: false },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'extract_dependencies',
            description: 'Extract dependencies from package files (package.json, requirements.txt, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Path to the dependency file' },
                createNodes: { type: 'boolean', description: 'Whether to create dependency nodes', default: false },
                projectNodeId: { type: 'string', description: 'ID of project node to link dependencies to' },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'map_directory',
            description: 'Map a directory structure and create nodes for files and folders',
            inputSchema: {
              type: 'object',
              properties: {
                directoryPath: { type: 'string', description: 'Path to the directory to map' },
                maxDepth: { type: 'number', description: 'Maximum depth to traverse', default: 3 },
                includeFiles: { type: 'boolean', description: 'Include individual files', default: true },
                createNodes: { type: 'boolean', description: 'Whether to create nodes for the structure', default: false },
              },
              required: ['directoryPath'],
            },
          },
          {
            name: 'get_graph_stats',
            description: 'Get statistics about the knowledge graph',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'export_graph',
            description: 'Export the graph in various formats (JSON, DOT, CSV)',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['json', 'dot', 'csv'],
                  description: 'Export format',
                  default: 'json'
                },
                includeNodes: { type: 'boolean', description: 'Include nodes in export', default: true },
                includeEdges: { type: 'boolean', description: 'Include edges in export', default: true },
                nodeTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by node types'
                },
              },
            },
          },
          {
            name: 'detect_patterns',
            description: 'Detect design patterns, architectural patterns, and code smells in codebase',
            inputSchema: {
              type: 'object',
              properties: {
                directoryPath: { type: 'string', description: 'Directory to analyze for patterns' },
                patternTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Types of patterns to detect: design, architectural, code_smells'
                },
                createNodes: { type: 'boolean', description: 'Create nodes for detected patterns', default: false },
                language: { type: 'string', description: 'Primary programming language hint' },
              },
              required: ['directoryPath'],
            },
          },
          {
            name: 'extract_todos',
            description: 'Extract and track TODOs, FIXMEs, and other code annotations',
            inputSchema: {
              type: 'object',
              properties: {
                directoryPath: { type: 'string', description: 'Directory to scan for TODOs' },
                includeTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Annotation types to extract: TODO, FIXME, HACK, NOTE, BUG',
                  default: ['TODO', 'FIXME', 'HACK', 'NOTE', 'BUG']
                },
                createNodes: { type: 'boolean', description: 'Create nodes for TODOs', default: false },
                assignToFiles: { type: 'boolean', description: 'Link TODOs to their source files', default: true },
              },
              required: ['directoryPath'],
            },
          },
          {
            name: 'monitor_changes',
            description: 'Monitor file changes and update knowledge graph automatically',
            inputSchema: {
              type: 'object',
              properties: {
                directoryPath: { type: 'string', description: 'Directory to monitor' },
                action: {
                  type: 'string',
                  enum: ['start', 'stop', 'status', 'sync'],
                  description: 'Monitor action: start watching, stop watching, check status, or sync changes'
                },
                includePatterns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'File patterns to monitor (e.g., "*.js", "*.py")'
                },
                excludePatterns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'File patterns to ignore (e.g., "node_modules/**", "*.log")'
                },
              },
              required: ['directoryPath', 'action'],
            },
          },
          {
            name: 'semantic_analysis',
            description: 'Analyze semantic relationships and improve code understanding',
            inputSchema: {
              type: 'object',
              properties: {
                nodeIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Node IDs to analyze for semantic relationships'
                },
                analysisType: {
                  type: 'string',
                  enum: ['similarity', 'clustering', 'naming', 'usage_patterns'],
                  description: 'Type of semantic analysis to perform'
                },
                createRelationships: { type: 'boolean', description: 'Create new relationship edges', default: false },
                threshold: { type: 'number', description: 'Similarity threshold (0-1)', default: 0.7 },
              },
              required: ['nodeIds', 'analysisType'],
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

          case 'update_node': {
            const { id, label, properties } = args as { id: string; label?: string; properties?: any };
            const updated = await this.db.updateNode(id, { label, properties });
            if (!updated) {
              return {
                content: [{ type: 'text', text: `Node with ID ${id} not found` }],
                isError: true,
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `Updated node: ${JSON.stringify(updated, null, 2)}`,
                },
              ],
            };
          }

          case 'update_edge': {
            const { id, type, properties, weight } = args as {
              id: string;
              type?: string;
              properties?: any;
              weight?: number;
            };
            const updated = await this.db.updateEdge(id, { type, properties, weight });
            if (!updated) {
              return {
                content: [{ type: 'text', text: `Edge with ID ${id} not found` }],
                isError: true,
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `Updated edge: ${JSON.stringify(updated, null, 2)}`,
                },
              ],
            };
          }

          case 'delete_node': {
            const { id } = args as { id: string };
            const deleted = await this.db.deleteNode(id);
            if (!deleted) {
              return {
                content: [{ type: 'text', text: `Node with ID ${id} not found` }],
                isError: true,
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `Deleted node ${id} and ${deleted.deletedEdges} connected edges`,
                },
              ],
            };
          }

          case 'delete_edge': {
            const { id } = args as { id: string };
            const deleted = await this.db.deleteEdge(id);
            if (!deleted) {
              return {
                content: [{ type: 'text', text: `Edge with ID ${id} not found` }],
                isError: true,
              };
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `Deleted edge: ${JSON.stringify(deleted, null, 2)}`,
                },
              ],
            };
          }

          case 'bulk_create_nodes': {
            const { nodes } = args as { nodes: any[] };
            const created = await this.db.bulkCreateNodes(nodes);
            return {
              content: [
                {
                  type: 'text',
                  text: `Created ${created.length} nodes:\n${JSON.stringify(created.map(n => ({ id: n.id, type: n.type, label: n.label })), null, 2)}`,
                },
              ],
            };
          }

          case 'bulk_create_edges': {
            const { edges } = args as { edges: any[] };
            const created = await this.db.bulkCreateEdges(edges);
            return {
              content: [
                {
                  type: 'text',
                  text: `Created ${created.length} edges:\n${JSON.stringify(created.map(e => ({ id: e.id, type: e.type, sourceId: e.sourceId, targetId: e.targetId })), null, 2)}`,
                },
              ],
            };
          }

          case 'search_nodes': {
            const { query, limit = 20, types } = args as { query: string; limit?: number; types?: string[] };
            const results = await this.db.searchNodes(query, { limit, types });
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${results.length} matching nodes:\n${JSON.stringify(results, null, 2)}`,
                },
              ],
            };
          }

          case 'find_path': {
            const { fromNodeId, toNodeId, maxDepth = 6 } = args as {
              fromNodeId: string;
              toNodeId: string;
              maxDepth?: number;
            };
            const path = await this.db.findPath(fromNodeId, toNodeId, maxDepth);
            return {
              content: [
                {
                  type: 'text',
                  text: path
                    ? `Found path (length ${path.length - 1}):\n${JSON.stringify(path, null, 2)}`
                    : `No path found between ${fromNodeId} and ${toNodeId} within depth ${maxDepth}`,
                },
              ],
            };
          }

          case 'get_subgraph': {
            const { nodeIds, depth = 2, includeEdgeTypes } = args as {
              nodeIds: string[];
              depth?: number;
              includeEdgeTypes?: string[];
            };
            const subgraph = await this.db.getSubgraph(nodeIds, depth, includeEdgeTypes);
            return {
              content: [
                {
                  type: 'text',
                  text: `Subgraph contains ${subgraph.nodes.length} nodes and ${subgraph.edges.length} edges:\n${JSON.stringify(subgraph, null, 2)}`,
                },
              ],
            };
          }

          case 'analyze_file': {
            const { filePath, language, createNodes = false } = args as {
              filePath: string;
              language?: string;
              createNodes?: boolean;
            };
            const analysis = await this.db.analyzeFile(filePath, language, createNodes);
            return {
              content: [
                {
                  type: 'text',
                  text: `File analysis for ${filePath}:\n${JSON.stringify(analysis, null, 2)}`,
                },
              ],
            };
          }

          case 'extract_dependencies': {
            const { filePath, createNodes = false, projectNodeId } = args as {
              filePath: string;
              createNodes?: boolean;
              projectNodeId?: string;
            };
            const dependencies = await this.db.extractDependencies(filePath, createNodes, projectNodeId);
            return {
              content: [
                {
                  type: 'text',
                  text: `Dependencies from ${filePath}:\n${JSON.stringify(dependencies, null, 2)}`,
                },
              ],
            };
          }

          case 'map_directory': {
            const { directoryPath, maxDepth = 3, includeFiles = true, createNodes = false } = args as {
              directoryPath: string;
              maxDepth?: number;
              includeFiles?: boolean;
              createNodes?: boolean;
            };
            const structure = await this.db.mapDirectory(directoryPath, maxDepth, includeFiles, createNodes);
            return {
              content: [
                {
                  type: 'text',
                  text: `Directory structure for ${directoryPath}:\n${JSON.stringify(structure, null, 2)}`,
                },
              ],
            };
          }

          case 'get_graph_stats': {
            const stats = await this.db.getGraphStats();
            return {
              content: [
                {
                  type: 'text',
                  text: `Graph Statistics:\n${JSON.stringify(stats, null, 2)}`,
                },
              ],
            };
          }

          case 'export_graph': {
            const { format = 'json', includeNodes = true, includeEdges = true, nodeTypes } = args as {
              format?: 'json' | 'dot' | 'csv';
              includeNodes?: boolean;
              includeEdges?: boolean;
              nodeTypes?: string[];
            };
            const exported = await this.db.exportGraph(format, { includeNodes, includeEdges, nodeTypes });
            return {
              content: [
                {
                  type: 'text',
                  text: `Graph exported in ${format} format:\n${exported}`,
                },
              ],
            };
          }

          case 'detect_patterns': {
            const { directoryPath, patternTypes, createNodes = false, language } = args as {
              directoryPath: string;
              patternTypes?: string[];
              createNodes?: boolean;
              language?: string;
            };
            const patterns = await this.db.detectPatterns(directoryPath, { patternTypes, createNodes, language });
            return {
              content: [
                {
                  type: 'text',
                  text: `Pattern detection in ${directoryPath}:\n${JSON.stringify(patterns, null, 2)}`,
                },
              ],
            };
          }

          case 'extract_todos': {
            const { directoryPath, includeTypes = ['TODO', 'FIXME', 'HACK', 'NOTE', 'BUG'], createNodes = false, assignToFiles = true } = args as {
              directoryPath: string;
              includeTypes?: string[];
              createNodes?: boolean;
              assignToFiles?: boolean;
            };
            const todos = await this.db.extractTodos(directoryPath, { includeTypes, createNodes, assignToFiles });
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${todos.length} annotations in ${directoryPath}:\n${JSON.stringify(todos, null, 2)}`,
                },
              ],
            };
          }

          case 'monitor_changes': {
            const { directoryPath, action, includePatterns, excludePatterns } = args as {
              directoryPath: string;
              action: 'start' | 'stop' | 'status' | 'sync';
              includePatterns?: string[];
              excludePatterns?: string[];
            };
            const result = await this.db.monitorChanges(directoryPath, action, { includePatterns, excludePatterns });
            return {
              content: [
                {
                  type: 'text',
                  text: `Change monitoring ${action} for ${directoryPath}:\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            };
          }

          case 'semantic_analysis': {
            const { nodeIds, analysisType, createRelationships = false, threshold = 0.7 } = args as {
              nodeIds: string[];
              analysisType: 'similarity' | 'clustering' | 'naming' | 'usage_patterns';
              createRelationships?: boolean;
              threshold?: number;
            };
            const analysis = await this.db.semanticAnalysis(nodeIds, analysisType, { createRelationships, threshold });
            return {
              content: [
                {
                  type: 'text',
                  text: `Semantic analysis (${analysisType}) results:\n${JSON.stringify(analysis, null, 2)}`,
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