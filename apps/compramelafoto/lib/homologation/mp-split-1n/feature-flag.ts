/**
 * Homologation-only surface for Mercado Pago Orders Split 1:N Card Brick.
 * Default OFF. Must never enable product checkout.
 */

function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Server flag — preferred. */
export const CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG =
  "DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED";

/** Optional client mirror for UI gating (never sufficient alone). */
export const CLF_MP_SPLIT_1N_HOMOLOGATION_PUBLIC_FLAG =
  "NEXT_PUBLIC_DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED";

export function isClfMpSplit1nHomologationFlagEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    parseTruthyEnv(env[CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG]) ||
    parseTruthyEnv(env[CLF_MP_SPLIT_1N_HOMOLOGATION_PUBLIC_FLAG])
  );
}

export function isClfMpSplit1nHomologationFlagEnabledClient(): boolean {
  return parseTruthyEnv(
    process.env.NEXT_PUBLIC_DNX_CLF_MP_SPLIT_1N_HOMOLOGATION_ENABLED,
  );
}
