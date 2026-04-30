import { describe, it, expect, vi } from 'vitest';
import { ContentCache } from '../src/cache';
import {
  CacheChain,
  InMemoryCacheStrategy,
} from '../src/cache-strategy';

describe('CacheChain', () => {
  it('should return first hit from strategies', async () => {
    const s1: any = { name: 's1', get: vi.fn().mockResolvedValue(null), set: vi.fn(), delete: vi.fn() };
    const s2: any = { name: 's2', get: vi.fn().mockResolvedValue({ data: 'from-s2', stale: false }), set: vi.fn(), delete: vi.fn() };
    const s3: any = { name: 's3', get: vi.fn().mockResolvedValue({ data: 'from-s3', stale: false }), set: vi.fn(), delete: vi.fn() };

    const chain = new CacheChain([s1, s2, s3]);
    const result = await chain.get('key');

    expect(result).toBe('from-s2');
    expect(s2.get).toHaveBeenCalled();
    expect(s3.get).not.toHaveBeenCalled();
  });

  it('should return null if all strategies miss', async () => {
    const s1: any = { name: 's1', get: vi.fn().mockResolvedValue(null), set: vi.fn(), delete: vi.fn() };
    const s2: any = { name: 's2', get: vi.fn().mockResolvedValue(null), set: vi.fn(), delete: vi.fn() };

    const chain = new CacheChain([s1, s2]);
    const result = await chain.get('key');

    expect(result).toBeNull();
  });

  it('should write to all strategies on set', async () => {
    const s1: any = { name: 's1', get: vi.fn(), set: vi.fn().mockResolvedValue(undefined), delete: vi.fn() };
    const s2: any = { name: 's2', get: vi.fn(), set: vi.fn().mockResolvedValue(undefined), delete: vi.fn() };

    const chain = new CacheChain([s1, s2]);
    await chain.set('key', 'value');

    expect(s1.set).toHaveBeenCalledWith('key', 'value');
    expect(s2.set).toHaveBeenCalledWith('key', 'value');
  });

  it('should delete from all strategies', async () => {
    const s1: any = { name: 's1', get: vi.fn(), set: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) };
    const s2: any = { name: 's2', get: vi.fn(), set: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) };

    const chain = new CacheChain([s1, s2]);
    await chain.delete('key');

    expect(s1.delete).toHaveBeenCalledWith('key');
    expect(s2.delete).toHaveBeenCalledWith('key');
  });
});

describe('InMemoryCacheStrategy', () => {
  it('should wrap ContentCache get/set/delete', async () => {
    const cache = new ContentCache(60000, true);
    const strategy = new InMemoryCacheStrategy(cache);

    await strategy.set('key', 'value');
    const result = await strategy.get('key');
    expect(result).toEqual({ data: 'value', stale: false });

    await strategy.delete('key');
    expect(await strategy.get('key')).toBeNull();
  });
});
