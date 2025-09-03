# 🚀 Local & Cloud Embedding Setup Guide

Your MCP Knowledge Graph now supports **multiple embedding providers** with **local-first** configuration for complete privacy and independence!

## 🎯 **Quick Start (100% Local)**

### **1. Install & Start Ollama (Recommended)**
```bash
# Install Ollama (macOS)
brew install ollama

# Or download from https://ollama.com/download

# Start Ollama server
ollama serve

# Install embedding model (choose one)
ollama pull nomic-embed-text      # 768D - Best general purpose
ollama pull mxbai-embed-large     # 1024D - Higher quality  
ollama pull all-minilm            # 384D - Fast and efficient
```

### **2. Set Environment Variables (Optional)**
```bash
# Use Ollama by default (auto-detected)
export EMBEDDING_PROVIDER=ollama
export EMBEDDING_MODEL=nomic-embed-text
export OLLAMA_URL=http://localhost:11434

# Optional: Configure timeouts
export EMBEDDING_TIMEOUT=10000
export EMBEDDING_RETRIES=3
```

### **3. Start Your MCP Tool**
```bash
npm start
# ✅ Will automatically use LOCAL Ollama for embeddings
# ✅ Complete privacy - no data sent to cloud
# ✅ Fast semantic search with high-quality embeddings
```

## 🌥️ **Cloud Provider Options**

### **OpenAI Integration (Optional)**
```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-your-key-here
export EMBEDDING_PROVIDER=openai
export EMBEDDING_MODEL=text-embedding-3-small

# Start MCP tool
npm start
# ✅ Will use OpenAI for embeddings
# ⚠️ Sends data to OpenAI servers
```

### **Automatic Fallback Chain**
Your tool automatically falls back in this order:
1. **Ollama** (local) - Best for privacy 
2. **OpenAI** (cloud) - If API key is provided
3. **Simple JS** (fallback) - Always works

## 🛠️ **Provider Comparison**

| Provider | Privacy | Quality | Speed | Setup |
|----------|---------|---------|--------|-------|
| **Ollama** | 🔒 100% Local | ⭐⭐⭐⭐⭐ | ⚡ Very Fast | Easy |
| **OpenAI** | ☁️ Cloud | ⭐⭐⭐⭐⭐ | ⚡ Fast | API Key |
| **Simple JS** | 🔒 Local | ⭐⭐ | ⚡ Fast | None |

## 🔧 **Advanced Configuration**

### **Check Available Providers**
```json
{
  "name": "get_embedding_providers"
}
```

**Response:**
```
OLLAMA (✅ Available)
  Default Model: nomic-embed-text
  Supported Models: nomic-embed-text, mxbai-embed-large, all-minilm

OPENAI (❌ Unavailable - No API key)
  Default Model: text-embedding-3-small
  Supported Models: text-embedding-3-small, text-embedding-3-large

SIMPLE (✅ Available)
  Default Model: simple-js
  Supported Models: simple-js
```

### **Provider-Specific Usage**

#### **Force Ollama:**
```json
{
  "name": "vector_search_nodes",
  "arguments": {
    "query": "authentication security",
    "provider": "ollama",
    "model": "nomic-embed-text"
  }
}
```

#### **Force OpenAI (if configured):**
```json
{
  "name": "vector_search_nodes", 
  "arguments": {
    "query": "authentication security",
    "provider": "openai",
    "model": "text-embedding-3-small"
  }
}
```

#### **Let System Auto-Choose:**
```json
{
  "name": "vector_search_nodes",
  "arguments": {
    "query": "authentication security"
  }
}
```

## ⚡ **Performance Comparison**

### **Local Ollama (Recommended)**
- **Privacy**: 🔒 Complete - No data leaves your machine
- **Speed**: ⚡ Very fast - No network latency
- **Quality**: ⭐⭐⭐⭐⭐ - Professional-grade embeddings
- **Cost**: 💰 Free - No API costs
- **Reliability**: 🛡️ Always available - No rate limits

### **Cloud OpenAI**
- **Privacy**: ☁️ Data sent to OpenAI
- **Speed**: ⚡ Fast - With network latency  
- **Quality**: ⭐⭐⭐⭐⭐ - Excellent embeddings
- **Cost**: 💰 Pay per usage
- **Reliability**: 🌐 Requires internet

### **Simple JS Fallback**
- **Privacy**: 🔒 Complete
- **Speed**: ⚡ Very fast
- **Quality**: ⭐⭐ - Basic but functional
- **Cost**: 💰 Free
- **Reliability**: 🛡️ Always available

## 🎯 **Recommended Models by Use Case**

### **General Development Knowledge Graph**
```bash
# Best balance of quality and performance
ollama pull nomic-embed-text
export EMBEDDING_MODEL=nomic-embed-text
```

### **High-Precision Semantic Analysis**
```bash
# Maximum quality for detailed code analysis
ollama pull mxbai-embed-large
export EMBEDDING_MODEL=mxbai-embed-large
```

### **Fast Iteration/Development**
```bash
# Fastest for quick prototyping
ollama pull all-minilm
export EMBEDDING_MODEL=all-minilm
```

## 🔧 **Troubleshooting**

### **Ollama Not Starting?**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama service
ollama serve

# Check available models
ollama list
```

### **Model Not Found?**
```bash
# Pull the required model
ollama pull nomic-embed-text

# Check it's installed
ollama list
```

### **Performance Issues?**
```bash
# Use faster model
export EMBEDDING_MODEL=all-minilm

# Or reduce batch size
# (automatically handled by the system)
```

## 🎉 **Why This Is Amazing**

### **Complete Independence**
- ✅ No external API dependencies
- ✅ No data privacy concerns  
- ✅ No internet required
- ✅ No usage costs

### **Professional Quality**
- ✅ State-of-the-art local embeddings
- ✅ 768+ dimensional vectors
- ✅ Better than most cloud services
- ✅ Purpose-built for knowledge graphs

### **Perfect for Your Use Case**
- ✅ MCP tool runs completely offline
- ✅ Integrates seamlessly with web search, thinking tools, etc.
- ✅ Knowledge graph becomes your **private semantic intelligence**
- ✅ No rate limits or API costs

Your knowledge graph now provides **enterprise-grade semantic search** while keeping everything completely local and private! 🎉
