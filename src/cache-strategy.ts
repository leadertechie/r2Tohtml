import { ContentCache } from './cache';
import { ExecutionContext } from './execution-context';
import {
  buildCFCacheKey,
  cfCacheMatch,
  cfCachePut,
  cfCacheDelete,
} from './cf-cache';
import { getDefaultLogger } from './telemetry-init.js';
import type { LoggerInterface as Logger } from '@leadertechie/telemetry';

/**
 * CacheStrategy — Strategy pattern for cache tiers.
 *
 * Each tier implements this interface and can be composed into a chain.
 * Adding a new cache tier (e.g., KV cache) is just adding a new strategy.
 *
 * IMPORTANT: Implementations must be stateless with respect to per-request
 * context (namespace, ExecutionContext). These values are passed via method
 * parameters to avoid mutable shared state between concurrent requests.
 */
export interface CacheStrategy {
  readonly name: string;
  get(key: string, opts?: CacheStrategyOpts): Promise<{ data: string; stale: boolean } | null>;
  set(key: string, data: string, opts?: CacheStrategyOpts): Promise<void>;
  delete(key: string, opts?: CacheStrategyOpts): Promise<void>;
}

export interface CacheStrategyOpts {
  namespace?: string;
  ctx?: ExecutionContext;
}

// ─── In-Memory Cache Strategy ─────────────────────────────────────

export class InMemoryCacheStrategy implements CacheStrategy {
  readonly name = 'in-memory';

  constructor(private cache: ContentCache) {}

  async get(key: string, _opts?: CacheStrategyOpts): Promise<{ data: string; stale: boolean } | null> {
    const data = this.cache.get<string>(key);
    if (data === null) return null;
    return { data, stale: false };
  }

  async set(key: string, data: string, _opts?: CacheStrategyOpts): Promise<void> {
    this.cache.set(key, data);
  }

  async delete(key: string, _opts?: CacheStrategyOpts): Promise<void> {
    this.cache.delete(key);
  }
}

// ─── CF Cache Strategy ────────────────────────────────────────────

/**
 * Stateless CF Cache strategy.
 * Namespace and ExecutionContext are passed per-call via opts,
 * not stored as mutable instance state. Thread/request-safe.
 */
export class CFCacheStrategy implements CacheStrategy {
  readonly name = 'cf-cache';
  private readonly cfCacheTTL: number;

  constructor(cfCacheTTL: number) {
    this.cfCacheTTL = cfCacheTTL;
  }

  async get(key: string, opts?: CacheStrategyOpts): Promise<{ data: string; stale: boolean } | null> {
    const cfKey = this.buildKey(key, opts?.namespace);
    const response = await cfCacheMatch(cfKey);
    if (!response) return null;
    return { data: await response.text(), stale: false };
  }

  async set(key: string, data: string, opts?: CacheStrategyOpts): Promise<void> {
    const cfKey = this.buildKey(key, opts?.namespace);
    const put = cfCachePut(cfKey, data, this.cfCacheTTL);
    if (opts?.ctx) {
      opts.ctx.waitUntil(put);
    } else {
      await put;
    }
  }

  async delete(key: string, opts?: CacheStrategyOpts): Promise<void> {
    const cfKey = this.buildKey(key, opts?.namespace);
    await cfCacheDelete(cfKey);
  }

  private buildKey(key: string, namespace?: string): string {
    return buildCFCacheKey(namespace || 'default', key);
  }
}

// ─── Cache Chain ──────────────────────────────────────────────────

/**
 * Chains multiple cache strategies in priority order.
 * First strategy to return a hit wins.
 * On miss, all strategies are populated on write-back.
 *
 * If no logger is provided, falls back to a default console logger (WARN+ only)
 * via the shared telemetry helper — same pattern used across all @leadertechie packages.
 */
export class CacheChain {
  private log: Logger;

  constructor(private strategies: CacheStrategy[], logger?: Logger) {
    this.log = logger ?? getDefaultLogger('r2tohtml');
  }

  /** Try each strategy in order. Returns first hit. */
  async get(key: string, opts?: CacheStrategyOpts): Promise<string | null> {
    for (const strategy of this.strategies) {
      try {
        const result = await strategy.get(key, opts);
        if (result !== null) {
          return result.data;
        }
      } catch (err: unknown) {
        this.log.warn(`[CacheChain] ${strategy.name}.get() failed:`, err as Record<string, unknown>);
      }
    }
    return null;
  }

  /** Write to all strategies in parallel. */
  async set(key: string, data: string, opts?: CacheStrategyOpts): Promise<void> {
    await Promise.all(
      this.strategies.map(s =>
        s.set(key, data, opts).catch((err: unknown) => {
          this.log.warn(`[CacheChain] ${s.name}.set() failed:`, err as Record<string, unknown>);
        }),
      ),
    );
  }

  /** Delete from all strategies in parallel. */
  async delete(key: string, opts?: CacheStrategyOpts): Promise<void> {
    await Promise.all(
      this.strategies.map(s =>
        s.delete(key, opts).catch((err: unknown) => {
          this.log.warn(`[CacheChain] ${s.name}.delete() failed:`, err as Record<string, unknown>);
        }),
      ),
    );
  }
}
