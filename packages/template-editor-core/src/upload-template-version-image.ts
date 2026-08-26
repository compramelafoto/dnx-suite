/**
 * Sube un archivo a la versión del template y devuelve la URL pública.
 * Usado por el inspector de imagen y la toolbar contextual.
 */
export async function uploadTemplateVersionImage(
  templateId: string,
  versionId: string,
  file: File
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(
    `/api/template-v2/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/image-upload`,
    { method: "POST", body: fd, credentials: "include" }
  );
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || data.ok !== true || typeof data.url !== "string") {
    throw new Error(typeof data.error === "string" ? data.error : "No se pudo subir la imagen");
  }
  return data.url;
}
