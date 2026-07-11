import Link from "next/link";
import type { ClfAlbumAvailabilityResult } from "@repo/db";
import { MarkdownBody } from "@/lib/markdown";
import { authorDisplayName, type ArticleWithRelations } from "@/lib/articles";
import { CategoryBadge } from "@/components/editorial/category-badge";
import { AuthorByline } from "@/components/editorial/author-byline";
import { ArticleMetadata } from "@/components/editorial/article-metadata";
import { EditorialImage } from "@/components/editorial/editorial-image";
import { ShareActions } from "@/components/editorial/share-actions";
import { RelatedArticles } from "@/components/editorial/related-articles";
import { AlbumCommerceCta } from "@/components/public/album-commerce-cta";
import {
  ArticleBodyContainer,
  WideMediaContainer,
  EditorialContainer,
  Section,
} from "@/components/layout/containers";

type Props = {
  article: ArticleWithRelations;
  related?: ArticleWithRelations[];
  badge?: string;
  albumAvailability?: ClfAlbumAvailabilityResult | null;
  shareUrl?: string;
};

export function ArticleView({
  article,
  related = [],
  badge,
  albumAvailability,
  shareUrl,
}: Props) {
  const inline = article.articleAssets.filter((a) => a.usageType === "INLINE");
  const gallery = article.articleAssets.filter((a) => a.usageType === "GALLERY");
  const coverFromLinks = article.articleAssets.find((a) => a.usageType === "COVER");
  const coverUrl = article.coverImage?.url || coverFromLinks?.asset.url;
  const coverCaption =
    coverFromLinks?.captionOverride ||
    article.coverImage?.caption ||
    coverFromLinks?.asset.caption;
  const coverCredit = article.coverImage?.credit || coverFromLinks?.asset.credit;
  const coverCopyright =
    article.coverImage?.copyrightText || coverFromLinks?.asset.copyrightText;

  return (
    <>
      <ArticleBodyContainer className="pt-10 md:pt-14">
        {badge ? (
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-warning)]">
            {badge}
          </p>
        ) : null}

        <nav aria-label="Migas" className="is-meta mb-5 flex flex-wrap items-center gap-2">
          <Link href="/noticias" className="hover:text-[var(--is-accent)]">
            Noticias
          </Link>
          {article.category ? (
            <>
              <span aria-hidden>/</span>
              <Link
                href={`/categorias/${article.category.slug}`}
                className="hover:text-[var(--is-accent)]"
              >
                {article.category.name}
              </Link>
            </>
          ) : null}
        </nav>

        {article.category ? (
          <CategoryBadge name={article.category.name} slug={article.category.slug} />
        ) : null}

        <h1 className="is-title-article mt-4 text-3xl sm:text-4xl md:text-5xl">
          {article.title}
        </h1>

        {article.excerpt ? <p className="is-dek mt-5">{article.excerpt}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--is-border)] pb-6">
          <AuthorByline name={authorDisplayName(article.author)} />
          <ArticleMetadata date={article.publishedAt ?? article.updatedAt} />
        </div>
      </ArticleBodyContainer>

      {coverUrl ? (
        <WideMediaContainer className="mt-8 md:mt-10">
          <EditorialImage
            src={coverUrl}
            alt={article.title}
            caption={coverCaption}
            credit={coverCredit}
            copyrightText={coverCopyright}
            priority
            aspect="feature"
          />
        </WideMediaContainer>
      ) : null}

      <ArticleBodyContainer className="py-10 md:py-12">
        <MarkdownBody content={article.content} />

        {inline.length > 0 ? (
          <div className="mt-10 space-y-10">
            {inline.map((item) => (
              <EditorialImage
                key={item.id}
                src={item.asset.url}
                caption={item.captionOverride || item.asset.caption}
                credit={item.asset.credit}
                copyrightText={item.asset.copyrightText}
                aspect="wide"
              />
            ))}
          </div>
        ) : null}

        {gallery.length > 0 ? (
          <section className="mt-14">
            <h2 className="is-title-section text-2xl">Galería</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {gallery.map((item) => (
                <EditorialImage
                  key={item.id}
                  src={item.asset.thumbnailUrl || item.asset.url}
                  caption={item.captionOverride || item.asset.caption}
                  credit={item.asset.credit}
                  copyrightText={item.asset.copyrightText}
                  aspect="card"
                />
              ))}
            </div>
          </section>
        ) : null}

        {albumAvailability ? (
          <AlbumCommerceCta availability={albumAvailability} />
        ) : null}

        <div className="mt-12 border-t border-[var(--is-border)] pt-8">
          <ShareActions title={article.title} url={shareUrl} />
        </div>

        <RelatedArticles articles={related} />
      </ArticleBodyContainer>

      <Section tone="muted" spacing="md">
        <EditorialContainer>
          <div className="flex flex-col gap-4 rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[var(--is-surface)] px-6 py-8 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="max-w-xl">
              <p className="is-eyebrow">Info Spot</p>
              <p className="is-title-section mt-2 text-xl md:text-2xl">
                Descubrí lo que está pasando cerca tuyo.
              </p>
            </div>
            <Link href="/contacto" className="is-btn is-btn-primary shrink-0">
              Contactar redacción
            </Link>
          </div>
        </EditorialContainer>
      </Section>
    </>
  );
}
