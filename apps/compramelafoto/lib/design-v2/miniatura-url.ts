/**
 * Dirección de la miniatura que dibuja el servidor para una plantilla (ver
 * `/api/template-v2/templates/[templateId]/miniatura`). Lleva la versión para que el navegador
 * la guarde y la pida de nuevo sólo cuando la plantilla cambia; la revisión cubre las ediciones
 * que se guardan en la misma versión. `m` es la forma de dibujarla:
 * sube cuando cambia (2 = con fotos de demo), así el navegador no se queda con la anterior.
 */
const FORMA_DE_MINIATURA = "2";

export function miniaturaDePlantillaUrl(
  templateId: string,
  versionId: string | null | undefined,
  revision?: number | null,
): string {
  const v = versionId ? `v=${encodeURIComponent(versionId)}&` : "";
  const r = versionId && revision != null ? `r=${revision}&` : "";
  return `/api/template-v2/templates/${encodeURIComponent(templateId)}/miniatura?${v}${r}m=${FORMA_DE_MINIATURA}`;
}
