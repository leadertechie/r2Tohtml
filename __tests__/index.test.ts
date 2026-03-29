import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentCache } from '../src/cache';
import { parseFrontmatter, stringifyFrontmatter } from '../src/frontmatter';
import { R2ContentLoader } from '../src/loader';

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

    it('should not expire if disabled', async () => {
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

describe('parseFrontmatter', () => {
  it('should parse simple frontmatter', () => {
    const input = `---
title: My Post
date: 2024-01-01
---
Content here`;

    const result = parseFrontmatter(input);
    
    expect(result.metadata.title).toBe('My Post');
    expect(result.metadata.date).toBe('2024-01-01');
    expect(result.content).toBe('Content here');
  });

  it('should parse frontmatter with array', () => {
    const input = `---
title: Post
tags: [tag1, tag2, tag3]
---
Content`;

    const result = parseFrontmatter(input);
    
    expect(result.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should return content as-is if no frontmatter', () => {
    const input = 'Just plain content';
    
    const result = parseFrontmatter(input);
    
    expect(result.metadata).toEqual({});
    expect(result.content).toBe('Just plain content');
  });

  it('should handle empty frontmatter', () => {
    const input = `---
---
Content`;

    const result = parseFrontmatter(input);
    
    expect(result.metadata).toEqual({});
    expect(result.content).toBe('Content');
  });

  it('should handle multiple lines of content', () => {
    const input = `---
title: Multi-line
---
Line 1
Line 2
Line 3`;

    const result = parseFrontmatter(input);
    
    expect(result.content).toBe('Line 1\nLine 2\nLine 3');
  });
});

describe('stringifyFrontmatter', () => {
  it('should stringify simple metadata', () => {
    const metadata = { title: 'My Post', date: '2024-01-01' };
    const result = stringifyFrontmatter(metadata);
    
    expect(result).toContain('---');
    expect(result).toContain('title: My Post');
    expect(result).toContain('date: 2024-01-01');
  });

  it('should stringify array values', () => {
    const metadata = { tags: ['tag1', 'tag2'] };
    const result = stringifyFrontmatter(metadata);
    
    expect(result).toContain('[tag1, tag2]');
  });

  it('should omit undefined values', () => {
    const metadata = { title: 'My Post', description: undefined };
    const result = stringifyFrontmatter(metadata);
    
    expect(result).not.toContain('description');
  });
});

describe('R2ContentLoader', () => {
  const createMockBucket = (data: Record<string, string>) => {
    return {
      get: vi.fn(async (key: string) => {
        if (key in data) {
          return {
            key,
            text: async () => data[key],
            json: async () => JSON.parse(data[key]),
          };
        }
        return null;
      }),
      list: vi.fn(async () => ({
        objects: Object.keys(data).map(key => ({ key })),
        truncated: false,
      })),
    };
  };

  describe('get', () => {
    it('should fetch content from R2', async () => {
      const mockBucket = createMockBucket({ 'test.md': '# Hello World' });
      const loader = new R2ContentLoader({ bucket: mockBucket as any });
      
      const result = await loader.get('test.md');
      
      expect(result).toBe('# Hello World');
    });

    it('should return null for missing file', async () => {
      const mockBucket = createMockBucket({});
      const loader = new R2ContentLoader({ bucket: mockBucket as any });
      
      const result = await loader.get('missing.md');
      
      expect(result).toBeNull();
    });

    it('should use cache', async () => {
      const mockBucket = createMockBucket({ 'test.md': 'content' });
      const loader = new R2ContentLoader({ bucket: mockBucket as any, cacheTTL: 60000 });
      
      await loader.get('test.md');
      await loader.get('test.md');
      
      expect(mockBucket.get).toHaveBeenCalledTimes(1);
    });

    it('should respect prefix', async () => {
      const mockBucket = createMockBucket({ 'content/test.md': 'hello' });
      const loader = new R2ContentLoader({ bucket: mockBucket as any, prefix: 'content/' });
      
      const result = await loader.get('test.md');
      
      expect(result).toBe('hello');
    });
  });

  describe('getWithMetadata', () => {
    it('should fetch and parse frontmatter', async () => {
      const content = `---
title: My Post
---
# Content`;
      const mockBucket = createMockBucket({ 'post.md': content });
      const loader = new R2ContentLoader({ bucket: mockBucket as any });
      
      const result = await loader.getWithMetadata('post.md');
      
      expect(result?.metadata.title).toBe('My Post');
      expect(result?.content).toBe('# Content');
    });
  });

  describe('list', () => {
    it('should list files with prefix', async () => {
      const mockBucket = {
        get: vi.fn(),
        list: vi.fn(async (options: { prefix?: string }) => {
          const prefix = options?.prefix || '';
          const allKeys = ['blogs/post1.md', 'blogs/post2.md', 'stories/post1.md'];
          const filtered = prefix 
            ? allKeys.filter(k => k.startsWith(prefix))
            : allKeys;
          return {
            objects: filtered.map(key => ({ key })),
            truncated: false,
          };
        }),
      };
      const loader = new R2ContentLoader({ bucket: mockBucket as any });
      
      const result = await loader.list('blogs/');
      
      expect(result.objects).toHaveLength(2);
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      const mockBucket = createMockBucket({ 'test.md': 'content' });
      const loader = new R2ContentLoader({ bucket: mockBucket as any });
      
      const result = await loader.exists('test.md');
      
      expect(result).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const mockBucket = createMockBucket({});
      const loader = new R2ContentLoader({ bucket: mockBucket as any });
      
      const result = await loader.exists('missing.md');
      
      expect(result).toBe(false);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate specific path', async () => {
      const mockBucket = createMockBucket({ 'test.md': 'content' });
      const loader = new R2ContentLoader({ bucket: mockBucket as any, cacheTTL: 60000 });
      
      await loader.get('test.md');
      loader.invalidate('test.md');
      await loader.get('test.md');
      
      expect(mockBucket.get).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      const mockBucket = createMockBucket({ 'a.md': 'a', 'b.md': 'b' });
      const loader = new R2ContentLoader({ bucket: mockBucket as any, cacheTTL: 60000 });
      
      await loader.get('a.md');
      await loader.get('b.md');
      loader.clearCache();
      await loader.get('a.md');
      
      // 3 calls: a.md (cache miss), b.md (cache miss), a.md again after cache cleared (cache miss)
      expect(mockBucket.get).toHaveBeenCalledTimes(3);
    });
  });
});
