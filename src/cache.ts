import { CacheEntry, SWRCacheEntry } from './types';

/**
 * CacheStore — minimal interface for cache operations.
 * Used by CacheRegistry to decouple from concrete cache classes.
 */
export interface CacheStore {
  delete(key: string): void;
  clear(): void;
}

export class ContentCache implements CacheStore {
  protected cache: Map<string, CacheEntry<unknown>>;
  protected ttl: number;
  protected enabled: boolean;

  constructor(ttl: number = 5 * 60 * 1000, enabled: boolean = true) {
    this.cache = new Map();
    this.ttl = ttl;
    this.enabled = enabled;
  }

  get<T>(key: string): T | null {
    if (!this.enabled) return null;

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T): void {
    if (!this.enabled) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * ContentCacheV2 with SWR (Stale-While-Revalidate) support.
 *
 * Cache lifecycle:
 *   Cached → [TTL expires] → Stale (SWR window) → [SWR expires] → Uncached
 *                                │
 *                                └─ revalidation succeeds → back to Cached
 *
 * Does NOT extend ContentCache because the return type of get() differs
 * (returns { data, stale } | null instead of T | null).
 */
export class ContentCacheV2 implements CacheStore {
  private cache: Map<string, SWRCacheEntry<unknown>>;
  private ttl: number;
  private enabled: boolean;
  private swrTTL: number;

  constructor(ttl?: number, enabled?: boolean, swrTTL?: number) {
    this.cache = new Map();
    this.ttl = ttl || 5 * 60 * 1000;
    this.enabled = enabled !== false;
    this.swrTTL = swrTTL || 0;
  }

  /**
   * Returns { data, stale: false } if fresh
   * Returns { data, stale: true } if within SWR window
   * Returns null if not cached or expired beyond SWR window
   */
  get<T>(key: string): { data: T; stale: boolean } | null {
    if (!this.enabled) return null;

    const entry = this.cache.get(key) as SWRCacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;

    // Fresh: within TTL
    if (age <= this.ttl) {
      return { data: entry.data, stale: false };
    }

    // Stale: within SWR window
    if (this.swrTTL > 0 && age <= this.ttl + this.swrTTL) {
      return { data: entry.data, stale: true };
    }

    // Expired beyond SWR window
    this.cache.delete(key);
    return null;
  }

  /**
   * Marks entry as fresh again after revalidation
   */
  refresh(key: string): void {
    const entry = this.cache.get(key) as SWRCacheEntry<unknown> | undefined;
    if (entry) {
      entry.timestamp = Date.now();
    }
  }

  set<T>(key: string, data: T): void {
    if (!this.enabled) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      staleTimestamp: Date.now() + this.ttl + this.swrTTL
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
