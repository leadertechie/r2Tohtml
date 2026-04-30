import { describe, it, expect } from 'vitest';
import { buildCFCacheKey } from '../src/cf-cache';

describe('buildCFCacheKey', () => {
  it('should build key with bucket name and path', () => {
    expect(buildCFCacheKey('my-bucket', 'path/to/file.md'))
      .toBe('my-bucket:path/to/file.md');
  });
});
