/**
 * El material de una clase (PDF y otros archivos que acompañan al video). Puro.
 */

/** " · 2,4 MB" para el botón de descarga; vacío si no se sabe el tamaño. */
export function tamanoLegible(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return ` · ${Math.max(1, Math.round(bytes / 1024))} KB`;
  return ` · ${mb.toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}
