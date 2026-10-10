/**
 * Portfolio del artista (etapa 6): fotos que **no** se exponen, con sus datos, colgadas del perfil
 * de fotógrafo y reutilizables en todas sus muestras. Es lo que el público ve del artista sin
 * adelantar la sala (spec D13–D16).
 */
export const PORTFOLIO_MAX_PHOTOS = 60;
/** Cuántas se ven en la sección "Artistas" de una muestra antes de "Ver portfolio". */
export const PORTFOLIO_PREVIEW = 8;
export const PORTFOLIO_TEXT_LIMITS = { title: 160, technique: 160, caption: 300 } as const;
export const PORTFOLIO_MIN_YEAR = 1826;

export const PORTFOLIO_EXHIBITED_WARNING =
  "Esa foto es una obra que expusiste o vas a exponer: no la sumes al portfolio, así sigue siendo sorpresa en la sala.";

/**
 * Qué está mal en una foto del portfolio; vacío si se puede guardar. `exhibitedUrls`: las
 * imágenes de las obras que la persona expone o expuso (no pueden ir al portfolio, spec D15);
 * `count`: cuántas fotos tiene hoy; `isNew`: si es una foto que se suma.
 */
export function portfolioPhotoProblems(p: {
  imageUrl: string | null;
  title: string;
  year: number | null;
  technique?: string | null;
  caption?: string | null;
  exhibitedUrls: ReadonlySet<string>;
  count: number;
  isNew: boolean;
  now?: Date;
}): string[] {
  if (p.isNew && p.count >= PORTFOLIO_MAX_PHOTOS) return [`El portfolio admite hasta ${PORTFOLIO_MAX_PHOTOS} fotos.`];
  const problemas: string[] = [];
  if (!p.imageUrl) problemas.push("Subí la foto.");
  else if (p.exhibitedUrls.has(p.imageUrl)) problemas.push(PORTFOLIO_EXHIBITED_WARNING);
  const title = p.title.trim();
  if (!title) problemas.push("Cada foto del portfolio necesita un título.");
  else if (title.length > PORTFOLIO_TEXT_LIMITS.title) problemas.push(`El título puede tener hasta ${PORTFOLIO_TEXT_LIMITS.title} caracteres.`);
  const anioMax = (p.now ?? new Date()).getUTCFullYear() + 1;
  if (p.year != null && (!Number.isInteger(p.year) || p.year < PORTFOLIO_MIN_YEAR || p.year > anioMax)) problemas.push("Revisá el año.");
  if ((p.technique ?? "").trim().length > PORTFOLIO_TEXT_LIMITS.technique) {
    problemas.push(`La técnica puede tener hasta ${PORTFOLIO_TEXT_LIMITS.technique} caracteres.`);
  }
  if ((p.caption ?? "").trim().length > PORTFOLIO_TEXT_LIMITS.caption) {
    problemas.push(`El texto puede tener hasta ${PORTFOLIO_TEXT_LIMITS.caption} caracteres.`);
  }
  return problemas;
}

/** Las primeras fotos del portfolio, en su orden, para la sección "Artistas". */
export function portfolioPreview<P extends { sortOrder: number }>(photos: readonly P[]): P[] {
  return [...photos].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, PORTFOLIO_PREVIEW);
}
