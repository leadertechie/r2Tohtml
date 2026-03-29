export class ContentCache {
    constructor(ttl = 5 * 60 * 1000, enabled = true) {
        this.cache = new Map();
        this.ttl = ttl;
        this.enabled = enabled;
    }
    get(key) {
        if (!this.enabled)
            return null;
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    set(key, data) {
        if (!this.enabled)
            return;
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    delete(key) {
        this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    clearPrefix(prefix) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }
    setTTL(ttl) {
        this.ttl = ttl;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
