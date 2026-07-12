import type { Env } from "../config/index.js";

export type LogLevel = Env["LOG_LEVEL"];

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string): void {
    if (shouldLog("debug")) {
      console.error(formatMessage("debug", message));
    }
  },

  info(message: string): void {
    if (shouldLog("info")) {
      console.error(formatMessage("info", message));
    }
  },

  warn(message: string): void {
    if (shouldLog("warn")) {
      console.error(formatMessage("warn", message));
    }
  },

  error(message: string, error?: unknown): void {
    if (shouldLog("error")) {
      const detail = error instanceof Error ? ` — ${error.message}` : "";
      console.error(formatMessage("error", `${message}${detail}`));
    }
  },
};
