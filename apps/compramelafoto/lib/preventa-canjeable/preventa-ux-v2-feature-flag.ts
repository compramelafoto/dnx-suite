function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** UX unificada preventa — naming, hub cliente, estados traducidos. Default: false. */
export function isPreventaUxV2Enabled(): boolean {
  return (
    parseTruthyEnv(process.env.PREVENTA_UX_V2) ||
    parseTruthyEnv(process.env.NEXT_PUBLIC_PREVENTA_UX_V2)
  );
}

/** Mismo flag en componentes cliente (NEXT_PUBLIC). */
export function isPreventaUxV2EnabledClient(): boolean {
  return parseTruthyEnv(process.env.NEXT_PUBLIC_PREVENTA_UX_V2);
}
