import * as vscode from 'vscode';
import * as path from 'path';
import { z } from 'zod';
import type { KnowledgeGraphDB } from '../db/index';
import { log } from '../extension';

// Zod schemas for validation
const FileNodeSchema = z.object({
    path: z.string(),
    name: z.string(),
    extension: z.string(),
    size: z.number(),
    type: z.enum(['file', 'directory']),
    language: z.string().optional(),
    isSource: z.boolean(),
});

const ScanOptionsSchema = z.object({
    includeNodeModules: z.boolean().default(false),
    includeDotFiles: z.boolean().default(false),
    maxFileSize: z.number().default(1024 * 1024), // 1MB default
    supportedExtensions: z.array(z.string()).default([
        '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h',
        '.css', '.scss', '.html', '.md', '.json', '.xml', '.yaml', '.yml'
    ]),
});

type FileNode = z.infer<typeof FileNodeSchema>;
type ScanOptions = z.infer<typeof ScanOptionsSchema>;

/**
 * Service for scanning workspace files and automatically creating knowledge graph nodes.
 * Integrates with VS Code's file system API to discover and analyze project structure.
 */
export class WorkspaceScanner {
    private db: KnowledgeGraphDB;
    private readonly excludePatterns: string[] = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/.next/**',
        '**/out/**',
        '**/.vscode/**',
    ];

    constructor(db: KnowledgeGraphDB) {
        this.db = db;
    }

    /**
     * Scans the entire workspace and creates nodes for discovered files.
     */
    async scanWorkspace(options: Partial<ScanOptions> = {}): Promise<{
        filesScanned: number;
        nodesCreated: number;
        edgesCreated: number;
        errors: string[];
    }> {
        const validatedOptions = ScanOptionsSchema.parse(options);
        const results = {
            filesScanned: 0,
            nodesCreated: 0,
            edgesCreated: 0,
            errors: [] as string[],
        };

        try {
            log('Starting workspace scan...');

            if (!vscode.workspace.workspaceFolders) {
                throw new Error('No workspace folders found');
            }

            // Create workspace root node
            const workspaceNode = await this.createWorkspaceNode();
            if (workspaceNode) {
                results.nodesCreated++;
            }

            // Scan each workspace folder
            for (const folder of vscode.workspace.workspaceFolders) {
                log(`Scanning workspace folder: ${folder.name}`);

                const folderResults = await this.scanFolder(folder.uri, validatedOptions);
                results.filesScanned += folderResults.filesScanned;
                results.nodesCreated += folderResults.nodesCreated;
                results.edgesCreated += folderResults.edgesCreated;
                results.errors.push(...folderResults.errors);

                // Connect folder to workspace
                if (workspaceNode && folderResults.folderNodeId) {
                    await this.createEdge(workspaceNode.id, folderResults.folderNodeId, 'contains', {
                        relationship: 'workspace contains folder',
                    });
                    results.edgesCreated++;
                }
            }

            log(`Workspace scan completed: ${results.filesScanned} files, ${results.nodesCreated} nodes, ${results.edgesCreated} edges`);
            return results;
        } catch (error) {
            const errorMsg = `Workspace scan failed: ${error}`;
            log(errorMsg, 'error');
            results.errors.push(errorMsg);
            return results;
        }
    }

