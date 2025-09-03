import { beforeEach, describe, expect, it } from 'vitest';
import { KnowledgeGraphDB } from '../db/index.js';

// Performance tests with longer timeout
describe('Performance and Stress Tests', () => {
  let db: KnowledgeGraphDB;

  beforeEach(() => {
    db = new KnowledgeGraphDB(':memory:');
  });

  describe('Bulk operations', () => {
    it('should handle creating many nodes efficiently', async () => {
      const start = Date.now();
      const nodes = [];

      // Create 1000 nodes
      for (let i = 0; i < 1000; i++) {
        const node = await db.createNode({
          type: `Type${i % 10}`, // 10 different types
          label: `Node ${i}`,
          properties: {
            index: i,
            category: i % 5,
            description: `Description for node ${i}`,
          },
        });
        nodes.push(node);
      }

      const elapsed = Date.now() - start;
      console.log(`Created 1000 nodes in ${elapsed}ms`);

      expect(nodes).toHaveLength(1000);
      expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
    }, 10000); // 10 second timeout

    it('should handle creating many edges efficiently', async () => {
      // First create 100 nodes
      const nodes = [];
      for (let i = 0; i < 100; i++) {
        const node = await db.createNode({
          type: 'Node',
          label: `Node ${i}`,
        });
        nodes.push(node);
      }

      const start = Date.now();
      const edges = [];

      // Create 500 edges (random connections)
      for (let i = 0; i < 500; i++) {
        const sourceIdx = Math.floor(Math.random() * nodes.length);
        const targetIdx = Math.floor(Math.random() * nodes.length);

        if (sourceIdx !== targetIdx) {
          // Avoid self-loops
          const edge = await db.createEdge({
            sourceId: nodes[sourceIdx].id,
            targetId: nodes[targetIdx].id,
            type: `EdgeType${i % 5}`,
            weight: Math.random(),
          });
          edges.push(edge);
        }
      }

      const elapsed = Date.now() - start;
      console.log(`Created ${edges.length} edges in ${elapsed}ms`);

      expect(edges.length).toBeGreaterThan(400); // Should create most edges
      expect(elapsed).toBeLessThan(3000); // Should complete in under 3 seconds
    }, 10000);

    it('should efficiently query large datasets', async () => {
      // Create test data
      const testTypes = ['TypeA', 'TypeB', 'TypeC', 'TypeD', 'TypeE'];

      for (let i = 0; i < 500; i++) {
        await db.createNode({
          type: testTypes[i % testTypes.length],
          label: `TestNode ${i}`,
          properties: {
            batch: Math.floor(i / 100),
            priority: i % 3,
          },
        });
      }

      const start = Date.now();

      // Perform various queries
      const results = await Promise.all([
        db.queryNodes({ type: 'TypeA' }),
        db.queryNodes({ label: 'TestNode' }),
        db.queryNodes({ type: 'TypeB', limit: 20 }),
        db.queryNodes({ limit: 50, offset: 100 }),
        db.queryNodes({}), // Get all nodes
      ]);

      const elapsed = Date.now() - start;
      console.log(`Performed 5 queries on 500 nodes in ${elapsed}ms`);

      expect(results[0]).toHaveLength(100); // TypeA nodes
      expect(results[1]).toHaveLength(500); // All nodes match "TestNode"
      expect(results[2]).toHaveLength(20); // Limited to 20
      expect(results[3]).toHaveLength(50); // Limited to 50 with offset
      expect(results[4]).toHaveLength(500); // All nodes

      expect(elapsed).toBeLessThan(1000); // Should complete in under 1 second
    }, 10000);
  });

  describe('Graph traversal performance', () => {
    it('should handle complex graph traversal efficiently', async () => {
      // Create a hub-and-spoke topology
      const hub = await db.createNode({
        type: 'Hub',
        label: 'Central Hub',
      });

      const spokes = [];
      const connections = [];

      // Create 50 spoke nodes
      for (let i = 0; i < 50; i++) {
        const spoke = await db.createNode({
          type: 'Spoke',
          label: `Spoke ${i}`,
        });
        spokes.push(spoke);

        // Connect hub to spoke
        const edge = await db.createEdge({
          sourceId: hub.id,
          targetId: spoke.id,
          type: 'connects',
          weight: Math.random(),
        });
        connections.push(edge);
      }

      // Add some spoke-to-spoke connections
      for (let i = 0; i < 25; i++) {
        const idx1 = Math.floor(Math.random() * spokes.length);
        const idx2 = Math.floor(Math.random() * spokes.length);

        if (idx1 !== idx2) {
          await db.createEdge({
            sourceId: spokes[idx1].id,
            targetId: spokes[idx2].id,
            type: 'peer',
          });
        }
      }

      const start = Date.now();

      // Perform traversal operations
      const [hubNeighbors, spokeNeighbors, allHubOut, allHubIn, allHubBoth] = await Promise.all([
        db.getNeighbors(hub.id, 'out'),
        db.getNeighbors(spokes[0].id, 'both'),
        db.getNeighbors(hub.id, 'out'),
        db.getNeighbors(hub.id, 'in'),
        db.getNeighbors(hub.id, 'both'),
      ]);

      const elapsed = Date.now() - start;
      console.log(`Performed graph traversal on ~75 nodes/edges in ${elapsed}ms`);

      expect(hubNeighbors).toHaveLength(50); // Hub connects to all spokes
      expect(spokeNeighbors.length).toBeGreaterThan(0); // At least hub connection
      expect(allHubOut).toHaveLength(50);
      expect(allHubIn).toHaveLength(0); // Hub has no incoming edges
      expect(allHubBoth).toHaveLength(50);

      expect(elapsed).toBeLessThan(500); // Should be very fast
    }, 10000);

    it('should handle deep traversal chains', async () => {
      // Create a chain of nodes: A -> B -> C -> D -> ... -> Z
      const chainLength = 26;
      const nodes = [];

      for (let i = 0; i < chainLength; i++) {
        const node = await db.createNode({
          type: 'Chain',
          label: `Node ${String.fromCharCode(65 + i)}`, // A, B, C, ...
        });
        nodes.push(node);
      }

      // Connect them in a chain
      for (let i = 0; i < nodes.length - 1; i++) {
        await db.createEdge({
          sourceId: nodes[i].id,
          targetId: nodes[i + 1].id,
          type: 'next',
        });
      }

      const start = Date.now();

      // Test traversal from different points in the chain
      const results = await Promise.all([
        db.getNeighbors(nodes[0].id, 'out'), // First node
        db.getNeighbors(nodes[Math.floor(chainLength / 2)].id, 'both'), // Middle node
        db.getNeighbors(nodes[chainLength - 1].id, 'in'), // Last node
      ]);

      const elapsed = Date.now() - start;
      console.log(`Traversed chain of ${chainLength} nodes in ${elapsed}ms`);

      expect(results[0]).toHaveLength(1); // First has 1 outgoing
      expect(results[1]).toHaveLength(2); // Middle has 2 total (1 in, 1 out)
      expect(results[2]).toHaveLength(1); // Last has 1 incoming

      expect(elapsed).toBeLessThan(100); // Should be very fast for chains
    });
  });

  describe('Memory and resource usage', () => {
    it('should handle large property objects', async () => {
      const start = Date.now();

      // Create nodes with large property objects
      const largeProperties = {};
      for (let i = 0; i < 1000; i++) {
        largeProperties[`key${i}`] = {
          value: `This is a longer string value for key ${i}`,
          metadata: {
            created: new Date().toISOString(),
            tags: [`tag${i}`, `category${i % 10}`],
            nested: {
              level1: { level2: { level3: `deep value ${i}` } },
            },
          },
        };
      }

      const nodes = [];
      for (let i = 0; i < 10; i++) {
        const node = await db.createNode({
          type: 'LargeData',
          label: `Large Node ${i}`,
          properties: largeProperties,
        });
        nodes.push(node);
      }

      const elapsed = Date.now() - start;
      console.log(`Created 10 nodes with large properties in ${elapsed}ms`);

      expect(nodes).toHaveLength(10);
      expect(elapsed).toBeLessThan(2000); // Should handle large objects reasonably

      // Verify data integrity
      const retrieved = await db.getNode(nodes[0].id);
      expect(retrieved?.properties).toEqual(largeProperties);
    }, 10000);

    it('should efficiently handle mixed query patterns', async () => {
      // Create diverse test data
      const nodeTypes = ['Type1', 'Type2', 'Type3', 'Type4', 'Type5'];
      const edgeTypes = ['connects', 'depends', 'contains', 'references'];

      const nodes = [];
      for (let i = 0; i < 200; i++) {
        const node = await db.createNode({
          type: nodeTypes[i % nodeTypes.length],
          label: `MixedNode ${i}`,
          properties: {
            group: Math.floor(i / 40), // 5 groups
            priority: i % 3,
            tags: [`tag${i % 10}`, `category${Math.floor(i / 20)}`],
          },
        });
        nodes.push(node);
      }

      // Create random edges
      for (let i = 0; i < 300; i++) {
        const source = nodes[Math.floor(Math.random() * nodes.length)];
        const target = nodes[Math.floor(Math.random() * nodes.length)];

        if (source.id !== target.id) {
          await db.createEdge({
            sourceId: source.id,
            targetId: target.id,
            type: edgeTypes[i % edgeTypes.length],
            weight: Math.random(),
          });
        }
      }

      const start = Date.now();

      // Perform mixed query patterns
      await Promise.all([
        // Node queries
        db.queryNodes({ type: 'Type1' }),
        db.queryNodes({ label: 'MixedNode 1' }),
        db.queryNodes({ limit: 10 }),

        // Edge queries
        db.queryEdges({ type: 'connects' }),
        db.queryEdges({ limit: 20 }),

        // Traversal queries
        db.getNeighbors(nodes[0].id, 'both'),
        db.getNeighbors(nodes[50].id, 'out'),
        db.getNeighbors(nodes[100].id, 'in'),
      ]);

      const elapsed = Date.now() - start;
      console.log(`Performed mixed query patterns in ${elapsed}ms`);

      expect(elapsed).toBeLessThan(1000); // Should handle mixed patterns efficiently
    }, 15000);
  });

  describe('Concurrent operations simulation', () => {
    it('should handle rapid sequential operations', async () => {
      const start = Date.now();
      const operations = [];

      // Simulate rapid sequential operations
      for (let i = 0; i < 100; i++) {
        operations.push(
          db
            .createNode({
              type: `RapidType${i % 5}`,
              label: `Rapid ${i}`,
            })
            .then((node) => db.queryNodes({ type: node.type }))
        );
      }

      const results = await Promise.all(operations);
      const elapsed = Date.now() - start;

      console.log(`Completed 100 rapid create+query operations in ${elapsed}ms`);

      expect(results).toHaveLength(100);
      expect(elapsed).toBeLessThan(3000); // Should handle rapid operations
    }, 10000);
  });
});
