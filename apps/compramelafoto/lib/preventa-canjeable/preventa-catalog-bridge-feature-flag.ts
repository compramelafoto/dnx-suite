function isExplicitlyDisabled(raw: string | undefined): boolean {
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no";
}

/** Bridge catálogo global → PackDefinition. Activo por defecto (opt-out con "false"). */
export function isGlobalProductsPreventaBridgeEnabled(): boolean {
  if (isExplicitlyDisabled(process.env.GLOBAL_PRODUCTS_PREVENTA_BRIDGE)) return false;
  if (isExplicitlyDisabled(process.env.NEXT_PUBLIC_GLOBAL_PRODUCTS_PREVENTA_BRIDGE)) {
    return false;
  }
  return true;
}

export function isGlobalProductsPreventaBridgeEnabledClient(): boolean {
  if (isExplicitlyDisabled(process.env.NEXT_PUBLIC_GLOBAL_PRODUCTS_PREVENTA_BRIDGE)) {
    return false;
  }
  return true;
}
