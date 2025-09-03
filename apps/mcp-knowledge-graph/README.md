# Dev Atlas Knowledge Graph MCP Server

A powerful Model Context Protocol (MCP) server that automatically builds rich knowledge graphs from codebases. Understand complex software architecture, track dependencies, and explore code relationships with AI-powered analysis.

## 🌟 Features

### Core Knowledge Graph
- 🧠 **Knowledge Graph Management**: Create nodes and edges to represent complex relationships
- 🗄️ **SQLite Backend**: Fast, reliable database with automatic schema management  
- 🔍 **Smart Path Resolution**: Automatically creates database in your project root
- 🎯 **Graph Traversal**: Find neighbors, paths, and explore deep connections
- 📊 **Advanced Analytics**: Graph statistics, clustering, and pattern analysis

### Code Analysis & Understanding
- 🔬 **Automated Code Analysis**: Extract functions, classes, imports from 10+ languages
- 🏗️ **Architecture Mapping**: Understand how files and components connect
- 📝 **TODO & Annotation Tracking**: Extract and manage TODOs, FIXMEs, and code comments
- 🔄 **Change Detection**: Monitor codebase changes and update knowledge graph automatically
- 🎯 **Semantic Search**: Find relevant code by meaning, not just text matching
- 🗺️ **Dependency Visualization**: Map project dependencies and library relationships

