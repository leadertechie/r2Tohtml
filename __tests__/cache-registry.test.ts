import { describe, it, expect, beforeEach } from 'vitest';
import { ContentCache } from '../src/cache';
import { CacheRegistry } from '../src/cache-registry';

describe('CacheRegistry', () => {
  let cache: ContentCache;
  let registry: CacheRegistry;

  beforeEach(() => {
    cache = new ContentCache(60000, true);
    registry = new CacheRegistry(cache);
  });

  it('should register and invalidate prefixes', () => {
    registry.register('meta:');
    registry.register('ast:');

    cache.set('post.md', 'raw');
    cache.set('meta:post.md', 'meta');
    cache.set('ast:post.md', 'ast');

    registry.invalidate('post.md');

    expect(cache.get('post.md')).toBeNull();
    expect(cache.get('meta:post.md')).toBeNull();
    expect(cache.get('ast:post.md')).toBeNull();
  });

  it('should not invalidate unregistered prefixes', () => {
    registry.register('meta:');

    cache.set('post.md', 'raw');
    cache.set('meta:post.md', 'meta');
    cache.set('rendered:post.md', 'rendered');

    registry.invalidate('post.md');

    expect(cache.get('post.md')).toBeNull();
    expect(cache.get('meta:post.md')).toBeNull();
    expect(cache.get('rendered:post.md')).toBe('rendered');
  });

  it('should clear all data', () => {
    cache.set('key1', 'val1');
    cache.set('key2', 'val2');

    registry.clear();

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});
