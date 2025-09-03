# Dev Atlas 🗺️

**Knowledge Graph for Developers**

Un monorepo completo que incluye un servidor MCP (Model Context Protocol) para manejar knowledge graphs en SQLite, una extensión elegante para VS Code/Cursor, y un sitio web de documentación moderno.

## 🚀 Características Principales

- **🔗 Servidor MCP**: Potente backend para gestionar knowledge graphs
- **🎨 Extensión VS Code/Cursor**: Interfaz visual elegante e intuitiva  
- **📚 Documentación Web**: Sitio moderno con Next.js 15 y Nextra
- **⚡ Alto Rendimiento**: Built with TypeScript y arquitectura moderna
- **🧠 Knowledge Management**: Mapea y conecta conceptos de desarrollo

## 🏗️ Estructura del Proyecto

```
dev-atlas/
├── apps/
│   ├── mcp-knowledge-graph/     # Servidor MCP para el knowledge graph
│   ├── vscode-extension/        # Extensión para VS Code/Cursor
│   └── website/                 # Sitio web de documentación (Next.js + Nextra)
├── packages/
│   └── shared/                  # Tipos y utilidades compartidas
├── package.json                 # Configuración del monorepo
├── turbo.json                   # Configuración de Turbo
└── biome.json                   # Configuración de Biome (linter/formatter)
```

## Características

### MCP Knowledge Graph
- Servidor MCP que maneja un knowledge graph en SQLite
- Operaciones CRUD para nodos y edges
- Búsqueda y consultas avanzadas
- Traversal del grafo
- Validación con Zod
- ORM con Drizzle

### Extensión VS Code/Cursor
- Interfaz visual para el knowledge graph
- Comandos para crear nodos y edges
- Vista en el explorador
- Integración con el MCP server

### Website & Documentación
- Landing page moderna y atractiva
- Documentación completa con Next.js 15 y Nextra
- Guías de instalación y uso
- Referencias de API y ejemplos
- Responsive design y navegación intuitiva

### Shared Package
- Tipos TypeScript compartidos
- Utilidades comunes
- Esquemas de validación

## Tecnologías Utilizadas

- **Turbo**: Monorepo build system
- **TypeScript**: Lenguaje principal
- **Zod**: Validación de esquemas
- **Drizzle ORM**: ORM para SQLite
- **Better SQLite3**: Base de datos SQLite
- **Biome**: Linter y formatter
- **Vitest**: Testing framework
- **MCP SDK**: Model Context Protocol

## Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Ejecuta todos los workspaces en modo desarrollo
npm run build        # Construye todos los workspaces
npm run test         # Ejecuta todos los tests
npm run lint         # Linter en todos los workspaces
npm run format       # Formatea el código con Biome
npm run clean        # Limpia todos los builds

# Workspace específico
npm run dev --workspace=dev-atlas-knowledge-graph
npm run build --workspace=dev-atlas-knowledge-graph
```

## Desarrollo

### Prerrequisitos
- Node.js >= 18.0.0
- npm >= 10.0.0

### Instalación
```bash
npm install
```

### Ejecutar el MCP Server
```bash
cd apps/mcp-knowledge-graph
npm run dev
```

### Desarrollar la Extensión
```bash
cd apps/vscode-extension
npm run dev
```

### Ejecutar el Website
```bash
cd apps/website
npm run dev
# El sitio estará disponible en http://localhost:3000
```

## Próximos Pasos

1. **Integración MCP-Extensión**: Conectar la extensión con el servidor MCP
2. **Visualización del Grafo**: Implementar una vista gráfica del knowledge graph
3. **Importación de Datos**: Herramientas para importar datos desde diferentes fuentes
4. **Búsqueda Avanzada**: Implementar búsqueda semántica y filtros
5. **Exportación**: Funcionalidades para exportar el grafo en diferentes formatos

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request