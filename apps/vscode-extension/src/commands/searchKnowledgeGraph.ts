import * as vscode from 'vscode';
import { z } from 'zod';
import type { Node, Edge } from '../db/schema';
import { log } from '../extension';
import type { KnowledgeGraphProvider } from '../views/KnowledgeGraphProvider';

// Global provider type
type GlobalWithProvider = typeof globalThis & {
    devAtlasKnowledgeGraphProvider?: KnowledgeGraphProvider;
};

// Zod schemas for search functionality
const SearchParamsSchema = z.object({
    searchTerm: z.string().min(1, 'Search term is required'),
    searchType: z.enum(['nodes', 'edges', 'both']).default('both'),
    nodeType: z.string().optional(),
    edgeType: z.string().optional(),
    includeProperties: z.boolean().default(true),
});

const SearchResultSchema = z.object({
    type: z.enum(['node', 'edge']),
    item: z.union([
        z.object({
            id: z.string(),
            type: z.string(),
            label: z.string(),
            properties: z.record(z.unknown()).optional(),
        }),
        z.object({
            id: z.string(),
            type: z.string(),
            sourceId: z.string(),
            targetId: z.string(),
            properties: z.record(z.unknown()).optional(),
            weight: z.number().optional(),
        }),
    ]),
    score: z.number(),
    matchFields: z.array(z.string()),
});

const AdvancedSearchParamsSchema = z.object({
    searchTerm: z.string().optional(),
    nodeType: z.string().optional(),
    edgeType: z.string().optional(),
    searchType: z.enum(['nodes', 'edges', 'both']),
});

const FileActionConfigSchema = z.object({
    action: z.enum(['open', 'copy', 'both']),
    files: z.array(z.string()),
    rememberChoice: z.boolean().default(false),
});

type SearchParams = z.infer<typeof SearchParamsSchema>;
type SearchResult = z.infer<typeof SearchResultSchema>;
type AdvancedSearchParams = z.infer<typeof AdvancedSearchParamsSchema>;
type FileActionConfig = z.infer<typeof FileActionConfigSchema>;

interface NodeSearchResult {
    type: 'node';
    item: Node;
    score: number;
    matchFields: string[];
}

interface EdgeSearchResult {
    type: 'edge';
    item: Edge;
    score: number;
    matchFields: string[];
}

type TypedSearchResult = NodeSearchResult | EdgeSearchResult;

interface SearchQuickPickItem extends vscode.QuickPickItem {
    result?: TypedSearchResult;
}

/**
 * Simple search command that finds nodes and edges by label, type, or properties.
 */
export async function searchKnowledgeGraphCommand() {
    log('Search knowledge graph command started');

    try {
        const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
        if (!knowledgeGraphProvider) {
            vscode.window.showErrorMessage('Knowledge graph provider not available');
            log('Knowledge graph provider not found', 'error');
            return;
        }

        const db = knowledgeGraphProvider.getDatabase();
        if (!db) {
            vscode.window.showErrorMessage('Database not available');
            log('Database not found', 'error');
            return;
        }

        // Get search term from user
        const searchTerm = await vscode.window.showInputBox({
            prompt: 'Search nodes and edges',
            placeHolder: 'Enter search term (searches labels, types, and properties)',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Search term is required';
                }
                if (value.length < 2) {
                    return 'Search term must be at least 2 characters';
                }
                return null;
            }
        });

        if (!searchTerm) {
            return;
        }

        const searchParams: SearchParams = {
            searchTerm: searchTerm.trim(),
            searchType: 'both',
            includeProperties: true,
        };

        log(`Searching for: "${searchParams.searchTerm}"`);
        const results = await performSearch(db, searchParams);

        if (results.length === 0) {
            vscode.window.showInformationMessage(`No results found for "${searchTerm}"`);
            return;
        }

        await showSearchResults(results, searchTerm);

    } catch (error) {
        vscode.window.showErrorMessage(`Search error: ${error}`);
        log(`Search error: ${error}`, 'error');
    }
}

/**
 * Vector/Semantic search command using embeddings for intelligent results.
 */
