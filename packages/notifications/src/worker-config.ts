/** Configuración centralizada del worker de outbox. */

export const NOTIFICATION_WORKER_DEFAULTS = {
  batchSize: 25,
  maxAttempts: 5,
  /** Lease de lock (ms). */
  lockTimeoutMs: 60_000,
  baseRetryDelayMs: 30_000,
  maxRetryDelayMs: 30 * 60 * 1000,
} as const;

export type NotificationWorkerConfig = {
  batchSize: number;
  maxAttempts: number;
  lockTimeoutMs: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  workerId: string;
};

export function resolveWorkerConfig(
  partial: Partial<NotificationWorkerConfig> = {},
): NotificationWorkerConfig {
  return {
    batchSize: partial.batchSize ?? NOTIFICATION_WORKER_DEFAULTS.batchSize,
    maxAttempts: partial.maxAttempts ?? NOTIFICATION_WORKER_DEFAULTS.maxAttempts,
    lockTimeoutMs:
      partial.lockTimeoutMs ?? NOTIFICATION_WORKER_DEFAULTS.lockTimeoutMs,
    baseRetryDelayMs:
      partial.baseRetryDelayMs ?? NOTIFICATION_WORKER_DEFAULTS.baseRetryDelayMs,
    maxRetryDelayMs:
      partial.maxRetryDelayMs ?? NOTIFICATION_WORKER_DEFAULTS.maxRetryDelayMs,
    workerId:
      partial.workerId ??
      `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  };
}
