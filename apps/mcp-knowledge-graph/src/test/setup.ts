import { beforeAll, afterAll } from 'vitest';
import { KnowledgeGraphDB } from '../db/index.js';

let testDb: KnowledgeGraphDB;

beforeAll(async () => {
  // Use in-memory database for tests
  testDb = new KnowledgeGraphDB(':memory:');
});

afterAll(async () => {
  if (testDb) {
    testDb.close();
  }
});

export { testDb };