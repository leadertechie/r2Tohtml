import { describe, it, expect, beforeEach } from 'vitest';
import { ContentCache, ContentCacheV2 } from '../src/cache';

// ─── ContentCache (v1) ───────────────────────────────────────────────────────

describe('ContentCache', () => {
  let cache: ContentCache;

  beforeEach(() => {
    cache = new ContentCache(1000, true);
  });

  describe('get/set', () => {
    it('should store and retrieve data', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for missing key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing value', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('expiration', () => {
    it('should expire data after TTL', async () => {
      const shortCache = new ContentCache(50, true);
      shortCache.set('key1', 'value1');
      expect(shortCache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 60));
      expect(shortCache.get('key1')).toBeNull();
    });

    it('should not cache if disabled', async () => {
      const shortCache = new ContentCache(50, false);
      shortCache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 60));
      expect(shortCache.get('key1')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete specific key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.delete('key1');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('clearPrefix', () => {
    it('should clear keys with prefix', () => {
      cache.set('blogs/post1', 'value1');
      cache.set('blogs/post2', 'value2');
      cache.set('stories/post1', 'value3');

      cache.clearPrefix('blogs/');

      expect(cache.get('blogs/post1')).toBeNull();
      expect(cache.get('blogs/post2')).toBeNull();
      expect(cache.get('stories/post1')).toBe('value3');
    });
  });

  describe('setTTL', () => {
    it('should update TTL', () => {
      cache.setTTL(5000);
      expect(() => cache.setTTL(5000)).not.toThrow();
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable cache', () => {
      cache.setEnabled(false);
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBeNull();

      cache.setEnabled(true);
      cache.set('key2', 'value2');
      expect(cache.get('key2')).toBe('value2');
    });
  });
});

// ─── ContentCacheV2 (SWR) ────────────────────────────────────────────────────

describe('ContentCacheV2', () => {
  describe('SWR mode', () => {
    it('should return fresh data within TTL', () => {
      const cache = new ContentCacheV2(1000, true, 2000);
      cache.set('key1', 'value1');

      const result = cache.get<string>('key1');
      expect(result).not.toBeNull();
      expect(result!.data).toBe('value1');
      expect(result!.stale).toBe(false);
    });

    it('should return stale data within SWR window', async () => {
      const cache = new ContentCacheV2(50, true, 2000);
      cache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 60));

      const result = cache.get<string>('key1');
      expect(result).not.toBeNull();
      expect(result!.data).toBe('value1');
      expect(result!.stale).toBe(true);
    });

    it('should return null after SWR window expires', async () => {
      const cache = new ContentCacheV2(20, true, 30);
      cache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      const result = cache.get<string>('key1');
      expect(result).toBeNull();
    });

    it('should return null when disabled', () => {
      const cache = new ContentCacheV2(1000, false, 2000);
      cache.set('key1', 'value1');

      const result = cache.get<string>('key1');
      expect(result).toBeNull();
    });

    it('should refresh entry timestamp', () => {
      const cache = new ContentCacheV2(1000, true, 2000);
      cache.set('key1', 'value1');

      cache.refresh('key1');

      const result = cache.get<string>('key1');
      expect(result).not.toBeNull();
      expect(result!.data).toBe('value1');
      expect(result!.stale).toBe(false);
    });

    it('should return null for missing key', () => {
      const cache = new ContentCacheV2(1000, true, 2000);
      expect(cache.get('nonexistent')).toBeNull();
    });
  });
});
