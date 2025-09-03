import { afterAll, beforeAll, beforeEach } from 'vitest';
import { KnowledgeGraphDB } from '../db/index.js';

let testDb: KnowledgeGraphDB;

beforeAll(async () => {
  // Use in-memory database for tests
  testDb = new KnowledgeGraphDB(':memory:');
});

beforeEach(async () => {
  // Clear all data between tests for isolation
  testDb.sqlite.exec('DELETE FROM edges');
  testDb.sqlite.exec('DELETE FROM nodes');
});

afterAll(async () => {
  if (testDb) {
    testDb.close();
  }
});

export { testDb };
