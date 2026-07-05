/** Meta para copias desde catálogo público (quita marca «sistema» y enlaza origen). */
export function forkVersionMetaJsonFromCatalog(
  sourceMeta: unknown,
  catalogTemplateId: string
): Record<string, unknown> {
  const base =
    sourceMeta != null && typeof sourceMeta === "object" && !Array.isArray(sourceMeta)
      ? { ...(sourceMeta as Record<string, unknown>) }
      : {};
  delete base.system;

  const legacyRaw = base.legacyStyleFlags;
  if (legacyRaw != null && typeof legacyRaw === "object" && !Array.isArray(legacyRaw)) {
    const leg = { ...(legacyRaw as Record<string, unknown>) };
    delete leg.system;
    if (Object.keys(leg).length > 0) base.legacyStyleFlags = leg;
    else delete base.legacyStyleFlags;
  }

  base.forkedFromTemplateId = catalogTemplateId;
  base.forkedFromCatalogAt = new Date().toISOString();
  return base;
}
