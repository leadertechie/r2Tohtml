export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class ContentCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private ttl: number;
  private enabled: boolean;

  constructor(ttl: number = 5 * 60 * 1000, enabled: boolean = true) {
    this.cache = new Map();
    this.ttl = ttl;
    this.enabled = enabled;
  }

  get<T>(key: string): T | null {
    if (!this.enabled) return null;
    
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set<T>(key: string, data: T): void {
    if (!this.enabled) return;
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
