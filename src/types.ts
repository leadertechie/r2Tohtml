export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: string | ReadableStream<Uint8Array>): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; delimiter?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  httpMetadata?: Record<string, unknown>;
  customMetadata?: Record<string, unknown>;
  writeHttpMetadata(headers: Headers): void;
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
  json<T>(): Promise<T>;
}

export interface R2ListResult {
  objects: R2ListObject[];
  truncated: boolean;
  cursor?: string;
}

export interface R2ListObject {
  key: string;
  size: number;
  httpMetadata?: Record<string, unknown>;
  customMetadata?: Record<string, unknown>;
}

export interface R2LoaderConfig {
  /** Optional telemetry logger */
  logger?: import("@leadertechie/telemetry").LoggerInterface;
  bucket: R2Bucket;
  prefix?: string;
  cacheTTL?: number;
  cacheEnabled?: boolean;
}

export interface ShardConfig {
  shards: R2Bucket[];
  vnodesPerShard: number;
  systemBucket?: R2Bucket;
}

export interface R2LoaderConfigV2 extends R2LoaderConfig {
  cfCache?: boolean;
  cfCacheTTL?: number;
  swrTTL?: number;
  systemBucket?: R2Bucket;
  systemPrefix?: string;
  shardConfig?: ShardConfig;
}

export interface ContentMetadata {
  [key: string]: string | string[] | undefined;
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  author?: string;
}

export interface ParsedContent {
  metadata: ContentMetadata;
  content: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface SWRCacheEntry<T> {
  data: T;
  timestamp: number;
  staleTimestamp: number;
}

/**
 * Logger — injectable logger interface.
 * In CF Workers, use `console` or a structured logger (e.g., from `@cloudflare/workers-types`).
 * Not needed in Worker runtime (console exists), but useful for testability.
 */
export type { LoggerInterface as Logger } from "@leadertechie/telemetry";