export async function vectorSearchCommand() {
    log('Vector search command started');

    try {
        const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
        if (!knowledgeGraphProvider) {
            vscode.window.showErrorMessage('Knowledge graph provider not available');
            log('Knowledge graph provider not found', 'error');
            return;
        }

        const db = knowledgeGraphProvider.getDatabase();
        if (!db) {
            vscode.window.showErrorMessage('Database not available');
            log('Database not found', 'error');
            return;
        }

        // Get search query from user
        const searchQuery = await vscode.window.showInputBox({
            prompt: 'Enter semantic search query (finds related concepts, not just exact matches)',
            placeHolder: 'e.g., "authentication security", "React components", "database models"',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Search query is required';
                }
                if (value.length < 3) {
                    return 'Search query must be at least 3 characters';
                }
                return null;
            }
        });

        if (!searchQuery) {
            return;
        }

        // Show search options
        const searchOptions = await vscode.window.showQuickPick([
            {
                label: '🔍 Standard Vector Search',
                description: 'Find semantically similar nodes using embeddings',
                value: 'vector'
            },
            {
                label: '🧠 Hybrid Search',
                description: 'Combine text matching + semantic similarity for best results',
                value: 'hybrid'
            },
            {
                label: '🌐 Contextual Search',
                description: 'Get rich context including related nodes and relationships',
                value: 'contextual'
            }
        ], {
            placeHolder: 'Choose search type',
            title: 'Vector Search Options'
        });

        if (!searchOptions) {
            return;
        }

        log(`Performing ${searchOptions.value} search for: "${searchQuery}"`);

        let results: any[] = [];
        let searchTitle = '';

        try {
            switch (searchOptions.value) {
                case 'vector':
                    const vectorResults = await db.vectorSearchNodes(searchQuery.trim(), {
                        limit: 20,
                        threshold: 0.1
                    });
                    results = vectorResults.map((r: any) => ({
                        type: 'node',
                        item: r.node,
                        score: Math.round(r.similarity * 100),
                        matchFields: ['semantic'],
                        similarity: r.similarity
                    }));
                    searchTitle = `Vector Search: "${searchQuery}"`;
                    break;

                case 'hybrid':
                    // Use hybrid search by creating a node structure
                    const hybridResults = await db.hybridSimilaritySearch({
                        type: 'Component', // Default type for search
                        label: searchQuery.trim(),
                        properties: {}
                    }, {
                        vectorWeight: 0.6,
                        traditionalWeight: 0.4,
                        threshold: 0.3
                    });

                    results = hybridResults.map((node: any) => ({
                        type: 'node',
                        item: node,
                        score: 85, // High score for hybrid matches
                        matchFields: ['hybrid'],
                    }));
                    searchTitle = `Hybrid Search: "${searchQuery}"`;
                    break;

                case 'contextual':
                    const contextResults = await db.getContextualInformation(searchQuery.trim(), {
                        includeRelated: true,
                        relationshipDepth: 2,
                        limit: 15
                    });

                    // Combine direct matches and related nodes
                    const directResults = contextResults.directMatches.map((node: any) => ({
                        type: 'node',
                        item: node,
                        score: 95,
                        matchFields: ['direct'],
                        category: 'Direct Match'
                    }));

                    const relatedResults = contextResults.relatedNodes.slice(0, 10).map((r: any) => ({
                        type: 'node',
                        item: r.node,
                        score: Math.max(50 - (r.distance * 10), 10),
                        matchFields: ['related'],
                        category: `Related (${r.relationship}, distance: ${r.distance})`
                    }));

                    results = [...directResults, ...relatedResults];
                    searchTitle = `Contextual Search: "${searchQuery}" (${contextResults.summary.confidence * 100}% confidence)`;
                    break;
            }

            if (results.length === 0) {
                vscode.window.showInformationMessage(`No semantic results found for "${searchQuery}"`);
                return;
            }

            await showVectorSearchResults(results, searchTitle, searchOptions.value);

        } catch (error) {
            log(`Vector search error: ${error}`, 'error');

            // Show user-friendly error message
            if (error instanceof Error && error.message.includes('Ollama')) {
                vscode.window.showWarningMessage(
                    `Vector search unavailable: ${error.message}. Using fallback search...`
                );
                // Fallback to regular search
                await searchKnowledgeGraphCommand();
            } else {
                vscode.window.showErrorMessage(`Vector search failed: ${error}`);
            }
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Vector search error: ${error}`);
        log(`Vector search error: ${error}`, 'error');
    }
}

/**
 * Advanced search command with filters and options.
 */
export async function advancedSearchCommand() {
    log('Advanced search command started');

    try {
        const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
        if (!knowledgeGraphProvider) {
            vscode.window.showErrorMessage('Knowledge graph provider not available');
            return;
        }

        const db = knowledgeGraphProvider.getDatabase();
        if (!db) {
            vscode.window.showErrorMessage('Database not available');
            return;
        }

        // Get search parameters
        const searchParams = await getAdvancedSearchParams();
        if (!searchParams) {
            return;
        }

        log(`Advanced search with params: ${JSON.stringify(searchParams)}`);
        const results = await performAdvancedSearch(db, searchParams);

        if (results.length === 0) {
            vscode.window.showInformationMessage('No results found with the specified criteria');
            return;
        }

        await showSearchResults(results, `Advanced Search (${results.length} results)`);

    } catch (error) {
        vscode.window.showErrorMessage(`Advanced search error: ${error}`);
        log(`Advanced search error: ${error}`, 'error');
    }
}

/**
 * Performs a simple text-based search across nodes and edges.
 */
async function performSearch(db: any, params: SearchParams): Promise<TypedSearchResult[]> {
    const results: TypedSearchResult[] = [];
    const lowerSearchTerm = params.searchTerm.toLowerCase();

    // Search nodes
    if (params.searchType === 'both' || params.searchType === 'nodes') {
        const nodes = await db.queryNodes({ limit: 1000 });
        for (const node of nodes) {
            const score = calculateNodeSearchScore(node, lowerSearchTerm);
            if (score > 0) {
                const matchFields = getNodeMatchingFields(node, lowerSearchTerm);
                results.push({ type: 'node', item: node, score, matchFields });
            }
        }
    }

    // Search edges  
    if (params.searchType === 'both' || params.searchType === 'edges') {
        const edges = await db.queryEdges({ limit: 1000 });
        for (const edge of edges) {
            const score = calculateEdgeSearchScore(edge, lowerSearchTerm);
            if (score > 0) {
                const matchFields = getEdgeMatchingFields(edge, lowerSearchTerm);
                results.push({ type: 'edge', item: edge, score, matchFields });
            }
        }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
}

/**
 * Calculates relevance score for node search results.
 */
function calculateNodeSearchScore(node: Node, searchTerm: string): number {
    let score = 0;
    const label = (node.label || '').toLowerCase();
    const nodeType = (node.type || '').toLowerCase();
    const properties = node.properties || {};

    // Exact label match gets highest score
    if (label === searchTerm) {
        score += 100;
    } else if (label.includes(searchTerm)) {
        score += 50;
    } else if (label.startsWith(searchTerm)) {
        score += 30;
    }

    // Type match
    if (nodeType === searchTerm) {
        score += 40;
    } else if (nodeType.includes(searchTerm)) {
        score += 20;
    }

    // Properties match
    const propertiesString = JSON.stringify(properties).toLowerCase();
    if (propertiesString.includes(searchTerm)) {
        score += 10;
    }

    return score;
}

/**
 * Calculates relevance score for edge search results.
 */
function calculateEdgeSearchScore(edge: Edge, searchTerm: string): number {
    let score = 0;
    const edgeType = (edge.type || '').toLowerCase();
    const properties = edge.properties || {};

    // Type match (edges don't have labels)
    if (edgeType === searchTerm) {
        score += 60;
    } else if (edgeType.includes(searchTerm)) {
        score += 30;
    }

    // Properties match
    const propertiesString = JSON.stringify(properties).toLowerCase();
    if (propertiesString.includes(searchTerm)) {
        score += 10;
    }

    // Source/Target ID partial match
    if (edge.sourceId.toLowerCase().includes(searchTerm) || edge.targetId.toLowerCase().includes(searchTerm)) {
        score += 5;
    }

    return score;
}

/**
 * Gets the fields that matched the search term for nodes.
 */
function getNodeMatchingFields(node: Node, searchTerm: string): string[] {
    const fields: string[] = [];
    const label = (node.label || '').toLowerCase();
    const nodeType = (node.type || '').toLowerCase();
    const properties = node.properties || {};

    if (label.includes(searchTerm)) {
        fields.push('label');
    }

    if (nodeType.includes(searchTerm)) {
        fields.push('type');
    }

    const propertiesString = JSON.stringify(properties).toLowerCase();
    if (propertiesString.includes(searchTerm)) {
        fields.push('properties');
    }

    return fields;
}

/**
 * Gets the fields that matched the search term for edges.
 */
function getEdgeMatchingFields(edge: Edge, searchTerm: string): string[] {
    const fields: string[] = [];
    const edgeType = (edge.type || '').toLowerCase();
    const properties = edge.properties || {};

    if (edgeType.includes(searchTerm)) {
        fields.push('type');
    }

    const propertiesString = JSON.stringify(properties).toLowerCase();
    if (propertiesString.includes(searchTerm)) {
        fields.push('properties');
    }

    if (edge.sourceId.toLowerCase().includes(searchTerm) || edge.targetId.toLowerCase().includes(searchTerm)) {
        fields.push('ids');
    }

    return fields;
}

/**
 * Gets parameters for advanced search from user input.
 */
async function getAdvancedSearchParams(): Promise<AdvancedSearchParams | null> {
    // First, ask what to search
    const searchScope = await vscode.window.showQuickPick([
        { label: 'Both Nodes and Edges', value: 'both' },
        { label: 'Nodes Only', value: 'nodes' },
        { label: 'Edges Only', value: 'edges' }
    ], {
        placeHolder: 'What do you want to search?'
    });

    if (!searchScope) {
        return null;
    }

    // Get search term
    const searchTerm = await vscode.window.showInputBox({
        prompt: 'Enter search term (optional)',
        placeHolder: 'Search in labels, types, and properties'
    });

    let nodeType: string | undefined;
    let edgeType: string | undefined;

    // Get type filter if searching nodes
    if (searchScope.value === 'both' || searchScope.value === 'nodes') {
        nodeType = await vscode.window.showInputBox({
            prompt: 'Filter by node type (optional)',
            placeHolder: 'e.g., Framework, Language, Tool'
        });
    }

    // Get type filter if searching edges
    if (searchScope.value === 'both' || searchScope.value === 'edges') {
        edgeType = await vscode.window.showInputBox({
            prompt: 'Filter by edge type (optional)',
            placeHolder: 'e.g., uses, depends_on, related_to'
        });
    }

    try {
        return AdvancedSearchParamsSchema.parse({
            searchTerm: searchTerm?.trim() || undefined,
            nodeType: nodeType?.trim() || undefined,
            edgeType: edgeType?.trim() || undefined,
            searchType: searchScope.value,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            vscode.window.showErrorMessage(`Invalid search parameters: ${error.message}`);
        }
        return null;
    }
}

/**
 * Performs advanced search with filters.
 */
async function performAdvancedSearch(db: any, params: AdvancedSearchParams): Promise<TypedSearchResult[]> {
    const results: TypedSearchResult[] = [];

    // Search nodes if requested
    if (params.searchType === 'both' || params.searchType === 'nodes') {
        const nodeQuery: any = { limit: 1000 };
        if (params.nodeType) {
            nodeQuery.type = params.nodeType;
        }
        if (params.searchTerm) {
            nodeQuery.label = params.searchTerm;
        }

        const nodes = await db.queryNodes(nodeQuery);
        for (const node of nodes) {
            let score = 50; // Base score for filtered results
            let matchFields: string[] = [];

            if (params.searchTerm) {
                const termScore = calculateNodeSearchScore(node, params.searchTerm.toLowerCase());
                score += termScore;
                if (termScore > 0) {
                    matchFields.push(...getNodeMatchingFields(node, params.searchTerm.toLowerCase()));
                }
            }

            if (params.nodeType) {
                matchFields.push('type');
            }

            results.push({ type: 'node', item: node, score, matchFields });
        }
    }

    // Search edges if requested
    if (params.searchType === 'both' || params.searchType === 'edges') {
        const edgeQuery: any = { limit: 1000 };
        if (params.edgeType) {
            edgeQuery.type = params.edgeType;
        }

        const edges = await db.queryEdges(edgeQuery);
        for (const edge of edges) {
            let score = 50; // Base score for filtered results
            let matchFields: string[] = [];

            if (params.searchTerm) {
                const termScore = calculateEdgeSearchScore(edge, params.searchTerm.toLowerCase());
                score += termScore;
                if (termScore > 0) {
                    matchFields.push(...getEdgeMatchingFields(edge, params.searchTerm.toLowerCase()));
                }
            }

            if (params.edgeType) {
                matchFields.push('type');
            }

            results.push({ type: 'edge', item: edge, score, matchFields });
        }
    }

    return results.sort((a, b) => b.score - a.score);
}

/**
 * Shows vector/semantic search results with enhanced information.
 */
async function showVectorSearchResults(results: any[], searchTitle: string, searchType: string) {
    const items: SearchQuickPickItem[] = results.map(result => {
        const item = result.item;
        const isNode = result.type === 'node';

        let description = `${result.type.toUpperCase()}: ${item.type}`;

        // Add similarity score for vector results
        if (result.similarity) {
            description += ` | Similarity: ${(result.similarity * 100).toFixed(1)}%`;
        }

        // Add category for contextual results
        if (result.category) {
            description += ` | ${result.category}`;
        }

        if (!isNode) {
            const edge = item as Edge;
            description += ` (${edge.sourceId.slice(0, 8)}... → ${edge.targetId.slice(0, 8)}...)`;
        }

        let detail = `Matches: ${result.matchFields.join(', ')} | Score: ${result.score}`;

        // Add file hint if it looks like a file
        if (isNode && item.label && isFileLikeName(item.label)) {
            detail += ` | 📁 File detected`;
        }

        if (item.properties && Object.keys(item.properties).length > 0) {
            detail += ` | Props: ${Object.keys(item.properties).slice(0, 3).join(', ')}${Object.keys(item.properties).length > 3 ? '...' : ''}`;
        }

        const displayLabel = isNode ? (item as Node).label : (item as Edge).type;
        const emoji = searchType === 'contextual' && result.category?.includes('Related') ? '🔗' : (isNode ? '⭕' : '➡️');

        return {
            label: `${emoji} ${displayLabel || item.type}`,
            description,
            detail,
            result
        };
    });

    // Add action options
    const actionItems: vscode.QuickPickItem[] = [
        { kind: vscode.QuickPickItemKind.Separator, label: `${searchType.charAt(0).toUpperCase() + searchType.slice(1)} Actions` },
        {
            label: '🧠 Generate Embeddings',
            description: 'Generate embeddings for nodes without them',
            detail: 'Improves semantic search quality by generating embeddings'
        },
        {
            label: '📊 Provider Info',
            description: 'Check embedding provider status',
            detail: 'Shows available providers (Ollama, OpenAI, Simple JS)'
        },
        {
            label: '📋 Copy Results to Clipboard',
            description: 'Copy search results as formatted text',
            detail: 'Includes similarity scores and semantic context'
        },
        {
            label: '📊 Open Graph Visualizer',
            description: 'Open visual graph and highlight results',
            detail: 'Opens the interactive graph with search results highlighted'
        }
    ];

    const allItems: (SearchQuickPickItem | vscode.QuickPickItem)[] = [...items, ...actionItems];

    const selected = await vscode.window.showQuickPick(allItems, {
        placeHolder: `${results.length} semantic results for: ${searchTitle}`,
        title: 'Vector Search Results',
        canPickMany: false
    });

    if (!selected) {
        return;
    }

    // Handle action items
    if (selected.label.includes('Generate Embeddings')) {
        await handleGenerateEmbeddings();
        return;
    }

    if (selected.label.includes('Provider Info')) {
        await handleProviderInfo();
        return;
    }

    if (selected.label.includes('Copy Results')) {
        await copyVectorSearchResultsToClipboard(results, searchTitle);
        return;
    }

    if (selected.label.includes('Open Graph Visualizer')) {
        vscode.commands.executeCommand('dev-atlas.openKnowledgeGraph');
        vscode.window.showInformationMessage('Graph visualizer opened - semantic highlighting coming soon!');
        return;
    }

    // Handle result selection
    const searchItem = selected as SearchQuickPickItem;
    if (searchItem.result) {
        await handleSearchResultSelection(searchItem.result);
    }
}

/**
 * Shows search results in a quick pick interface.
 */
async function showSearchResults(results: TypedSearchResult[], searchTitle: string) {
    const items: SearchQuickPickItem[] = results.map(result => {
        const item = result.item;
        const isNode = result.type === 'node';

        let description = `${result.type.toUpperCase()}: ${item.type}`;
        if (!isNode) {
            const edge = item as Edge;
            description += ` (${edge.sourceId} → ${edge.targetId})`;
        }

        let detail = `Matches: ${result.matchFields.join(', ')} | Score: ${result.score}`;
        if (item.properties && Object.keys(item.properties).length > 0) {
            detail += ` | Props: ${Object.keys(item.properties).join(', ')}`;
        }

        const displayLabel = isNode ? (item as Node).label : (item as Edge).type;

        return {
            label: `${isNode ? '⭕' : '➡️'} ${displayLabel || item.type}`,
            description,
            detail,
            result
        };
    });

    // Add action options
    const actionItems: vscode.QuickPickItem[] = [
        { kind: vscode.QuickPickItemKind.Separator, label: 'Actions' },
        {
            label: '📊 Open Graph Visualizer',
            description: 'Open visual graph and highlight results',
            detail: 'Opens the interactive graph with search results highlighted'
        },
        {
            label: '📋 Copy Results to Clipboard',
            description: 'Copy search results as formatted text',
            detail: 'Copies results in a readable format for sharing'
        }
    ];

    const allItems: (SearchQuickPickItem | vscode.QuickPickItem)[] = [...items, ...actionItems];

    const selected = await vscode.window.showQuickPick(allItems, {
        placeHolder: `${results.length} results for: ${searchTitle}`,
        title: 'Search Results',
        canPickMany: false
    });

    if (!selected) {
        return;
    }

    // Handle action items
    if (selected.label.includes('Open Graph Visualizer')) {
        vscode.commands.executeCommand('dev-atlas.openKnowledgeGraph');
        vscode.window.showInformationMessage('Graph visualizer opened - search highlighting coming in future update');
        return;
    }

    if (selected.label.includes('Copy Results')) {
        await copySearchResultsToClipboard(results, searchTitle);
        return;
    }

    // Handle result selection
    const searchItem = selected as SearchQuickPickItem;
    if (searchItem.result) {
        await handleSearchResultSelection(searchItem.result);
    }
}

/**
 * Handles selection of a specific search result.
 */
async function handleSearchResultSelection(result: TypedSearchResult) {
    const item = result.item;
    const isNode = result.type === 'node';
    const displayLabel = isNode ? (item as Node).label : (item as Edge).type;

    // Show detailed information about the selected item
    let detail: string;
    if (isNode) {
        const node = item as Node;
        detail = `Node: ${node.label} (${node.type})\nID: ${node.id}\nProperties: ${JSON.stringify(node.properties, null, 2)}`;
    } else {
        const edge = item as Edge;
        detail = `Edge: ${edge.type}\nFrom: ${edge.sourceId}\nTo: ${edge.targetId}\nProperties: ${JSON.stringify(edge.properties, null, 2)}`;
    }

    const action = await vscode.window.showQuickPick([
        { label: '📄 Show Details', description: 'View full item details' },
        { label: '📋 Copy ID', description: 'Copy item ID to clipboard' },
        { label: '🔗 Find Connected', description: 'Find related nodes/edges' }
    ], {
        placeHolder: `Actions for ${displayLabel || item.type}`
    });

    if (!action) {
        return;
    }

    if (action.label.includes('Show Details')) {
        vscode.window.showInformationMessage(detail);
    } else if (action.label.includes('Copy ID')) {
        await vscode.env.clipboard.writeText(item.id);
        vscode.window.showInformationMessage(`Copied ID: ${item.id}`);
    } else if (action.label.includes('Find Connected')) {
        const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
        if (knowledgeGraphProvider?.getDatabase()) {
            await findConnectedItems(knowledgeGraphProvider.getDatabase()!, item, result.type);
        }
    }
}

/**
 * Finds items connected to the given node or edge.
 */
async function findConnectedItems(db: any, item: Node | Edge, type: 'node' | 'edge') {
    try {
        if (type === 'node') {
            const node = item as Node;

            // Find edges connected to this node
            const connectedEdges = await db.queryEdges({ sourceId: node.id });
            const connectedEdges2 = await db.queryEdges({ targetId: node.id });
            const allConnectedEdges = [...connectedEdges, ...connectedEdges2];

            if (allConnectedEdges.length === 0) {
                vscode.window.showInformationMessage(`No edges connected to node: ${node.label}`);
                return;
            }

            const edgeItems = allConnectedEdges.map(edge => ({
                label: `➡️ ${edge.type}`,
                description: `${edge.sourceId} → ${edge.targetId}`,
                detail: `Edge ID: ${edge.id}`
            }));

            await vscode.window.showQuickPick(edgeItems, {
                placeHolder: `${allConnectedEdges.length} edges connected to ${node.label}`
            });

        } else {
            // For edges, find the source and target nodes
            const edge = item as Edge;
            const sourceNode = await db.getNode(edge.sourceId);
            const targetNode = await db.getNode(edge.targetId);

            const nodeItems: vscode.QuickPickItem[] = [];
            if (sourceNode) {
                nodeItems.push({
                    label: `⭕ ${sourceNode.label} (source)`,
                    description: sourceNode.type,
                    detail: `Node ID: ${sourceNode.id}`
                });
            }
            if (targetNode) {
                nodeItems.push({
                    label: `⭕ ${targetNode.label} (target)`,
                    description: targetNode.type,
                    detail: `Node ID: ${targetNode.id}`
                });
            }

            if (nodeItems.length > 0) {
                await vscode.window.showQuickPick(nodeItems, {
                    placeHolder: `Nodes connected by edge: ${edge.type}`
                });
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error finding connected items: ${error}`);
    }
}

