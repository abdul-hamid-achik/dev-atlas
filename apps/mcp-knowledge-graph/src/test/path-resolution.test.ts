import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { KnowledgeGraphDB } from '../db/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Database Path Resolution', () => {
    let tempDir: string;
    let projectDir: string;
    let nestedDir: string;

    beforeAll(() => {
        // Create a temporary directory structure for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kg-path-test-'));
        projectDir = path.join(tempDir, 'test-project');
        nestedDir = path.join(projectDir, 'apps', 'test-app');

        // Create directory structure
        fs.mkdirSync(projectDir, { recursive: true });
        fs.mkdirSync(nestedDir, { recursive: true });

        // Create root package.json with workspaces
        fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
            name: 'test-project',
            workspaces: ['apps/*'],
            version: '1.0.0'
        }, null, 2));

        // Create turbo.json to further identify project root
        fs.writeFileSync(path.join(projectDir, 'turbo.json'), JSON.stringify({
            pipeline: {}
        }, null, 2));

        // Create nested package.json
        fs.writeFileSync(path.join(nestedDir, 'package.json'), JSON.stringify({
            name: 'test-app',
            version: '1.0.0'
        }, null, 2));
    });

    afterAll(() => {
        // Clean up temporary directory
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create database in project root when initialized from nested directory', () => {
        // Change to nested directory
        const originalCwd = process.cwd();
        process.chdir(nestedDir);

        try {
            // Create database without specifying path
            const db = new KnowledgeGraphDB();
            db.close();

            // Check that database was created in project root
            const expectedDbPath = path.join(projectDir, 'knowledge-graph.db');
            expect(fs.existsSync(expectedDbPath)).toBe(true);

            // Clean up
            fs.unlinkSync(expectedDbPath);
        } finally {
            process.chdir(originalCwd);
        }
    });

    it('should create database in project root when initialized from project root', () => {
        const originalCwd = process.cwd();
        process.chdir(projectDir);

        try {
            const db = new KnowledgeGraphDB();
            db.close();

            const expectedDbPath = path.join(projectDir, 'knowledge-graph.db');
            expect(fs.existsSync(expectedDbPath)).toBe(true);

            // Clean up
            fs.unlinkSync(expectedDbPath);
        } finally {
            process.chdir(originalCwd);
        }
    });

    it('should use custom path when explicitly provided', () => {
        const customPath = path.join(tempDir, 'custom-knowledge-graph.db');
        const db = new KnowledgeGraphDB(customPath);
        db.close();

        expect(fs.existsSync(customPath)).toBe(true);

        // Clean up
        fs.unlinkSync(customPath);
    });

    it('should still work when no project root indicators are found', () => {
        // Create a directory without any project indicators
        const isolatedDir = path.join(tempDir, 'isolated');
        fs.mkdirSync(isolatedDir);

        const originalCwd = process.cwd();
        process.chdir(isolatedDir);

        try {
            const db = new KnowledgeGraphDB();
            db.close();

            // Should create database in current working directory (isolatedDir)
            const expectedDbPath = path.join(isolatedDir, 'knowledge-graph.db');
            expect(fs.existsSync(expectedDbPath)).toBe(true);

            // Clean up
            fs.unlinkSync(expectedDbPath);
        } finally {
            process.chdir(originalCwd);
        }
    });

      it('should prefer project root with dev-atlas name', () => {
    // Create another project structure with dev-atlas name
    const devAtlasDir = path.join(tempDir, 'dev-atlas-project');
    const devAtlasNested = path.join(devAtlasDir, 'packages', 'nested');
    
    fs.mkdirSync(devAtlasNested, { recursive: true });
    
    // Create package.json with dev-atlas name
    fs.writeFileSync(path.join(devAtlasDir, 'package.json'), JSON.stringify({
      name: 'dev-atlas',
      version: '1.0.0'
    }, null, 2));
    
    const originalCwd = process.cwd();
    process.chdir(devAtlasNested);
    
    try {
      const db = new KnowledgeGraphDB();
      db.close();
      
      const expectedDbPath = path.join(devAtlasDir, 'knowledge-graph.db');
      expect(fs.existsSync(expectedDbPath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(expectedDbPath);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should use KNOWLEDGE_GRAPH_DIR environment variable when set', () => {
    const customDir = path.join(tempDir, 'custom-env-dir');
    fs.mkdirSync(customDir);
    
    // Set environment variable
    const originalEnv = process.env.KNOWLEDGE_GRAPH_DIR;
    process.env.KNOWLEDGE_GRAPH_DIR = customDir;
    
    try {
      const db = new KnowledgeGraphDB();
      db.close();
      
      // Should create database in the environment-specified directory
      const expectedDbPath = path.join(customDir, 'knowledge-graph.db');
      expect(fs.existsSync(expectedDbPath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(expectedDbPath);
    } finally {
      // Restore original environment variable
      if (originalEnv !== undefined) {
        process.env.KNOWLEDGE_GRAPH_DIR = originalEnv;
      } else {
        delete process.env.KNOWLEDGE_GRAPH_DIR;
      }
    }
  });

  it('should prioritize environment variable over project root detection', () => {
    const customDir = path.join(tempDir, 'env-priority');
    fs.mkdirSync(customDir);
    
    // Set environment variable
    const originalEnv = process.env.KNOWLEDGE_GRAPH_DIR;
    process.env.KNOWLEDGE_GRAPH_DIR = customDir;
    
    // Change to project directory
    const originalCwd = process.cwd();
    process.chdir(projectDir);
    
    try {
      const db = new KnowledgeGraphDB();
      db.close();
      
      // Should use env dir, not project root
      const envDbPath = path.join(customDir, 'knowledge-graph.db');
      const projectDbPath = path.join(projectDir, 'knowledge-graph.db');
      
      expect(fs.existsSync(envDbPath)).toBe(true);
      expect(fs.existsSync(projectDbPath)).toBe(false);
      
      // Clean up
      fs.unlinkSync(envDbPath);
    } finally {
      // Restore original environment and working directory
      if (originalEnv !== undefined) {
        process.env.KNOWLEDGE_GRAPH_DIR = originalEnv;
      } else {
        delete process.env.KNOWLEDGE_GRAPH_DIR;
      }
      process.chdir(originalCwd);
    }
  });
});
