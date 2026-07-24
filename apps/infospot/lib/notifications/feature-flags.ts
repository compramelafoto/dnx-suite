/**
 * Gates server-side del Notifications Engine (kill switch).
 *
 * Producción real (`VERCEL_ENV=production`, o sin Vercel con `NODE_ENV=production`):
 *   OFF por defecto — requiere `DNX_NOTIFICATIONS_ENABLED=1`.
 *
 * Local / Preview / test:
 *   ON por defecto — se puede forzar OFF con `DNX_NOTIFICATIONS_ENABLED=0`.
 *
 * Subflags (si el master está OFF, todo queda OFF):
 *   DNX_NOTIFICATIONS_CAMPAIGNS_ENABLED
 *   DNX_NOTIFICATIONS_CRON_ENABLED
 *   DNX_NOTIFICATIONS_EMAIL_ENABLED
 *
 * Valores: "1" / "true" → on; "0" / "false" → off; ausente → default según entorno.
 */

export type NotificationsFlagEnv = {
  nodeEnv?: string | null;
  vercelEnv?: string | null;
  enabled?: string | null;
  campaigns?: string | null;
  cron?: string | null;
  email?: string | null;
};

function readEnv(): NotificationsFlagEnv {
  /* eslint-disable turbo/no-undeclared-env-vars -- flags release notificaciones */
  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    enabled: process.env.DNX_NOTIFICATIONS_ENABLED,
    campaigns: process.env.DNX_NOTIFICATIONS_CAMPAIGNS_ENABLED,
    cron: process.env.DNX_NOTIFICATIONS_CRON_ENABLED,
    email: process.env.DNX_NOTIFICATIONS_EMAIL_ENABLED,
  };
  /* eslint-enable turbo/no-undeclared-env-vars */
}

export function isNotificationsProductionRuntime(env: NotificationsFlagEnv = readEnv()): boolean {
  if (env.vercelEnv != null && env.vercelEnv !== "") {
    return env.vercelEnv === "production";
  }
  return (env.nodeEnv ?? "") === "production";
}

function parseTriState(
  raw: string | null | undefined,
  defaultOn: boolean,
): boolean {
  if (raw == null || raw.trim() === "") return defaultOn;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return defaultOn;
}

/** Master kill switch. */
export function isNotificationsEngineEnabled(
  env: NotificationsFlagEnv = readEnv(),
): boolean {
  const defaultOn = !isNotificationsProductionRuntime(env);
  return parseTriState(env.enabled, defaultOn);
}

export function isNotificationCampaignsEnabled(
  env: NotificationsFlagEnv = readEnv(),
): boolean {
  if (!isNotificationsEngineEnabled(env)) return false;
  const defaultOn = !isNotificationsProductionRuntime(env);
  return parseTriState(env.campaigns, defaultOn);
}

export function isNotificationCronEnabled(
  env: NotificationsFlagEnv = readEnv(),
): boolean {
  if (!isNotificationsEngineEnabled(env)) return false;
  const defaultOn = !isNotificationsProductionRuntime(env);
  return parseTriState(env.cron, defaultOn);
}

export function isNotificationEmailChannelEnabled(
  env: NotificationsFlagEnv = readEnv(),
): boolean {
  if (!isNotificationsEngineEnabled(env)) return false;
  const defaultOn = !isNotificationsProductionRuntime(env);
  return parseTriState(env.email, defaultOn);
}

export type NotificationsFlagsSnapshot = {
  productionRuntime: boolean;
  engine: boolean;
  campaigns: boolean;
  cron: boolean;
  email: boolean;
};

export function getNotificationsFlagsSnapshot(
  env: NotificationsFlagEnv = readEnv(),
): NotificationsFlagsSnapshot {
  return {
    productionRuntime: isNotificationsProductionRuntime(env),
    engine: isNotificationsEngineEnabled(env),
    campaigns: isNotificationCampaignsEnabled(env),
    cron: isNotificationCronEnabled(env),
    email: isNotificationEmailChannelEnabled(env),
  };
}
