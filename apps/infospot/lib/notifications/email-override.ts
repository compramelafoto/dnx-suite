/**
 * Destinatario EMAIL de notificaciones — override QA solo fuera de producción real.
 *
 * En Vercel, `NODE_ENV` es `production` también en Preview; usar `VERCEL_ENV`
 * cuando exista. Producción real (`VERCEL_ENV=production` o, sin Vercel,
 * `NODE_ENV=production`) ignora siempre el override (fail-safe).
 */

export type ResolveNotificationEmailToInput = {
  recipientEmail: string;
  nodeEnv?: string | null;
  /** `production` | `preview` | `development` (Vercel). */
  vercelEnv?: string | null;
  override?: string | null;
};

export type ResolveNotificationEmailToResult = {
  to: string;
  overridden: boolean;
  ignoredOverrideInProduction: boolean;
};

export function isNotificationsProductionRuntime(input?: {
  nodeEnv?: string | null;
  vercelEnv?: string | null;
}): boolean {
  const vercelEnv =
    input?.vercelEnv ?? process.env.VERCEL_ENV ?? null;
  if (vercelEnv != null && vercelEnv !== "") {
    return vercelEnv === "production";
  }
  const nodeEnv = input?.nodeEnv ?? process.env.NODE_ENV ?? "";
  return nodeEnv === "production";
}

export function resolveNotificationEmailTo(
  input: ResolveNotificationEmailToInput,
): ResolveNotificationEmailToResult {
  const override = (input.override ?? process.env.DNX_NOTIFICATIONS_EMAIL_OVERRIDE)?.trim();
  const recipient = input.recipientEmail.trim();
  const inProduction = isNotificationsProductionRuntime({
    nodeEnv: input.nodeEnv,
    vercelEnv: input.vercelEnv,
  });

  if (inProduction) {
    return {
      to: recipient,
      overridden: false,
      ignoredOverrideInProduction: Boolean(override),
    };
  }

  if (override && override.includes("@")) {
    return {
      to: override,
      overridden: true,
      ignoredOverrideInProduction: false,
    };
  }

  return {
    to: recipient,
    overridden: false,
    ignoredOverrideInProduction: false,
  };
}
