import { ContentCache } from './cache';
import { CacheRegistry } from './cache-registry';
import { ContentMetadata, ParsedContent } from './types';
import { parseFrontmatter } from './frontmatter';
import { MarkdownPipeline } from '@leadertechie/md2html';
import type { ContentNode } from '@leadertechie/md2html';

/**
 * ContentProcessor — Decorator pattern.
 *
 * Wraps a raw content fetcher with transformation + caching.
 * Eliminates repetitive getWithMetadata / getWithAST / getRendered methods.
 *
 * Usage:
 *   const getRendered = new ContentProcessor(loader, cache, registry, 'rendered',
 *     (raw) => { ... transform raw to desired type ... });
 *   const html = await getRendered.get('path');
 */

export interface RenderedContent {
  metadata: ContentMetadata;
  content: string;
}

export interface ASTContent {
  metadata: ContentMetadata;
  contentNodes: ContentNode[];
}

export type ContentFetcher = (path: string) => Promise<string | null>;

export class ContentProcessor<T> {
  private cacheKeyPrefix: string;

  constructor(
    private fetcher: ContentFetcher,
    private cache: ContentCache,
    registry: CacheRegistry,
    prefix: string,
    private transform: (raw: string) => T,
  ) {
    this.cacheKeyPrefix = prefix;
    registry.register(prefix);
  }

  async get(path: string): Promise<T | null> {
    const cacheKey = `${this.cacheKeyPrefix}:${path}`;

    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) return cached;

    const raw = await this.fetcher(path);
    if (raw === null) return null;

    const result = this.transform(raw);
    this.cache.set(cacheKey, result);
    return result;
  }
}

// ─── Pre-built processors ─────────────────────────────────────────

export function createMetadataProcessor(
  fetcher: ContentFetcher,
  cache: ContentCache,
  registry: CacheRegistry,
): ContentProcessor<ParsedContent> {
  return new ContentProcessor(fetcher, cache, registry, 'meta', (raw) => {
    const { metadata, content } = parseFrontmatter(raw);
    return { metadata, content };
  });
}

export function createASTProcessor(
  fetcher: ContentFetcher,
  cache: ContentCache,
  registry: CacheRegistry,
  pipeline: MarkdownPipeline,
): ContentProcessor<ASTContent> {
  // We need a two-stage processor: first parse frontmatter, then parse AST.
  // Use the metadata processor internally.
  const metaProcessor = createMetadataProcessor(fetcher, cache, registry);

  return new ContentProcessor<ASTContent>(
    // The fetcher for AST is actually getWithMetadata
    async (path: string) => {
      const parsed = await metaProcessor.get(path);
      return parsed ? JSON.stringify(parsed) : null;
    },
    cache,
    registry,
    'ast',
    (raw) => {
      const parsed: ParsedContent = JSON.parse(raw);
      const contentNodes = pipeline.parse(parsed.content);
      return { metadata: parsed.metadata, contentNodes };
    },
  );
}

export function createRenderedProcessor(
  fetcher: ContentFetcher,
  cache: ContentCache,
  registry: CacheRegistry,
  pipeline: MarkdownPipeline,
): ContentProcessor<RenderedContent> {
  const metaProcessor = createMetadataProcessor(fetcher, cache, registry);

  return new ContentProcessor<RenderedContent>(
    async (path: string) => {
      const parsed = await metaProcessor.get(path);
      return parsed ? JSON.stringify(parsed) : null;
    },
    cache,
    registry,
    'rendered',
    (raw) => {
      const parsed: ParsedContent = JSON.parse(raw);
      const html = pipeline.renderMarkdown(parsed.content);
      return { metadata: parsed.metadata, content: html };
    },
  );
}
