import { ContentCache } from './cache';
import { parseFrontmatter } from './frontmatter';
import { MarkdownPipeline } from '@leadertechie/md2html';
export class R2ContentLoader {
    constructor(config, options) {
        this.bucket = config.bucket;
        this.prefix = config.prefix || '';
        this.cache = new ContentCache(config.cacheTTL || 5 * 60 * 1000, config.cacheEnabled !== false);
        this.pipeline = new MarkdownPipeline(options?.md2html);
    }
    getKey(path) {
        return this.prefix ? `${this.prefix}${path}` : path;
    }
    async get(path) {
        const cacheKey = this.getKey(path);
        const cached = this.cache.get(cacheKey);
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
    async getObject(path) {
        const cacheKey = `obj:${this.getKey(path)}`;
        const cached = this.cache.get(cacheKey);
        if (cached !== null) {
            return cached;
        }
        const obj = await this.bucket.get(this.getKey(path));
        if (obj) {
            this.cache.set(cacheKey, obj);
        }
        return obj;
    }
    async getWithMetadata(path) {
        const cacheKey = `meta:${this.getKey(path)}`;
        const cached = this.cache.get(cacheKey);
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
    async getWithAST(path) {
        const cacheKey = `ast:${this.getKey(path)}`;
        const cached = this.cache.get(cacheKey);
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
    async getRendered(path) {
        const cacheKey = `rendered:${this.getKey(path)}`;
        const cached = this.cache.get(cacheKey);
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
    async list(prefix = '') {
        const fullPrefix = this.prefix ? `${this.prefix}${prefix}` : prefix;
        return this.bucket.list({ prefix: fullPrefix });
    }
    async exists(path) {
        const obj = await this.getObject(path);
        return obj !== null;
    }
    invalidate(path) {
        const key = this.getKey(path);
        this.cache.delete(key);
        this.cache.delete(`obj:${key}`);
        this.cache.delete(`meta:${key}`);
        this.cache.delete(`ast:${key}`);
        this.cache.delete(`rendered:${key}`);
    }
    invalidatePrefix(prefix) {
        const fullPrefix = this.getKey(prefix);
        this.cache.clearPrefix(fullPrefix);
    }
    clearCache() {
        this.cache.clear();
    }
    setCacheTTL(ttl) {
        this.cache.setTTL(ttl);
    }
    disableCache() {
        this.cache.setEnabled(false);
    }
    enableCache() {
        this.cache.setEnabled(true);
    }
}
