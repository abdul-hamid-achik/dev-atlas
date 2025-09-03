# Knowledge Graph Visualizer

The Dev Atlas extension now includes a powerful interactive knowledge graph visualizer that allows you to explore and understand the relationships between nodes in your knowledge graph.

## Features

### Visual Graph Rendering
- **Interactive D3.js-powered visualization** with force-directed layout
- **Dynamic node sizing** based on the number of connections
- **Color-coded node types** with a legend for easy identification
- **Directional edges** with labels showing relationship types

### Interactive Controls
- **Zoom and Pan**: Mouse wheel to zoom, click and drag to pan
- **Node Dragging**: Click and drag nodes to reposition them
- **Reset View**: Button to reset zoom and pan to default
- **Toggle Physics**: Enable/disable force simulation for static or dynamic layout
- **Fit to Window**: Automatically zoom to fit all nodes in the view
- **Refresh Data**: Update the visualization with latest graph data

### Search and Filtering
- **Real-time Search**: Search for nodes by name or type
- **Visual Highlighting**: Matching nodes are highlighted while others are dimmed
- **Auto-focus**: Automatically centers the view on search results
- **Clear Search**: Reset search and highlighting

### Node Types and Colors
The visualizer supports various node types, each with distinct colors:

- **Technology** (Blue) - Core technologies and platforms
- **Language** (Orange) - Programming languages
- **Runtime** (Green) - Runtime environments
- **Framework** (Red) - Application frameworks
- **Library** (Purple) - Code libraries and packages
- **Tool** (Brown) - Development tools
- **Concept** (Pink) - Abstract concepts and ideas
- **Person** (Gray) - People and individuals
- **Project** (Yellow-green) - Specific projects
- **Organization** (Cyan) - Companies and organizations
- **Documentation** (Light Blue) - Documentation resources
- **Tutorial** (Light Orange) - Educational content
- **Other** (Light Green) - Miscellaneous items

### Graph Statistics
- **Node Count**: Total number of nodes in the graph
- **Edge Count**: Total number of relationships
- **Density**: Mathematical measure of how connected the graph is (0-1 scale)

### Information Panel
Click any node to see detailed information including:
- Node label and type
- Unique identifier
- Connected relationships

## Usage

### Opening the Visualizer
1. Open the Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Run the command: `Dev Atlas: Open Knowledge Graph`
3. The visualizer will open in a new panel

### Alternative Access
- Click the graph icon in the Activity Bar to open the Dev Atlas panel
- Click the "Open Knowledge Graph" button in the panel toolbar

### Navigation
- **Mouse Wheel**: Zoom in/out
- **Click + Drag on Background**: Pan the view
- **Click + Drag on Node**: Move individual nodes
- **Click on Node**: Show information panel
- **Double-click on Background**: Reset view

### Searching
1. Type in the search box in the top-left controls
2. Press Enter or click the Search button
3. Use Clear button to reset search highlighting

## Integration with MCP Server

The visualizer automatically displays data from your Knowledge Graph Provider, which can be connected to:
- Local SQLite database via the MCP Knowledge Graph server
- Real-time updates when nodes and edges are created/modified
- Sample data for demonstration when no MCP server is connected

## Performance Notes

- The visualizer is optimized for graphs with up to several hundred nodes
- Force simulation can be disabled for better performance on large graphs
- Search operations are performed client-side for instant results
- Graph layout calculations are done using efficient D3.js algorithms

## Keyboard Shortcuts

- **Enter** (in search box): Execute search
- **Escape**: Clear search (when search box is focused)
- **Spacebar**: Toggle physics simulation
- **F**: Fit to window
- **R**: Reset view

## Customization

The visualizer respects VS Code's color theme and will automatically adapt to light/dark modes. All colors and styling integrate with the VS Code UI for a consistent experience.

## Troubleshooting

### Graph Not Loading
- Ensure the extension is properly activated
- Check that sample data is available in the Knowledge Graph Provider
- Try refreshing the graph data using the Refresh button

### Poor Performance
- Disable physics simulation for large graphs
- Use search to focus on specific areas of interest
- Consider filtering data at the source to reduce node count

### Visual Issues
- Try resetting the view if nodes appear outside the viewport
- Ensure your browser supports WebGL for optimal D3.js performance
- Check VS Code's zoom level if elements appear too small/large

## Future Enhancements

Planned features for future releases:
- Export visualization as PNG/SVG
- Multiple layout algorithms (circular, hierarchical, etc.)
- Advanced filtering options
- Real-time collaboration features
- Integration with external graph databases
