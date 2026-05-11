/**
 * Shared internal telemetry helper — used by every @leadertechie package.
 *
 * Each package gets a lazy console logger (WARN+ERROR only).
 * Consumers can optionally pass their own LoggerInterface for
 * production telemetry (fetchAdapter → toldby-telemetry-worker).
 *
 * Usage inside a package:
 *   import { getDefaultLogger } from "./telemetry-init.js";
 *   const log = opts?.logger ?? getDefaultLogger("md2html");
 */

import {
  LoggerProvider,
  consoleAdapter,
  LogLevel,
  LoggerInterface,
} from "@leadertechie/telemetry";

const defaultLoggers = new Map<string, LoggerInterface>();

export function getDefaultLogger(serviceName: string): LoggerInterface {
  let log = defaultLoggers.get(serviceName);
  if (!log) {
    const provider = new LoggerProvider({ serviceName });
    // Dev/standalone: console, WARN+ only — silent unless something's wrong
    provider.addAdapter(consoleAdapter({ level: LogLevel.WARN }));
    log = provider.getLogger();
    defaultLoggers.set(serviceName, log);
  }
  return log;
}

export type { LoggerInterface } from "@leadertechie/telemetry";
