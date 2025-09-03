# Dev Atlas Website

This is the documentation website for Dev Atlas, built with **Next.js 15** and the **App Router**.

## 🛠️ Tech Stack

- **Next.js 15.0.3** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Nextra 4** - Documentation framework (planned integration)

## 📁 Project Structure

```
apps/website/
├── app/                      # App Router directory (Next.js 15)
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Homepage
│   ├── globals.css          # Global styles
│   ├── _meta.ts            # Navigation metadata
│   ├── docs/               # Documentation section
│   │   ├── _meta.ts        # Docs navigation
│   │   └── getting-started/
│   │       └── page.mdx    # Getting started guide
│   ├── mcp/                # MCP Server docs
│   │   └── page.mdx        
│   └── extension/          # VS Code extension docs
│       └── page.mdx
├── next.config.mjs         # Next.js configuration
├── theme.config.tsx        # Nextra theme config
├── tailwind.config.js      # Tailwind CSS config
└── tsconfig.json          # TypeScript config
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# From the root of the monorepo
cd apps/website
npm install
```

### Development

```bash
# Start development server
npm run dev

# Visit http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## 📝 Content Management

### Adding New Pages

1. Create a new directory under `app/`
2. Add a `page.tsx` or `page.mdx` file
3. Update the `_meta.ts` file for navigation

Example:
```bash
# Create new section
mkdir app/guides
touch app/guides/page.mdx
```

### Navigation Structure

Navigation is controlled by `_meta.ts` files:

```typescript
// app/_meta.ts
export default {
  index: 'Home',
  docs: {
    title: 'Documentation',
    type: 'page'
  },
  mcp: {
    title: 'MCP Server',
    type: 'page'
  },
  extension: {
    title: 'VS Code Extension',
    type: 'page'
  }
}
```

## 🎨 Styling

The website uses Tailwind CSS for styling. Global styles are in `app/globals.css`.

### Key Design Decisions

- **Mobile-first approach** with responsive grid layouts
- **Gradient accents** for headings and CTAs
- **Card-based layouts** for feature sections
- **Clean typography** with Inter font family

## 🔧 Next.js 15 App Router Features

### What We're Using

- ✅ **App Directory Structure** - File-based routing
- ✅ **Server Components** - Default server-side rendering
- ✅ **Layouts** - Shared UI across routes
- ✅ **Metadata API** - SEO optimization
- ✅ **TypeScript** - Full type safety

### File Conventions

- `layout.tsx` - Shared layout for route segments
- `page.tsx` - Route pages
- `loading.tsx` - Loading UI (planned)
- `error.tsx` - Error handling (planned)
- `not-found.tsx` - 404 pages (planned)

## 📚 Nextra Integration (Planned)

Currently working on integrating Nextra 4 for enhanced documentation features:

### Planned Features

- [ ] MDX component support
- [ ] Built-in search
- [ ] Syntax highlighting
- [ ] Table of contents
- [ ] Git-based edit links

### Current Status

The basic Next.js 15 App Router setup is complete and working. Nextra 4 integration is in progress due to some compatibility issues with the App Router and MDX configuration.

## 🐛 Known Issues

1. **Nextra 4 MDX Integration** - Working on resolving MDX import issues
2. **Git Timestamps** - Nextra warnings about git timestamp retrieval

## 🚀 Deployment

The website is configured for deployment on various platforms:

### Vercel (Recommended)
```bash
# Deploy with Vercel CLI
vercel --prod
```

### Manual Build
```bash
npm run build
npm run start
```

## 📖 Package Information

- **Package Name**: `@dev-atlas/website`
- **Version**: 0.1.0
- **Node.js**: >= 18.0.0
- **Next.js**: 15.0.3

## 🤝 Contributing

1. Make changes to the appropriate files in `app/`
2. Test locally with `npm run dev`
3. Build and verify with `npm run build`
4. Submit a pull request

## 📊 Performance

Current Lighthouse scores (target):
- Performance: 90+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 95+

---

For more information about the overall Dev Atlas project, see the [main README](../../README.md).
