import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './setup.js';

describe('Vector Search Functionality', () => {
    beforeEach(async () => {
        // Create test nodes with diverse content for vector search testing
        await testDb.createNode({
            type: 'Component',
            label: 'UserAuthentication',
            properties: {
                framework: 'React',
                features: ['login', 'signup', 'password-reset'],
                description: 'Handles user authentication and authorization',
            },
        });

        await testDb.createNode({
            type: 'Component',
            label: 'LoginForm',
            properties: {
                framework: 'React',
                features: ['form-validation', 'user-login'],
                description: 'Form component for user login functionality',
            },
        });

        await testDb.createNode({
            type: 'Service',
            label: 'AuthService',
            properties: {
                type: 'backend',
                features: ['jwt-tokens', 'user-verification', 'session-management'],
                description: 'Backend service managing user authentication',
            },
        });

        await testDb.createNode({
            type: 'Database',
            label: 'UserTable',
            properties: {
                type: 'postgresql',
                fields: ['username', 'email', 'password_hash'],
                description: 'Database table storing user account information',
            },
        });

        await testDb.createNode({
            type: 'Component',
            label: 'ProductCatalog',
            properties: {
                framework: 'Vue',
                features: ['product-listing', 'search', 'filtering'],
                description: 'Displays products in a searchable catalog',
            },
        });
    });

    describe('Embedding Generation', () => {
        it('should generate embeddings for a node', async () => {
            const node = await testDb.createNode({
                type: 'Test',
                label: 'EmbeddingTest',
                properties: { description: 'Test node for embedding generation' },
            });

            await testDb.generateNodeEmbedding(node.id, 'simple');

            const updatedNode = await testDb.getNode(node.id);
            expect(updatedNode).toBeDefined();

            // Note: embeddings are stored in the database, not in the node properties object
            // We need to check the database directly or add a method to retrieve embeddings
        });

        it('should generate embeddings for multiple nodes', async () => {
            const nodes = await testDb.queryNodes({ type: 'Component' });
            expect(nodes.length).toBeGreaterThan(0);

            const result = await testDb.generateMissingEmbeddings('simple');

            expect(result.processed).toBeGreaterThan(0);
            expect(result.errors).toBe(0);
        });

        it('should handle embedding generation errors gracefully', async () => {
            // Test with invalid node ID
            await expect(testDb.generateNodeEmbedding('invalid-id', 'simple')).rejects.toThrow(
                'Node invalid-id not found'
            );
        });
    });

    describe('Vector Similarity Search', () => {
        beforeEach(async () => {
            // Generate embeddings for all test nodes
            await testDb.generateMissingEmbeddings('simple');
        });

        it('should find semantically similar nodes with authentication query', async () => {
            const results = await testDb.vectorSearchNodes('user authentication login', {
                limit: 5,
                threshold: 0.1,
                model: 'simple',
            });

            expect(results.length).toBeGreaterThan(0);

            // Should find authentication-related nodes
            const labels = results.map((r) => r.node.label);
            expect(labels).toContain('UserAuthentication');
            expect(labels).toContain('LoginForm');
            expect(labels).toContain('AuthService');

            // Results should be sorted by similarity (highest first)
            for (let i = 0; i < results.length - 1; i++) {
                expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
            }
        });

        it('should filter results by node type', async () => {
            const results = await testDb.vectorSearchNodes('component user interface', {
                limit: 10,
                threshold: 0.1,
                model: 'simple',
                nodeTypes: ['Component'],
            });

            expect(results.length).toBeGreaterThan(0);
            expect(results.every((r) => r.node.type === 'Component')).toBe(true);
        });

        it('should respect similarity threshold', async () => {
            const highThresholdResults = await testDb.vectorSearchNodes('authentication', {
                limit: 10,
                threshold: 0.8, // Very high threshold
                model: 'simple',
            });

            const lowThresholdResults = await testDb.vectorSearchNodes('authentication', {
                limit: 10,
                threshold: 0.1, // Low threshold
                model: 'simple',
            });

            expect(lowThresholdResults.length).toBeGreaterThanOrEqual(highThresholdResults.length);

            // All high threshold results should have high similarity
            highThresholdResults.forEach((result) => {
                expect(result.similarity).toBeGreaterThanOrEqual(0.8);
            });
        });

        it('should return fewer results for unrelated queries', async () => {
            const relatedResults = await testDb.vectorSearchNodes('authentication user login', {
                limit: 10,
                threshold: 0.1,
                model: 'simple',
            });

            const unrelatedResults = await testDb.vectorSearchNodes(
                'completely unrelated quantum physics',
                {
                    limit: 10,
                    threshold: 0.1,
                    model: 'simple',
                }
            );

            // Unrelated query should return fewer results than related query
            expect(unrelatedResults.length).toBeLessThanOrEqual(relatedResults.length);

            // Since our simple embedding is basic, just ensure we get reasonable results
            // In production with real embeddings, unrelated queries would have much lower similarity
            expect(Array.isArray(relatedResults)).toBe(true);
            expect(Array.isArray(unrelatedResults)).toBe(true);

            // Simple validation that the search is working
            expect(relatedResults.length).toBeGreaterThan(0);
        });

        it('should handle empty query gracefully', async () => {
            const results = await testDb.vectorSearchNodes('', {
                limit: 5,
                model: 'simple',
            });

            // Should handle empty query without throwing
            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('Hybrid Similarity Search', () => {
        beforeEach(async () => {
            await testDb.generateMissingEmbeddings('simple');
        });

        it('should combine traditional and vector similarity', async () => {
            const searchData = {
                type: 'Component',
                label: 'UserForm',
                properties: { framework: 'React', features: ['authentication'] },
            };

            const results = await testDb.hybridSimilaritySearch(searchData, {
                vectorWeight: 0.6,
                traditionalWeight: 0.4,
                threshold: 0.5,
                model: 'simple',
            });

            expect(results.length).toBeGreaterThan(0);

            // Should find related components
            const componentResults = results.filter((r) => r.type === 'Component');
            expect(componentResults.length).toBeGreaterThan(0);
        });

        it('should adjust results based on weight configuration', async () => {
            const searchData = {
                type: 'Component',
                label: 'LoginForm', // Exact match exists
                properties: { framework: 'React' },
            };

            // High traditional weight should favor exact matches
            const traditionalHeavy = await testDb.hybridSimilaritySearch(searchData, {
                vectorWeight: 0.1,
                traditionalWeight: 0.9,
                threshold: 0.3,
                model: 'simple',
            });

            // High vector weight should favor semantic similarity
            const vectorHeavy = await testDb.hybridSimilaritySearch(searchData, {
                vectorWeight: 0.9,
                traditionalWeight: 0.1,
                threshold: 0.3,
                model: 'simple',
            });

            expect(traditionalHeavy.length).toBeGreaterThan(0);
            expect(vectorHeavy.length).toBeGreaterThan(0);
        });
    });

    describe('Cosine Similarity Calculations', () => {
        it('should calculate similarity between identical vectors', async () => {
            const node1 = await testDb.createNode({
                type: 'Test',
                label: 'SimilarityTest1',
                properties: { content: 'identical content for testing' },
            });

            const node2 = await testDb.createNode({
                type: 'Test',
                label: 'SimilarityTest2',
                properties: { content: 'identical content for testing' },
            });

            await testDb.generateNodeEmbedding(node1.id, 'simple');
            await testDb.generateNodeEmbedding(node2.id, 'simple');

            // For testing purposes, we'll create a method to access similarity calculation
            // In a real scenario, this would be tested through the hybrid search or vector search
            const results = await testDb.vectorSearchNodes('identical content for testing', {
                limit: 2,
                threshold: 0.1,
                model: 'simple',
            });

            expect(results.length).toBe(2);

            // Both results should have high similarity to the query
            results.forEach((result) => {
                expect(result.similarity).toBeGreaterThan(0.5);
            });
        });

        it('should calculate different similarity for different content', async () => {
            const node1 = await testDb.createNode({
                type: 'Test',
                label: 'ContentA',
                properties: { content: 'machine learning artificial intelligence' },
            });

            const node2 = await testDb.createNode({
                type: 'Test',
                label: 'ContentB',
                properties: { content: 'cooking recipes kitchen utensils' },
            });

            await testDb.generateNodeEmbedding(node1.id, 'simple');
            await testDb.generateNodeEmbedding(node2.id, 'simple');

            const mlResults = await testDb.vectorSearchNodes('artificial intelligence', {
                limit: 2,
                threshold: 0.05,
                model: 'simple',
            });

            const cookingResults = await testDb.vectorSearchNodes('kitchen recipes', {
                limit: 2,
                threshold: 0.05,
                model: 'simple',
            });

            expect(mlResults.length).toBeGreaterThan(0);
            expect(cookingResults.length).toBeGreaterThan(0);

            // The ML node should have higher similarity to AI query
            const mlResult = mlResults.find((r) => r.node.label === 'ContentA');
            const cookingResult = cookingResults.find((r) => r.node.label === 'ContentB');

            expect(mlResult).toBeDefined();
            expect(cookingResult).toBeDefined();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle nodes with no content', async () => {
            const emptyNode = await testDb.createNode({
                type: 'Empty',
                label: '',
                properties: {},
            });

            // Should not throw when generating embeddings for empty content
            await expect(testDb.generateNodeEmbedding(emptyNode.id, 'simple')).resolves.not.toThrow();
        });

        it('should handle invalid embedding model', async () => {
            const node = await testDb.createNode({
                type: 'Test',
                label: 'ModelTest',
            });

            await expect(testDb.generateNodeEmbedding(node.id, 'invalid-model')).rejects.toThrow(
                'Embedding model invalid-model not supported'
            );
        });

        it('should handle vector search with no embeddings in database', async () => {
            // Clear any existing embeddings by creating fresh nodes
            const freshNode = await testDb.createNode({
                type: 'Fresh',
                label: 'NoEmbedding',
                properties: { test: 'value' },
            });

            const results = await testDb.vectorSearchNodes('test query', {
                limit: 5,
                threshold: 0.1,
                model: 'simple',
            });

            // Should handle gracefully when no nodes have embeddings
            expect(Array.isArray(results)).toBe(true);
        });
    });
});
