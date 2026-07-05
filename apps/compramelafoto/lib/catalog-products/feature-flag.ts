function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Fase 1 — catálogo global interno (servidor). */
export function isGlobalProductsCatalogPhase1Enabled(): boolean {
  return (
    parseTruthyEnv(process.env.GLOBAL_PRODUCTS_CATALOG_PHASE1) ||
    parseTruthyEnv(process.env.NEXT_PUBLIC_GLOBAL_PRODUCTS_CATALOG_PHASE1)
  );
}

/** UI cliente (bundle). Confirmar con GET /api/dashboard/catalog-products-phase1-enabled si hace falta. */
export function isGlobalProductsCatalogPhase1EnabledClient(): boolean {
  return parseTruthyEnv(process.env.NEXT_PUBLIC_GLOBAL_PRODUCTS_CATALOG_PHASE1);
}
