import { ContentCache } from './cache';

/**
 * CacheRegistry — Plugin pattern for cache invalidation.
 *
 * Each content processor registers its cache key prefix on construction.
 * invalidate() then iterates the registry instead of hardcoding key prefixes.
 *
 * This means adding a new processor never requires updating invalidate().
 */
export class CacheRegistry {
  private prefixes = new Set<string>();

  constructor(private cache: ContentCache) {}

  /** Register a cache key prefix (e.g. 'meta:', 'ast:', 'rendered:'). */
  register(prefix: string): void {
    this.prefixes.add(prefix);
  }

  /** Invalidate all cache entries for a given base key across all prefixes. */
  invalidate(baseKey: string): void {
    this.cache.delete(baseKey);
    for (const prefix of this.prefixes) {
      this.cache.delete(`${prefix}${baseKey}`);
    }
  }

  /** Clear all cached data. */
  clear(): void {
    this.cache.clear();
  }
}
