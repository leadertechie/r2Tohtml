import { R2Bucket, R2LoaderConfig, R2Object, R2ListResult, ContentMetadata, ParsedContent } from './types';
import { ContentCache } from './cache';
import { parseFrontmatter } from './frontmatter';
import { MarkdownPipeline } from '@leadertechie/md2html';
import type { ContentNode, PipelineConfig } from '@leadertechie/md2html';

export interface RenderedContent {
  metadata: ContentMetadata;
  content: string;
}

export interface ASTContent {
  metadata: ContentMetadata;
  contentNodes: ContentNode[];
}

export interface R2LoaderOptions {
  md2html?: PipelineConfig;
}

export class R2ContentLoader {
  private bucket: R2Bucket;
  private prefix: string;
  private cache: ContentCache;
  private pipeline: MarkdownPipeline;

  constructor(config: R2LoaderConfig, options?: R2LoaderOptions) {
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
    this.cache = new ContentCache(
      config.cacheTTL || 5 * 60 * 1000,
      config.cacheEnabled !== false
    );
    this.pipeline = new MarkdownPipeline(options?.md2html);
  }

  private getKey(path: string): string {
    return this.prefix ? `${this.prefix}${path}` : path;
  }

  async get(path: string): Promise<string | null> {
    const cacheKey = this.getKey(path);
    
    const cached = this.cache.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const obj = await this.bucket.get(cacheKey);
    if (!obj) {
      return null;
    }

    const content = await obj.text();
    this.cache.set(cacheKey, content);
    return content;
  }

  async getObject(path: string): Promise<R2Object | null> {
    const cacheKey = `obj:${this.getKey(path)}`;
    
    const cached = this.cache.get<R2Object>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const obj = await this.bucket.get(this.getKey(path));
    if (obj) {
      this.cache.set(cacheKey, obj);
    }
    return obj;
  }

  async getWithMetadata(path: string): Promise<ParsedContent | null> {
    const cacheKey = `meta:${this.getKey(path)}`;
    
    const cached = this.cache.get<ParsedContent>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const content = await this.get(path);
    if (!content) {
      return null;
    }

    const { metadata, content: body } = parseFrontmatter(content);
    const result = { metadata, content: body };
    this.cache.set(cacheKey, result);
    return result;
  }

  async getWithAST(path: string): Promise<ASTContent | null> {
    const cacheKey = `ast:${this.getKey(path)}`;
    
    const cached = this.cache.get<ASTContent>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const withMetadata = await this.getWithMetadata(path);
    if (!withMetadata) {
      return null;
    }

    const contentNodes = this.pipeline.parse(withMetadata.content);
    const result = {
      metadata: withMetadata.metadata,
      contentNodes
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  async getRendered(path: string): Promise<RenderedContent | null> {
    const cacheKey = `rendered:${this.getKey(path)}`;
    
    const cached = this.cache.get<RenderedContent>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const withMetadata = await this.getWithMetadata(path);
    if (!withMetadata) {
      return null;
    }

    const html = this.pipeline.renderMarkdown(withMetadata.content);
    const result = {
      metadata: withMetadata.metadata,
      content: html
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  async list(prefix: string = ''): Promise<R2ListResult> {
    const fullPrefix = this.prefix ? `${this.prefix}${prefix}` : prefix;
    return this.bucket.list({ prefix: fullPrefix });
  }

  async exists(path: string): Promise<boolean> {
    const obj = await this.getObject(path);
    return obj !== null;
  }

  invalidate(path: string): void {
    const key = this.getKey(path);
    this.cache.delete(key);
    this.cache.delete(`obj:${key}`);
    this.cache.delete(`meta:${key}`);
    this.cache.delete(`ast:${key}`);
    this.cache.delete(`rendered:${key}`);
  }

  invalidatePrefix(prefix: string): void {
    const fullPrefix = this.getKey(prefix);
    this.cache.clearPrefix(fullPrefix);
  }

  clearCache(): void {
    this.cache.clear();
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
