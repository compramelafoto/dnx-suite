import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createArticleAndRedirect } from "@/app/actions/articles";
import { ArticleForm } from "@/components/redaccion/article-form";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { getCategories, listUploadAssets } from "@/lib/articles";
import {
  canManageInfoSpotSettings,
  canPublishInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Nueva noticia",
};

type PageProps = {
  searchParams: Promise<{ error?: string; directo?: string }>;
};

/**
 * Por defecto el flujo pasa por el Asistente Editorial.
 * `?directo=1` conserva el formulario vacío legacy (power users).
 */
export default async function NuevaNoticiaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.directo !== "1") {
    const q = new URLSearchParams();
    q.set("intent", "independent");
    if (params.error) q.set("error", params.error);
    redirect(`/redaccion/asistente?${q.toString()}`);
  }

  const access = await requireInfoSpotRedaccionAccess();
  const [categories, assets] = await Promise.all([getCategories(), listUploadAssets()]);

  return (
    <RedaccionShell variant="editor">
      <FlashBanner error={params.error} />
      <ArticleForm
        mode="create"
        action={createArticleAndRedirect}
        categories={categories}
        assets={assets.map((a) => ({
          id: a.id,
          url: a.url,
          caption: a.caption,
          credit: a.credit,
          sourceType: "UPLOAD" as const,
        }))}
        canPublish={canPublishInfoSpotArticle(access.subject)}
        isDirector={canManageInfoSpotSettings(access.subject)}
        subject={access.subject}
        authorLabel={access.user.name?.trim() || access.user.email}
      />
    </RedaccionShell>
  );
}