    /**
     * Scans a specific folder and creates nodes for its contents.
     */
    private async scanFolder(folderUri: vscode.Uri, options: ScanOptions): Promise<{
        filesScanned: number;
        nodesCreated: number;
        edgesCreated: number;
        errors: string[];
        folderNodeId?: string;
    }> {
        const results = {
            filesScanned: 0,
            nodesCreated: 0,
            edgesCreated: 0,
            errors: [] as string[],
            folderNodeId: undefined as string | undefined,
        };

        try {
            // Create folder node
            const folderNode = await this.createFolderNode(folderUri);
            if (folderNode) {
                results.nodesCreated++;
                results.folderNodeId = folderNode.id;
            }

            // Get all files in the folder
            const files = await this.getFilesInFolder(folderUri, options);
            results.filesScanned = files.length;

            // Process files in batches to avoid overwhelming the system
            const batchSize = 50;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const batchResults = await this.processBatch(batch, folderNode?.id);

                results.nodesCreated += batchResults.nodesCreated;
                results.edgesCreated += batchResults.edgesCreated;
                results.errors.push(...batchResults.errors);
            }

            return results;
        } catch (error) {
            const errorMsg = `Failed to scan folder ${folderUri.fsPath}: ${error}`;
            results.errors.push(errorMsg);
            return results;
        }
    }

    /**
     * Gets all files in a folder that match the scanning criteria.
     */
    private async getFilesInFolder(folderUri: vscode.Uri, options: ScanOptions): Promise<FileNode[]> {
        const files: FileNode[] = [];

        try {
            // Use VS Code's file system API to find files
            const pattern = new vscode.RelativePattern(folderUri, '**/*');
            const excludePattern = options.includeNodeModules
                ? this.excludePatterns.filter(p => !p.includes('node_modules')).join(',')
                : this.excludePatterns.join(',');

            const fileUris = await vscode.workspace.findFiles(pattern, excludePattern);

            for (const fileUri of fileUris) {
                try {
                    const stat = await vscode.workspace.fs.stat(fileUri);

                    // Skip if file is too large
                    if (stat.size > options.maxFileSize) {
                        continue;
                    }

                    const relativePath = vscode.workspace.asRelativePath(fileUri);
                    const fileName = path.basename(fileUri.fsPath);
                    const extension = path.extname(fileName);

                    // Skip files with unsupported extensions
                    if (extension && !options.supportedExtensions.includes(extension)) {
                        continue;
                    }

                    // Skip dot files if not included
                    if (!options.includeDotFiles && fileName.startsWith('.')) {
                        continue;
                    }

                    const fileNode: FileNode = {
                        path: relativePath,
                        name: fileName,
                        extension,
                        size: stat.size,
                        type: stat.type === vscode.FileType.Directory ? 'directory' : 'file',
                        language: this.getLanguageFromExtension(extension),
                        isSource: this.isSourceFile(extension),
                    };

                    files.push(fileNode);
                } catch (error) {
                    log(`Failed to process file ${fileUri.fsPath}: ${error}`, 'warn');
                }
            }

            return files;
        } catch (error) {
            log(`Failed to get files in folder ${folderUri.fsPath}: ${error}`, 'error');
            return [];
        }
    }

    /**
     * Processes a batch of files and creates nodes/edges.
     */
    private async processBatch(files: FileNode[], parentFolderId?: string): Promise<{
        nodesCreated: number;
        edgesCreated: number;
        errors: string[];
    }> {
        const results = {
            nodesCreated: 0,
            edgesCreated: 0,
            errors: [] as string[],
        };

        for (const file of files) {
            try {
                // Create file node
                const fileNode = await this.createFileNode(file);
                if (fileNode) {
                    results.nodesCreated++;

                    // Connect to parent folder if available
                    if (parentFolderId) {
                        await this.createEdge(parentFolderId, fileNode.id, 'contains', {
                            relationship: 'folder contains file',
                        });
                        results.edgesCreated++;
                    }
                }
            } catch (error) {
                const errorMsg = `Failed to process file ${file.path}: ${error}`;
                results.errors.push(errorMsg);
                log(errorMsg, 'warn');
            }
        }

        return results;
    }

    /**
     * Creates a workspace root node.
     */
    private async createWorkspaceNode(): Promise<{ id: string } | null> {
        try {
            if (!vscode.workspace.workspaceFolders?.[0]) {
                return null;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders[0];
            const workspaceName = vscode.workspace.name || workspaceFolder.name;

            const node = await this.db.createNode({
                type: 'Workspace',
                label: workspaceName,
                properties: {
                    path: workspaceFolder.uri.fsPath,
                    folderCount: vscode.workspace.workspaceFolders.length,
                    scannedAt: new Date().toISOString(),
                },
            });

            log(`Created workspace node: ${workspaceName}`);
            return node;
        } catch (error) {
            log(`Failed to create workspace node: ${error}`, 'error');
            return null;
        }
    }

    /**
     * Creates a folder node.
     */
    private async createFolderNode(folderUri: vscode.Uri): Promise<{ id: string } | null> {
        try {
            const folderName = path.basename(folderUri.fsPath);
            const relativePath = vscode.workspace.asRelativePath(folderUri);

            const node = await this.db.createNode({
                type: 'Folder',
                label: folderName,
                properties: {
                    path: relativePath,
                    fullPath: folderUri.fsPath,
                    scannedAt: new Date().toISOString(),
                },
            });

            return node;
        } catch (error) {
            log(`Failed to create folder node for ${folderUri.fsPath}: ${error}`, 'error');
            return null;
        }
    }

    /**
     * Creates a file node.
     */
    private async createFileNode(file: FileNode): Promise<{ id: string } | null> {
        try {
            const node = await this.db.createNode({
                type: file.isSource ? 'SourceFile' : 'File',
                label: file.name,
                properties: {
                    path: file.path,
                    extension: file.extension,
                    size: file.size,
                    language: file.language,
                    isSource: file.isSource,
                    scannedAt: new Date().toISOString(),
                },
            });

            return node;
        } catch (error) {
            log(`Failed to create file node for ${file.path}: ${error}`, 'error');
            return null;
        }
    }

    /**
     * Creates an edge between two nodes.
     */
    private async createEdge(
        sourceId: string,
        targetId: string,
        type: string,
        properties: Record<string, unknown> = {}
    ): Promise<void> {
        try {
            await this.db.createEdge({
                sourceId,
                targetId,
                type,
                properties,
            });
        } catch (error) {
            log(`Failed to create edge ${sourceId} -> ${targetId}: ${error}`, 'error');
        }
    }

    /**
     * Determines the programming language from file extension.
     */
    private getLanguageFromExtension(extension: string): string | undefined {
        const languageMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.css': 'css',
            '.scss': 'scss',
            '.html': 'html',
            '.md': 'markdown',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
        };

        return languageMap[extension];
    }

    /**
     * Determines if a file is a source code file.
     */
    private isSourceFile(extension: string): boolean {
        const sourceExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h',
            '.css', '.scss', '.html', '.md', '.json', '.xml', '.yaml', '.yml'
        ];

        return sourceExtensions.includes(extension);
    }

    /**
     * Scans a specific file and updates its node if it exists.
     */
    async scanFile(fileUri: vscode.Uri): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(fileUri);
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const fileName = path.basename(fileUri.fsPath);
            const extension = path.extname(fileName);

            const fileNode: FileNode = {
                path: relativePath,
                name: fileName,
                extension,
                size: stat.size,
                type: stat.type === vscode.FileType.Directory ? 'directory' : 'file',
                language: this.getLanguageFromExtension(extension),
                isSource: this.isSourceFile(extension),
            };

            // Check if node already exists
            const existingNodes = await this.db.queryNodes({ label: fileName });
            const existingNode = existingNodes.find(node =>
                node.properties?.path === relativePath
            );

            if (existingNode) {
                // Update existing node
                await this.db.updateNode(existingNode.id, {
                    properties: {
                        ...existingNode.properties,
                        size: fileNode.size,
                        scannedAt: new Date().toISOString(),
                    },
                });
                log(`Updated file node: ${fileName}`);
            } else {
                // Create new node
                await this.createFileNode(fileNode);
                log(`Created file node: ${fileName}`);
            }

            return true;
        } catch (error) {
            log(`Failed to scan file ${fileUri.fsPath}: ${error}`, 'error');
            return false;
        }
    }

    /**
     * Removes a file node when the file is deleted.
     */
    async removeFile(fileUri: vscode.Uri): Promise<boolean> {
        try {
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const fileName = path.basename(fileUri.fsPath);

            // Find and remove the node
            const existingNodes = await this.db.queryNodes({ label: fileName });
            const nodeToRemove = existingNodes.find(node =>
                node.properties?.path === relativePath
            );

            if (nodeToRemove) {
                await this.db.deleteNode(nodeToRemove.id);
                log(`Removed file node: ${fileName}`);
                return true;
            }

            return false;
        } catch (error) {
            log(`Failed to remove file ${fileUri.fsPath}: ${error}`, 'error');
            return false;
        }
    }
}
