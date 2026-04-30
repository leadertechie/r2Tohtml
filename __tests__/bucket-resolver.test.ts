import { describe, it, expect, vi } from 'vitest';
import { BucketResolver } from '../src/bucket-resolver';

describe('BucketResolver', () => {
  const defaultBucket = { get: vi.fn() } as any;
  const sysBucket = { get: vi.fn() } as any;
  const shard1 = { get: vi.fn() } as any;
  const shard2 = { get: vi.fn() } as any;

  it('should resolve default bucket for normal paths', () => {
    const resolver = new BucketResolver(defaultBucket);
    const result = resolver.resolve('post.md');
    expect(result.bucket).toBe(defaultBucket);
    expect(result.namespace).toBe('default');
  });

  it('should resolve system bucket for __sys_ paths', () => {
    const resolver = new BucketResolver(defaultBucket, sysBucket);
    const result = resolver.resolve('__sys_/layout.html');
    expect(result.bucket).toBe(sysBucket);
    expect(result.namespace).toBe('system');
  });

  it('should resolve shard bucket when shardConfig is provided', () => {
    const resolver = new BucketResolver(defaultBucket, undefined, '__sys_', {
      shards: [shard1, shard2],
      vnodesPerShard: 64,
    });
    const result = resolver.resolve('some/path.md');
    expect([shard1, shard2]).toContain(result.bucket);
    expect(result.namespace).toMatch(/^shard-\d+$/);
  });

  it('should consistently resolve same path to same shard', () => {
    const resolver = new BucketResolver(defaultBucket, undefined, '__sys_', {
      shards: [shard1, shard2],
      vnodesPerShard: 64,
    });
    const r1 = resolver.resolve('consistent/path.md');
    const r2 = resolver.resolve('consistent/path.md');
    expect(r1.bucket).toBe(r2.bucket);
    expect(r1.namespace).toBe(r2.namespace);
  });
});
