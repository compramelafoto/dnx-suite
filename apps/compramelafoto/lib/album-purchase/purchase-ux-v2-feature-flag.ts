function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** UX V2 compra de packs — Fase 0 quick wins (solo cliente). Default: false. */
export function isPurchaseUxV2EnabledClient(): boolean {
  return parseTruthyEnv(process.env.NEXT_PUBLIC_PURCHASE_UX_V2);
}
