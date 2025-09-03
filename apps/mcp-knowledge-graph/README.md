# Dev Atlas Knowledge Graph MCP Server

A powerful Model Context Protocol (MCP) server for managing knowledge graphs using SQLite. Create, query, and visualize relationships between entities with full TypeScript support.

## 🌟 Features

- 🧠 **Knowledge Graph Management**: Create nodes and edges to represent complex relationships
- 🗄️ **SQLite Backend**: Fast, reliable database with automatic schema management
- 🔍 **Smart Path Resolution**: Automatically creates database in your project root (not node_modules)
- 🎯 **Graph Traversal**: Find neighbors, query by relationships, and explore connections
- 🔧 **Full TypeScript Support**: Complete type definitions and IntelliSense
- 🚀 **MCP Integration**: Works seamlessly with Claude, Cursor, and other MCP clients
- 📊 **Rich Querying**: Filter by type, label, properties, and more
- 🏗️ **Robust Testing**: Comprehensive test suite with performance benchmarks

## 📦 Installation

```bash
npm install -g dev-atlas-knowledge-graph
```

## 🔧 MCP Configuration

### For Claude Desktop

Add to your `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx",
      "args": ["dev-atlas-knowledge-graph"]
    }
  }
}
```

### For Cursor

Add to your MCP settings in Cursor or create a `mcp.json` in your project:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx",
      "args": ["dev-atlas-knowledge-graph"]
    }
  }
}
```

### For Other MCP Clients

Most MCP clients support similar configuration. Use:
- **Command**: `npx`
- **Args**: `["dev-atlas-knowledge-graph"]`

## 🗂️ Database Location

The knowledge graph database is intelligently placed:

- 📁 **Project Root**: Automatically detects your project root and creates `knowledge-graph.db` there
- 🔍 **Smart Detection**: Looks for `package.json` with workspaces, `turbo.json`, or project name patterns
- 📋 **Startup Logging**: Shows exactly where the database is created when starting

```
[KnowledgeGraph] Current working directory: /path/to/your/project/app
[KnowledgeGraph] Project root detected: /path/to/your/project
[KnowledgeGraph] Database path: /path/to/your/project/knowledge-graph.db
```

## 🛠️ Available Tools

### Node Operations

#### `create_node`
Create a new node in the knowledge graph.

```typescript
{
  type: string,           // Node type (e.g., "Person", "Project", "Technology")
  label: string,          // Human-readable label
  properties?: object     // Additional key-value properties
}
```

#### `get_node`
Retrieve a specific node by ID.

```typescript
{ id: string }
```

#### `query_nodes`
Search and filter nodes.

```typescript
{
  type?: string,          // Filter by node type
  label?: string,         // Partial label match
  limit?: number,         // Max results
  offset?: number         // Pagination offset
}
```

### Edge Operations

#### `create_edge`
Create a relationship between two nodes.

```typescript
{
  sourceId: string,       // Source node ID
  targetId: string,       // Target node ID
  type: string,           // Relationship type (e.g., "uses", "depends_on")
  properties?: object,    // Additional properties
  weight?: number         // Relationship strength (0-1)
}
```

#### `get_edge`
Retrieve a specific edge by ID.

```typescript
{ id: string }
```

#### `query_edges`
Search and filter edges.

```typescript
{
  sourceId?: string,      // Filter by source node
  targetId?: string,      // Filter by target node
  type?: string,          // Filter by relationship type
  limit?: number,
  offset?: number
}
```

### Graph Traversal

#### `get_neighbors`
Find all connected nodes.

```typescript
{
  nodeId: string,         // Node to find neighbors for
  direction?: "in" | "out" | "both"  // Edge direction (default: "both")
}
```

## 📋 Usage Examples

### Basic Knowledge Graph

```typescript
// Create technology nodes
const react = await createNode({
  type: "Technology",
  label: "React",
  properties: { version: "18.0", category: "Frontend Framework" }
});

const javascript = await createNode({
  type: "Language", 
  label: "JavaScript",
  properties: { paradigm: "Multi-paradigm" }
});

// Create relationship
await createEdge({
  sourceId: react.id,
  targetId: javascript.id,
  type: "uses",
  weight: 1.0
});
```

### Project Dependencies

```typescript
// Model a project's dependency graph
const myApp = await createNode({
  type: "Project",
  label: "My Web App"
});

const express = await createNode({
  type: "Library",
  label: "Express.js"
});

const postgres = await createNode({
  type: "Database", 
  label: "PostgreSQL"
});

// Create dependency relationships
await createEdge({
  sourceId: myApp.id,
  targetId: express.id,
  type: "depends_on"
});

await createEdge({
  sourceId: myApp.id,
  targetId: postgres.id,
  type: "stores_data_in"
});

// Find all dependencies
const dependencies = await getNeighbors(myApp.id, "out");
```

### Querying & Analysis

```typescript
// Find all frontend technologies
const frontendTech = await queryNodes({
  type: "Technology",
  limit: 10
});

// Find what uses JavaScript
const jsUsers = await queryEdges({
  targetId: javascript.id,
  type: "uses"
});

// Get ecosystem around React
const reactEcosystem = await getNeighbors(react.id, "both");
```

## 🧪 Development

### Running Tests

```bash
npm test                # Run all tests once
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### Building

```bash
npm run build          # Build TypeScript
npm run dev            # Development with watch mode
```

### Database Management

The database is automatically created and managed. If you need to reset:

```bash
rm knowledge-graph.db  # Remove database file
```

The schema will be recreated automatically on next startup.

## 🔍 Troubleshooting

### Database Not Found

If you see database path issues:
1. Check the startup logs for the detected paths
2. Ensure you're running from within your project
3. Verify your project has identifying files (`package.json`, etc.)

### MCP Connection Issues

1. Verify the MCP client configuration matches exactly
2. Check that `npx dev-atlas-knowledge-graph` runs without errors
3. Look at the MCP client's error logs for detailed messages

### Performance with Large Graphs

The server includes performance optimizations:
- Indexed database queries
- Efficient graph traversal algorithms
- Pagination support for large result sets

## 📊 Performance

Benchmarks from the test suite:
- **Node Creation**: 1000 nodes in ~70ms
- **Edge Creation**: 500 edges in ~25ms
- **Complex Queries**: Sub-10ms response times
- **Graph Traversal**: Deep chains processed in ~2ms

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Related Projects

- [Dev Atlas](https://github.com/abdul-hamid-achik/dev-atlas) - The main project
- [MCP Specification](https://modelcontextprotocol.io/) - Learn more about MCP

---

**Built with ❤️ for the MCP ecosystem**