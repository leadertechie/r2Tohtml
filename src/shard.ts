import { R2Bucket, ShardConfig } from './types';

/**
 * FNV-1a hash implementation (32-bit)
 * Used for consistent hashing of paths to shard buckets.
 */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  const prime = 0x01000193; // FNV prime

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, prime);
  }

  // Ensure unsigned 32-bit integer
  return hash >>> 0;
}

/**
 * Resolve the identity (virtual node index) for a given path.
 * Uses FNV-1a hash of the path.
 */
export function resolveIdentity(path: string, totalVnodes: number): number {
  return fnv1a(path) % totalVnodes;
}

/**
 * Resolve which bucket a path belongs to.
 *
 * - If path starts with system prefix, returns systemBucket (if configured).
 * - If no shardConfig, returns null (caller should use default bucket).
 * - Otherwise, uses consistent hashing to pick a shard.
 */
export function resolveBucket(
  path: string,
  shardConfig?: ShardConfig,
  systemPrefix: string = '__sys_'
): R2Bucket | null {
  if (!shardConfig) return null;

  // System path routing
  if (path.startsWith(systemPrefix)) {
    return shardConfig.systemBucket || null;
  }

  const totalVnodes = shardConfig.shards.length * shardConfig.vnodesPerShard;
  const vnode = resolveIdentity(path, totalVnodes);
  const shardIdx = Math.floor(vnode / shardConfig.vnodesPerShard);
  return shardConfig.shards[shardIdx];
}

/**
 * Get the cache key namespace for a shard.
 * Single bucket mode: no prefix
 * Shard mode: `shard-${shardIdx}:`
 */
export function getShardCachePrefix(shardIdx?: number): string {
  if (shardIdx === undefined) return '';
  return `shard-${shardIdx}:`;
}
