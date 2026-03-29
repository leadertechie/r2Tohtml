import { MarkdownPipeline } from "@leadertechie/md2html";
class ContentCache {
  constructor(ttl = 5 * 60 * 1e3, enabled = true) {
    this.cache = /* @__PURE__ */ new Map();
    this.ttl = ttl;
    this.enabled = enabled;
  }
  get(key) {
    if (!this.enabled) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
  set(key, data) {
    if (!this.enabled) return;
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
function parseFrontmatter(content) {
  var _a, _b;
  const lines = content.split("\n");
  const metadata = {};
  let contentStart = 0;
  if (((_a = lines[0]) == null ? void 0 : _a.trim()) === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (((_b = lines[i]) == null ? void 0 : _b.trim()) === "---") {
        contentStart = i + 1;
        break;
      }
      const colonIdx = lines[i].indexOf(":");
      if (colonIdx > 0) {
        const key = lines[i].slice(0, colonIdx).trim();
        let value = lines[i].slice(colonIdx + 1).trim();
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value.slice(1, -1);
          metadata[key] = value.split(",").map((v) => v.trim());
        } else {
          metadata[key] = value;
        }
      }
    }
  }
  return {
    metadata,
    content: lines.slice(contentStart).join("\n").trim()
  };
}
function stringifyFrontmatter(metadata) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(", ")}]`);
    } else if (value !== void 0) {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
class R2ContentLoader {
  constructor(config, options) {
    this.bucket = config.bucket;
    this.prefix = config.prefix || "";
    this.cache = new ContentCache(
      config.cacheTTL || 5 * 60 * 1e3,
      config.cacheEnabled !== false
    );
    this.pipeline = new MarkdownPipeline(options == null ? void 0 : options.md2html);
  }
  getKey(path) {
    return this.prefix ? `${this.prefix}${path}` : path;
  }
  async get(path) {
    const cacheKey = this.getKey(path);
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const obj = await this.bucket.get(cacheKey);
    if (!obj) {
      return null;
    }
    const content = await obj.text();
    this.cache.set(cacheKey, content);
    return content;
  }
  async getObject(path) {
    const obj = await this.bucket.get(this.getKey(path));
    return obj;
  }
  async getWithMetadata(path) {
    const cacheKey = `meta:${this.getKey(path)}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const content = await this.get(path);
    if (!content) {
      return null;
    }
    const { metadata, content: body } = parseFrontmatter(content);
    const result = { metadata, content: body };
    this.cache.set(cacheKey, result);
    return result;
  }
  async getWithAST(path) {
    const cacheKey = `ast:${this.getKey(path)}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const withMetadata = await this.getWithMetadata(path);
    if (!withMetadata) {
      return null;
    }
    const contentNodes = this.pipeline.parse(withMetadata.content);
    const result = {
      metadata: withMetadata.metadata,
      contentNodes
    };
    this.cache.set(cacheKey, result);
    return result;
  }
  async getRendered(path) {
    const cacheKey = `rendered:${this.getKey(path)}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const withMetadata = await this.getWithMetadata(path);
    if (!withMetadata) {
      return null;
    }
    const html = this.pipeline.renderMarkdown(withMetadata.content);
    const result = {
      metadata: withMetadata.metadata,
      content: html
    };
    this.cache.set(cacheKey, result);
    return result;
  }
  async list(prefix = "") {
    const fullPrefix = this.prefix ? `${this.prefix}${prefix}` : prefix;
    return this.bucket.list({ prefix: fullPrefix });
  }
  async exists(path) {
    const obj = await this.getObject(path);
    return obj !== null;
  }
  invalidate(path) {
    const key = this.getKey(path);
    this.cache.delete(key);
    this.cache.delete(`obj:${key}`);
    this.cache.delete(`meta:${key}`);
    this.cache.delete(`ast:${key}`);
    this.cache.delete(`rendered:${key}`);
  }
  invalidatePrefix(prefix) {
    const fullPrefix = this.getKey(prefix);
    this.cache.clearPrefix(fullPrefix);
  }
  clearCache() {
    this.cache.clear();
  }
  setCacheTTL(ttl) {
    this.cache.setTTL(ttl);
  }
  disableCache() {
    this.cache.setEnabled(false);
  }
  enableCache() {
    this.cache.setEnabled(true);
  }
}
export {
  ContentCache,
  R2ContentLoader,
  parseFrontmatter,
  stringifyFrontmatter
};
//# sourceMappingURL=index.js.map
