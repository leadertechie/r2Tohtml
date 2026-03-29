export interface CacheEntry<T> {
    data: T;
    timestamp: number;
}
export declare class ContentCache {
    private cache;
    private ttl;
    private enabled;
    constructor(ttl?: number, enabled?: boolean);
    get<T>(key: string): T | null;
    set<T>(key: string, data: T): void;
    delete(key: string): void;
    clear(): void;
    clearPrefix(prefix: string): void;
    setTTL(ttl: number): void;
    setEnabled(enabled: boolean): void;
}
//# sourceMappingURL=cache.d.ts.map