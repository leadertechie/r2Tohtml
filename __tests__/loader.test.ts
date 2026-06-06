import { describe, it, expect, vi } from 'vitest';

// Mock @leadertechie/md2html before importing loader.
// jsdom is now a peer dependency of md2html — the mock keeps tests isolated.
vi.mock('@leadertechie/md2html', () => {
  class MarkdownPipeline {
    parse = vi.fn((content: string) => [
      {
        type: 'heading',
        depth: 1,
        children: [{ type: 'text', value: 'Mocked' }],
      },
    ]);
    renderMarkdown = vi.fn((content: string) => `<h1>${content}</h1>`);
  }
  return { MarkdownPipeline };
});

import { R2ContentLoader } from '../src/loader';

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
        objects: Object.keys(data).map((key) => ({ key })),
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
      const loader = new R2ContentLoader({
        bucket: mockBucket as any,
        cacheTTL: 60000,
      });

      await loader.get('test.md');
      await loader.get('test.md');

      expect(mockBucket.get).toHaveBeenCalledTimes(1);
    });

    it('should respect prefix', async () => {
      const mockBucket = createMockBucket({ 'content/test.md': 'hello' });
      const loader = new R2ContentLoader({
        bucket: mockBucket as any,
        prefix: 'content/',
      });

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

  describe('getWithAST', () => {
    it('should fetch and return AST nodes', async () => {
      const content = `---
title: AST Post
---
# Heading`;
      const mockBucket = createMockBucket({ 'ast-post.md': content });
      const loader = new R2ContentLoader({ bucket: mockBucket as any });

      const result = await loader.getWithAST('ast-post.md');

      expect(result).not.toBeNull();
      expect(result!.metadata.title).toBe('AST Post');
      expect(result!.contentNodes).toBeDefined();
      expect(Array.isArray(result!.contentNodes)).toBe(true);
    });
  });

  describe('getRendered', () => {
    it('should fetch and render markdown to HTML', async () => {
      const content = `---
title: Rendered Post
---
# Hello`;
      const mockBucket = createMockBucket({ 'rendered-post.md': content });
      const loader = new R2ContentLoader({ bucket: mockBucket as any });

      const result = await loader.getRendered('rendered-post.md');

      expect(result).not.toBeNull();
      expect(result!.metadata.title).toBe('Rendered Post');
      expect(result!.content).toContain('<h1>');
    });
  });

  describe('list', () => {
    it('should list files with prefix', async () => {
      const mockBucket = {
        get: vi.fn(),
        list: vi.fn(async (options: { prefix?: string }) => {
          const prefix = options?.prefix || '';
          const allKeys = [
            'blogs/post1.md',
            'blogs/post2.md',
            'stories/post1.md',
          ];
          const filtered = prefix
            ? allKeys.filter((k) => k.startsWith(prefix))
            : allKeys;
          return {
            objects: filtered.map((key) => ({ key })),
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
      const loader = new R2ContentLoader({
        bucket: mockBucket as any,
        cacheTTL: 60000,
      });

      await loader.get('test.md');
      loader.invalidate('test.md');
      await loader.get('test.md');

      expect(mockBucket.get).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      const mockBucket = createMockBucket({ 'a.md': 'a', 'b.md': 'b' });
      const loader = new R2ContentLoader({
        bucket: mockBucket as any,
        cacheTTL: 60000,
      });

      await loader.get('a.md');
      await loader.get('b.md');
      loader.clearCache();
      await loader.get('a.md');

      expect(mockBucket.get).toHaveBeenCalledTimes(3);
    });
  });

  // ─── v2: System Bucket ─────────────────────────────────────────────────────

  describe('v2 system bucket', () => {
    it('should route __sys_ paths to system bucket', async () => {
      const userBucket = createMockBucket({});
      const sysBucket = createMockBucket({ '__sys_/layout.html': '<html>' });

      const loader = new R2ContentLoader({
        bucket: userBucket as any,
        systemBucket: sysBucket as any,
      } as any);

      const result = await loader.get('__sys_/layout.html');

      expect(result).toBe('<html>');
      expect(userBucket.get).not.toHaveBeenCalled();
    });

    it('should route non-system paths to user bucket', async () => {
      const userBucket = createMockBucket({ 'post.md': '# Hello' });
      const sysBucket = createMockBucket({});

      const loader = new R2ContentLoader({
        bucket: userBucket as any,
        systemBucket: sysBucket as any,
      } as any);

      const result = await loader.get('post.md');

      expect(result).toBe('# Hello');
      expect(sysBucket.get).not.toHaveBeenCalled();
    });
  });

  // ─── v2: Shard Config ──────────────────────────────────────────────────────

  describe('v2 shard config', () => {
    it('should route paths to shards consistently', async () => {
      const shard1 = createMockBucket({});
      const shard2 = createMockBucket({});

      const loader = new R2ContentLoader({
        bucket: shard1 as any,
        shardConfig: {
          shards: [shard1, shard2],
          vnodesPerShard: 64,
        },
      } as any);

      await loader.get('some/path.md');
      await loader.get('some/path.md');

      const shard1Calls = shard1.get.mock.calls.length;
      const shard2Calls = shard2.get.mock.calls.length;
      expect(shard1Calls + shard2Calls).toBe(2);
      expect(shard1Calls === 2 || shard2Calls === 2).toBe(true);
    });
  });
});
