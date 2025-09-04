import { z } from 'zod';

// ========== EMBEDDING PROVIDER INTERFACES ==========

export interface EmbeddingProvider {
  name: string;
  generateEmbedding(text: string, model?: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
  getDefaultModel(): string;
  getSupportedModels(): string[];
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: string;
  dimensions: number;
}

// ========== CONFIGURATION SCHEMAS ==========

export const EmbeddingConfigSchema = z
  .object({
    provider: z.enum(['ollama', 'openai', 'simple']).default('ollama'),
    model: z.string().optional(),
    ollamaUrl: z.string().url().optional().default('http://localhost:11434'),
    openaiApiKey: z.string().optional(),
    maxRetries: z.number().int().min(1).max(5).optional().default(3),
    timeout: z.number().int().min(1000).max(30000).optional().default(10000),
  })
  .strict();

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// ========== LOCAL OLLAMA PROVIDER ==========

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  name = 'ollama';
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: { baseUrl?: string; timeout?: number; maxRetries?: number } = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || 10000;
    this.maxRetries = config.maxRetries || 3;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error('[Ollama] Service not available:', error);
      return false;
    }
  }

  getDefaultModel(): string {
    return 'nomic-embed-text';
  }

  getSupportedModels(): string[] {
    return [
      'nomic-embed-text', // 768 dimensions - excellent for general use
      'mxbai-embed-large', // 1024 dimensions - high quality
      'all-minilm', // 384 dimensions - fast and efficient
      'bge-large', // 1024 dimensions - very accurate
      'snowflake-arctic-embed', // 1024 dimensions - latest model
    ];
  }

  async generateEmbedding(text: string, model = this.getDefaultModel()): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty for embedding generation');
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: text.trim(),
          }),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API error (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        if (!result.embedding || !Array.isArray(result.embedding)) {
          throw new Error('Invalid embedding response from Ollama');
        }

        console.error(`[Ollama] Generated ${result.embedding.length}D embedding using ${model}`);
        return result.embedding;
      } catch (error) {
        console.error(`[Ollama] Attempt ${attempt}/${this.maxRetries} failed:`, error);

        if (attempt === this.maxRetries) {
          throw new Error(
            `Failed to generate Ollama embedding after ${this.maxRetries} attempts: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Unexpected error in Ollama embedding generation');
  }

  async ensureModelAvailable(model: string): Promise<void> {
    try {
      // Check if model is available
      const response = await fetch(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
      });

      if (!response.ok) {
        console.error(`[Ollama] Model ${model} not found, attempting to pull...`);

        // Try to pull the model
        const pullResponse = await fetch(`${this.baseUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: model }),
        });

        if (!pullResponse.ok) {
          throw new Error(`Failed to pull model ${model}`);
        }

        console.error(`[Ollama] Successfully pulled model ${model}`);
      }
    } catch (error) {
      console.error(`[Ollama] Could not ensure model ${model} is available:`, error);
      throw error;
    }
  }
}

// ========== OPTIONAL OPENAI PROVIDER (Commented out to fix build) ==========

// Uncomment this class and install 'openai' package to enable OpenAI embeddings
/*
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  private apiKey: string;
  private maxRetries: number;
  private timeout: number;

  constructor(config: { apiKey: string; maxRetries?: number; timeout?: number }) {
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 10000;
  }

  async isAvailable(): Promise<boolean> {
    return false; // Disabled for now
  }

  getDefaultModel(): string {
    return 'text-embedding-3-small';
  }

  getSupportedModels(): string[] {
    return ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'];
  }

  async generateEmbedding(text: string, model = this.getDefaultModel()): Promise<number[]> {
    throw new Error('OpenAI provider is disabled. Install openai package and uncomment the provider to enable.');
  }
}
*/

// ========== SIMPLE JAVASCRIPT PROVIDER (FALLBACK) ==========

export class SimpleEmbeddingProvider implements EmbeddingProvider {
  name = 'simple';

