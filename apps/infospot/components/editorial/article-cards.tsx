import { ArticleCard as ArticleCardView } from "@/components/editorial/ArticleCard";
import { ArticleCardCompact as ArticleCardCompactView } from "@/components/editorial/ArticleCardCompact";
import { ArticleCardFeatured as ArticleCardFeaturedView } from "@/components/editorial/ArticleCardFeatured";
import { ArticleCardHorizontal as ArticleCardHorizontalView } from "@/components/editorial/ArticleCardHorizontal";
import type { ArticleCardProps } from "@/components/editorial/types";
import {
  authorDisplayName,
  type ArticleWithRelations,
} from "@/lib/articles";
import {
  pickThematicStock,
  resolveEditorialImageAlt,
  resolveEditorialImageUrl,
} from "@/lib/editorial-stock";

type MapOptions = {
  priority?: boolean;
  image?: "cover" | "thumb";
  /** Portada: forzar stock energético (evita covers genéricos del CMS). */
  forceEditorialStock?: boolean;
};

/** Mapea un artículo CMS a props de card editorial (con foto fallback). */
export function toArticleCardProps(
  article: ArticleWithRelations,
  options?: MapOptions,
): ArticleCardProps {
  const seed = article.id || article.slug;
  const hint = `${article.category?.slug || ""} ${article.category?.name || ""} ${article.title}`;
  const raw =
    options?.image === "thumb"
      ? article.coverImage?.thumbnailUrl || article.coverImage?.url
      : article.coverImage?.url;

  const stock = pickThematicStock(seed, hint);
  const imageUrl = options?.forceEditorialStock
    ? stock.src
    : resolveEditorialImageUrl(raw);
  const imageAlt = options?.forceEditorialStock
    ? stock.alt
    : resolveEditorialImageAlt(article.title, seed, hint);

  return {
    title: article.title,
    excerpt: article.excerpt,
    href: `/noticias/${article.slug}`,
    imageUrl,
    imageAlt,
    category: article.category?.name,
    categorySlug: article.category?.slug,
    publishedAt: article.publishedAt,
    authorName: authorDisplayName(article.author),
    priority: options?.priority,
  };
}

export function ArticleCard({
  article,
  priority,
  forceEditorialStock = false,
}: {
  article: ArticleWithRelations;
  priority?: boolean;
  forceEditorialStock?: boolean;
}) {
  return (
    <ArticleCardView
      {...toArticleCardProps(article, { priority, forceEditorialStock })}
    />
  );
}

export function ArticleCardFeatured({
  article,
}: {
  article: ArticleWithRelations;
}) {
  return (
    <ArticleCardFeaturedView
      {...toArticleCardProps(article, {
        priority: true,
        forceEditorialStock: false,
      })}
    />
  );
}

export function ArticleCardHorizontal({
  article,
  forceEditorialStock = false,
}: {
  article: ArticleWithRelations;
  forceEditorialStock?: boolean;
}) {
  return (
    <ArticleCardHorizontalView
      {...toArticleCardProps(article, {
        image: "thumb",
        forceEditorialStock,
      })}
    />
  );
}

export function ArticleCardCompact({
  article,
  forceEditorialStock = false,
}: {
  article: ArticleWithRelations;
  forceEditorialStock?: boolean;
}) {
  return (
    <ArticleCardCompactView
      {...toArticleCardProps(article, {
        image: "thumb",
        forceEditorialStock,
      })}
    />
  );
}
