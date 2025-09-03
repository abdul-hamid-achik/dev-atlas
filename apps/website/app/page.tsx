import { ThemeToggle } from '@/components/theme-toggle';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowRight,
  Book,
  CheckCircle,
  Code2,
  Command,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  GitBranch,
  Github,
  Network,
  Package,
  Play,
  Puzzle,
  Settings,
  Star,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <span className="text-sm font-bold">DA</span>
            </div>
            <span className="font-semibold">Dev Atlas</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="https://github.com/abdul-hamid-achik/dev-atlas">
                <Github className="h-4 w-4" />
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20" />
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />

        <div className="relative container mx-auto px-6 pb-20 pt-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 flex justify-center">
              <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 px-4 py-1.5">
                <Star className="mr-1 h-3 w-3" />
                Knowledge Graph Platform
              </Badge>
            </div>

            <h1 className="mb-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 dark:from-slate-100 dark:via-slate-200 dark:to-slate-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
              Knowledge Graph
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                for Developers
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 dark:text-slate-300 sm:text-xl">
              Transform how you organize and navigate development knowledge.
              <strong className="text-slate-900 dark:text-slate-100">
                {' '}
                MCP server + VS Code extension
              </strong>{' '}
              for structured knowledge management.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="group h-11 px-8">
                <Play className="mr-2 h-4 w-4" />
                Quick Start
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-8" asChild>
                <Link href="https://github.com/abdul-hamid-achik/dev-atlas">
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </Link>
              </Button>
            </div>

            {/* Tech badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">
                <Network className="mr-1 h-3 w-3" />
                MCP Protocol
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <Code2 className="mr-1 h-3 w-3" />
                VS Code
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <Database className="mr-1 h-3 w-3" />
                SQLite
              </Badge>
              <Badge variant="secondary" className="px-3 py-1">
                <FileCode className="mr-1 h-3 w-3" />
                TypeScript
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Section */}
      <section className="border-t bg-slate-50/50 dark:bg-slate-900/50 py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Get started in <span className="text-blue-600">minutes</span>
            </h2>
            <p className="mb-12 text-lg text-slate-600 dark:text-slate-300">
              Three simple steps to transform your development workflow
            </p>
          </div>

          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  step: '01',
                  icon: <Package className="h-8 w-8 text-blue-600" />,
                  title: 'Install MCP Server',
                  code: 'npm install -g dev-atlas-knowledge-graph',
                  description: 'Install the knowledge graph MCP server globally via npm',
                },
                {
                  step: '02',
                  icon: <Settings className="h-8 w-8 text-purple-600" />,
                  title: 'Configure Your AI',
                  code: 'Add to MCP config',
                  description: 'Configure Claude or Cursor to use the knowledge graph server',
                },
                {
                  step: '03',
                  icon: <Puzzle className="h-8 w-8 text-indigo-600" />,
                  title: 'Install Extension',
                  code: "Search 'Dev Atlas' in Extensions",
                  description: 'Install the VS Code extension for visual graph management',
                },
              ].map((item) => (
                <Card
                  key={item.step}
                  className="group relative overflow-hidden border-0 bg-white/80 shadow-lg backdrop-blur dark:bg-slate-800/80"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                  <CardContent className="relative p-8">
                    <div className="mb-6 flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-slate-900 to-slate-700 font-mono text-sm font-bold text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
                        {item.step}
                      </div>
                      {item.icon}
                    </div>
                    <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                    <div className="mb-4 rounded-lg bg-slate-100 p-3 font-mono text-sm dark:bg-slate-700">
                      {item.code}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Two powerful components, <span className="text-purple-600">one solution</span>
            </h2>
            <p className="mb-16 text-lg text-slate-600 dark:text-slate-300">
              Everything you need to build and manage development knowledge graphs
            </p>
          </div>

          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* MCP Server */}
              <Card className="group overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-100 shadow-xl dark:from-blue-950/50 dark:to-indigo-900/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Network className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">MCP Server</CardTitle>
                      <CardDescription className="text-blue-700 dark:text-blue-300">
                        Powerful backend engine
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'SQLite-based knowledge graph storage',
                    'Full CRUD operations for nodes and edges',
                    'Advanced search and graph traversal',
                    'MCP protocol compliance',
                    'TypeScript implementation',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* VS Code Extension */}
              <Card className="group overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-pink-100 shadow-xl dark:from-purple-950/50 dark:to-pink-900/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">VS Code Extension</CardTitle>
                      <CardDescription className="text-purple-700 dark:text-purple-300">
                        Visual interface
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    'Visual knowledge graph browser',
                    'Integrated command palette',
                    'Real-time graph visualization',
                    'Node and edge creation UI',
                    'Explorer panel integration',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center space-x-3">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section className="border-t bg-slate-50/50 dark:bg-slate-900/50 py-20">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="text-indigo-600">Technical</span> Documentation
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Everything you need to know to get up and running
              </p>
            </div>

            <div className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem
                  value="mcp-setup"
                  className="border rounded-lg px-6 bg-white dark:bg-slate-800"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                        <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">MCP Server Configuration</div>
                        <div className="text-sm text-slate-500">
                          Connect your AI assistant to the knowledge graph
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="space-y-6">
                      <p className="text-slate-600 dark:text-slate-300">
                        Add this configuration to your Claude Desktop or Cursor MCP settings:
                      </p>
                      <div className="overflow-hidden rounded-lg bg-slate-900 dark:bg-slate-800">
                        <div className="flex items-center justify-between bg-slate-800 px-4 py-2 dark:bg-slate-700">
                          <span className="text-xs font-medium text-slate-400">
                            mcp_settings.json
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-slate-400 hover:text-slate-200"
                          >
                            <span className="text-xs">Copy</span>
                          </Button>
                        </div>
                        <pre className="p-4 text-sm text-slate-100 overflow-x-auto">
                          {`{
  "mcpServers": {
    "knowledge-graph": {
      "command": "npx",
      "args": ["dev-atlas-knowledge-graph"],
      "env": {
        "GRAPH_DB_PATH": "./knowledge-graph.db"
      }
    }
  }
}`}
                        </pre>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  value="vscode-features"
                  className="border rounded-lg px-6 bg-white dark:bg-slate-800"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                        <Command className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">VS Code Extension Commands</div>
                        <div className="text-sm text-slate-500">
                          Available commands and keyboard shortcuts
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="overflow-hidden rounded-lg border bg-white dark:bg-slate-800">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 dark:bg-slate-700/50">
                            <TableHead className="font-semibold">Command</TableHead>
                            <TableHead className="font-semibold">Description</TableHead>
                            <TableHead className="font-semibold">Shortcut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-mono text-sm">Create Node</TableCell>
                            <TableCell>Add new knowledge nodes</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                Ctrl+Shift+P
                              </Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono text-sm">Create Edge</TableCell>
                            <TableCell>Connect knowledge nodes</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                Ctrl+Shift+E
                              </Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-mono text-sm">Open Visualizer</TableCell>
                            <TableCell>Launch graph visualization</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                Ctrl+Shift+G
                              </Badge>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  value="api-reference"
                  className="border rounded-lg px-6 bg-white dark:bg-slate-800"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900">
                        <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">MCP API Reference</div>
                        <div className="text-sm text-slate-500">Available tools and methods</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { name: 'create_entities', desc: 'Create new knowledge entities' },
                        { name: 'create_relations', desc: 'Create relationships between entities' },
                        { name: 'search_nodes', desc: 'Search through the knowledge graph' },
                        { name: 'read_graph', desc: 'Read the entire knowledge graph' },
                      ].map((api) => (
                        <Card key={api.name} className="border-0 bg-slate-50 dark:bg-slate-700/50">
                          <CardContent className="p-4">
                            <div className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                              {api.name}
                            </div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              {api.desc}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <Card className="mx-auto max-w-4xl overflow-hidden border-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white shadow-2xl">
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <GitBranch className="h-8 w-8" />
              </div>
              <h3 className="mb-4 text-3xl font-bold">Ready to transform your workflow?</h3>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-blue-100">
                Join developers who are already using structured knowledge graphs to organize their
                development insights and accelerate their productivity.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" variant="secondary" className="group h-12 px-8">
                  <Download className="mr-2 h-4 w-4" />
                  Get Started Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-white/20 px-8 text-white hover:bg-white/10"
                  asChild
                >
                  <Link href="https://github.com/abdul-hamid-achik/dev-atlas">
                    <Github className="mr-2 h-4 w-4" />
                    Star on GitHub
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
