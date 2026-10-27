import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { slugifyPageTitle } from "./pages";

/**
 * Documentos del sitio (PR D, reemplaza «Propuestas» de Prosite): un PDF que se comparte con un
 * enlace `/w/<slug>/d/<documento>` (en el dominio propio, `/d/<documento>`). Reglas puras; el
 * lado del servidor está en `documentos.server.ts`.
 * Spec: docs/superpowers/specs/2026-10-27-sitio-herramientas-prosite-design.md (PR D)
 */

export const MB = 1024 * 1024;
/** Peso máximo de un documento. Sube directo a R2 (las funciones de Vercel no aceptan más de 4,5 MB). */
export const MAX_BYTES_DOCUMENTO = 25 * MB;
export const MAX_LARGO_TITULO_DOCUMENTO = 160;
export const MAX_LARGO_SLUG_DOCUMENTO = 80;
/** Cuántos documentos puede tener un sitio. */
export const MAX_DOCUMENTOS_POR_SITIO = 200;
/** Minutos que vale el enlace firmado con el que el visitante abre el PDF. */
export const SEGUNDOS_ENLACE_DOCUMENTO = 10 * 60;

export const AVISO_TABLA_DOCUMENTOS_FALTANTE = "Falta crear la tabla de documentos en la base. Avisale al administrador.";

const SLUG_FORMATO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** El mensaje de error de una dirección de documento, o `null` si sirve. */
export function validarSlugDocumento(slug: string): string | null {
  if (!slug) return "Escribí la dirección del documento.";
  if (slug.length > MAX_LARGO_SLUG_DOCUMENTO || !SLUG_FORMATO.test(slug)) {
    return "Usá sólo letras minúsculas, números y guiones (por ejemplo: propuesta-casamiento).";
  }
  return null;
}

/** Una dirección a partir del título (sin tildes, minúsculas y guiones). */
export function slugDeDocumento(titulo: string): string {
  return slugifyPageTitle(titulo).slice(0, MAX_LARGO_SLUG_DOCUMENTO).replace(/-+$/g, "") || "documento";
}

export function validarTituloDocumento(titulo: string): string | null {
  const t = titulo.trim();
  if (!t) return "Escribí un título.";
  if (t.length > MAX_LARGO_TITULO_DOCUMENTO) return `El título puede tener hasta ${MAX_LARGO_TITULO_DOCUMENTO} letras.`;
  return null;
}

/** El peso declarado por el navegador: el real se mira después en R2. */
export function validarPesoDocumento(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return "El archivo está vacío.";
  if (bytes > MAX_BYTES_DOCUMENTO) return `El PDF pesa más de ${MAX_BYTES_DOCUMENTO / MB} MB.`;
  return null;
}

/** ¿Empieza como un PDF? Todo PDF arranca con `%PDF-`. Se mira el archivo, no su nombre ni su tipo. */
export function esPdfPorFirma(primeros: Uint8Array): boolean {
  const firma = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  if (primeros.length < firma.length) return false;
  return firma.every((b, i) => primeros[i] === b);
}

/** Todo documento de un sitio vive bajo su institución. */
export function prefijoDocumentos(workspaceId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.websiteDocument}/${workspaceId}/`;
}

const KEY_DOCUMENTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/** ¿Es una key que este servidor firmó para los documentos de ESTE workspace? */
export function esKeyDeDocumento(key: unknown, workspaceId: string): key is string {
  if (typeof key !== "string") return false;
  const prefijo = prefijoDocumentos(workspaceId);
  if (!key.startsWith(prefijo)) return false;
  return KEY_DOCUMENTO.test(key.slice(prefijo.length));
}

/** El enlace público de un documento (relativo al sitio de FOTOFFICE). */
export function rutaPublicaDocumento(workspaceSlug: string, slug: string): string {
  return `/w/${workspaceSlug}/d/${slug}`;
}

/** Nombre del archivo que ve quien lo baja: el título como slug, con `.pdf`. */
export function nombreDeArchivoDocumento(titulo: string, slug: string): string {
  return `${slugifyPageTitle(titulo) || slug}.pdf`;
}

export function pesoLegible(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("es-AR")} KB`;
}