  async isAvailable(): Promise<boolean> {
    return true; // Always available as it's JavaScript-only
  }

  getDefaultModel(): string {
    return 'simple-js';
  }

  getSupportedModels(): string[] {
    return ['simple-js'];
  }

  async generateEmbedding(text: string, model = 'simple-js'): Promise<number[]> {
    // Validate model - only accept supported models
    const supportedModels = this.getSupportedModels();
    if (!supportedModels.includes(model) && model !== 'simple') {
      throw new Error(`Embedding model ${model} not supported`);
    }

    return this.generateSimpleEmbedding(text);
  }

  private generateSimpleEmbedding(text: string): number[] {
    const normalizedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalizedText.split(/\s+/).filter((w) => w.length > 0);

    // Create a 100-dimensional embedding vector
    const dimension = 100;
    const embedding = new Array(dimension).fill(0);

    // Character frequency features
    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText.charCodeAt(i);
      if (char >= 97 && char <= 122) {
        // a-z
        embedding[char - 97] += 1;
      } else if (char >= 48 && char <= 57) {
        // 0-9
        embedding[26 + (char - 48)] += 1;
      }
    }

    // Word position features
    for (let i = 0; i < words.length && i < 20; i++) {
      const wordHash = this.simpleHash(words[i]) % 40;
      embedding[36 + wordHash] += 1;
    }

    // Length features
    embedding[76] = text.length;
    embedding[77] = words.length;
    embedding[78] = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);

    // Bigram features
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + words[i + 1];
      const bigramHash = this.simpleHash(bigram) % 20;
      embedding[79 + bigramHash] += 1;
    }

    // Normalize the embedding vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ========== EMBEDDING PROVIDER FACTORY ==========

export class EmbeddingProviderFactory {
  private static instance: EmbeddingProviderFactory;
  private providers = new Map<string, EmbeddingProvider>();
  private currentProvider?: EmbeddingProvider;

  private constructor() {
    this.setupProviders();
  }

  static getInstance(): EmbeddingProviderFactory {
    if (!EmbeddingProviderFactory.instance) {
      EmbeddingProviderFactory.instance = new EmbeddingProviderFactory();
    }
    return EmbeddingProviderFactory.instance;
  }

  private setupProviders() {
    // Always available fallback
    this.providers.set('simple', new SimpleEmbeddingProvider());

    // Local Ollama provider
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.providers.set(
      'ollama',
      new OllamaEmbeddingProvider({
        baseUrl: ollamaUrl,
        timeout: Number.parseInt(process.env.EMBEDDING_TIMEOUT || '10000'),
        maxRetries: Number.parseInt(process.env.EMBEDDING_RETRIES || '3'),
      })
    );

    // Optional OpenAI provider (disabled for now - uncomment OpenAIEmbeddingProvider class to enable)
    /*
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.providers.set('openai', new OpenAIEmbeddingProvider({ 
        apiKey: openaiKey,
        timeout: Number.parseInt(process.env.EMBEDDING_TIMEOUT || '10000'),
        maxRetries: Number.parseInt(process.env.EMBEDDING_RETRIES || '3'),
      }));
    }
    */
  }

