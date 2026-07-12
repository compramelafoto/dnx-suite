import Link from "next/link";
import { CategoryBadge } from "@/components/editorial/CategoryBadge";
import { ArticleMetadata } from "@/components/editorial/ArticleMetadata";
import {
  ArticleCardCompact,
  ArticleCardHorizontal,
  toArticleCardProps,
} from "@/components/editorial/article-cards";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import type { ArticleWithRelations } from "@/lib/articles";

type Props = {
  articles: ArticleWithRelations[];
};

/**
 * Ritmo de revista: lead fotográfico enorme + columna de tensión.
 */
export function HomeSecondaryRail({ articles }: Props) {
  if (articles.length === 0) return null;

  const [lead, second, third, fourth, ...rest] = articles;
  const leadProps = lead
    ? toArticleCardProps(lead, { priority: true, forceEditorialStock: false })
    : null;

  return (
    <section aria-labelledby="home-secondary-heading" className="space-y-12 md:space-y-16">
      <SectionHeader
        id="home-secondary-heading"
        title="Lo que está pasando"
        eyebrow="En foco"
        description="Historias con peso. Selección de la mesa de edición — no un listado plano."
      />

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16">
        {lead && leadProps ? (
          <Link
            href={leadProps.href}
            className="group relative block overflow-hidden lg:col-span-7"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={leadProps.imageUrl || "/editorial-stock/concert.jpg"}
              alt={leadProps.imageAlt || leadProps.title}
              className="aspect-[4/5] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] sm:aspect-[5/4] lg:aspect-auto lg:min-h-[34rem] xl:min-h-[38rem]"
              loading="eager"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_82%,transparent)] via-[color-mix(in_oklab,var(--is-graphite-950)_20%,transparent)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 md:p-8 lg:p-10">
              <div className="flex flex-wrap items-center gap-3">
                {leadProps.category ? (
                  <CategoryBadge
                    name={leadProps.category}
                    slug={leadProps.categorySlug}
                    asLink={false}
                    className="!bg-[var(--is-accent)] !text-[var(--is-white-0)]"
                  />
                ) : null}
                <ArticleMetadata
                  date={leadProps.publishedAt}
                  className="!text-[color-mix(in_oklab,var(--is-white-0)_75%,transparent)]"
                />
              </div>
              <h3 className="is-h2 max-w-[18ch] text-2xl text-[var(--is-white-0)] md:text-3xl lg:text-4xl">
                {leadProps.title}
              </h3>
              {leadProps.excerpt ? (
                <p className="max-w-lg text-sm leading-relaxed text-[color-mix(in_oklab,var(--is-white-0)_85%,transparent)] md:text-base">
                  {leadProps.excerpt}
                </p>
              ) : null}
            </div>
          </Link>
        ) : null}

        <div className="flex flex-col justify-between gap-8 lg:col-span-5">
          {second ? (
            <div className="border-b border-[var(--is-border)] pb-8">
              <ArticleCardHorizontal article={second} />
            </div>
          ) : null}
          <div>
            {third ? <ArticleCardCompact article={third} /> : null}
            {fourth ? <ArticleCardCompact article={fourth} /> : null}
          </div>
        </div>
      </div>

      {rest.length > 0 ? (
        <div className="grid gap-10 border-t border-[var(--is-border)] pt-12 md:grid-cols-2 md:gap-12">
          {rest.map((article) => (
            <ArticleCardHorizontal key={article.id} article={article} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
