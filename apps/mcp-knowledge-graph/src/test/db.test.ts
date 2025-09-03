import { describe, expect, it } from 'vitest';
import { testDb } from './setup.js';

describe('KnowledgeGraphDB', () => {
  describe('Node operations', () => {
    it('should create a node', async () => {
      const nodeData = {
        type: 'Technology',
        label: 'React',
        properties: { version: '18.0' },
      };

      const node = await testDb.createNode(nodeData);

      expect(node.id).toBeDefined();
      expect(node.type).toBe('Technology');
      expect(node.label).toBe('React');
      expect(node.properties?.version).toBe('18.0');
    });

    it('should get a node by ID', async () => {
      const nodeData = {
        type: 'Language',
        label: 'TypeScript',
      };

      const createdNode = await testDb.createNode(nodeData);
      const retrievedNode = await testDb.getNode(createdNode.id);

      expect(retrievedNode).not.toBeNull();
      expect(retrievedNode?.id).toBe(createdNode.id);
      expect(retrievedNode?.type).toBe('Language');
      expect(retrievedNode?.label).toBe('TypeScript');
    });

    it('should query nodes by type', async () => {
      // Create test nodes
      await testDb.createNode({ type: 'Technology', label: 'React' });
      await testDb.createNode({ type: 'Technology', label: 'Vue' });
      await testDb.createNode({ type: 'Language', label: 'JavaScript' });

      const technologyNodes = await testDb.queryNodes({ type: 'Technology' });

      expect(technologyNodes).toHaveLength(2);
      expect(technologyNodes.every((node) => node.type === 'Technology')).toBe(true);
    });
  });

  describe('Edge operations', () => {
    it('should create an edge between two nodes', async () => {
      // Create source and target nodes
      const sourceNode = await testDb.createNode({
        type: 'Framework',
        label: 'React',
      });
      const targetNode = await testDb.createNode({
        type: 'Language',
        label: 'JavaScript',
      });

      const edgeData = {
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'uses',
        weight: 0.9,
      };

      const edge = await testDb.createEdge(edgeData);

      expect(edge.id).toBeDefined();
      expect(edge.sourceId).toBe(sourceNode.id);
      expect(edge.targetId).toBe(targetNode.id);
      expect(edge.type).toBe('uses');
      expect(edge.weight).toBe(0.9);
    });

    it('should get neighbors of a node', async () => {
      // Create nodes
      const centerNode = await testDb.createNode({
        type: 'Project',
        label: 'MyApp',
      });
      const dependency1 = await testDb.createNode({
        type: 'Library',
        label: 'Express',
      });
      const dependency2 = await testDb.createNode({
        type: 'Database',
        label: 'PostgreSQL',
      });

      // Create edges
      await testDb.createEdge({
        sourceId: centerNode.id,
        targetId: dependency1.id,
        type: 'uses',
      });
      await testDb.createEdge({
        sourceId: centerNode.id,
        targetId: dependency2.id,
        type: 'uses',
      });

      const neighbors = await testDb.getNeighbors(centerNode.id, 'out');

      expect(neighbors).toHaveLength(2);
      expect(neighbors.map((n) => n.node.label)).toContain('Express');
      expect(neighbors.map((n) => n.node.label)).toContain('PostgreSQL');
    });
  });
});
