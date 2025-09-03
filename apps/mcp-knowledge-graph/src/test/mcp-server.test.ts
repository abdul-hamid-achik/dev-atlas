import { describe, it, expect, beforeEach } from 'vitest';
import {
    CreateNodeSchema,
    CreateEdgeSchema,
    QueryNodesSchema,
    QueryEdgesSchema
} from '../types/schema.js';
import { KnowledgeGraphDB } from '../db/index.js';

// Simple tool handler simulator
class MCP_ToolHandler {
    private db: KnowledgeGraphDB;

    constructor() {
        this.db = new KnowledgeGraphDB(':memory:');
    }

    async callTool(name: string, args: any) {
        try {
            switch (name) {
                case 'create_node': {
                    const validatedArgs = CreateNodeSchema.parse(args);
                    const node = await this.db.createNode(validatedArgs);
                    return {
                        success: true,
                        result: node,
                        message: `Created node: ${JSON.stringify(node, null, 2)}`,
                    };
                }

                case 'create_edge': {
                    const validatedArgs = CreateEdgeSchema.parse(args);
                    const edge = await this.db.createEdge(validatedArgs);
                    return {
                        success: true,
                        result: edge,
                        message: `Created edge: ${JSON.stringify(edge, null, 2)}`,
                    };
                }

                case 'get_node': {
                    const { id } = args;
                    const node = await this.db.getNode(id);
                    if (!node) {
                        return {
                            success: false,
                            message: `Node with ID ${id} not found`,
                        };
                    }
                    return {
                        success: true,
                        result: node,
                        message: `Node: ${JSON.stringify(node, null, 2)}`,
                    };
                }

                case 'query_nodes': {
                    const validatedArgs = QueryNodesSchema.parse(args);
                    const nodes = await this.db.queryNodes(validatedArgs);
                    return {
                        success: true,
                        result: nodes,
                        message: `Found ${nodes.length} nodes`,
                    };
                }

                case 'get_neighbors': {
                    const { nodeId, direction = 'both' } = args;
                    const neighbors = await this.db.getNeighbors(nodeId, direction);
                    return {
                        success: true,
                        result: neighbors,
                        message: `Found ${neighbors.length} neighbors (${direction})`,
                    };
                }

                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                message: `Error: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    getDb() {
        return this.db;
    }

    cleanup() {
        this.db.close();
    }
}

describe('MCP Tool Handler Integration', () => {
    let toolHandler: MCP_ToolHandler;

    beforeEach(() => {
        toolHandler = new MCP_ToolHandler();
    });

    describe('Tool functionality', () => {
        it('should handle create_node tool', async () => {
            const result = await toolHandler.callTool('create_node', {
                type: 'Technology',
                label: 'React',
                properties: { version: '18' }
            });

            expect(result.success).toBe(true);
            expect(result.result.type).toBe('Technology');
            expect(result.result.label).toBe('React');
            expect(result.result.properties?.version).toBe('18');
            expect(result.result.id).toBeDefined();
        });

        it('should handle create_edge tool', async () => {
            // First create nodes
            const node1 = await toolHandler.callTool('create_node', {
                type: 'App',
                label: 'MyApp'
            });
            const node2 = await toolHandler.callTool('create_node', {
                type: 'Library',
                label: 'Lodash'
            });

            // Create edge
            const result = await toolHandler.callTool('create_edge', {
                sourceId: node1.result.id,
                targetId: node2.result.id,
                type: 'uses',
                weight: 0.8
            });

            expect(result.success).toBe(true);
            expect(result.result.type).toBe('uses');
            expect(result.result.weight).toBe(0.8);
            expect(result.result.sourceId).toBe(node1.result.id);
            expect(result.result.targetId).toBe(node2.result.id);
        });
    });

    describe('Node operations', () => {
        it('should get node by ID', async () => {
            // First create a node
            const createResult = await toolHandler.callTool('create_node', {
                type: 'Framework',
                label: 'Vue.js'
            });

            // Get the node
            const getResult = await toolHandler.callTool('get_node', {
                id: createResult.result.id
            });

            expect(getResult.success).toBe(true);
            expect(getResult.result.label).toBe('Vue.js');
            expect(getResult.result.type).toBe('Framework');
        });

        it('should handle non-existent node gracefully', async () => {
            const result = await toolHandler.callTool('get_node', {
                id: 'non-existent'
            });

            expect(result.success).toBe(false);
            expect(result.message).toBe('Node with ID non-existent not found');
        });

        it('should query nodes with filters', async () => {
            // Create test nodes
            await toolHandler.callTool('create_node', {
                type: 'Language',
                label: 'JavaScript'
            });
            await toolHandler.callTool('create_node', {
                type: 'Language',
                label: 'TypeScript'
            });

            // Query by type
            const result = await toolHandler.callTool('query_nodes', {
                type: 'Language'
            });

            expect(result.success).toBe(true);
            expect(result.result).toHaveLength(2);
            expect(result.result.some((n: any) => n.label === 'JavaScript')).toBe(true);
            expect(result.result.some((n: any) => n.label === 'TypeScript')).toBe(true);
        });
    });

    describe('Graph traversal', () => {
        it('should traverse graph via get_neighbors tool', async () => {
            // Create nodes
            const sourceResult = await toolHandler.callTool('create_node', {
                type: 'App',
                label: 'MyApp'
            });
            const targetResult = await toolHandler.callTool('create_node', {
                type: 'Library',
                label: 'Lodash'
            });

            // Create edge
            await toolHandler.callTool('create_edge', {
                sourceId: sourceResult.result.id,
                targetId: targetResult.result.id,
                type: 'uses',
                weight: 0.8
            });

            // Get neighbors
            const neighborsResult = await toolHandler.callTool('get_neighbors', {
                nodeId: sourceResult.result.id,
                direction: 'out'
            });

            expect(neighborsResult.success).toBe(true);
            expect(neighborsResult.result).toHaveLength(1);
            expect(neighborsResult.result[0].node.label).toBe('Lodash');
            expect(neighborsResult.result[0].edge.type).toBe('uses');
        });
    });

    describe('Error handling', () => {
        it('should handle invalid tool names', async () => {
            const result = await toolHandler.callTool('invalid_tool', {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unknown tool: invalid_tool');
        });

        it('should handle missing required parameters', async () => {
            const result = await toolHandler.callTool('create_node', {
                type: 'Test'
                // missing required 'label'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle invalid edge creation (non-existent nodes)', async () => {
            const result = await toolHandler.callTool('create_edge', {
                sourceId: 'fake-id-1',
                targetId: 'fake-id-2',
                type: 'fake'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
