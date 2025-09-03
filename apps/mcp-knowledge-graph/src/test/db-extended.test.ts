import { describe, it, expect } from 'vitest';
import { testDb } from './setup.js';

describe('KnowledgeGraphDB - Extended Tests', () => {
    describe('Node operations - Edge cases', () => {
        it('should handle nodes with empty properties', async () => {
            const nodeData = {
                type: 'Test',
                label: 'Empty Props',
                properties: {},
            };

            const node = await testDb.createNode(nodeData);
            expect(node.properties).toEqual({});

            const retrieved = await testDb.getNode(node.id);
            expect(retrieved?.properties).toEqual({});
        });

        it('should handle nodes without properties', async () => {
            const nodeData = {
                type: 'Test',
                label: 'No Props',
            };

            const node = await testDb.createNode(nodeData);
            expect(node.properties).toBeUndefined();

            const retrieved = await testDb.getNode(node.id);
            expect(retrieved?.properties).toEqual({});
        });

        it('should handle complex nested properties', async () => {
            const complexProps = {
                nested: {
                    deep: {
                        value: 'test'
                    },
                    array: [1, 2, 3],
                    boolean: true
                },
                tags: ['tag1', 'tag2']
            };

            const nodeData = {
                type: 'Complex',
                label: 'Nested Data',
                properties: complexProps,
            };

            const node = await testDb.createNode(nodeData);
            const retrieved = await testDb.getNode(node.id);

            expect(retrieved?.properties).toEqual(complexProps);
        });

        it('should return null for non-existent node', async () => {
            const nonExistent = await testDb.getNode('non-existent-id');
            expect(nonExistent).toBeNull();
        });

        it('should handle label search with special characters', async () => {
            await testDb.createNode({
                type: 'Special',
                label: 'Test@#$%^&*()',
            });

            const results = await testDb.queryNodes({ label: '@#$' });
            expect(results).toHaveLength(1);
            expect(results[0].label).toBe('Test@#$%^&*()');
        });

        it('should respect limit and offset in queries', async () => {
            // Create 5 nodes
            for (let i = 0; i < 5; i++) {
                await testDb.createNode({
                    type: 'Paginated',
                    label: `Node ${i}`,
                });
            }

            const page1 = await testDb.queryNodes({ type: 'Paginated', limit: 2, offset: 0 });
            const page2 = await testDb.queryNodes({ type: 'Paginated', limit: 2, offset: 2 });
            const page3 = await testDb.queryNodes({ type: 'Paginated', limit: 2, offset: 4 });

            expect(page1).toHaveLength(2);
            expect(page2).toHaveLength(2);
            expect(page3).toHaveLength(1);

            // Ensure no duplicates between pages
            const allIds = [...page1, ...page2, ...page3].map(n => n.id);
            expect(new Set(allIds).size).toBe(5);
        });
    });

    describe('Edge operations - Edge cases', () => {
        it('should handle edges with zero weight', async () => {
            const source = await testDb.createNode({ type: 'Source', label: 'A' });
            const target = await testDb.createNode({ type: 'Target', label: 'B' });

            const edgeData = {
                sourceId: source.id,
                targetId: target.id,
                type: 'weak_connection',
                weight: 0,
            };

            const edge = await testDb.createEdge(edgeData);
            expect(edge.weight).toBe(0);

            const retrieved = await testDb.getEdge(edge.id);
            expect(retrieved?.weight).toBe(0);
        });

        it('should handle edges with negative weights', async () => {
            const source = await testDb.createNode({ type: 'Source', label: 'A' });
            const target = await testDb.createNode({ type: 'Target', label: 'B' });

            const edgeData = {
                sourceId: source.id,
                targetId: target.id,
                type: 'negative',
                weight: -0.5,
            };

            const edge = await testDb.createEdge(edgeData);
            expect(edge.weight).toBe(-0.5);
        });

        it('should return null for non-existent edge', async () => {
            const nonExistent = await testDb.getEdge('non-existent-id');
            expect(nonExistent).toBeNull();
        });

        it('should handle self-referencing edges', async () => {
            const node = await testDb.createNode({ type: 'Self', label: 'Loop' });

            const edgeData = {
                sourceId: node.id,
                targetId: node.id,
                type: 'self_reference',
            };

            const edge = await testDb.createEdge(edgeData);
            expect(edge.sourceId).toBe(node.id);
            expect(edge.targetId).toBe(node.id);

            const neighbors = await testDb.getNeighbors(node.id);
            expect(neighbors).toHaveLength(2); // Self-loop appears twice: as source and target
            expect(neighbors.every(n => n.node.id === node.id)).toBe(true);
        });

        it('should handle multiple edges between same nodes', async () => {
            const source = await testDb.createNode({ type: 'Multi', label: 'A' });
            const target = await testDb.createNode({ type: 'Multi', label: 'B' });

            await testDb.createEdge({
                sourceId: source.id,
                targetId: target.id,
                type: 'type1',
            });

            await testDb.createEdge({
                sourceId: source.id,
                targetId: target.id,
                type: 'type2',
            });

            const edges = await testDb.queryEdges({
                sourceId: source.id,
                targetId: target.id,
            });

            expect(edges).toHaveLength(2);
            expect(edges.map(e => e.type).sort()).toEqual(['type1', 'type2']);
        });
    });

    describe('Graph traversal - Complex scenarios', () => {
        it('should handle bidirectional relationships', async () => {
            const nodeA = await testDb.createNode({ type: 'Node', label: 'A' });
            const nodeB = await testDb.createNode({ type: 'Node', label: 'B' });

            // A -> B
            await testDb.createEdge({
                sourceId: nodeA.id,
                targetId: nodeB.id,
                type: 'forward',
            });

            // B -> A
            await testDb.createEdge({
                sourceId: nodeB.id,
                targetId: nodeA.id,
                type: 'backward',
            });

            const neighborsA = await testDb.getNeighbors(nodeA.id, 'both');
            const neighborsAOut = await testDb.getNeighbors(nodeA.id, 'out');
            const neighborsAIn = await testDb.getNeighbors(nodeA.id, 'in');

            expect(neighborsA).toHaveLength(2);
            expect(neighborsAOut).toHaveLength(1);
            expect(neighborsAIn).toHaveLength(1);

            expect(neighborsAOut[0].edge.type).toBe('forward');
            expect(neighborsAIn[0].edge.type).toBe('backward');
        });

        it('should handle star topology (hub with many connections)', async () => {
            const hub = await testDb.createNode({ type: 'Hub', label: 'Central' });
            const spokes = [];

            // Create 5 spoke nodes
            for (let i = 0; i < 5; i++) {
                const spoke = await testDb.createNode({
                    type: 'Spoke',
                    label: `Spoke ${i}`,
                });
                spokes.push(spoke);

                await testDb.createEdge({
                    sourceId: hub.id,
                    targetId: spoke.id,
                    type: 'connects',
                });
            }

            const hubNeighbors = await testDb.getNeighbors(hub.id, 'out');
            expect(hubNeighbors).toHaveLength(5);

            // Each spoke should have hub as only neighbor
            for (const spoke of spokes) {
                const spokeNeighbors = await testDb.getNeighbors(spoke.id, 'in');
                expect(spokeNeighbors).toHaveLength(1);
                expect(spokeNeighbors[0].node.id).toBe(hub.id);
            }
        });

        it('should handle disconnected components', async () => {
            // Create two separate components
            const comp1Node1 = await testDb.createNode({ type: 'Comp1', label: 'A1' });
            const comp1Node2 = await testDb.createNode({ type: 'Comp1', label: 'A2' });

            const comp2Node1 = await testDb.createNode({ type: 'Comp2', label: 'B1' });
            const comp2Node2 = await testDb.createNode({ type: 'Comp2', label: 'B2' });

            // Connect within components
            await testDb.createEdge({
                sourceId: comp1Node1.id,
                targetId: comp1Node2.id,
                type: 'internal',
            });

            await testDb.createEdge({
                sourceId: comp2Node1.id,
                targetId: comp2Node2.id,
                type: 'internal',
            });

            // Verify no cross-component connections
            const comp1Neighbors = await testDb.getNeighbors(comp1Node1.id);
            const comp2Neighbors = await testDb.getNeighbors(comp2Node1.id);

            expect(comp1Neighbors.every(n => n.node.type === 'Comp1')).toBe(true);
            expect(comp2Neighbors.every(n => n.node.type === 'Comp2')).toBe(true);
        });
    });

    describe('Query optimization and performance', () => {
        it('should handle large property objects efficiently', async () => {
            const largeProps = {};
            for (let i = 0; i < 100; i++) {
                largeProps[`key${i}`] = `value${i}`.repeat(10);
            }

            const node = await testDb.createNode({
                type: 'Large',
                label: 'Big Properties',
                properties: largeProps,
            });

            const retrieved = await testDb.getNode(node.id);
            expect(retrieved?.properties).toEqual(largeProps);
        });

        it('should handle queries with all filters combined', async () => {
            // Create test data
            for (let i = 0; i < 3; i++) {
                await testDb.createNode({
                    type: 'FilterTest',
                    label: `Filter Node ${i}`,
                });
            }

            const results = await testDb.queryNodes({
                type: 'FilterTest',
                label: 'Filter',
                limit: 2,
                offset: 1,
            });

            expect(results).toHaveLength(2);
            expect(results.every(n => n.type === 'FilterTest')).toBe(true);
            expect(results.every(n => n.label.includes('Filter'))).toBe(true);
        });
    });
});
