import { describe, it, expect, vi } from 'vitest';
import { ContentCache } from '../src/cache';
import { CacheRegistry } from '../src/cache-registry';
import { ContentProcessor } from '../src/content-processor';

describe('ContentProcessor', () => {
  it('should transform and cache content', async () => {
    const cache = new ContentCache(60000, true);
    const registry = new CacheRegistry(cache);
    const fetcher = vi.fn().mockResolvedValue('hello world');

    const processor = new ContentProcessor(
      fetcher, cache, registry, 'upper',
      (raw: string) => raw.toUpperCase(),
    );

    const result = await processor.get('greeting');
    expect(result).toBe('HELLO WORLD');
    expect(fetcher).toHaveBeenCalledTimes(1);

    const cached = await processor.get('greeting');
    expect(cached).toBe('HELLO WORLD');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should return null when fetcher returns null', async () => {
    const cache = new ContentCache(60000, true);
    const registry = new CacheRegistry(cache);
    const fetcher = vi.fn().mockResolvedValue(null);

    const processor = new ContentProcessor(
      fetcher, cache, registry, 'test',
      (raw: string) => raw,
    );

    const result = await processor.get('missing');
    expect(result).toBeNull();
  });

  it('should register prefix with CacheRegistry', async () => {
    const cache = new ContentCache(60000, true);
    const registry = new CacheRegistry(cache);
    const fetcher = vi.fn().mockResolvedValue('data');

    const processor = new ContentProcessor(
      fetcher, cache, registry, 'custom:',
      (raw: string) => raw,
    );

    await processor.get('path');

    cache.set('custom:path', 'should-be-deleted');
    registry.invalidate('path');
    expect(cache.get('custom:path')).toBeNull();
  });
});
