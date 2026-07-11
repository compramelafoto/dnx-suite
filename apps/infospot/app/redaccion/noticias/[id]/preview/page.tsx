import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/public/article-view";
import { getArticleByIdForEditor } from "@/lib/articles";
import { requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";
import { STATUS_LABELS, type ArticleStatus } from "@/lib/article-status";

export const metadata: Metadata = {
  title: "Vista previa",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PreviewNoticiaPage({ params }: PageProps) {
  await requireInfoSpotRedaccionAccess();
  const { id } = await params;
  const article = await getArticleByIdForEditor(id);
  if (!article) notFound();

  return (
    <div>
      <div className="border-b border-[var(--is-border)] bg-amber-50">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
          <p className="text-amber-900">
            Vista previa · estado: {STATUS_LABELS[article.status as ArticleStatus] ?? article.status}
          </p>
          <div className="flex gap-3">
            <Link
              href={`/redaccion/noticias/${article.id}/editar`}
              className="min-h-11 inline-flex items-center font-medium text-[var(--is-accent)]"
            >
              Editar
            </Link>
            <Link href="/redaccion" className="min-h-11 inline-flex items-center text-[var(--is-muted)]">
              Volver
            </Link>
          </div>
        </div>
      </div>
      <ArticleView article={article} badge="PREVIEW — no es la vista pública" />
    </div>
  );
}
