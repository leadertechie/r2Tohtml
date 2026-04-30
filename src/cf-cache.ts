/**
 * CF Cache API Tier
 *
 * Provides an edge cache layer using Cloudflare's caches.default.
 * Cache key format: `${bucketName}:${path}`
 *
 * NOTE: This module is designed to run in a Cloudflare Workers environment.
 * The `caches` global and `ExecutionContext` are available natively there.
 * In test/non-Worker environments, these calls gracefully return null/no-op.
 */

// Type declarations for Cloudflare Workers globals
declare var caches: {
  default: {
    match(request: string | Request): Promise<Response | undefined>;
    put(request: string | Request, response: Response): Promise<void>;
    delete(request: string | Request): Promise<boolean>;
  };
};

export interface CFCacheOptions {
  bucketName: string;
  cfCacheTTL: number;
}

/**
 * Build a cache key for the CF Cache.
 * Uses bucket name + path to avoid collisions between buckets/shard namespaces.
 */
export function buildCFCacheKey(bucketName: string, path: string): string {
  return `${bucketName}:${path}`;
}

/**
 * Try to retrieve a response from caches.default.
 * Returns the Response if found, null otherwise.
 */
export async function cfCacheMatch(cacheKey: string): Promise<Response | null> {
  try {
    const cache = caches.default;
    const response = await cache.match(cacheKey);
    return response || null;
  } catch {
    return null;
  }
}

/**
 * Store a response in caches.default with the given cache key.
 * Sets Cache-Control max-age based on cfCacheTTL.
 */
export async function cfCachePut(
  cacheKey: string,
  content: string,
  cfCacheTTL: number
): Promise<void> {
  try {
    const cache = caches.default;
    const response = new Response(content, {
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Cache-Control': `public, max-age=${cfCacheTTL}`,
        'Date': new Date().toUTCString(),
      },
    });
    await cache.put(cacheKey, response);
  } catch {
    // Silently fail if CF Cache is unavailable (e.g., not in Workers environment)
  }
}

/**
 * Delete a response from caches.default.
 */
export async function cfCacheDelete(cacheKey: string): Promise<void> {
  try {
    const cache = caches.default;
    await cache.delete(cacheKey);
  } catch {
    // Silently fail
  }
}
