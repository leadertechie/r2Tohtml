/**
 * Cloudflare Workers ExecutionContext type declaration.
 *
 * In non-Worker environments (tests, Node.js), these calls gracefully no-op.
 */

declare var ExecutionContext: {
  new (): ExecutionContext;
};

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
