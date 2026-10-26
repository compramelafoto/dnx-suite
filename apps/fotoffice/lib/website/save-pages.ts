import {
  PAGE_KEY_FORMAT,
  websitePageMetaSchema,
  type WebsitePageContent,
  type WebsitePageMeta,
  type WebsiteSections,
} from "./blocks";
import { HOME_PAGE_KEY, validatePageSlug } from "./pages";

/** Tope de páginas propias (sin contar el inicio) por sitio. */
export const MAX_CUSTOM_PAGES = 50;

export type PageSaveInput = {
  /** Página a la que pertenecen `blocks`. Por omisión, el inicio. */
  pageKey: string;
  blocks?: WebsitePageContent;
  /** Si viene, REEMPLAZA el mapa entero: las claves que desaparecen borran también sus bloques. */
  pageMeta?: Record<string, WebsitePageMeta>;
};

/**
 * Aplica un guardado parcial sobre el `sectionsJson` actual del borrador, sin pisar lo que el
 * guardado no tocó (antes se escribía `{ pages: { home } }` y se perdía todo lo demás).
 *
 * Las reglas de la meta se exigen en CADA guardado, también cuando no manda meta: el parseo
 * tolerante no garantiza slugs únicos, así que un estado heredado roto no puede seguir
 * escribiéndose sin que alguien se entere.
 */
export function mergePageSave(
  current: WebsiteSections,
  input: PageSaveInput,
): { sections: WebsiteSections } | { error: string } {
  const pageMeta = input.pageMeta ?? current.pageMeta;
  const keys = Object.keys(pageMeta);

  if (keys.length > MAX_CUSTOM_PAGES) {
    return { error: `Un sitio puede tener hasta ${MAX_CUSTOM_PAGES} páginas propias.` };
  }
  if (keys.includes(HOME_PAGE_KEY)) {
    return { error: "La página de inicio no se puede configurar como una página propia." };
  }

  for (const key of keys) {
    if (!PAGE_KEY_FORMAT.test(key)) return { error: "Una de las páginas tiene una clave inválida." };
    const meta = pageMeta[key];
    if (!websitePageMetaSchema.safeParse(meta).success) {
      return { error: "Una de las páginas tiene un título o una dirección inválidos." };
    }
    const others = keys.filter((k) => k !== key).map((k) => pageMeta[k].slug);
    const slugError = validatePageSlug(meta.slug, others);
    if (slugError) return { error: slugError };
  }

  // Sólo sobreviven el inicio y las páginas con meta; una página nueva arranca vacía.
  // `hasOwn`: una clave como `constructor` no debe heredar nada del prototipo.
  const actual = (key: string) => (Object.hasOwn(current.pages, key) ? current.pages[key] : []);
  const pages: Record<string, WebsitePageContent> = { [HOME_PAGE_KEY]: actual(HOME_PAGE_KEY) };
  for (const key of keys) pages[key] = actual(key);

  if (input.blocks !== undefined) {
    if (!Object.hasOwn(pages, input.pageKey)) {
      return { error: "Esa página no existe." };
    }
    pages[input.pageKey] = input.blocks;
  }

  return { sections: { pages, pageMeta: { ...pageMeta } } };
}
