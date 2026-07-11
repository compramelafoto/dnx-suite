import type { Metadata } from "next";
import { createArticleAndRedirect } from "@/app/actions/articles";
import { ArticleForm } from "@/components/redaccion/article-form";
import { FlashBanner } from "@/components/redaccion/flash-banner";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { getCategories, listUploadAssets } from "@/lib/articles";
import { canPublishInfoSpotArticle, requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Nueva noticia",
};

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NuevaNoticiaPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;
  const [categories, assets] = await Promise.all([getCategories(), listUploadAssets()]);

  return (
    <RedaccionShell
      title="Nueva noticia"
      description="Podés guardar un borrador incompleto. Para publicar se exige extracto, contenido y categoría."
    >
      <FlashBanner error={params.error} />
      <ArticleForm
        mode="create"
        action={createArticleAndRedirect}
        categories={categories}
        assets={assets.map((a) => ({ id: a.id, url: a.url, caption: a.caption }))}
        canPublish={canPublishInfoSpotArticle(access.subject)}
      />
    </RedaccionShell>
  );
}