/**
 * Copies search results to clipboard in a formatted way.
 */
async function copySearchResultsToClipboard(results: TypedSearchResult[], searchTitle: string) {
    try {
        const config = vscode.workspace.getConfiguration('devAtlas');
        const prefix = config.get<string>('filePathPrefix', '@');

        let clipboardContent = `# ${searchTitle}\n\n`;

        const nodeResults = results.filter((r): r is NodeSearchResult => r.type === 'node');
        const edgeResults = results.filter((r): r is EdgeSearchResult => r.type === 'edge');

        if (nodeResults.length > 0) {
            clipboardContent += `## Nodes (${nodeResults.length})\n`;
            for (const result of nodeResults) {
                const node = result.item;
                clipboardContent += `- **${node.label}** (${node.type})\n`;
                clipboardContent += `  - ID: ${node.id}\n`;
                if (result.matchFields.length > 0) {
                    clipboardContent += `  - Matches: ${result.matchFields.join(', ')}\n`;
                }

                // If the node looks like a file, add it with prefix
                if (node.label && isFileLikeName(node.label)) {
                    const fileReference = prefix ? `${prefix}${node.label}` : node.label;
                    clipboardContent += `  - File: ${fileReference}\n`;
                }

                clipboardContent += '\n';
            }
        }

        if (edgeResults.length > 0) {
            clipboardContent += `## Edges (${edgeResults.length})\n`;
            for (const result of edgeResults) {
                const edge = result.item;
                clipboardContent += `- **${edge.type}**: ${edge.sourceId} → ${edge.targetId}\n`;
                clipboardContent += `  - ID: ${edge.id}\n`;
                if (result.matchFields.length > 0) {
                    clipboardContent += `  - Matches: ${result.matchFields.join(', ')}\n`;
                }
                clipboardContent += '\n';
            }
        }

        await vscode.env.clipboard.writeText(clipboardContent);
        vscode.window.showInformationMessage(`Copied ${results.length} search results to clipboard`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy search results: ${error}`);
    }
}

/**
 * Handles generating embeddings for improved search quality.
 */
async function handleGenerateEmbeddings() {
    try {
        const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
        const db = knowledgeGraphProvider?.getDatabase();
        if (!db) {
            vscode.window.showErrorMessage('Database not available');
            return;
        }

        vscode.window.showInformationMessage('Generating embeddings... This may take a moment.');

        const result = await db.generateMissingEmbeddings();

        if (result.processed > 0) {
            vscode.window.showInformationMessage(
                `✅ Generated embeddings for ${result.processed} items using ${result.provider || 'default'}:${result.model || 'unknown'} provider`
            );
        } else {
            vscode.window.showInformationMessage('All items already have embeddings');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate embeddings: ${error}`);
        log(`Embedding generation error: ${error}`, 'error');
    }
}

