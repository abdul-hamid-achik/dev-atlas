import { describe, expect, it, beforeEach, beforeAll, afterAll } from 'vitest';
import { KnowledgeGraphDB } from '../db/index.js';

describe('MCP Vector Search Endpoints', () => {
  let testDb: KnowledgeGraphDB;

  beforeAll(async () => {
    // Use in-memory database for testing
    testDb = new KnowledgeGraphDB(':memory:');
    
    // Note: For MCP handler testing, we test the database methods directly
    // since the handlers are thin wrappers around these methods
  });

  beforeEach(async () => {
    // Clear database between tests
    try {
      testDb.getSqliteForTesting().exec('DELETE FROM edges');
      testDb.getSqliteForTesting().exec('DELETE FROM nodes');
      testDb.getSqliteForTesting().exec('DELETE FROM vector_search_cache');
    } catch (error) {
      // Tables might not exist yet, ignore
    }

    // Create test data
    await testDb.createNode({
      type: 'Component',
      label: 'UserAuthentication',
      properties: {
        framework: 'React',
        features: ['login', 'signup', 'password-reset'],
        description: 'Comprehensive user authentication system'
      }
    });

    await testDb.createNode({
      type: 'Component',
      label: 'LoginForm',
      properties: {
        framework: 'React',
        features: ['form-validation', 'input-fields'],
        description: 'Form component for user login'
      }
    });

    await testDb.createNode({
      type: 'Service',
      label: 'AuthService',
      properties: {
        type: 'backend',
        features: ['jwt', 'session-management', 'user-verification'],
        description: 'Backend authentication service'
      }
    });

    await testDb.createNode({
      type: 'Database',
      label: 'UserTable',
      properties: {
        engine: 'postgresql',
        fields: ['id', 'username', 'email', 'password_hash'],
        description: 'User account data storage'
      }
    });
  });

  afterAll(async () => {
    if (testDb) {
      testDb.close();
    }
  });

  describe('vector_search_nodes endpoint', () => {
    beforeEach(async () => {
      await testDb.generateMissingEmbeddings('simple');
    });

    it('should perform semantic search through MCP interface', async () => {
      const results = await testDb.vectorSearchNodes('user authentication login', {
        limit: 10,
        threshold: 0.1,
        model: 'simple'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0);
      
      // Should find authentication-related nodes
      const labels = results.map(r => r.node.label);
      expect(labels).toContain('UserAuthentication');
      expect(labels).toContain('LoginForm');
    });

    it('should filter by node types', async () => {
      const results = await testDb.vectorSearchNodes('authentication', {
        limit: 10,
        threshold: 0.1,
        model: 'simple',
        nodeTypes: ['Component']
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.node.type).toBe('Component');
      });
    });

    it('should respect similarity threshold', async () => {
      const highThreshold = await testDb.vectorSearchNodes('authentication', {
        limit: 10,
        threshold: 0.8,
        model: 'simple'
      });

      const lowThreshold = await testDb.vectorSearchNodes('authentication', {
        limit: 10,
        threshold: 0.1,
        model: 'simple'
      });

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
      
      highThreshold.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should handle empty queries gracefully', async () => {
      const results = await testDb.vectorSearchNodes('', {
        limit: 5,
        model: 'simple'
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('generate_embeddings endpoint', () => {
    it('should generate embeddings for all nodes without embeddings', async () => {
      const result = await testDb.generateMissingEmbeddings('simple');

      expect(result.processed).toBeGreaterThan(0);
      expect(result.errors).toBe(0);
    });

    it('should generate embeddings for specific nodes', async () => {
      const nodes = await testDb.queryNodes({ type: 'Component' });
      expect(nodes.length).toBeGreaterThan(0);

      // Generate embedding for first node
      await testDb.generateNodeEmbedding(nodes[0].id, 'simple');

      // Verify it was generated (we'd need to add a method to check this)
      const results = await testDb.vectorSearchNodes('authentication', {
        limit: 5,
        threshold: 0.05,
        model: 'simple'
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle non-existent node IDs gracefully', async () => {
      await expect(
        testDb.generateNodeEmbedding('non-existent-id', 'simple')
      ).rejects.toThrow('Node non-existent-id not found');
    });

    it('should handle invalid model names', async () => {
      const nodes = await testDb.queryNodes({ limit: 1 });
      if (nodes.length > 0) {
        await expect(
          testDb.generateNodeEmbedding(nodes[0].id, 'invalid-model')
        ).rejects.toThrow('Embedding model invalid-model not supported');
      }
    });
  });

  describe('hybrid_similarity_search endpoint', () => {
    beforeEach(async () => {
      await testDb.generateMissingEmbeddings('simple');
    });

    it('should perform hybrid search combining traditional and vector similarity', async () => {
      const searchData = {
        type: 'Component',
        label: 'UserForm',
        properties: { framework: 'React', features: ['authentication'] }
      };

      const results = await testDb.hybridSimilaritySearch(searchData, {
        vectorWeight: 0.6,
        traditionalWeight: 0.4,
        threshold: 0.4,
        model: 'simple'
      });

      expect(results.length).toBeGreaterThan(0);
      
      // Should find component-related nodes
      const components = results.filter(r => r.type === 'Component');
      expect(components.length).toBeGreaterThan(0);
    });

    it('should adjust results based on weight configuration', async () => {
      const searchData = {
        type: 'Component',
        label: 'LoginForm', // Exact match exists
        properties: {}
      };

      const traditionalHeavy = await testDb.hybridSimilaritySearch(searchData, {
        vectorWeight: 0.1,
        traditionalWeight: 0.9,
        threshold: 0.3,
        model: 'simple'
      });

      const vectorHeavy = await testDb.hybridSimilaritySearch(searchData, {
        vectorWeight: 0.9,
        traditionalWeight: 0.1,
        threshold: 0.3,
        model: 'simple'
      });

      expect(traditionalHeavy.length).toBeGreaterThan(0);
      expect(vectorHeavy.length).toBeGreaterThan(0);

      // Traditional heavy should strongly favor the exact label match
      const traditionalMatch = traditionalHeavy.find(n => n.label === 'LoginForm');
      expect(traditionalMatch).toBeDefined();
    });

    it('should handle threshold filtering', async () => {
      const searchData = {
        type: 'Service',
        label: 'CompleteDifferentService',
        properties: { unrelated: 'properties' }
      };

      const highThreshold = await testDb.hybridSimilaritySearch(searchData, {
        threshold: 0.9,
        model: 'simple'
      });

      const lowThreshold = await testDb.hybridSimilaritySearch(searchData, {
        threshold: 0.1,
        model: 'simple'
      });

      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  describe('create_or_merge_node endpoint', () => {
    beforeEach(async () => {
      await testDb.generateMissingEmbeddings('simple');
    });

    it('should create new node when no similar exists', async () => {
      const result = await testDb.createOrMergeNode({
        type: 'Library',
        label: 'ChartingLibrary',
        properties: { purpose: 'data-visualization', charts: ['bar', 'line', 'pie'] }
      }, {
        mergeStrategy: 'merge',
        useVectorSimilarity: true,
        similarityThreshold: 0.8
      });

      expect(result.action).toBe('created');
      expect(result.node.type).toBe('Library');
      expect(result.node.label).toBe('ChartingLibrary');
      expect(result.node.properties?.purpose).toBe('data-visualization');
    });

    it('should merge with existing similar node', async () => {
      const result = await testDb.createOrMergeNode({
        type: 'Component',
        label: 'UserAuthenticationForm',
        properties: {
          framework: 'React',
          features: ['login', 'social-auth', 'remember-me'],
          newFeature: 'two-factor-auth'
        }
      }, {
        mergeStrategy: 'merge',
        useVectorSimilarity: true,
        similarityThreshold: 0.3
      });

      expect(result.action).toBe('merged');
      expect(result.node.properties?.newFeature).toBe('two-factor-auth');
      
      // Should have merged features arrays
      const features = result.node.properties?.features as string[];
      expect(features).toContain('login');
      expect(features).toContain('social-auth');
    });

    it('should use traditional similarity when vector is disabled', async () => {
      const result = await testDb.createOrMergeNode({
        type: 'Component',
        label: 'LoginForm', // Exact match exists
        properties: { newProp: 'value' }
      }, {
        mergeStrategy: 'merge',
        useVectorSimilarity: false,
        similarityThreshold: 0.7
      });

      expect(['merged', 'created']).toContain(result.action);
      if (result.action === 'merged') {
        expect(result.node.label).toBe('LoginForm');
      }
      expect(result.node.properties?.newProp).toBe('value');
    });

    it('should handle different merge strategies', async () => {
      // Skip strategy
      const skipResult = await testDb.createOrMergeNode({
        type: 'Component',
        label: 'UserAuthentication',
        properties: { shouldNotMerge: 'value' }
      }, {
        mergeStrategy: 'skip',
        useVectorSimilarity: true,
        similarityThreshold: 0.3
      });

      expect(skipResult.action).toBe('skipped');
      expect(skipResult.node.properties?.shouldNotMerge).toBeUndefined();

      // Update strategy
      const updateResult = await testDb.createOrMergeNode({
        type: 'Component',
        label: 'UserAuthentication',
        properties: { replaced: 'properties' }
      }, {
        mergeStrategy: 'update',
        useVectorSimilarity: true,
        similarityThreshold: 0.3
      });

      expect(updateResult.action).toBe('merged');
      expect(updateResult.node.properties?.replaced).toBe('properties');
    });
  });

  describe('create_or_merge_edge endpoint', () => {
    let sourceNode: any;
    let targetNode: any;

    beforeEach(async () => {
      const nodes = await testDb.queryNodes({ type: 'Component' });
      sourceNode = nodes[0];
      targetNode = nodes[1];

      // Create existing edge
      await testDb.createEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'connects',
        properties: { method: 'API' },
        weight: 0.8
      });
    });

    it('should create new edge when none exists', async () => {
      const serviceNode = await testDb.queryNodes({ type: 'Service' });
      
      const result = await testDb.createOrMergeEdge({
        sourceId: sourceNode.id,
        targetId: serviceNode[0].id,
        type: 'uses',
        properties: { protocol: 'HTTP' },
        weight: 0.9
      }, {
        mergeStrategy: 'merge'
      });

      expect(result.action).toBe('created');
      expect(result.edge.type).toBe('uses');
      expect(result.edge.properties?.protocol).toBe('HTTP');
      expect(result.edge.weight).toBe(0.9);
    });

    it('should merge with existing edge', async () => {
      const result = await testDb.createOrMergeEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'connects',
        properties: { 
          method: 'API',
          timeout: 5000,
          newProp: 'value'
        },
        weight: 1.0
      }, {
        mergeStrategy: 'merge'
      });

      expect(result.action).toBe('merged');
      expect(result.edge.properties?.method).toBe('API');
      expect(result.edge.properties?.timeout).toBe(5000);
      expect(result.edge.properties?.newProp).toBe('value');
      // Weight should be averaged: (0.8 + 1.0) / 2 = 0.9
      expect(result.edge.weight).toBe(0.9);
    });

    it('should handle different merge strategies for edges', async () => {
      // Skip strategy
      const skipResult = await testDb.createOrMergeEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'connects',
        properties: { shouldNotMerge: 'value' }
      }, {
        mergeStrategy: 'skip'
      });

      expect(skipResult.action).toBe('skipped');
      expect(skipResult.edge.properties?.shouldNotMerge).toBeUndefined();

      // Update strategy
      const updateResult = await testDb.createOrMergeEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'connects',
        properties: { replaced: 'properties' },
        weight: 0.5
      }, {
        mergeStrategy: 'update'
      });

      expect(updateResult.action).toBe('merged');
      expect(updateResult.edge.properties?.replaced).toBe('properties');
      expect(updateResult.edge.weight).toBe(0.5);
    });

    it('should allow multiple edge types when configured', async () => {
      const result = await testDb.createOrMergeEdge({
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: 'depends_on', // Different from existing 'connects'
        properties: { dependency: 'required' }
      }, {
        mergeStrategy: 'merge',
        allowMultipleTypes: true
      });

      expect(result.action).toBe('created');
      expect(result.edge.type).toBe('depends_on');
      expect(result.edge.properties?.dependency).toBe('required');
    });
  });

  describe('analyze_vector_similarity endpoint', () => {
    beforeEach(async () => {
      await testDb.generateMissingEmbeddings('simple');
    });

    it('should analyze similarity between multiple nodes', async () => {
      const nodes = await testDb.queryNodes({ limit: 3 });
      expect(nodes.length).toBeGreaterThanOrEqual(2);

      // We'll simulate the similarity analysis since the actual MCP endpoint
      // would need access to the private cosineSimilarity method
      const results = await testDb.vectorSearchNodes('authentication', {
        limit: 10,
        threshold: 0.05,
        model: 'simple'
      });

      expect(results.length).toBeGreaterThan(0);
      
      // Check that similarities are calculated and sorted
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
      }
    });

    it('should handle different embedding models', async () => {
      const nodes = await testDb.queryNodes({ limit: 2 });
      
      // Test with simple model
      const results = await testDb.vectorSearchNodes('component', {
        limit: 5,
        threshold: 0.05,
        model: 'simple'
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(typeof result.similarity).toBe('number');
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid node IDs in embedding generation', async () => {
      await expect(
        testDb.generateNodeEmbedding('invalid-id', 'simple')
      ).rejects.toThrow();
    });

    it('should handle invalid embedding models', async () => {
      const nodes = await testDb.queryNodes({ limit: 1 });
      if (nodes.length > 0) {
        await expect(
          testDb.generateNodeEmbedding(nodes[0].id, 'invalid-model')
        ).rejects.toThrow('Embedding model invalid-model not supported');
      }
    });

    it('should handle vector search with no embeddings', async () => {
      // Don't generate embeddings, try to search
      const results = await testDb.vectorSearchNodes('test query', {
        limit: 5,
        threshold: 0.1,
        model: 'simple'
      });

      // Should handle gracefully
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty or invalid search queries', async () => {
      await testDb.generateMissingEmbeddings('simple');

      const emptyResults = await testDb.vectorSearchNodes('', {
        limit: 5,
        model: 'simple'
      });

      const specialCharResults = await testDb.vectorSearchNodes('!@#$%^&*()', {
        limit: 5,
        model: 'simple'
      });

      expect(Array.isArray(emptyResults)).toBe(true);
      expect(Array.isArray(specialCharResults)).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of nodes efficiently', async () => {
      // Create many test nodes
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          testDb.createNode({
            type: 'TestNode',
            label: `TestNode${i}`,
            properties: { index: i, category: i % 5 }
          })
        );
      }
      await Promise.all(promises);

      // Generate embeddings for all
      const result = await testDb.generateMissingEmbeddings('simple');
      expect(result.processed).toBeGreaterThanOrEqual(50);

      // Perform vector search
      const searchResults = await testDb.vectorSearchNodes('test node category', {
        limit: 10,
        threshold: 0.05,
        model: 'simple'
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.length).toBeLessThanOrEqual(10);
    });

    it('should handle nodes with complex nested properties', async () => {
      const complexNode = await testDb.createNode({
        type: 'ComplexComponent',
        label: 'NestedDataProcessor',
        properties: {
          config: {
            processing: {
              steps: ['validation', 'transformation', 'output'],
              options: {
                strict: true,
                timeout: 5000
              }
            },
            metadata: {
              version: '2.1.0',
              author: 'test',
              dependencies: ['lodash', 'moment']
            }
          },
          features: ['async-processing', 'error-handling', 'logging']
        }
      });

      await testDb.generateNodeEmbedding(complexNode.id, 'simple');

      const results = await testDb.vectorSearchNodes('data processing validation', {
        limit: 5,
        threshold: 0.05,
        model: 'simple'
      });

      expect(results.length).toBeGreaterThan(0);
      
      const foundComplex = results.find(r => r.node.id === complexNode.id);
      expect(foundComplex).toBeDefined();
    });
  });
});
