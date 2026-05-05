import { ContentCache } from './cache';
import { CacheRegistry } from './cache-registry';
import { ContentMetadata, ParsedContent } from './types';
import { parseFrontmatter } from './frontmatter';
import { MarkdownPipeline } from '@leadertechie/md2html';
import type { ContentNode } from '@leadertechie/md2html';

/**
 * ContentProcessor — Decorator pattern for content transformation.
 *
 * Composes transformations: raw content → intermediate ParsedContent → final type.
 * No JSON serialization hack — uses proper function composition.
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

/** A transform that produces output from raw content. */
export type ContentTransform<T> = (raw: string) => T;

/**
 * ContentProcessor — single-stage processor.
 * Fetcher → Transform → Cache.
 */
export class ContentProcessor<T> {
  private cacheKeyPrefix: string;

  constructor(
    private fetcher: ContentFetcher,
    private cache: ContentCache,
    registry: CacheRegistry,
    prefix: string,
    private transform: ContentTransform<T>,
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

/**
 * TwoStageProcessor — composes two ContentProcessors.
 * Stage 1: raw → ParsedContent (metadata + body)
 * Stage 2: ParsedContent → final T (AST or rendered HTML)
 *
 * Eliminates JSON.stringify/parse pipe between stages.
 */
export class TwoStageProcessor<T> {
  private cacheKeyPrefix: string;

  constructor(
    private stage1: ContentProcessor<ParsedContent>,
    private cache: ContentCache,
    registry: CacheRegistry,
    prefix: string,
    private transform: (parsed: ParsedContent) => T,
  ) {
    this.cacheKeyPrefix = prefix;
    registry.register(prefix);
  }

  async get(path: string): Promise<T | null> {
    const cacheKey = `${this.cacheKeyPrefix}:${path}`;

    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) return cached;

    // Call stage1 — uses its own caching internally
    const parsed = await this.stage1.get(path);
    if (parsed === null) return null;

    const result = this.transform(parsed);
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
): TwoStageProcessor<ASTContent> {
  const metaProcessor = createMetadataProcessor(fetcher, cache, registry);

  return new TwoStageProcessor<ASTContent>(
    metaProcessor,
    cache,
    registry,
    'ast',
    (parsed) => {
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
): TwoStageProcessor<RenderedContent> {
  const metaProcessor = createMetadataProcessor(fetcher, cache, registry);

  return new TwoStageProcessor<RenderedContent>(
    metaProcessor,
    cache,
    registry,
    'rendered',
    (parsed) => {
      const html = pipeline.renderMarkdown(parsed.content);
      return { metadata: parsed.metadata, content: html };
    },
  );
}
