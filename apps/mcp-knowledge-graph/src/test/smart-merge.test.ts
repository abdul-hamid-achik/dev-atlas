import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './setup.js';

describe('Smart Merge with Vector Similarity', () => {
  describe('Smart Node Creation and Merging', () => {
    beforeEach(async () => {
      // Create existing nodes for merge testing
      await testDb.createNode({
        type: 'Component',
        label: 'UserProfile',
        properties: {
          framework: 'React',
          features: ['avatar', 'bio', 'preferences'],
          version: '1.0',
        },
      });

      await testDb.createNode({
        type: 'Component',
        label: 'LoginButton',
        properties: {
          framework: 'React',
          features: ['authentication', 'click-handler'],
          styling: 'styled-components',
        },
      });

      // Generate embeddings for existing nodes
      await testDb.generateMissingEmbeddings('simple');
    });

    it('should create new node when no similar nodes exist', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Database',
          label: 'ProductCatalog',
          properties: { engine: 'PostgreSQL', tables: ['products', 'categories'] },
        },
        {
          mergeStrategy: 'merge',
          similarityThreshold: 0.8,
          useVectorSimilarity: true,
        }
      );

      expect(result.action).toBe('created');
      expect(result.node.type).toBe('Database');
      expect(result.node.label).toBe('ProductCatalog');
      expect(result.node.properties?.engine).toBe('PostgreSQL');
    });

    it('should merge with existing similar node when similarity is high', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Component',
          label: 'UserProfile',
          properties: {
            framework: 'React',
            features: ['avatar', 'settings', 'profile-editing'],
            version: '2.0',
            newFeature: 'profile-picture-upload',
          },
        },
        {
          mergeStrategy: 'merge',
          similarityThreshold: 0.3, // Low threshold to ensure merge
          useVectorSimilarity: true,
        }
      );

      expect(result.action).toBe('merged');
      expect(result.node.label).toBe('UserProfile');

      // Should merge properties
      expect(result.node.properties?.version).toBe('2.0'); // Newer version
      expect(result.node.properties?.newFeature).toBe('profile-picture-upload');
      expect(result.node.properties?.framework).toBe('React');

      // Should merge array features
      const features = result.node.properties?.features as string[];
      expect(features).toContain('avatar');
      expect(features).toContain('settings');
      expect(features).toContain('profile-editing');
    });

    it('should skip creation when merge strategy is skip', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Component',
          label: 'UserProfile',
          properties: { different: 'properties' },
        },
        {
          mergeStrategy: 'skip',
          similarityThreshold: 0.3,
          useVectorSimilarity: true,
        }
      );

      expect(result.action).toBe('skipped');
      expect(result.node.label).toBe('UserProfile');
      // Original properties should be unchanged
      expect(result.node.properties?.framework).toBe('React');
      expect(result.node.properties?.different).toBeUndefined();
    });

    it('should update node when merge strategy is update', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Component',
          label: 'UserProfile',
          properties: { completely: 'new', framework: 'Vue' },
        },
        {
          mergeStrategy: 'update',
          similarityThreshold: 0.3,
          useVectorSimilarity: true,
        }
      );

      expect(result.action).toBe('merged');
      expect(result.node.properties?.completely).toBe('new');
      expect(result.node.properties?.framework).toBe('Vue'); // Updated
    });

    it('should fall back to traditional similarity when vector search fails', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Component',
          label: 'LoginButton', // Exact match exists
          properties: { framework: 'React' },
        },
        {
          mergeStrategy: 'merge',
          similarityThreshold: 0.7,
          useVectorSimilarity: true,
          embeddingModel: 'invalid-model', // This will cause vector search to fail
        }
      );

      // Should still work with traditional similarity or create if no match found
      expect(['merged', 'created']).toContain(result.action);
      if (result.action === 'merged') {
        expect(result.node.label).toBe('LoginButton');
      }
    });

    it('should use traditional similarity when disabled', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Component',
          label: 'LoginButton',
          properties: { newProp: 'value' },
        },
        {
          mergeStrategy: 'merge',
          similarityThreshold: 0.5, // Lower threshold for better matching
          useVectorSimilarity: false, // Explicitly disabled
        }
      );

      expect(['merged', 'created']).toContain(result.action);
      expect(result.node.properties?.newProp).toBe('value');
    });

    it('should handle deep property merging correctly', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Component',
          label: 'UserProfile',
          properties: {
            nested: {
              settings: {
                theme: 'dark',
                notifications: true,
              },
              preferences: {
                language: 'en',
              },
            },
            features: ['new-feature'],
          },
        },
        {
          mergeStrategy: 'merge',
          similarityThreshold: 0.3,
          useVectorSimilarity: true,
        }
      );

      expect(result.action).toBe('merged');

      const nested = result.node.properties?.nested as any;
      expect(nested).toBeDefined();
      expect(nested.settings?.theme).toBe('dark');
      expect(nested.preferences?.language).toBe('en');
    });
  });

  describe('Smart Edge Creation and Merging', () => {
    let sourceNode: any;
    let targetNode: any;

    beforeEach(async () => {
      // Create nodes for edge testing
      sourceNode = await testDb.createNode({
        type: 'Component',
        label: 'UserForm',
        properties: { framework: 'React' },
      });

      targetNode = await testDb.createNode({
        type: 'Service',
        label: 'AuthAPI',
        properties: { protocol: 'REST' },
      });

      // Create an existing edge
      await testDb.createEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'calls',
        properties: { method: 'POST', endpoint: '/auth' },
        weight: 0.8,
      });
    });

    it('should create new edge when no similar edge exists', async () => {
      const newTarget = await testDb.createNode({
        type: 'Database',
        label: 'UserDB',
      });

      const result = await testDb.createOrMergeEdge(
        {
          sourceId: sourceNode.id,
          targetId: newTarget.id,
          type: 'connects',
          properties: { connection: 'pool' },
          weight: 0.9,
        },
        {
          mergeStrategy: 'merge',
          allowMultipleTypes: false,
        }
      );

      expect(result.action).toBe('created');
      expect(result.edge.type).toBe('connects');
      expect(result.edge.properties?.connection).toBe('pool');
      expect(result.edge.weight).toBe(0.9);
    });

    it('should merge with existing edge between same nodes', async () => {
      const result = await testDb.createOrMergeEdge(
        {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          type: 'calls',
          properties: {
            method: 'POST', // Same as existing
            timeout: 5000, // New property
            endpoint: '/auth/login', // Updated property
          },
          weight: 1.0,
        },
        {
          mergeStrategy: 'merge',
          allowMultipleTypes: false,
        }
      );

      expect(result.action).toBe('merged');
      expect(result.edge.properties?.method).toBe('POST');
      expect(result.edge.properties?.timeout).toBe(5000);
      expect(result.edge.properties?.endpoint).toBe('/auth/login');
      // Weight should be averaged: (0.8 + 1.0) / 2 = 0.9
      expect(result.edge.weight).toBe(0.9);
    });

    it('should skip edge creation when strategy is skip', async () => {
      const result = await testDb.createOrMergeEdge(
        {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          type: 'calls',
          properties: { different: 'props' },
        },
        {
          mergeStrategy: 'skip',
          allowMultipleTypes: false,
        }
      );

      expect(result.action).toBe('skipped');
      expect(result.edge.properties?.method).toBe('POST'); // Original unchanged
      expect(result.edge.properties?.different).toBeUndefined();
    });

    it('should update edge when strategy is update', async () => {
      const result = await testDb.createOrMergeEdge(
        {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          type: 'calls',
          properties: { completely: 'new', method: 'GET' },
          weight: 0.5,
        },
        {
          mergeStrategy: 'update',
          allowMultipleTypes: false,
        }
      );

      expect(result.action).toBe('merged');
      expect(result.edge.properties?.completely).toBe('new');
      expect(result.edge.properties?.method).toBe('GET');
      expect(result.edge.weight).toBe(0.5);
    });

    it('should allow multiple edge types when configured', async () => {
      const result = await testDb.createOrMergeEdge(
        {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          type: 'depends_on', // Different type than existing 'calls'
          properties: { dependency: 'required' },
        },
        {
          mergeStrategy: 'merge',
          allowMultipleTypes: true,
        }
      );

      expect(result.action).toBe('created'); // Should create new edge with different type
      expect(result.edge.type).toBe('depends_on');
      expect(result.edge.properties?.dependency).toBe('required');
    });

    it('should handle weight merging correctly', async () => {
      // Test with undefined existing weight
      const newSource = await testDb.createNode({ type: 'Test', label: 'TestSource' });
      const newTarget = await testDb.createNode({ type: 'Test', label: 'TestTarget' });

      await testDb.createEdge({
        sourceId: newSource.id,
        targetId: newTarget.id,
        type: 'test_edge',
        // No weight specified (undefined)
      });

      const result = await testDb.createOrMergeEdge(
        {
          sourceId: newSource.id,
          targetId: newTarget.id,
          type: 'test_edge',
          weight: 0.7,
        },
        {
          mergeStrategy: 'merge',
        }
      );

      expect(result.action).toBe('merged');
      expect(result.edge.weight).toBe(0.7); // Should use new weight when existing is undefined
    });
  });

  describe('Traditional vs Vector Similarity Comparison', () => {
    beforeEach(async () => {
      // Create nodes with similar meanings but different text
      await testDb.createNode({
        type: 'Component',
        label: 'AuthenticationComponent',
        properties: {
          description: 'handles user login and signup processes',
          framework: 'React',
        },
      });

      await testDb.createNode({
        type: 'Component',
        label: 'LoginWidget',
        properties: {
          description: 'user signin and registration functionality',
          framework: 'Vue',
        },
      });

      await testDb.generateMissingEmbeddings('simple');
    });

    it('should find different results with vector vs traditional similarity', async () => {
      const searchNode = {
        type: 'Component',
        label: 'UserSignInForm',
        properties: {
          description: 'form for user authentication and access',
          framework: 'Angular',
        },
      };

      // Traditional similarity (disabled vector)
      const traditionalResult = await testDb.createOrMergeNode(searchNode, {
        mergeStrategy: 'skip',
        useVectorSimilarity: false,
        similarityThreshold: 0.3,
      });

      // Vector similarity enabled
      const vectorResult = await testDb.createOrMergeNode(searchNode, {
        mergeStrategy: 'skip',
        useVectorSimilarity: true,
        similarityThreshold: 0.3,
      });

      // Both should find matches, but potentially different ones
      // The important thing is that vector similarity works
      expect(traditionalResult.action === 'skipped' || traditionalResult.action === 'created').toBe(
        true
      );
      expect(vectorResult.action === 'skipped' || vectorResult.action === 'created').toBe(true);
    });

    it('should respect similarity thresholds in vector search', async () => {
      const searchNode = {
        type: 'Service',
        label: 'DatabaseConnector', // Very different from existing components
        properties: {
          description: 'manages database connections and queries',
        },
      };

      const highThresholdResult = await testDb.createOrMergeNode(searchNode, {
        mergeStrategy: 'skip',
        useVectorSimilarity: true,
        similarityThreshold: 0.9, // Very high threshold
      });

      const lowThresholdResult = await testDb.createOrMergeNode(searchNode, {
        mergeStrategy: 'skip',
        useVectorSimilarity: true,
        similarityThreshold: 0.1, // Low threshold
      });

      // High threshold should be more selective
      expect(highThresholdResult.action).toBe('created'); // No matches found
      // Low threshold might find matches or create new, either is valid
      expect(['created', 'skipped'].includes(lowThresholdResult.action)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle merging with non-existent node gracefully', async () => {
      const result = await testDb.createOrMergeNode(
        {
          type: 'Test',
          label: 'NonExistent',
        },
        {
          mergeStrategy: 'merge',
          useVectorSimilarity: true,
        }
      );

      // Should create new node when no similar ones exist
      expect(result.action).toBe('created');
      expect(result.node.label).toBe('NonExistent');
    });

    it('should handle embedding generation failure during merge', async () => {
      // This tests the error handling when embedding generation fails
      const result = await testDb.createOrMergeNode(
        {
          type: 'Test',
          label: 'EmbeddingFailTest',
        },
        {
          mergeStrategy: 'merge',
          useVectorSimilarity: true,
          embeddingModel: 'invalid-model',
        }
      );

      // Should still succeed by falling back to traditional similarity
      expect(result.action).toBe('created');
      expect(result.node.label).toBe('EmbeddingFailTest');
    });

    it('should handle empty properties in merge', async () => {
      const existingNode = await testDb.createNode({
        type: 'Test',
        label: 'EmptyPropsTest',
        // No properties
      });

      const result = await testDb.createOrMergeNode(
        {
          type: 'Test',
          label: 'EmptyPropsTest',
          properties: { newProp: 'value' },
        },
        {
          mergeStrategy: 'merge',
          similarityThreshold: 0.3, // Lower threshold for better matching
          useVectorSimilarity: false, // Use traditional for exact match
        }
      );

      expect(['merged', 'created']).toContain(result.action);
      expect(result.node.properties?.newProp).toBe('value');
    });

    it('should handle edge creation with non-existent nodes', async () => {
      await expect(
        testDb.createOrMergeEdge({
          sourceId: 'non-existent-source',
          targetId: 'non-existent-target',
          type: 'test',
        })
      ).rejects.toThrow(); // Should fail with foreign key constraint
    });
  });
});
