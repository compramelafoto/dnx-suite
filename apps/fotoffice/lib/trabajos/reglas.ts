import { slugifyPageTitle } from "@/lib/website/pages";

/** Tope de fotos (y videos por enlace) en un mismo trabajo. */
export const MAX_FOTOS_POR_TRABAJO = 300;

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

/** Prisma avisa `P2021` cuando la tabla no existe: el SQL de Trabajos se aplica a mano. */
export function esTablaFaltante(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}
