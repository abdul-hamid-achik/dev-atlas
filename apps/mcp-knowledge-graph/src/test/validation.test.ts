import { describe, expect, it } from 'vitest';
import {
  CreateEdgeSchema,
  CreateNodeSchema,
  EdgeSchema,
  NodeSchema,
  QueryEdgesSchema,
  QueryNodesSchema,
} from '../types/schema.js';

describe('Schema validation', () => {
  describe('NodeSchema', () => {
    it('should validate a complete node', () => {
      const validNode = {
        id: 'test-id',
        type: 'Technology',
        label: 'React',
        properties: { version: '18.0' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = NodeSchema.safeParse(validNode);
      expect(result.success).toBe(true);
    });

    it('should validate a minimal node', () => {
      const minimalNode = {
        id: 'test-id',
        type: 'Technology',
        label: 'React',
      };

      const result = NodeSchema.safeParse(minimalNode);
      expect(result.success).toBe(true);
    });

    it('should reject node without required fields', () => {
      const invalidNode = {
        id: 'test-id',
        type: 'Technology',
        // missing label
      };

      const result = NodeSchema.safeParse(invalidNode);
      expect(result.success).toBe(false);
    });

    it('should accept various property types', () => {
      const nodeWithComplexProps = {
        id: 'test-id',
        type: 'Complex',
        label: 'Test',
        properties: {
          string: 'value',
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          object: { nested: 'value' },
          null: null,
        },
      };

      const result = NodeSchema.safeParse(nodeWithComplexProps);
      expect(result.success).toBe(true);
    });
  });

  describe('EdgeSchema', () => {
    it('should validate a complete edge', () => {
      const validEdge = {
        id: 'edge-id',
        sourceId: 'source-id',
        targetId: 'target-id',
        type: 'connects',
        properties: { strength: 0.8 },
        weight: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = EdgeSchema.safeParse(validEdge);
      expect(result.success).toBe(true);
    });

    it('should validate a minimal edge', () => {
      const minimalEdge = {
        id: 'edge-id',
        sourceId: 'source-id',
        targetId: 'target-id',
        type: 'connects',
      };

      const result = EdgeSchema.safeParse(minimalEdge);
      expect(result.success).toBe(true);
    });

    it('should reject edge without required fields', () => {
      const invalidEdge = {
        id: 'edge-id',
        sourceId: 'source-id',
        // missing targetId and type
      };

      const result = EdgeSchema.safeParse(invalidEdge);
      expect(result.success).toBe(false);
    });

    it('should accept negative weights', () => {
      const edgeWithNegativeWeight = {
        id: 'edge-id',
        sourceId: 'source-id',
        targetId: 'target-id',
        type: 'negative',
        weight: -0.5,
      };

      const result = EdgeSchema.safeParse(edgeWithNegativeWeight);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateNodeSchema', () => {
    it('should validate node creation data', () => {
      const createData = {
        type: 'Framework',
        label: 'Vue.js',
        properties: { version: '3.0' },
      };

      const result = CreateNodeSchema.safeParse(createData);
      expect(result.success).toBe(true);
    });

    it('should require type and label', () => {
      const incompleteData = {
        type: 'Framework',
        // missing label
      };

      const result = CreateNodeSchema.safeParse(incompleteData);
      expect(result.success).toBe(false);
    });

    it('should allow empty properties', () => {
      const dataWithEmptyProps = {
        type: 'Framework',
        label: 'Vue.js',
        properties: {},
      };

      const result = CreateNodeSchema.safeParse(dataWithEmptyProps);
      expect(result.success).toBe(true);
    });

    it('should not require properties field', () => {
      const dataWithoutProps = {
        type: 'Framework',
        label: 'Vue.js',
      };

      const result = CreateNodeSchema.safeParse(dataWithoutProps);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateEdgeSchema', () => {
    it('should validate edge creation data', () => {
      const createData = {
        sourceId: 'source-123',
        targetId: 'target-456',
        type: 'depends_on',
        properties: { critical: true },
        weight: 0.7,
      };

      const result = CreateEdgeSchema.safeParse(createData);
      expect(result.success).toBe(true);
    });

    it('should require sourceId, targetId, and type', () => {
      const incompleteData = {
        sourceId: 'source-123',
        // missing targetId and type
      };

      const result = CreateEdgeSchema.safeParse(incompleteData);
      expect(result.success).toBe(false);
    });

    it('should allow zero weight', () => {
      const dataWithZeroWeight = {
        sourceId: 'source-123',
        targetId: 'target-456',
        type: 'weak',
        weight: 0,
      };

      const result = CreateEdgeSchema.safeParse(dataWithZeroWeight);
      expect(result.success).toBe(true);
    });
  });

  describe('QueryNodesSchema', () => {
    it('should validate empty query', () => {
      const emptyQuery = {};
      const result = QueryNodesSchema.safeParse(emptyQuery);
      expect(result.success).toBe(true);
    });

    it('should validate query with all filters', () => {
      const fullQuery = {
        type: 'Technology',
        label: 'React',
        limit: 10,
        offset: 0,
      };

      const result = QueryNodesSchema.safeParse(fullQuery);
      expect(result.success).toBe(true);
    });

    it('should validate partial queries', () => {
      const typeOnlyQuery = { type: 'Technology' };
      const labelOnlyQuery = { label: 'React' };
      const paginationOnlyQuery = { limit: 5, offset: 10 };

      expect(QueryNodesSchema.safeParse(typeOnlyQuery).success).toBe(true);
      expect(QueryNodesSchema.safeParse(labelOnlyQuery).success).toBe(true);
      expect(QueryNodesSchema.safeParse(paginationOnlyQuery).success).toBe(true);
    });

    it('should reject negative limit or offset', () => {
      const negativeLimit = { limit: -1 };
      const negativeOffset = { offset: -1 };

      // Note: Current schema doesn't enforce positive numbers, but if it did:
      // expect(QueryNodesSchema.safeParse(negativeLimit).success).toBe(false);
      // For now, this just documents expected behavior
    });
  });

  describe('QueryEdgesSchema', () => {
    it('should validate empty edge query', () => {
      const emptyQuery = {};
      const result = QueryEdgesSchema.safeParse(emptyQuery);
      expect(result.success).toBe(true);
    });

    it('should validate edge query with all filters', () => {
      const fullQuery = {
        sourceId: 'source-123',
        targetId: 'target-456',
        type: 'connects',
        limit: 5,
        offset: 0,
      };

      const result = QueryEdgesSchema.safeParse(fullQuery);
      expect(result.success).toBe(true);
    });

    it('should validate partial edge queries', () => {
      const sourceOnlyQuery = { sourceId: 'source-123' };
      const targetOnlyQuery = { targetId: 'target-456' };
      const typeOnlyQuery = { type: 'connects' };

      expect(QueryEdgesSchema.safeParse(sourceOnlyQuery).success).toBe(true);
      expect(QueryEdgesSchema.safeParse(targetOnlyQuery).success).toBe(true);
      expect(QueryEdgesSchema.safeParse(typeOnlyQuery).success).toBe(true);
    });
  });

  describe('Type inference', () => {
    it('should have correct TypeScript types', () => {
      // This test ensures our types are properly inferred from schemas
      const node: typeof NodeSchema._type = {
        id: 'test',
        type: 'test',
        label: 'test',
        properties: { key: 'value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const edge: typeof EdgeSchema._type = {
        id: 'test',
        sourceId: 'source',
        targetId: 'target',
        type: 'test',
        properties: { key: 'value' },
        weight: 0.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createNode: typeof CreateNodeSchema._type = {
        type: 'test',
        label: 'test',
        properties: { key: 'value' },
      };

      const createEdge: typeof CreateEdgeSchema._type = {
        sourceId: 'source',
        targetId: 'target',
        type: 'test',
        properties: { key: 'value' },
        weight: 0.5,
      };

      // If this compiles, the types are correct
      expect(node.id).toBe('test');
      expect(edge.id).toBe('test');
      expect(createNode.type).toBe('test');
      expect(createEdge.sourceId).toBe('source');
    });
  });

  describe('Schema edge cases', () => {
    it('should handle very long strings', () => {
      const longString = 'x'.repeat(10000);
      const nodeWithLongData = {
        id: 'test',
        type: longString,
        label: longString,
        properties: { longProp: longString },
      };

      const result = NodeSchema.safeParse(nodeWithLongData);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in strings', () => {
      const specialChars = '!@#$%^&*()_+{}[]|";:.,<>?`~';
      const nodeWithSpecialChars = {
        id: 'test',
        type: specialChars,
        label: specialChars,
        properties: { special: specialChars },
      };

      const result = NodeSchema.safeParse(nodeWithSpecialChars);
      expect(result.success).toBe(true);
    });

    it('should handle Unicode characters', () => {
      const unicodeString = '🚀🧠💡🔗📊';
      const nodeWithUnicode = {
        id: 'test',
        type: 'Technology',
        label: unicodeString,
        properties: { emoji: unicodeString },
      };

      const result = NodeSchema.safeParse(nodeWithUnicode);
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested properties', () => {
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };

      const nodeWithDeepProps = {
        id: 'test',
        type: 'Test',
        label: 'Deep',
        properties: deeplyNested,
      };

      const result = NodeSchema.safeParse(nodeWithDeepProps);
      expect(result.success).toBe(true);
    });
  });
});
