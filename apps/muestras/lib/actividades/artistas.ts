import { normalizeName, portfolioPreview, type Visibility } from "@repo/muestras";
import { esUrlWeb } from "@/lib/url";

/** Una foto del portfolio tal como viaja al navegador: sin orden, perfil ni fechas. */
export type FotoDePortfolio = { id: string; imageUrl: string; title: string; year: number | null; technique: string | null; caption: string | null };

export type Artista = {
  key: string;
  nombre: string;
  perfil: { slug: string; bio: string | null; ciudad: string | null; avatarUrl: string | null } | null;
  portfolio: FotoDePortfolio[];
  /** Cuántas fotos tiene el portfolio completo (para "Ver portfolio"). */
  totalPortfolio: number;
};

type PerfilDeAutor = {
  id: string; slug: string; displayName: string; bio: string | null; city: string | null; province: string | null; avatarUrl: string | null;
  portfolio?: ReadonlyArray<FotoDePortfolio & { sortOrder: number }>;
  _count?: { portfolio: number };
};

/**
 * "Artistas" de la página de la muestra (spec D26): uno por autor de las obras **expuestas**
 * (aunque online estén reservadas), por perfil o, si no tiene, por nombre; en el orden de su primera
 * obra. Lleva la biografía y las primeras fotos de su portfolio. **Nunca** incluye la imagen, el
 * título ni el id de una obra expuesta: esto se muestra aunque la sorpresa reserve todas.
 */
export function artistasDeMuestra(
  a: { works: ReadonlyArray<{ sortOrder: number; authorName: string; authorProfile: PerfilDeAutor | null }> },
  v: Visibility,
): Artista[] {
  if (!v.online.artists) return [];
  const vistos = new Map<string, Artista>();
  for (const w of [...a.works].sort((x, y) => x.sortOrder - y.sortOrder)) {
    const p = w.authorProfile;
    const key = p ? `perfil:${p.id}` : `nombre:${normalizeName(w.authorName)}`;
    if (vistos.has(key) || (!p && !w.authorName.trim())) continue;
    const fotos = p?.portfolio ? portfolioPreview(p.portfolio).filter((f) => esUrlWeb(f.imageUrl)) : [];
    vistos.set(key, {
      key,
      nombre: p?.displayName ?? w.authorName.trim(),
      perfil: p
        ? { slug: p.slug, bio: p.bio, ciudad: [p.city, p.province].filter(Boolean).join(", ") || null, avatarUrl: esUrlWeb(p.avatarUrl) ? p.avatarUrl : null }
        : null,
      portfolio: fotos.map(({ id, imageUrl, title, year, technique, caption }) => ({ id, imageUrl, title, year, technique, caption })),
      totalPortfolio: p?._count?.portfolio ?? fotos.length,
    });
  }
  return [...vistos.values()];
}
