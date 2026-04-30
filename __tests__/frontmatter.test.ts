import { describe, it, expect } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from '../src/frontmatter';

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
