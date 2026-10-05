/**
 * Sube un archivo de un proyecto directo al bucket, en dos pasos: pedir el permiso firmado y
 * escribir. El registro (tercer paso) lo hace quien llama, con todos los archivos juntos.
 */
export async function uploadGovernanceFile(
  file: File,
  target: { projectId: string; taskId?: string },
  /** El panel usa la ruta del equipo; el portal, la del socio (otra regla de quién puede subir). */
  endpoint: string = "/api/gobierno/upload-url",
): Promise<{ ok: true; key: string; filename: string } | { ok: false; error: string }> {
  const permiso = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: target.projectId,
      taskId: target.taskId,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  }).catch(() => null);
  const datos = (await permiso?.json().catch(() => null)) as {
    uploadUrl?: string;
    key?: string;
    contentType?: string;
    error?: string;
  } | null;
  if (!permiso?.ok || !datos?.uploadUrl || !datos.key || !datos.contentType) {
    return { ok: false, error: datos?.error ?? "No pudimos preparar la subida." };
  }
  // El tipo tiene que ser exactamente el que se firmó: el servidor lo saneó.
  const subida = await fetch(datos.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": datos.contentType },
    body: file,
  }).catch(() => null);
  if (!subida?.ok) return { ok: false, error: "La subida se cortó. Revisá tu conexión y probá de nuevo." };
  return { ok: true, key: datos.key, filename: file.name };
}
