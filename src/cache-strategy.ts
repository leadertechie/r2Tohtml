import { ContentCache } from './cache';
import { ExecutionContext } from './execution-context';
import {
  buildCFCacheKey,
  cfCacheMatch,
  cfCachePut,
  cfCacheDelete,
} from './cf-cache';

/**
 * CacheStrategy — Strategy pattern for cache tiers.
 *
 * Each tier implements this interface and can be composed into a chain.
 * Adding a new cache tier (e.g., KV cache) is just adding a new strategy.
 */
export interface CacheStrategy {
  readonly name: string;
  get(key: string): Promise<{ data: string; stale: boolean } | null>;
  set(key: string, data: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// ─── In-Memory Cache Strategy ─────────────────────────────────────

export class InMemoryCacheStrategy implements CacheStrategy {
  readonly name = 'in-memory';

  constructor(private cache: ContentCache) {}

  async get(key: string): Promise<{ data: string; stale: boolean } | null> {
    const data = this.cache.get<string>(key);
    if (data === null) return null;
    return { data, stale: false };
  }

  async set(key: string, data: string): Promise<void> {
    this.cache.set(key, data);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

// ─── CF Cache Strategy ────────────────────────────────────────────

export class CFCacheStrategy implements CacheStrategy {
  readonly name = 'cf-cache';
  private ctx?: ExecutionContext;

  constructor(
    private namespace: string,
    private cfCacheTTL: number,
    ctx?: ExecutionContext,
  ) {
    this.ctx = ctx;
  }

  /** Update the namespace (called when shard routing changes per-path). */
  setNamespace(namespace: string): void {
    this.namespace = namespace;
  }

  setExecutionContext(ctx?: ExecutionContext): void {
    this.ctx = ctx;
  }

  private buildKey(key: string): string {
    return buildCFCacheKey(this.namespace, key);
  }

  async get(key: string): Promise<{ data: string; stale: boolean } | null> {
    const cfKey = this.buildKey(key);
    const response = await cfCacheMatch(cfKey);
    if (!response) return null;
    return { data: await response.text(), stale: false };
  }

  async set(key: string, data: string): Promise<void> {
    const cfKey = this.buildKey(key);
    if (this.ctx) {
      this.ctx.waitUntil(cfCachePut(cfKey, data, this.cfCacheTTL));
    } else {
      await cfCachePut(cfKey, data, this.cfCacheTTL);
    }
  }

  async delete(key: string): Promise<void> {
    const cfKey = this.buildKey(key);
    await cfCacheDelete(cfKey);
  }
}

// ─── Cache Chain ──────────────────────────────────────────────────

/**
 * Chains multiple cache strategies in priority order.
 * First strategy to return a hit wins.
 * On miss, all strategies are populated on write-back.
 */
export class CacheChain {
  constructor(private strategies: CacheStrategy[]) {}

  /** Try each strategy in order. Returns first hit. */
  async get(key: string): Promise<string | null> {
    for (const strategy of this.strategies) {
      const result = await strategy.get(key);
      if (result !== null) {
        return result.data;
      }
    }
    return null;
  }

  /** Write to all strategies in parallel. */
  async set(key: string, data: string): Promise<void> {
    await Promise.all(
      this.strategies.map(s => s.set(key, data).catch(() => {})),
    );
  }

  /** Delete from all strategies in parallel. */
  async delete(key: string): Promise<void> {
    await Promise.all(
      this.strategies.map(s => s.delete(key).catch(() => {})),
    );
  }
}
