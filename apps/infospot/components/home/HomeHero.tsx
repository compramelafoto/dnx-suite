import Link from "next/link";
import { CategoryBadge } from "@/components/editorial/CategoryBadge";
import { ArticleMetadata } from "@/components/editorial/ArticleMetadata";
import { toArticleCardProps } from "@/components/editorial/article-cards";
import { pickHeroStock } from "@/lib/editorial-stock";
import type { ArticleWithRelations } from "@/lib/articles";
import { SiteContainer } from "@/components/foundations";

type Props = {
  article: ArticleWithRelations;
};

/**
 * Hero portada — fotografía a pantalla, H1 dominante, CTA elegante.
 * Siempre stock energético (nunca notebooks / escenas de oficina).
 */
export function HomeHero({ article }: Props) {
  const { href, category, categorySlug, publishedAt } = toArticleCardProps(
    article,
    { priority: true, forceEditorialStock: false },
  );
  const hint = `${categorySlug || ""} ${category || ""} ${article.title}`;
  // Preferir señal de categoría; si es "eventos" genérico, forzar energía de portada.
  const hero = pickHeroStock(
    article.id || article.slug,
    /evento/i.test(hint) ? "recital festival deporte" : hint,
  );

  return (
    <article className="relative">
      <div className="relative min-h-[88vw] overflow-hidden bg-[var(--is-graphite-950)] sm:min-h-[72vw] lg:min-h-[min(92vh,900px)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.src}
          alt={hero.alt}
          className="absolute inset-0 h-full w-full scale-[1.02] object-cover"
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          draggable={false}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_88%,transparent)] via-[color-mix(in_oklab,var(--is-graphite-950)_35%,transparent)] to-[color-mix(in_oklab,var(--is-graphite-950)_18%,transparent)]"
          aria-hidden
        />

        <SiteContainer className="relative flex min-h-[inherit] items-end pb-14 pt-36 md:pb-20 md:pt-40 lg:pb-24">
          <div className="max-w-4xl space-y-7 text-[var(--is-white-0)] md:space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              {category ? (
                <CategoryBadge
                  name={category}
                  slug={categorySlug}
                  className="!bg-[var(--is-accent)] !text-[var(--is-white-0)]"
                />
              ) : (
                <p className="is-eyebrow !text-[var(--is-orange-300)]">Portada</p>
              )}
              <ArticleMetadata
                date={publishedAt}
                className="!text-[color-mix(in_oklab,var(--is-white-0)_78%,transparent)]"
              />
            </div>

            <h1 className="is-display-hero max-w-[16ch] text-wrap break-words !text-[var(--is-white-0)]">
              {article.title}
            </h1>

            {article.excerpt ? (
              <p className="max-w-2xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--is-white-0)_90%,transparent)] md:text-xl md:leading-relaxed lg:text-[1.35rem]">
                {article.excerpt}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href={href}
                className="is-btn is-btn-on-dark h-10 px-5 text-sm"
              >
                Leer la nota
              </Link>
              <Link
                href="/publicar-evento"
                className="is-btn is-btn-outline-on-dark h-10 px-4 text-sm font-medium"
              >
                Publicar evento
              </Link>
            </div>
          </div>
        </SiteContainer>
      </div>
    </article>
  );
}