### Developer Productivity
- 🚀 **MCP Integration**: Works seamlessly with Claude, Cursor, and other MCP clients
- 🔧 **Full TypeScript Support**: Complete type definitions and IntelliSense
- 📈 **Bulk Operations**: Efficiently analyze entire codebases
- 📊 **Multiple Export Formats**: JSON, DOT (Graphviz), CSV for visualization
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
      "args": ["dev-atlas-knowledge-graph"],
      "env": {
        "KNOWLEDGE_GRAPH_DIR": "/absolute/path/to/your/project"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/your/project` with the actual absolute path to your project directory.

For example:
```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx", 
      "args": ["dev-atlas-knowledge-graph"],
      "env": {
        "KNOWLEDGE_GRAPH_DIR": "/Users/yourusername/projects/my-project"
      }
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
      "args": ["dev-atlas-knowledge-graph"],
      "env": {
        "KNOWLEDGE_GRAPH_DIR": "/absolute/path/to/your/project"
      }
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

## 🛠️ Available Tools (27 Total)

### Core Graph Operations

#### Basic CRUD
- **`create_node`** - Create individual nodes with type, label, and properties
- **`create_edge`** - Create relationships between nodes with optional weights
- **`get_node`** / **`get_edge`** - Retrieve specific nodes or edges by ID
- **`query_nodes`** / **`query_edges`** - Search with filters, pagination, and sorting
- **`update_node`** / **`update_edge`** - Modify existing entities ⭐ *New*
- **`delete_node`** / **`delete_edge`** - Remove entities and cleanup relationships ⭐ *New*

#### Bulk Operations
- **`bulk_create_nodes`** / **`bulk_create_edges`** - Create hundreds of entities efficiently ⭐ *New*

#### Graph Analysis & Discovery
- **`get_neighbors`** - Find connected nodes with direction control
- **`find_path`** - Shortest path between any two nodes using BFS ⭐ *New*
- **`get_subgraph`** - Extract focused subgraphs around specific nodes ⭐ *New*
- **`search_nodes`** - Full-text search across labels and properties ⭐ *New*
- **`get_graph_stats`** - Comprehensive analytics (node counts, types, connectivity) ⭐ *New*
- **`export_graph`** - Export in JSON, DOT (Graphviz), or CSV formats ⭐ *New*

### Code Analysis Tools ⭐ *All New*

#### Automated Code Understanding
- **`analyze_file`** - Extract functions, classes, imports, exports from source files
  - **Supported Languages**: JavaScript, TypeScript, Python, Java, C++, C#, PHP, Ruby, Go, Rust
  - **Auto-Detection**: Language detection from file extensions
  - **Metadata Extraction**: Line numbers, function signatures, class hierarchies
  - **Optional Node Creation**: Automatically populate knowledge graph

#### Project Analysis
- **`extract_dependencies`** - Parse package.json, requirements.txt, and other dependency files
  - **Dependency Classification**: Separate dev vs production dependencies  
  - **Automatic Linking**: Connect projects to their dependencies
  - **Version Tracking**: Capture version constraints and relationships

#### Architecture Mapping
- **`map_directory`** - Recursively analyze project structure
  - **Configurable Depth**: Control analysis scope to avoid deep rabbit holes
  - **File Size Tracking**: Identify large files that might need attention
  - **Hierarchical Relationships**: Model folder/file containment relationships

### Advanced Analysis ⭐ *New*
- **`detect_patterns`** - Identify design patterns, architectural patterns, and code smells
  - **Design Patterns**: Singleton, Observer, Factory pattern detection
  - **Architectural Patterns**: MVC components, Microservices detection
  - **Code Smells**: Long methods, large files, technical debt indicators
  - **Smart Detection**: Pattern confidence scoring and line number tracking

- **`extract_todos`** - Find and track TODOs, FIXMEs, and other code annotations
  - **Multi-Language Support**: Detects comments in JS/TS (//) and Python (#) formats
  - **Annotation Types**: TODO, FIXME, HACK, NOTE, BUG with customizable filters
  - **File Linking**: Automatically connects TODOs to their source files
  - **Context Preservation**: Captures full line context and line numbers

- **`monitor_changes`** - Watch for file changes and update knowledge graph automatically
  - **Smart Monitoring**: File modification time tracking with pattern filtering
  - **Incremental Sync**: Only re-analyze files that have actually changed
  - **Pattern Control**: Include/exclude specific file patterns from monitoring
  - **Status Tracking**: Monitor multiple directories with independent sync states

- **`semantic_analysis`** - Understand semantic relationships between code entities
  - **Similarity Analysis**: Find related code entities using name and property matching
  - **Clustering**: Group related nodes by type and characteristics  
  - **Naming Analysis**: Detect naming convention inconsistencies across codebase
  - **Usage Patterns**: Identify highly connected nodes, isolated components, and architectural hubs

## 📋 Usage Examples

### Automated Codebase Analysis

```typescript
// Analyze a JavaScript/TypeScript file and create nodes automatically
await analyze_file({
  filePath: "./src/components/UserProfile.tsx",
  createNodes: true
});
// Creates nodes for: UserProfile component, functions, imports, exports
// Links them with "contains", "imports", "exports" relationships

// Extract all project dependencies 
await extract_dependencies({
  filePath: "./package.json", 
  createNodes: true,
  projectNodeId: "my-project-id"
});
// Creates nodes for each dependency and links to project

// Map entire project structure
await map_directory({
  directoryPath: "./src",
  maxDepth: 3,
  createNodes: true
});
// Creates hierarchical nodes for folders and files
```

### Explore Code Relationships

```typescript
// Find how components are connected
const path = await find_path({
  fromNodeId: "LoginForm-component", 
  toNodeId: "UserService-class"
});
// Returns the chain: LoginForm -> AuthHook -> UserService

// Get everything related to authentication
const authSubgraph = await get_subgraph({
  nodeIds: ["AuthService-class"],
  depth: 2,
  includeEdgeTypes: ["uses", "imports", "extends"]
});

// Search for security-related code
const securityCode = await search_nodes({
  query: "authentication security password",
  types: ["Function", "Class", "File"],
  limit: 20
});
```

### Codebase Analytics & Insights

```typescript
// Get comprehensive statistics
const stats = await get_graph_stats();
console.log(`
  Total Files: ${stats.nodesByType.File}
  Functions: ${stats.nodesByType.Function} 
  Classes: ${stats.nodesByType.Class}
  Dependencies: ${stats.nodesByType.Library}
  Avg Connections: ${stats.avgEdgesPerNode}
`);

// Export for visualization tools
const graphviz = await export_graph({
  format: "dot",
  nodeTypes: ["Class", "Function"], 
  includeEdges: true
});
// Import into Graphviz, yEd, or other visualization tools
```

### Smart Code Navigation

```typescript
// Find all files that use a specific function
const usages = await query_edges({
  targetId: "validateUser-function-id",
  type: "uses"
});

// Find similar components
const similar = await search_nodes({
  query: "modal dialog popup",
  types: ["Function", "Class"]
});

// Understand architectural layers
const frontendNodes = await query_nodes({
  type: "File",
  properties: { path: "**/components/**" }
});
```

### Advanced Pattern Detection & Code Quality

```typescript
// Detect design patterns and code smells across codebase
const patterns = await detect_patterns({
  directoryPath: "./src",
  patternTypes: ["design", "architectural", "code_smells"],
  createNodes: true
});

// Extract and track TODOs for project management
const todos = await extract_todos({
  directoryPath: "./",
  includeTypes: ["TODO", "FIXME", "HACK"],
  createNodes: true,
  assignToFiles: true
});

// Identify code quality issues
console.log("Found patterns:", patterns.length);
console.log("TODOs to address:", todos.length);
```

### Continuous Knowledge Graph Updates

```typescript
// Start monitoring for changes
await monitor_changes({
  directoryPath: "./src",
  action: "start",
  includePatterns: ["**/*.js", "**/*.ts"],
  excludePatterns: ["**/node_modules/**", "**/dist/**"]
});

// Later, sync any changes
const syncResult = await monitor_changes({
  directoryPath: "./src", 
  action: "sync"
});

console.log(`Updated ${syncResult.filesProcessed} files`);
```

### Semantic Understanding & Code Relationships

```typescript
// Find similar functions/classes by name and structure
const semantics = await semantic_analysis({
  nodeIds: ["UserService", "AuthService", "PaymentService"],
  analysisType: "similarity",
  threshold: 0.7,
  createRelationships: true
});

// Analyze naming consistency
const naming = await semantic_analysis({
  nodeIds: ["all-function-nodes"],
  analysisType: "naming"
});

// Find architectural hotspots
const usage = await semantic_analysis({
  nodeIds: ["all-class-nodes"],
  analysisType: "usage_patterns"
});

console.log("Highly connected components:", usage.results.highlyConnected);
console.log("Isolated components:", usage.results.isolated);
```

## 🎯 Why Use This for Codebase Understanding?

### The Problem
Traditional tools show you individual files, but struggle to answer questions like:
- "How is this component actually used across the codebase?"  
- "What would break if I change this function?"
- "Where are all the authentication-related pieces?"
- "What's the actual architecture of this system?"

### The Solution: Knowledge Graph + AI
This tool builds a **semantic map** of your codebase that understands relationships, not just text matching:

```
SearchResult: "LoginForm component"
├── imports AuthService from "../services/auth" 
├── uses validateCredentials function
├── connects to UserService via AuthHook
└── referenced by 12 other components
```

### Key Benefits
- 🧭 **Navigate by Meaning**: Find related code by concept, not filename
- 🔍 **Impact Analysis**: See what connects to what before making changes  
- 📚 **Onboarding**: New team members understand architecture quickly
- 🏗️ **Refactoring**: Safely restructure code with full relationship visibility
- 📝 **Documentation**: Auto-generate architecture diagrams and dependency maps
- 🤖 **AI Enhancement**: Give your AI assistant a semantic understanding of your codebase

### Perfect For
- **Large, complex codebases** where understanding relationships is hard
- **Team collaboration** where architecture knowledge needs to be shared  
- **Legacy systems** where documentation is missing or outdated
- **Microservices** where understanding cross-service dependencies is crucial
- **AI-assisted development** where context understanding is key

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

### Database Created in Wrong Location

**Problem**: Database is created in your home directory instead of your project directory.

**Logs show**:
```
[KnowledgeGraph] Current working directory: /Users/yourusername
[KnowledgeGraph] Project root detected: /Users/yourusername
[KnowledgeGraph] Database path: /Users/yourusername/knowledge-graph.db
```

**Solution**: Set the `KNOWLEDGE_GRAPH_DIR` environment variable in your MCP configuration:

```json
{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx",
      "args": ["dev-atlas-knowledge-graph"],
      "env": {
        "KNOWLEDGE_GRAPH_DIR": "/Users/yourusername/projects/your-project"
      }
    }
  }
}
```

After updating, you should see:
```
[KnowledgeGraph] Using KNOWLEDGE_GRAPH_DIR: /Users/yourusername/projects/your-project
[KnowledgeGraph] Database path: /Users/yourusername/projects/your-project/knowledge-graph.db
```

### Database Not Found

If you see database path issues:
1. Check the startup logs for the detected paths
2. Set the `KNOWLEDGE_GRAPH_DIR` environment variable (recommended)
3. Ensure you're running from within your project
4. Verify your project has identifying files (`package.json`, etc.)

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