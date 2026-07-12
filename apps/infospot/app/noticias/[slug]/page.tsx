import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma, resolveClfAlbumCommercialAvailability } from "@repo/db";
import { ArticleView } from "@/components/editorial/article-view";
import { getPublishedArticleBySlug, getPublishedArticles } from "@/lib/articles";
import {
  canReviewInfoSpotApprovals,
  getInfoSpotAccessContext,
} from "@/lib/infospot-access";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return { title: "Noticia" };
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/noticias/${article.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      images: article.coverImage?.url ? [article.coverImage.url] : undefined,
      publishedTime: article.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: article.coverImage?.url ? [article.coverImage.url] : undefined,
    },
  };
}

export default async function NoticiaDetallePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const relatedPool = await getPublishedArticles({
    take: 8,
    categorySlug: article.category?.slug,
  });
  const related = relatedPool.filter((a) => a.id !== article.id).slice(0, 4);

  let albumAvailability = null;
  if (article.clfAlbumId) {
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt.toISOString() } : {}),
    dateModified: article.updatedAt.toISOString(),
    ...(article.coverImage?.url ? { image: [article.coverImage.url] } : {}),
    author: {
      "@type": "Person",
      name: article.author?.name || article.author?.email || "Redacción Info Spot",
    },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: "Info Spot",
    },
    mainEntityOfPage: `/noticias/${article.slug}`,
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
      />
    </>
  );
}
