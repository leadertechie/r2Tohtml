import { R2LoaderConfig, R2Object, R2ListResult, ContentMetadata, ParsedContent } from './types';
import type { ContentNode, PipelineConfig } from '@leadertechie/md2html';
export interface RenderedContent {
    metadata: ContentMetadata;
    content: string;
}
export interface ASTContent {
    metadata: ContentMetadata;
    contentNodes: ContentNode[];
}
export interface R2LoaderOptions {
    md2html?: PipelineConfig;
}
export declare class R2ContentLoader {
    private bucket;
    private prefix;
    private cache;
    private pipeline;
    constructor(config: R2LoaderConfig, options?: R2LoaderOptions);
    private getKey;
    get(path: string): Promise<string | null>;
    getObject(path: string): Promise<R2Object | null>;
    getWithMetadata(path: string): Promise<ParsedContent | null>;
    getWithAST(path: string): Promise<ASTContent | null>;
    getRendered(path: string): Promise<RenderedContent | null>;
    list(prefix?: string): Promise<R2ListResult>;
    exists(path: string): Promise<boolean>;
    invalidate(path: string): void;
    invalidatePrefix(prefix: string): void;
    clearCache(): void;
    setCacheTTL(ttl: number): void;
    disableCache(): void;
    enableCache(): void;
}
//# sourceMappingURL=loader.d.ts.map