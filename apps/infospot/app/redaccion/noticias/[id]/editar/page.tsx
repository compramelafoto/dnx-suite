import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { updateArticleAndRedirect } from "@/app/actions/articles";
import { ArticleForm } from "@/components/redaccion/article-form";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import {
  authorDisplayName,
  getArticleByIdForEditor,
  getCategories,
  listUploadAssets,
} from "@/lib/articles";
import {
  canManageInfoSpotSettings,
  canPublishInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { hasPendingReturn, type ArticleStatus } from "@/lib/article-status";

export const metadata: Metadata = {
  title: "Editar nota",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function EditarNoticiaPage({ params, searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const { id } = await params;
  const query = await searchParams;
  const [article, categories, assets] = await Promise.all([
    getArticleByIdForEditor(id),
    getCategories(),
    listUploadAssets(),
  ]);
  if (!article) notFound();

  const [event, album] = await Promise.all([
    article.eventId
      ? prisma.event.findUnique({
          where: { id: article.eventId },
          select: { id: true, title: true },
        })
      : null,
    article.clfAlbumId
      ? prisma.album.findUnique({
          where: { id: article.clfAlbumId },
          select: { id: true, title: true },
        })
      : null,
  ]);

  async function action(formData: FormData) {
    "use server";
    await updateArticleAndRedirect(id, formData);
  }

  const latestObs = article.observations?.[0];
  const pendingReturn = hasPendingReturn(article);
  const latestReturn =
    pendingReturn && latestObs
      ? {
          message: latestObs.message,
          createdAt: latestObs.createdAt,
          authorName: authorDisplayName(latestObs.author),
        }
      : null;

  return (
    <RedaccionShell title="Editar nota" description={article.title}>
      <FlashBanner ok={query.ok} error={query.error} />
      {latestReturn ? (
        <div className="mb-6 rounded-[var(--is-radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Nota devuelta — acción requerida</p>
          <p className="mt-1 leading-relaxed">{latestReturn.message}</p>
        </div>
      ) : null}
      <ArticleForm
        mode="edit"
        action={action}
        categories={categories}
        assets={assets.map((a) => ({
          id: a.id,
          url: a.url,
          caption: a.caption,
          credit: a.credit,
        }))}
        canPublish={canPublishInfoSpotArticle(access.subject)}
        isDirector={canManageInfoSpotSettings(access.subject)}
        subject={access.subject}
        authorLabel={authorDisplayName(article.author)}
        latestReturn={latestReturn}
        clf={{
          eventId: article.eventId,
          albumId: article.clfAlbumId,
          eventTitle: event?.title ?? null,
          albumTitle: album?.title ?? null,
          linkedAssets: article.articleAssets.map((link) => ({
            linkId: link.id,
            usageType: link.usageType as "COVER" | "INLINE" | "GALLERY",
            sortOrder: link.sortOrder,
            captionOverride: link.captionOverride,
            url: link.asset.url,
            thumbnailUrl: link.asset.thumbnailUrl,
            credit: link.asset.credit,
            photographerName: link.asset.photographerName,
          })),
        }}
        initial={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          content: article.content,
          categoryId: article.categoryId,
          coverImageId: article.coverImageId,
          coverCredit: article.coverImage?.credit ?? null,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          publishedAt: article.publishedAt,
          status: article.status as ArticleStatus,
          contentTag: article.contentTag,
          sourceName: article.sourceName,
          sourceUrl: article.sourceUrl,
          factCheckedAt: article.factCheckedAt,
          authorId: article.authorId,
          updatedAt: article.updatedAt,
          returnedAt: article.returnedAt,
          submittedForReviewAt: article.submittedForReviewAt,
        }}
      />
    </RedaccionShell>
  );
}
