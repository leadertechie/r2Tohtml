# @leadertechie/r2tohtml

**Cloudflare R2 content loader with multi-tier caching, sharding, and system bucket support.**

`r2tohtml` fetches content from Cloudflare R2. It is a **content access layer** — pure plumbing. It does NOT know about page structure, layouts, slots, or interactions.

---

## Installation

```bash
npm install @leadertechie/r2tohtml
```

---

## Quick Start

```typescript
import { R2ContentLoader } from '@leadertechie/r2tohtml';

const loader = new R2ContentLoader({
  bucket: MY_R2_BUCKET,
  cacheTTL: 5 * 60 * 1000,  // 5 minutes
});

// Fetch raw content
const content = await loader.get('posts/hello.md');

// Fetch with frontmatter parsing
const { metadata, content: body } = await loader.getWithMetadata('posts/hello.md');

// Fetch rendered HTML
const { metadata, content: html } = await loader.getRendered('posts/hello.md');

// Fetch AST nodes
const { metadata, contentNodes } = await loader.getWithAST('posts/hello.md');

// List objects
const { objects } = await loader.list('posts/');

// Check existence
const exists = await loader.exists('posts/hello.md');

// Cache management
loader.invalidate('posts/hello.md');
loader.clearCache();
```

---

## Architecture

r2tohtml uses a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    R2ContentLoader                       │
│  (Facade — unified public API)                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ BucketResolver│  │  CacheChain  │  │ ContentProc  │  │
│  │ (Adapter)     │  │ (Strategy)   │  │ (Decorator)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         ▼                 ▼                 ▼           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  R2 Buckets  │  │  Cache Tiers │  │  Processors  │  │
│  │  (sharded)   │  │  mem→CF→R2   │  │  meta/ast/   │  │
│  │              │  │              │  │  rendered    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Design Patterns Used

| Pattern | File | Purpose |
|---------|------|---------|
| **Facade** | `loader.ts` | Unified `R2ContentLoader` API |
| **Adapter** | `bucket-resolver.ts` | Maps paths → buckets (shard/system/default) |
| **Strategy** | `cache-strategy.ts` | Pluggable cache tiers (in-memory, CF Cache) |
| **Chain of Responsibility** | `cache-strategy.ts` | `CacheChain` tries tiers in priority order |
| **Decorator** | `content-processor.ts` | Wraps raw fetcher with transform + cache |
| **Plugin** | `cache-registry.ts` | Auto-registers cache key prefixes for invalidation |

---

## API Reference

### `R2ContentLoader`

#### Constructor

```typescript
new R2ContentLoader(config: R2LoaderConfig, options?: R2LoaderOptions)
```

**`R2LoaderConfig` (v1 — unchanged)**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `bucket` | `R2Bucket` | required | Cloudflare R2 bucket binding |
| `prefix` | `string` | `''` | Key prefix for all operations |
| `cacheTTL` | `number` | `300000` | In-memory cache TTL (ms) |
| `cacheEnabled` | `boolean` | `true` | Enable/disable in-memory cache |

**`R2LoaderConfigV2` (v2 — opt-in via new fields)**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cfCache` | `boolean` | `false` | Enable Cloudflare edge cache tier |
| `cfCacheTTL` | `number` | `300` | CF Cache-Control max-age (seconds) |
| `systemBucket` | `R2Bucket` | `undefined` | Separate bucket for `__sys_` paths |
| `systemPrefix` | `string` | `'__sys_'` | Path prefix for system content routing |
| `shardConfig` | `ShardConfig` | `undefined` | Consistent hash sharding config |

**`ShardConfig`**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `shards` | `R2Bucket[]` | required | Physical buckets for content distribution |
| `vnodesPerShard` | `number` | `64` | Virtual nodes for consistent hashing |
| `systemBucket` | `R2Bucket` | `undefined` | Overrides system bucket for sharded setups |

**`R2LoaderOptions`**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `md2html` | `PipelineConfig` | `undefined` | Configuration for the markdown-to-HTML pipeline |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get(path, ctx?)` | `Promise<string \| null>` | Fetch raw content (with multi-tier caching) |
| `getObject(path)` | `Promise<R2Object \| null>` | Fetch raw R2 object |
| `getWithMetadata(path)` | `Promise<ParsedContent \| null>` | Fetch + parse frontmatter |
| `getWithAST(path)` | `Promise<ASTContent \| null>` | Fetch + parse frontmatter + AST |
| `getRendered(path)` | `Promise<RenderedContent \| null>` | Fetch + parse frontmatter + render HTML |
| `list(prefix?)` | `Promise<R2ListResult>` | List objects under prefix |
| `exists(path)` | `Promise<boolean>` | Check if path exists |
| `invalidate(path)` | `void` | Invalidate cache for path (all tiers) |
| `invalidatePrefix(prefix)` | `void` | Invalidate cache for prefix |
| `clearCache()` | `void` | Clear all cached data |
| `setCacheTTL(ttl)` | `void` | Update cache TTL |
| `disableCache()` | `void` | Disable in-memory cache |
| `enableCache()` | `void` | Enable in-memory cache |

---

## v2 Features

### 1. CF Cache API Tier

Enable Cloudflare's edge cache (`caches.default`) for sub-10ms reads on cache hits.

```typescript
const loader = new R2ContentLoader({
  bucket: MY_BUCKET,
  cfCache: true,
  cfCacheTTL: 600,  // 10 minutes
});
```

