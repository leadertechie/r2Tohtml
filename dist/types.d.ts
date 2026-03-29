export interface R2Bucket {
    get(key: string): Promise<R2Object | null>;
    put(key: string, value: string | ReadableStream<Uint8Array>): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: {
        prefix?: string;
        delimiter?: string;
        limit?: number;
        cursor?: string;
    }): Promise<R2ListResult>;
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
    bucket: R2Bucket;
    prefix?: string;
    cacheTTL?: number;
    cacheEnabled?: boolean;
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
//# sourceMappingURL=types.d.ts.map