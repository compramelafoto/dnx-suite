import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma, resolveClfAlbumCommercialAvailability } from "@repo/db";
import { ArticleView } from "@/components/editorial/article-view";
import { getPublishedArticleBySlug, getPublishedArticles } from "@/lib/articles";
import {
  canReviewInfoSpotApprovals,
  getInfoSpotAccessContext,
} from "@/lib/infospot-access";
import { getPublicEditorialCoverageByArticleSlug } from "@/lib/public-coverage";
import { authorDisplayName } from "@/lib/articles";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return { title: "Noticia" };

  const coverage = await getPublicEditorialCoverageByArticleSlug(slug);
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || undefined;
  const ogImage = coverage?.ogImageUrl || article.coverImage?.url || undefined;
  const authors = authorDisplayName(article.author);

  return {
    title,
    description,
    alternates: { canonical: `/noticias/${article.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/noticias/${article.slug}`,
      images: ogImage
        ? [
            {
              url: ogImage,
              alt: coverage?.coverPhoto?.altText || article.title,
            },
          ]
        : undefined,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: authors ? [authors] : undefined,
      ...(coverage?.coverPhoto?.credit
        ? { section: coverage.coverPhoto.credit }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    other: coverage?.event
      ? {
          "article:section": article.category?.name || "",
          "infospot:event": coverage.event.slug,
        }
      : undefined,
  };
}

export default async function NoticiaDetallePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const [relatedPool, publicCoverage] = await Promise.all([
    getPublishedArticles({
      take: 8,
      categorySlug: article.category?.slug,
    }),
    getPublicEditorialCoverageByArticleSlug(slug),
  ]);
  const related = relatedPool.filter((a) => a.id !== article.id).slice(0, 4);

  let albumAvailability = null;
  if (article.clfAlbumId && !publicCoverage?.albums?.length) {
    const album = await prisma.album.findFirst({
      where: { id: article.clfAlbumId },
      select: {
        publicSlug: true,
        isHidden: true,
        isPublic: true,
        deletedAt: true,
        firstPhotoDate: true,
        createdAt: true,
        expirationExtensionDays: true,
        cleanupStatus: true,
      },
    });
    if (album) {
      albumAvailability = resolveClfAlbumCommercialAvailability({
        publicSlug: album.publicSlug,
        isHidden: album.isHidden,
        isPublic: album.isPublic,
        deletedAt: album.deletedAt,
        firstPhotoDate: album.firstPhotoDate,
        createdAt: album.createdAt,
        expirationExtensionDays: album.expirationExtensionDays,
        cleanupStatus: album.cleanupStatus,
        storagePurged: album.cleanupStatus === "COMPLETED",
      });
    }
  }

  const access = await getInfoSpotAccessContext();
  const showDirectorCommerceActions = canReviewInfoSpotApprovals(access?.subject);

  const ogImage = publicCoverage?.ogImageUrl || article.coverImage?.url;
  const imageObjects =
    publicCoverage?.galleryPhotos
      .filter((p) => p.src)
      .slice(0, 5)
      .map((p) => ({
        "@type": "ImageObject",
        contentUrl: p.src,
        creditText: p.credit,
        creator: {
          "@type": "Person",
          name: p.photographerName,
        },
        description: p.altText,
      })) ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt.toISOString() } : {}),
    dateModified: article.updatedAt.toISOString(),
    ...(ogImage ? { image: [ogImage] } : {}),
    author: {
      "@type": "Person",
      name: article.author?.name || article.author?.email || "Redacción Info Spot",
      ...(article.author?.logoUrl ? { image: article.author.logoUrl } : {}),
      url: `/autores/${article.author.id}`,
    },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: "Info Spot",
    },
    mainEntityOfPage: `/noticias/${article.slug}`,
    ...(publicCoverage?.event
      ? {
          about: {
            "@type": "Event",
            name: publicCoverage.event.title,
            url: `/eventos/${publicCoverage.event.slug}`,
            startDate: publicCoverage.event.startAt.toISOString(),
            location: {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                addressLocality: publicCoverage.event.city,
                addressRegion: publicCoverage.event.province,
                addressCountry: "AR",
              },
            },
          },
        }
      : {}),
    ...(imageObjects.length ? { associatedMedia: imageObjects } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleView
        article={article}
        related={related}
        albumAvailability={albumAvailability}
        showDirectorCommerceActions={showDirectorCommerceActions}
        publicCoverage={publicCoverage}
      />
    </>
  );
}