**Cache key format:** `{namespace}:{path}` where namespace is `default`, `system`, or `shard-{N}`.

### 2. Stale-While-Revalidate (SWR)

Serve stale data while re-fetching in the background. SWR applies between in-memory cache and CF cache tiers.

```typescript
import { ContentCacheV2 } from '@leadertechie/r2tohtml';

const cache = new ContentCacheV2(
  5 * 60 * 1000,  // TTL: 5 minutes
  true,            // enabled
  30 * 60 * 1000,  // SWR TTL: 30 minutes
);

cache.set('key', 'value');
// After TTL expires but within SWR window:
const result = cache.get<string>('key');
// result = { data: 'value', stale: true }
```

**Cache lifecycle:**

```
Cached → [TTL expires] → Stale (SWR window) → [SWR expires] → Uncached
                            │
                            └─ revalidation succeeds → back to Cached
```

### 3. System Bucket Support

Route `__sys_` paths to a separate bucket for system content (layouts, navbars, ads, templates).

```typescript
const loader = new R2ContentLoader({
  bucket: USER_BUCKET,
  systemBucket: SYSTEM_BUCKET,
});

// Routes to SYSTEM_BUCKET
const layout = await loader.get('__sys_/layouts/default.html');

// Routes to USER_BUCKET
const post = await loader.get('posts/hello.md');
```

### 4. Identity Shard Mapping

Distribute content across physical buckets using FNV-1a consistent hashing.

```typescript
const loader = new R2ContentLoader({
  bucket: SHARD_1,
  shardConfig: {
    shards: [SHARD_1, SHARD_2, SHARD_3],
    vnodesPerShard: 64,
    systemBucket: SYSTEM_BUCKET,
  },
});

// Same path always routes to the same shard
await loader.get('users/alice/post.md');  // → SHARD_1 or SHARD_2 or SHARD_3
await loader.get('__sys_/layout.html');   // → SYSTEM_BUCKET
```

### 5. Multi-Tier Caching

```
Layer 1: In-memory ContentCache  (~1µs, worker-local)
Layer 2: CF Cache (caches.default)  (~10ms, edge-local)
Layer 3: R2 Bucket  (~100ms, origin)
```

The `CacheChain` tries each tier in priority order. On a miss, all tiers are populated on write-back.

---

## Advanced Usage

### Custom Content Processors

Use the `ContentProcessor` decorator to create custom transformations:

```typescript
import { ContentProcessor, ContentCache, CacheRegistry } from '@leadertechie/r2tohtml';

const cache = new ContentCache(60000, true);
const registry = new CacheRegistry(cache);

const uppercaseProcessor = new ContentProcessor(
  async (path) => loader.get(path),  // fetcher
  cache,
  registry,
  'uppercase',                       // cache key prefix
  (raw: string) => raw.toUpperCase(), // transform
);

const result = await uppercaseProcessor.get('hello.md');
```

### Custom Cache Strategies

Implement the `CacheStrategy` interface to add new cache tiers:

```typescript
import { CacheStrategy, CacheChain } from '@leadertechie/r2tohtml';

class KVCacheStrategy implements CacheStrategy {
  readonly name = 'kv-cache';
  async get(key: string) { /* ... */ }
  async set(key: string, data: string) { /* ... */ }
  async delete(key: string) { /* ... */ }
}

const chain = new CacheChain([
  new InMemoryCacheStrategy(cache),
  new KVCacheStrategy(kvNamespace),
]);
```

---

## Exports

```typescript
// Core
export { R2ContentLoader } from './loader';
export { ContentCache, ContentCacheV2 } from './cache';
export { parseFrontmatter, stringifyFrontmatter } from './frontmatter';

// v2 Architecture
export { BucketResolver } from './bucket-resolver';
export { CacheRegistry } from './cache-registry';
export { CacheChain, InMemoryCacheStrategy, CFCacheStrategy } from './cache-strategy';
export { ContentProcessor, createMetadataProcessor, createASTProcessor, createRenderedProcessor } from './content-processor';

// Sharding
export { fnv1a, resolveIdentity, resolveBucket, getShardCachePrefix } from './shard';

// CF Cache
export { buildCFCacheKey, cfCacheMatch, cfCachePut, cfCacheDelete } from './cf-cache';

// Types
export type {
  R2LoaderConfig, R2LoaderConfigV2, ShardConfig,
  R2Object, R2ListResult, ContentMetadata, ParsedContent,
  RenderedContent, ASTContent, ContentFetcher,
  CacheStrategy, BucketResolution,
} from './types';

// Execution Context
export { ExecutionContext } from './execution-context';

// md2html
export { MarkdownPipeline } from '@leadertechie/md2html';
export type { ContentNode, PipelineConfig } from '@leadertechie/md2html';
```

---

## Migration from v1

v2 is **fully backward compatible**. All v1 API is unchanged. New features are opt-in via new config fields.

| Step | What changes |
|------|-------------|
| 1. Update package | `npm install @leadertechie/r2tohtml@latest` |
| 2. No code changes needed | Existing `R2ContentLoader` calls continue to work |
| 3. Enable CF Cache | Add `cfCache: true` to config |
| 4. Add system bucket | Add `systemBucket: MY_SYS_BUCKET` to config |
| 5. Add sharding | Add `shardConfig: { shards: [...] }` to config |
| 6. Use SWR cache | Replace `ContentCache` with `ContentCacheV2` |

---

## License

MIT
