/**
 * Dirección de la miniatura que dibuja el servidor para una plantilla (ver
 * `/api/template-v2/templates/[templateId]/miniatura`). Lleva la versión para que el navegador
 * la guarde y la pida de nuevo sólo cuando la plantilla cambia.
 */
export function miniaturaDePlantillaUrl(templateId: string, versionId: string | null | undefined): string {
  const v = versionId ? `?v=${encodeURIComponent(versionId)}` : "";
  return `/api/template-v2/templates/${encodeURIComponent(templateId)}/miniatura${v}`;
}