/**
 * Shows information about available embedding providers.
 */
async function handleProviderInfo() {
    try {
        const knowledgeGraphProvider = (global as GlobalWithProvider).devAtlasKnowledgeGraphProvider;
        const db = knowledgeGraphProvider?.getDatabase();
        if (!db) {
            vscode.window.showErrorMessage('Database not available');
            return;
        }

        const providerInfo = await db.getEmbeddingProviderInfo();

        const items = providerInfo.map(p => ({
            label: `${p.available ? '✅' : '❌'} ${p.name.toUpperCase()}`,
            description: p.available ? `Default: ${p.defaultModel}` : 'Not available',
            detail: `Models: ${p.supportedModels.join(', ')}`
        }));

        await vscode.window.showQuickPick(items, {
            placeHolder: 'Embedding Provider Status',
            title: 'Available Embedding Providers'
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to get provider info: ${error}`);
        log(`Provider info error: ${error}`, 'error');
    }
}

/**
 * Copies vector search results to clipboard with semantic information.
 */
async function copyVectorSearchResultsToClipboard(results: any[], searchTitle: string) {
    try {
        const config = vscode.workspace.getConfiguration('devAtlas');
        const prefix = config.get<string>('filePathPrefix', '@');

        let clipboardContent = `# ${searchTitle}\n\n`;

        const nodeResults = results.filter((r: any) => r.type === 'node');
        const edgeResults = results.filter((r: any) => r.type === 'edge');

        if (nodeResults.length > 0) {
            clipboardContent += `## Semantic Nodes (${nodeResults.length})\n`;
            for (const result of nodeResults) {
                const node = result.item;
                const simScore = result.similarity ? ` (${(result.similarity * 100).toFixed(1)}% similar)` : '';

                clipboardContent += `- **${node.label}** (${node.type})${simScore}\n`;
                clipboardContent += `  - ID: ${node.id}\n`;
                clipboardContent += `  - Match Type: ${result.matchFields.join(', ')}\n`;

                if (result.category) {
                    clipboardContent += `  - Category: ${result.category}\n`;
                }

                // If the node looks like a file, add it with prefix
                if (node.label && isFileLikeName(node.label)) {
                    const fileReference = prefix ? `${prefix}${node.label}` : node.label;
                    clipboardContent += `  - File: ${fileReference}\n`;
                }

                if (node.properties && Object.keys(node.properties).length > 0) {
                    clipboardContent += `  - Properties: ${JSON.stringify(node.properties, null, 4).split('\n').join('\n    ')}\n`;
                }

                clipboardContent += '\n';
            }
        }

        if (edgeResults.length > 0) {
            clipboardContent += `## Semantic Edges (${edgeResults.length})\n`;
            for (const result of edgeResults) {
                const edge = result.item;
                clipboardContent += `- **${edge.type}**: ${edge.sourceId} → ${edge.targetId}\n`;
                clipboardContent += `  - ID: ${edge.id}\n`;
                clipboardContent += `  - Match Type: ${result.matchFields.join(', ')}\n`;
                if (edge.weight) {
                    clipboardContent += `  - Weight: ${edge.weight}\n`;
                }
                clipboardContent += '\n';
            }
        }

        clipboardContent += `\n---\n*Generated by Dev Atlas Vector Search*`;

        await vscode.env.clipboard.writeText(clipboardContent);
        vscode.window.showInformationMessage(`Copied ${results.length} semantic search results to clipboard`);

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy vector search results: ${error}`);
        log(`Copy vector results error: ${error}`, 'error');
    }
}

/**
 * Checks if a string looks like a file name.
 */
function isFileLikeName(name: string): boolean {
    return name.includes('/') || /\.(ts|js|jsx|tsx|py|java|cpp|c|h|css|scss|html|md|json|xml|yaml|yml|config|env)$/.test(name);
}