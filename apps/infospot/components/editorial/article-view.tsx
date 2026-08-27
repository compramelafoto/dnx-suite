import Link from "next/link";
import type { ClfAlbumAvailabilityResult } from "@repo/db/clf-album-availability";
import { MarkdownBody } from "@/lib/markdown";
import { authorDisplayName, type ArticleWithRelations } from "@/lib/articles";
import { CategoryBadge } from "@/components/editorial/category-badge";
import { AuthorByline } from "@/components/editorial/author-byline";
import { ArticleMetadata } from "@/components/editorial/article-metadata";
import { EditorialImage } from "@/components/editorial/editorial-image";
import { PhotoCaptureNotice } from "@/components/editorial-photos/photo-capture-notice";
import { ShareActions } from "@/components/editorial/share-actions";
import { RelatedArticles } from "@/components/editorial/related-articles";
import { AlbumCommerceCta } from "@/components/public/album-commerce-cta";
import {
  ArticleBodyContainer,
  WideMediaContainer,
  EditorialContainer,
  Section,
} from "@/components/layout/containers";
import type { PublicEditorialCoverage } from "@/lib/public-coverage";
import {
  PublicEditorialPhoto,
  PublicEditorialGallery,
  CoveragePhotographers,
  CoverageAlbumsCommerce,
  RelatedEventCoverage,
  ContentViewTracker,
} from "@/components/public-coverage";
import { AlsoNearThisPlaceBlock } from "@/components/home/AlsoNearThisPlaceBlock";
import { RecommendationBlocks } from "@/components/editorial/recommendation-blocks";
import type { InfoSpotFeedItem } from "@/lib/feed/types";
import type { ArticleRecommendationBlocks } from "@/lib/recommendations/get-article-recommendations";

type Props = {
  article: ArticleWithRelations;
  related?: ArticleWithRelations[];
  badge?: string;
  albumAvailability?: ClfAlbumAvailabilityResult | null;
  shareUrl?: string;
  showDirectorCommerceActions?: boolean;
  /** View model de cobertura editorial (opcional; no rompe artículos sin cobertura). */
  publicCoverage?: PublicEditorialCoverage | null;
  /** Etapa 15 — contenido cercano a la nota georreferenciada. */
  alsoNearItems?: InfoSpotFeedItem[];
  /** Etapa 17 — bloques del Recommendation Engine. */
  recommendationBlocks?: ArticleRecommendationBlocks | null;
};

