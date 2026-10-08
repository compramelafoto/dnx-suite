/**
 * Ruta pública de un formulario de captación, armada con la dirección pública REAL del workspace
 * (FotofficeWorkspaceBranding.publicSlug). Sin dirección pública no hay enlace: devuelve null.
 * El formulario "general" vive en la portada del sitio (`/w/<slug>`).
 */
export function rutaPublicaFormulario(publicSlug: string | null | undefined, formSlug: string): string | null {
  const slug = publicSlug?.trim();
  if (!slug) return null;
  const base = `/w/${encodeURIComponent(slug)}`;
  return formSlug === "general" ? base : `${base}/${encodeURIComponent(formSlug)}`;
}
