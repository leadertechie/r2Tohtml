import { R2Bucket, ShardConfig } from './types';
import { resolveBucket } from './shard';

/**
 * Result of resolving a path to a bucket.
 * Includes both the bucket and a namespace string for cache key isolation.
 */
export interface BucketResolution {
  bucket: R2Bucket;
  namespace: string;
}

/**
 * BucketResolver — Adapter pattern.
 *
 * Single source of truth for mapping paths to R2 buckets.
 * Eliminates the duplicated getBucket() / getBucketName() logic.
 *
 * Resolution priority:
 * 1. Shard config (consistent hashing)
 * 2. System bucket (if path starts with system prefix)
 * 3. Default bucket
 */
export class BucketResolver {
  constructor(
    private defaultBucket: R2Bucket,
    private systemBucket?: R2Bucket,
    private systemPrefix: string = '__sys_',
    private shardConfig?: ShardConfig,
  ) {}

  /**
   * Resolve both the bucket and its cache namespace for a given path.
   */
  resolve(path: string): BucketResolution {
    // 1. Shard config takes priority
    if (this.shardConfig) {
      const shardBucket = resolveBucket(path, this.shardConfig, this.systemPrefix);
      if (shardBucket) {
        const idx = this.shardConfig.shards.indexOf(shardBucket);
        return {
          bucket: shardBucket,
          namespace: idx >= 0 ? `shard-${idx}` : 'default',
        };
      }
    }

    // 2. System bucket
    if (this.systemBucket && path.startsWith(this.systemPrefix)) {
      return { bucket: this.systemBucket, namespace: 'system' };
    }

    // 3. Default
    return { bucket: this.defaultBucket, namespace: 'default' };
  }
}
