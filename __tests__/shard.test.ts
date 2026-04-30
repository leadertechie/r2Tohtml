import { describe, it, expect, vi } from 'vitest';
import { fnv1a, resolveIdentity, resolveBucket, getShardCachePrefix } from '../src/shard';

describe('fnv1a', () => {
  it('should produce consistent hash for same input', () => {
    expect(fnv1a('hello')).toBe(fnv1a('hello'));
  });

  it('should produce different hashes for different inputs', () => {
    expect(fnv1a('hello')).not.toBe(fnv1a('world'));
  });

  it('should return a 32-bit unsigned integer', () => {
    const hash = fnv1a('test-path');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('resolveIdentity', () => {
  it('should return a value within total vnodes range', () => {
    const vnode = resolveIdentity('some/path.md', 256);
    expect(vnode).toBeGreaterThanOrEqual(0);
    expect(vnode).toBeLessThan(256);
  });

  it('should be consistent for same path', () => {
    expect(resolveIdentity('same/path', 100)).toBe(resolveIdentity('same/path', 100));
  });
});

describe('resolveBucket', () => {
  const mockBucket1 = { get: vi.fn() } as any;
  const mockBucket2 = { get: vi.fn() } as any;
  const mockSystemBucket = { get: vi.fn() } as any;

  const shardConfig = {
    shards: [mockBucket1, mockBucket2],
    vnodesPerShard: 64,
    systemBucket: mockSystemBucket,
  };

  it('should return null if no shardConfig', () => {
    expect(resolveBucket('any/path')).toBeNull();
  });

  it('should route system paths to system bucket', () => {
    const bucket = resolveBucket('__sys_/layout.html', shardConfig);
    expect(bucket).toBe(mockSystemBucket);
  });

  it('should route non-system paths to a shard', () => {
    const bucket = resolveBucket('user-content/post.md', shardConfig);
    expect(bucket).toBeDefined();
    expect([mockBucket1, mockBucket2]).toContain(bucket);
  });

  it('should consistently route same path to same shard', () => {
    const bucket1 = resolveBucket('consistent/path.md', shardConfig);
    const bucket2 = resolveBucket('consistent/path.md', shardConfig);
    expect(bucket1).toBe(bucket2);
  });
});

describe('getShardCachePrefix', () => {
  it('should return empty string for undefined shard', () => {
    expect(getShardCachePrefix()).toBe('');
  });

  it('should return shard prefix for given index', () => {
    expect(getShardCachePrefix(0)).toBe('shard-0:');
    expect(getShardCachePrefix(3)).toBe('shard-3:');
  });
});
