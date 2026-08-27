import type { ArticleWithRelations } from "@/lib/articles";
import { HOME_CATEGORY_ORDER } from "@/lib/articles";

type CategoryWithArticles = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  articles: ArticleWithRelations[];
};

export type HomeDensity = "empty" | "minimal" | "medium" | "full";

export type HomeComposition = {
  density: HomeDensity;
  featured: ArticleWithRelations | null;
  secondary: ArticleWithRelations[];
  latest: ArticleWithRelations[];
  categoryBlocks: CategoryWithArticles[];
  coverageImageArticle: ArticleWithRelations | null;
  actualidadLinks: Array<{ href: string; label: string }>;
};

function densityForCount(n: number): HomeDensity {
  if (n <= 0) return "empty";
  if (n <= 4) return "minimal";
  if (n <= 10) return "medium";
  return "full";
}

/**
 * Arma la jerarquía de portada según cantidad de notas REAL disponibles.
 * Evita bloques vacíos y repeticiones.
 */
export function composeHomeEditorial(input: {
  featured: ArticleWithRelations | null;
  latest: ArticleWithRelations[];
  categories: CategoryWithArticles[];
}): HomeComposition {
  const poolAll = [
    ...(input.featured ? [input.featured] : []),
    ...input.latest.filter((a) => a.id !== input.featured?.id),
  ];
  const unique = poolAll.filter(
    (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i,
  );
  const density = densityForCount(unique.length);

  if (density === "empty") {
    return {
      density,
      featured: null,
      secondary: [],
      latest: [],
      categoryBlocks: [],
      coverageImageArticle: null,
      actualidadLinks: [{ href: "/", label: "Últimas noticias" }],
    };
  }

  const featured = unique[0] ?? null;
  const used = new Set<string>();
  if (featured) used.add(featured.id);

  const rest = unique.filter((a) => !used.has(a.id));

  const secondaryTake = density === "minimal" ? Math.min(2, rest.length) : density === "medium" ? 3 : 4;
  const secondary = rest.slice(0, secondaryTake);
  secondary.forEach((a) => used.add(a.id));

  const latestTake = density === "minimal" ? 0 : density === "medium" ? 4 : 6;
  const latest = rest.filter((a) => !used.has(a.id)).slice(0, latestTake);
  latest.forEach((a) => used.add(a.id));

  const categoryBlocks =
    density === "full"
      ? (() => {
          const bySlug = new Map(input.categories.map((c) => [c.slug, c]));
          const orderedPreferred = HOME_CATEGORY_ORDER.map((slug) => bySlug.get(slug)).filter(
            (c): c is CategoryWithArticles => Boolean(c && c.articles.length > 0),
          );
          const extras = input.categories.filter(
            (c) =>
              c.articles.length > 0 &&
              !HOME_CATEGORY_ORDER.includes(c.slug as (typeof HOME_CATEGORY_ORDER)[number]),
          );
          return [...orderedPreferred, ...extras]
            .map((category) => ({
              ...category,
              articles: category.articles
                .filter((a) => a.id !== featured?.id)
                .slice(0, 3),
            }))
            .filter((c) => c.articles.length > 0);
        })()
      : [];

  const coverageImageArticle =
    [featured, ...secondary, ...latest].find((a) => a?.coverImage?.url) ?? null;

  const actualidadLinks = [
    { href: "/", label: "Últimas noticias" },
    ...categoryBlocks.slice(0, 4).map((c) => ({
      href: `/categorias/${c.slug}`,
      label: c.name,
    })),
  ];

  return {
    density,
    featured,
    secondary,
    latest,
    categoryBlocks,
    coverageImageArticle,
    actualidadLinks,
  };
}
