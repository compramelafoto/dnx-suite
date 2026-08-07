function envTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Procesamiento automático vía cron (default off). */
export function isPartnerBenefitAutoSyncEnabled(): boolean {
  return envTruthy(process.env.DNX_PARTNER_BENEFIT_AUTO_SYNC_ENABLED);
}

/** Escrituras reales de materialización (default off). Sin esto → shadow. */
export function isPartnerBenefitAutoSyncWritesEnabled(): boolean {
  return envTruthy(process.env.DNX_PARTNER_BENEFIT_AUTO_SYNC_WRITES_ENABLED);
}

export function getPartnerBenefitAutoSyncMaxAttempts(): number {
  const n = Number.parseInt(
    process.env.DNX_PARTNER_BENEFIT_AUTO_SYNC_MAX_ATTEMPTS ?? "5",
    10,
  );
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 20) : 5;
}

export type AutoSyncProcessMode = "disabled" | "shadow" | "apply";

export function resolveAutoSyncProcessMode(): AutoSyncProcessMode {
  if (!isPartnerBenefitAutoSyncEnabled()) return "disabled";
  if (!isPartnerBenefitAutoSyncWritesEnabled()) return "shadow";
  return "apply";
}
