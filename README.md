# @leadertechie/r2tohtml

A generic, configuration-driven R2 content loader for Cloudflare Workers. Fetch, cache, and parse content from R2 without hardcoded paths.

## Features

- **Generic R2 operations** - No hardcoded content structure
- **In-memory caching** - Configurable TTL with cache invalidation
- **Frontmatter parsing** - Extract metadata from markdown files
- **TypeScript support** - Full type definitions included

## Installation

```bash
npm install @leadertechie/r2tohtml @leadertechie/md2html
```

> Note: `@leadertechie/md2html` is a peer dependency and must be installed alongside r2tohtml.

## Usage

### Basic Usage

```typescript
import { R2ContentLoader } from '@leadertechie/r2tohtml';

const loader = new R2ContentLoader({
  bucket: env.CONTENT_BUCKET,  // Cloudflare R2 binding
  cacheTTL: 5 * 60 * 1000,    // 5 minutes (default)
  cacheEnabled: true           // Enable caching (default: true)
});

// Fetch a file
const content = await loader.get('about.md');

// Fetch with metadata (parses YAML frontmatter)
const { metadata, content } = await loader.getWithMetadata('blog/post.md');

// List files in a prefix
const result = await loader.list('blogs/');
```

### Configuration

```typescript
import { R2ContentLoader } from '@leadertechie/r2tohtml';

const loader = new R2ContentLoader({
  // R2 bucket binding (required)
  bucket: env.CONTENT_BUCKET,
  
  // Optional prefix for all operations
  prefix: 'content/',
  
  // Cache TTL in milliseconds (default: 5 minutes)
  cacheTTL: 5 * 60 * 1000,
  
  // Enable/disable caching (default: true)
  cacheEnabled: true
});
```

### API

#### `R2ContentLoader`

| Method | Description |
|--------|-------------|
| `get(path: string): Promise<string | null>` | Fetch file content as string |
| `getObject(path: string): Promise<R2Object | null>` | Fetch raw R2 object |
| `getWithMetadata(path: string): Promise<ParsedContent | null>` | Fetch and parse frontmatter |
| `list(prefix: string): Promise<R2ListResult>` | List files with prefix |
| `exists(path: string): Promise<boolean>` | Check if file exists |
| `invalidate(path: string): void` | Invalidate cache for specific path |
| `invalidatePrefix(prefix: string): void` | Invalidate cache for prefix |
| `clearCache(): void` | Clear all cached data |
| `disableCache(): void` | Disable caching |
| `enableCache(): void` | Enable caching |

### Types

```typescript
interface R2LoaderConfig {
  bucket: R2Bucket;
  prefix?: string;
  cacheTTL?: number;
  cacheEnabled?: boolean;
}

interface ParsedContent {
  metadata: ContentMetadata;
  content: string;
}

interface ContentMetadata {
  [key: string]: string | string[] | undefined;
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  author?: string;
}
```

## Example: Using with md2html

```typescript
import { R2ContentLoader } from '@leadertechie/r2tohtml';
import { MarkdownPipeline } from '@leadertechie/md2html';

const r2 = new R2ContentLoader({
  bucket: env.CONTENT_BUCKET,
  prefix: 'content/'
});

const pipeline = new MarkdownPipeline({
  imagePathPrefix: 'images/'
});

// Fetch and render markdown content
const content = await r2.get('home.md');
const html = pipeline.renderMarkdown(content);
```

## License

MIT
