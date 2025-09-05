## Add Dev Atlas Knowledge Graph MCP Server

### Summary
This PR adds the **Dev Atlas Knowledge Graph** MCP server to the Docker registry. This server enables AI assistants to create, manage, and traverse knowledge graphs stored in SQLite, providing persistent memory and relationship mapping capabilities.

### Server Information
- **Name**: dev-atlas-knowledge-graph
- **Repository**: https://github.com/abdul-hamid-achik/dev-atlas
- **Version**: 2.0.1
- **License**: MIT

### Features
- 🔗 **Graph Operations**: Full CRUD operations for nodes and edges
- 🔍 **Advanced Search**: Query and traverse complex relationships
- 💾 **Persistent Storage**: SQLite-based storage with Drizzle ORM
- 🎯 **Type-Safe**: Full TypeScript implementation with Zod validation
- 🤖 **AI-Optimized**: Designed specifically for AI assistant workflows
- 📊 **Knowledge Management**: Map and connect concepts, entities, and data points

### Use Cases
- Building persistent memory for AI assistants
- Creating semantic knowledge networks
- Mapping relationships between concepts and entities
- Storing and retrieving contextual information
- Building domain-specific knowledge bases

### Technical Details
- **Runtime**: Node.js 20 Alpine
- **Database**: SQLite with Better-SQLite3
- **ORM**: Drizzle ORM
- **Validation**: Zod schemas
- **Protocol**: Model Context Protocol (MCP) SDK

### Docker Image
- [x] Dockerfile included and tested
- [x] Multi-stage build for optimized image size
- [x] Non-root user for security
- [x] Volume support for persistent data
- [x] Environment variable configuration

### Testing
- [x] Server builds successfully
- [x] Docker image builds without errors
- [x] Follows MCP protocol standards
- [x] Includes comprehensive error handling

### Compliance Checklist
- [x] Follows security best practices
- [x] Includes comprehensive documentation
- [x] Provides working Docker deployment
- [x] Maintains MCP standards compatibility
- [x] Includes proper error handling and logging
- [x] MIT licensed (open source)

### Additional Notes
This server is part of the larger Dev Atlas monorepo which includes a VS Code extension and documentation website. The MCP server component can be used independently and provides a powerful knowledge graph backend for any MCP-compatible AI assistant.

### Related Links
- [Documentation](https://github.com/abdul-hamid-achik/dev-atlas/tree/main/apps/mcp-knowledge-graph)
- [NPM Package](https://www.npmjs.com/package/dev-atlas-knowledge-graph)
- [Issue Tracker](https://github.com/abdul-hamid-achik/dev-atlas/issues)