  async getProvider(preferredProvider?: string): Promise<EmbeddingProvider> {
    if (
      this.currentProvider &&
      (!preferredProvider || this.currentProvider.name === preferredProvider)
    ) {
      return this.currentProvider;
    }

    // In test environment, use simple provider only if no specific provider is configured
    if (process.env.NODE_ENV === 'test' && !process.env.EMBEDDING_PROVIDER) {
      const simpleProvider = this.providers.get('simple');
      if (!simpleProvider) {
        throw new Error('Simple provider not available in test environment');
      }
      console.error('[EmbeddingFactory] Using simple provider for tests (no provider specified)');
      this.currentProvider = simpleProvider;
      return simpleProvider;
    }

    // Provider priority: preferred -> env -> ollama -> simple
    const providers = preferredProvider
      ? [preferredProvider, process.env.EMBEDDING_PROVIDER, 'ollama', 'simple']
      : [process.env.EMBEDDING_PROVIDER, 'ollama', 'simple'];

    for (const providerName of providers) {
      if (!providerName) continue;

      const provider = this.providers.get(providerName);
      if (provider) {
        try {
          const available = await provider.isAvailable();
          if (available) {
            console.error(`[EmbeddingFactory] Using provider: ${provider.name}`);
            this.currentProvider = provider;
            return provider;
          }
        } catch (error) {
          console.error(
            `[EmbeddingFactory] Provider ${providerName} failed availability check:`,
            error
          );
        }
      }
    }

    // Fallback to simple if nothing else works
    const simpleProvider = this.providers.get('simple');
    if (!simpleProvider) {
      throw new Error('No embedding providers available - simple provider not found');
    }
    console.error('[EmbeddingFactory] Falling back to simple JavaScript provider');
    this.currentProvider = simpleProvider;
    return simpleProvider;
  }

  async generateEmbedding(
    text: string,
    options: {
      provider?: string;
      model?: string;
    } = {}
  ): Promise<EmbeddingResult> {
    const provider = await this.getProvider(options.provider);
    const model = options.model || provider.getDefaultModel();

    const embedding = await provider.generateEmbedding(text, model);

    return {
      embedding,
      model,
      provider: provider.name,
      dimensions: embedding.length,
    };
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async getProviderInfo(): Promise<
    Array<{
      name: string;
      available: boolean;
      defaultModel: string;
      supportedModels: string[];
    }>
  > {
    const info = [];

    for (const [name, provider] of this.providers) {
      try {
        const available = await provider.isAvailable();
        info.push({
          name,
          available,
          defaultModel: provider.getDefaultModel(),
          supportedModels: provider.getSupportedModels(),
        });
      } catch (error) {
        info.push({
          name,
          available: false,
          defaultModel: provider.getDefaultModel(),
          supportedModels: provider.getSupportedModels(),
        });
      }
    }

    return info;
  }

  // Reset provider (useful for testing or configuration changes)
  reset() {
    this.currentProvider = undefined;
    this.providers.clear();
    this.setupProviders();
  }
}

// ========== CONFIGURATION UTILITIES ==========

export function getEmbeddingConfig(): EmbeddingConfig {
  return EmbeddingConfigSchema.parse({
    provider: process.env.EMBEDDING_PROVIDER || 'ollama',
    model: process.env.EMBEDDING_MODEL,
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    openaiApiKey: process.env.OPENAI_API_KEY,
    maxRetries: Number.parseInt(process.env.EMBEDDING_RETRIES || '3'),
    timeout: Number.parseInt(process.env.EMBEDDING_TIMEOUT || '10000'),
  });
}

export function validateEmbeddingConfig(config: unknown): EmbeddingConfig {
  return EmbeddingConfigSchema.parse(config);
}

// ========== ENVIRONMENT SETUP HELPER ==========

export function logEmbeddingSetup() {
  const config = getEmbeddingConfig();

  console.error('[EmbeddingSetup] Configuration:');
  console.error(`  Provider: ${config.provider}`);
  console.error(`  Model: ${config.model || 'auto-detect'}`);
  console.error(`  Ollama URL: ${config.ollamaUrl}`);
  console.error(`  OpenAI API Key: ${config.openaiApiKey ? 'provided' : 'not provided'}`);
  console.error(`  Max Retries: ${config.maxRetries}`);
  console.error(`  Timeout: ${config.timeout}ms`);

  if (config.provider === 'ollama') {
    console.error('[EmbeddingSetup] Using LOCAL Ollama for complete privacy and independence');
    console.error('[EmbeddingSetup] Make sure Ollama is running: ollama serve');
    console.error('[EmbeddingSetup] Install embedding model: ollama pull nomic-embed-text');
  }

  return config;
}
