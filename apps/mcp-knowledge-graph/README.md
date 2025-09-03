# @dev-atlas/mcp-knowledge-graph

A Model Context Protocol (MCP) server for managing knowledge graphs using SQLite.

## Features

- 🧠 Knowledge graph management with entities and relations
- 🗄️ SQLite database backend using Drizzle ORM
- 🔧 TypeScript support with full type definitions
- 🚀 Easy integration with MCP-compatible AI assistants

## Installation

```bash
npm install @dev-atlas/mcp-knowledge-graph
```

## Usage

This package provides an MCP server that can be integrated with AI assistants to manage knowledge graphs.

```javascript
import { startServer } from '@dev-atlas/mcp-knowledge-graph';

// Start the MCP server
startServer();
```

## Configuration

The server uses SQLite to store the knowledge graph data. The database file will be created automatically.

## API

The MCP server provides tools for:

- Creating and managing entities
- Creating relationships between entities
- Querying the knowledge graph
- Adding observations to entities

## License

MIT
