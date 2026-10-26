import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { slugifyPageTitle } from "@/lib/website/pages";

/** Raíz del panel Sitio web → Trabajos. */
export const TRABAJOS_ADMIN_BASE = "/website/trabajos";

/** Tope de fotos (y videos por enlace) en un mismo trabajo. */
export const MAX_FOTOS_POR_TRABAJO = 300;

/** Peso máximo de cada foto que se sube a un trabajo. */
export const MAX_BYTES_FOTO_TRABAJO = 25 * 1024 * 1024;

/** Formatos que se aceptan (y que el servidor sabe verificar por firma después de la subida). */
export const FORMATOS_FOTO_TRABAJO = ["image/jpeg", "image/png", "image/webp"] as const;

/** Extensión de la key de R2 según el tipo de la foto. */
const EXTENSION_POR_TIPO: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

/** Nombre que se usa para armar la key de R2: la extensión sale del tipo, nunca del nombre que
 * eligió el navegador (que puede traer cualquier cosa). Un tipo desconocido queda sin extensión. */
export function nombreParaKey(tipo: string): string {
  return `foto${EXTENSION_POR_TIPO[tipo] ?? ""}`;
}

/** Lado más largo con que se guarda una foto: alcanza para pantallas grandes y el sitio no sirve
 * originales de 25 MB. */
export const LADO_MAX_FOTO_TRABAJO = 2560;

/** Medidas de la foto reducida para que su lado más largo no pase de `max`. Nunca agranda. */
export function medidasReducidas(ancho: number, alto: number, max = LADO_MAX_FOTO_TRABAJO): { ancho: number; alto: number } {
  const lado = Math.max(ancho, alto);
  if (!(ancho > 0) || !(alto > 0) || lado <= max) return { ancho, alto };
  const escala = max / lado;
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/** Largo máximo del texto alternativo de una foto. */
export const ALT_MAX = 180;

/** Largo máximo de la dirección de un trabajo o de una categoría. */
export const SLUG_TRABAJO_MAX = 80;

/** Letras minúsculas/números separados por guiones simples, igual que las páginas del sitio. */
const FORMATO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Mensaje para mostrar, o `null` si la dirección sirve. `otros` son los slugs de los demás
 * trabajos de la institución (sin el que se está editando). */
export function validarSlugTrabajo(slug: string, otros: string[]): string | null {
  if (!FORMATO_SLUG.test(slug) || slug.length > SLUG_TRABAJO_MAX) {
    return "Usá sólo letras minúsculas, números y guiones (por ejemplo: casamiento-sofi-y-juan)";
  }
  if (otros.includes(slug)) return "Ya hay otro trabajo con esa dirección";
  return null;
}

/** Arma la dirección a partir del título. Puede dar vacío si el título no tiene letras ni números. */
export function slugDeTitulo(titulo: string): string {
  return slugifyPageTitle(titulo).slice(0, SLUG_TRABAJO_MAX).replace(/-+$/g, "");
}

/** «14 de marzo de 2025». `fecha` es un día calendario guardado como medianoche UTC (columna
 * `date`): se lee en UTC, porque pasarla a hora argentina la correría al día anterior. */
export function fechaLarga(fecha: Date): string {
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
}

/** Lo que ve el panel si el SQL de Trabajos todavía no se aplicó a la base. */
export const AVISO_TABLAS_FALTANTES = "Falta crear las tablas de Trabajos en la base. Avisale al administrador.";

/** Prisma avisa `P2021` cuando la tabla no existe: el SQL de Trabajos se aplica a mano. */
export function esTablaFaltante(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

/** Id de trabajo con forma de cuid: letras y números, sin `/` ni puntos. Se mira antes de armar
 * cualquier prefijo de R2 con él (y antes de cualquier limpieza). */
export function esIdTrabajoValido(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9]{8,40}$/i.test(id);
}

/** Prefijo de R2 de las fotos de un trabajo: `fotoffice/site-trabajos/<workspaceId>/<trabajoId>/`.
 * Lo arma el servidor (nunca el navegador) y es lo único que `agregarFotos` acepta como key. */
export function prefijoFotosTrabajo(workspaceId: string, trabajoId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.siteTrabajoPhoto}/${workspaceId}/${trabajoId}/`;
}

/** Prefijo de todo lo que una institución tiene en R2 bajo Trabajos. */
export function prefijoWorkspaceTrabajos(workspaceId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.siteTrabajoPhoto}/${workspaceId}/`;
}

/** Medianoche UTC del día calendario de `d` (lo que espera la columna `date`). Las fechas que
 * llegan ya son de ese día; si traen hora, se descarta. */
export function diaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function esCodigoUnico(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}
