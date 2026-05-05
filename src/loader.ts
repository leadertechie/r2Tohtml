import {
  R2LoaderConfig,
  R2LoaderConfigV2,
  R2Object,
  R2ListResult,
  ParsedContent,
  Logger,
} from './types';
import { ContentCache } from './cache';
import { CacheRegistry } from './cache-registry';
import { BucketResolver } from './bucket-resolver';
import {
  CacheChain,
  CacheStrategy,
  CacheStrategyOpts,
  InMemoryCacheStrategy,
  CFCacheStrategy,
} from './cache-strategy';
import {
  ContentProcessor,
  TwoStageProcessor,
  ContentFetcher,
  createMetadataProcessor,
  createASTProcessor,
  createRenderedProcessor,
  RenderedContent,
  ASTContent,
} from './content-processor';
import { ExecutionContext } from './execution-context';
import { MarkdownPipeline } from '@leadertechie/md2html';
import type { PipelineConfig, PipelineConfigV2 } from '@leadertechie/md2html';

export interface R2LoaderOptions {
  md2html?: PipelineConfig | PipelineConfigV2;
  /** Optional injectable logger. In CF Workers pass `console` or your structured logger. Defaults to no-op. */
  logger?: Logger;
}


export class R2ContentLoader {
  private prefix: string;
  private cache: ContentCache;
  private registry: CacheRegistry;
  private bucketResolver: BucketResolver;
  private cacheChain: CacheChain;
  private cfCacheStrategy?: CFCacheStrategy;
  private cfCacheEnabled: boolean;
  private pipeline: MarkdownPipeline;
  private cfCacheTTL: number;

  // Processors (created lazily)
  private _metaProcessor?: ContentProcessor<ParsedContent>;
  private _astProcessor?: TwoStageProcessor<ASTContent>;
  private _renderedProcessor?: TwoStageProcessor<RenderedContent>;

  constructor(config: R2LoaderConfig | R2LoaderConfigV2, options?: R2LoaderOptions) {
    this.prefix = config.prefix || '';
    this.cache = new ContentCache(
      config.cacheTTL || 5 * 60 * 1000,
      config.cacheEnabled !== false,
    );
    this.registry = new CacheRegistry(this.cache);
    this.pipeline = new MarkdownPipeline(options?.md2html);

    // v2 config
    const v2Config = config as R2LoaderConfigV2;
    this.cfCacheEnabled = v2Config.cfCache || false;
    this.cfCacheTTL = v2Config.cfCacheTTL || 300;
    const systemBucket = v2Config.systemBucket;
    const systemPrefix = v2Config.systemPrefix || '__sys_';
    const shardConfig = v2Config.shardConfig;

    // BucketResolver — single source of truth for bucket routing
    this.bucketResolver = new BucketResolver(
      config.bucket,
      systemBucket,
      systemPrefix,
      shardConfig,
    );

    // CacheChain — pluggable cache tiers
    const strategies: CacheStrategy[] = [new InMemoryCacheStrategy(this.cache)];
    if (this.cfCacheEnabled) {
      this.cfCacheStrategy = new CFCacheStrategy(this.cfCacheTTL);
      strategies.push(this.cfCacheStrategy);
    }
    this.cacheChain = new CacheChain(strategies, options?.logger);
  }

  private getKey(path: string): string {
    return this.prefix ? `${this.prefix}${path}` : path;
  }

  /**
   * Fetch raw content from R2 directly, bypassing cache chain.
   * Used by ContentProcessors to avoid nested cache lookups.
   */
  private fetchRawFromBucket: ContentFetcher = async (path: string) => {
    const cacheKey = this.getKey(path);
    const { bucket } = this.bucketResolver.resolve(path);
    const obj = await bucket.get(cacheKey);
    return obj ? obj.text() : null;
  };

  // ─── Lazy processor accessors ───────────────────────────────────

  private get metaProcessor(): ContentProcessor<ParsedContent> {
    if (!this._metaProcessor) {
      this._metaProcessor = createMetadataProcessor(
        this.fetchRawFromBucket,
        this.cache,
        this.registry,
      );
    }
    return this._metaProcessor;
  }

  private get astProcessor(): TwoStageProcessor<ASTContent> {
    if (!this._astProcessor) {
      this._astProcessor = createASTProcessor(
        this.fetchRawFromBucket,
        this.cache,
        this.registry,
        this.pipeline,
      );
    }
    return this._astProcessor;
  }

  private get renderedProcessor(): TwoStageProcessor<RenderedContent> {
    if (!this._renderedProcessor) {
      this._renderedProcessor = createRenderedProcessor(
        this.fetchRawFromBucket,
        this.cache,
        this.registry,
        this.pipeline,
      );
    }
    return this._renderedProcessor;
  }

  // ─── Public API ─────────────────────────────────────────────────

  async get(path: string, ctx?: ExecutionContext): Promise<string | null> {
    const cacheKey = this.getKey(path);
    const { bucket, namespace } = this.bucketResolver.resolve(path);

    // 1. Check cache chain (in-memory → CF cache). Pass namespace for CF tier.
    const opts: CacheStrategyOpts = { namespace, ctx };
    const cached = await this.cacheChain.get(cacheKey, opts);
    if (cached !== null) return cached;

    // 2. Fallback to R2
    const obj = await bucket.get(cacheKey);
    if (!obj) return null;

    const content = await obj.text();

    // 3. Write back to all cache tiers with namespace context
    await this.cacheChain.set(cacheKey, content, opts);

    return content;
  }

  async getObject(path: string): Promise<R2Object | null> {
    const { bucket } = this.bucketResolver.resolve(path);
    return bucket.get(this.getKey(path));
  }

  async getWithMetadata(path: string): Promise<ParsedContent | null> {
    return this.metaProcessor.get(path);
  }

  async getWithAST(path: string): Promise<ASTContent | null> {
    return this.astProcessor.get(path);
  }

  async getRendered(path: string): Promise<RenderedContent | null> {
    return this.renderedProcessor.get(path);
  }

  async list(prefix: string = ''): Promise<R2ListResult> {
    const fullPrefix = this.prefix ? `${this.prefix}${prefix}` : prefix;
    const { bucket } = this.bucketResolver.resolve(prefix);
    return bucket.list({ prefix: fullPrefix });
  }

  async exists(path: string): Promise<boolean> {
    const obj = await this.getObject(path);
    return obj !== null;
  }

  invalidate(path: string): void {
    const key = this.getKey(path);
    this.registry.invalidate(key);

    // Also invalidate CF cache
    if (this.cfCacheStrategy) {
      this.cacheChain.delete(key);
    }
  }

  invalidatePrefix(prefix: string): void {
    this.cache.clearPrefix(this.getKey(prefix));
  }

  clearCache(): void {
    this.registry.clear();
  }

  setCacheTTL(ttl: number): void {
    this.cache.setTTL(ttl);
  }

  disableCache(): void {
    this.cache.setEnabled(false);
  }

  enableCache(): void {
    this.cache.setEnabled(true);
  }
}