export function ArticleView({
  article,
  related = [],
  badge,
  albumAvailability,
  shareUrl,
  showDirectorCommerceActions = false,
  publicCoverage = null,
  alsoNearItems = [],
  recommendationBlocks = null,
}: Props) {
  const inline = article.articleAssets.filter((a) => a.usageType === "INLINE");
  const gallery = article.articleAssets.filter((a) => a.usageType === "GALLERY");
  const coverFromLinks = article.articleAssets.find((a) => a.usageType === "COVER");

  const clfCover = publicCoverage?.coverPhoto ?? null;
  const traditionalCoverUrl =
    article.coverImage?.url || coverFromLinks?.asset.url || null;
  const coverCaption =
    clfCover?.caption ||
    coverFromLinks?.captionOverride ||
    article.coverImage?.caption ||
    coverFromLinks?.asset.caption;
  const coverCredit =
    clfCover?.credit ||
    article.coverImage?.credit ||
    coverFromLinks?.asset.credit;
  const coverCopyright =
    article.coverImage?.copyrightText || coverFromLinks?.asset.copyrightText;

  const locationLabel = publicCoverage?.event
    ? [publicCoverage.event.city, publicCoverage.event.province]
        .filter(Boolean)
        .join(", ")
    : null;

  const relatedFromCoverage = publicCoverage?.relatedArticles ?? [];
  const showLegacyRelated =
    relatedFromCoverage.length === 0 && related.length > 0;

  const showLegacyAlbumCta =
    albumAvailability &&
    !(publicCoverage?.albums && publicCoverage.albums.length > 0);

  return (
    <>
      <ContentViewTracker kind="ARTICLE_VIEW" articleId={article.id} />
      <PhotoCaptureNotice />

      <ArticleBodyContainer className="pt-10 md:pt-14">
        {badge ? (
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-warning)]">
            {badge}
          </p>
        ) : null}

        <nav aria-label="Migas" className="is-meta mb-5 flex flex-wrap items-center gap-2">
          <Link href="/" className="hover:text-[var(--is-accent)]">
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
          <AuthorByline
            name={authorDisplayName(article.author)}
            avatarUrl={article.author.logoUrl}
            bio={article.author.bio}
            href={`/autores/${article.author.id}`}
          />
          <ArticleMetadata date={article.publishedAt ?? article.updatedAt} />
          {locationLabel ? (
            <span className="is-meta">{locationLabel}</span>
          ) : null}
        </div>

        {publicCoverage?.event ? (
          <p className="mt-4 text-sm text-[var(--is-text-secondary)]">
            Evento:{" "}
            <Link
              href={`/eventos/${publicCoverage.event.slug}`}
              className="font-medium text-[var(--is-accent)] hover:underline"
            >
              {publicCoverage.event.title}
            </Link>
            {publicCoverage.event.temporalLabel
              ? ` · ${publicCoverage.event.temporalLabel}`
              : null}
          </p>
        ) : null}
      </ArticleBodyContainer>

      {clfCover ? (
        <WideMediaContainer className="mt-8 md:mt-10">
          <PublicEditorialPhoto photo={clfCover} priority />
        </WideMediaContainer>
      ) : traditionalCoverUrl ? (
        <WideMediaContainer className="mt-8 md:mt-10">
          <EditorialImage
            src={traditionalCoverUrl}
            alt={coverCaption || article.title}
            caption={coverCaption}
            credit={coverCredit}
            copyrightText={coverCopyright}
            priority
            aspect="feature"
          />
        </WideMediaContainer>
      ) : null}

      <ArticleBodyContainer className="py-10 md:py-12">
        <MarkdownBody
          content={article.content}
          photoById={publicCoverage?.photoById}
        />

        {/* Inline legacy assets (no CLF) */}
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

        {/* Galería CLF */}
        {publicCoverage && publicCoverage.galleryPhotos.length > 0 ? (
          <PublicEditorialGallery
            photos={publicCoverage.galleryPhotos}
            albumHref={
              publicCoverage.commercialAvailability.canShowPurchaseCta
                ? publicCoverage.albums[0]?.trackedAlbumHref
                : null
            }
          />
        ) : gallery.length > 0 ? (
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

        {publicCoverage ? (
          <>
            <CoveragePhotographers photographers={publicCoverage.photographers} />
            <CoverageAlbumsCommerce albums={publicCoverage.albums} />
          </>
        ) : null}

        {showLegacyAlbumCta ? (
          <AlbumCommerceCta
            availability={albumAvailability}
            showDirectorActions={showDirectorCommerceActions}
            articleId={article.id}
          />
        ) : null}

        <div className="mt-12 border-t border-[var(--is-border)] pt-8">
          <ShareActions title={article.title} url={shareUrl} />
        </div>

        {relatedFromCoverage.length > 0 || (publicCoverage?.relatedEvents?.length ?? 0) > 0 ? (
          <RelatedEventCoverage
            articles={relatedFromCoverage}
            events={publicCoverage?.relatedEvents}
          />
        ) : null}

        {showLegacyRelated ? <RelatedArticles articles={related} /> : null}

        {recommendationBlocks ? (
          <RecommendationBlocks {...recommendationBlocks} />
        ) : alsoNearItems.length > 0 ? (
          <AlsoNearThisPlaceBlock
            items={alsoNearItems}
            placeLabel={
              [article.city, article.province].filter(Boolean).join(", ") ||
              locationLabel
            }
          />
        ) : null}
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
