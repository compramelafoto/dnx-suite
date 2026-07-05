/**
 * Meta guardada en `TemplateV2Version.metaJson` para catálogo / UX dashboard.
 */

export function isTemplateDesignerMetaV2(metaJson: unknown): boolean {
  if (metaJson == null || typeof metaJson !== "object") return true;
  const version = (metaJson as Record<string, unknown>).version;
  if (version === "v1") return false;
  return true;
}

/** Plantilla marcada como de catálogo “sistema” (variable en metaJson, no existe columna en Prisma). */
export function isTemplateSystemFlagInMeta(metaJson: unknown): boolean {
  if (metaJson == null || typeof metaJson !== "object") return false;
  const m = metaJson as Record<string, unknown>;
  if (m.system === true) return true;
  const legacy = m.legacyStyleFlags;
  if (legacy != null && typeof legacy === "object" && (legacy as Record<string, unknown>).system === true) {
    return true;
  }
  return false;
}
