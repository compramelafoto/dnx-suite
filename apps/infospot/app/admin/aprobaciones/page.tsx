import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@repo/db";
import { PageShell } from "@/components/page-shell";
import {
  canReviewInfoSpotApprovals,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";
import { redirect } from "next/navigation";
import { ApprovalQueue } from "@/components/admin/approval-queue";
import { summarizeChecklist } from "@/lib/redaccion-queues";
import { formatDateTimeEs } from "@/lib/dates";
import { authorDisplayName } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Aprobaciones editoriales",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  redactor?: string;
  categoria?: string;
  orden?: string;
  checklist?: string;
}>;

export default async function AdminAprobacionesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const access = await requireInfoSpotAdminAccess();
  if (!canReviewInfoSpotApprovals(access.subject)) {
    redirect("/ingresar?forbidden=infospot-admin");
  }

  const params = await searchParams;
  const redactorId = params.redactor ? Number(params.redactor) : null;
  const categoriaId = params.categoria?.trim() || null;
  const orden = params.orden === "antiguas" ? "antiguas" : "recientes";
  const checklistFilter = params.checklist || "todas";

  const articles = await prisma.infoSpotArticle.findMany({
    where: {
      status: "IN_REVIEW",
      ...(redactorId && Number.isFinite(redactorId)
        ? { authorId: redactorId }
        : {}),
      ...(categoriaId ? { categoryId: categoriaId } : {}),
    },
    orderBy: [
      orden === "antiguas"
        ? { submittedForReviewAt: "asc" }
        : { submittedForReviewAt: "desc" },
      { updatedAt: "desc" },
    ],
    include: {
      author: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, name: true, slug: true } },
      coverImage: {
        select: { id: true, url: true, thumbnailUrl: true, credit: true },
      },
      observations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const [redactores, categorias] = await Promise.all([
    prisma.infoSpotUserRole.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["INFOSPOT_REDACTOR", "INFOSPOT_COLABORADOR", "INFOSPOT_DIRECTOR"] },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.infoSpotCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const items = articles
    .map((article) => {
      const checklist = summarizeChecklist(article);
      return {
        id: article.id,
        title: article.title,
        authorId: article.authorId,
        authorLabel: authorDisplayName(article.author),
        categoryId: article.categoryId,
        categoryLabel: article.category?.name ?? "Sin categoría",
        coverUrl: article.coverImage?.thumbnailUrl || article.coverImage?.url || null,
        submittedAtLabel: article.submittedForReviewAt
          ? formatDateTimeEs(article.submittedForReviewAt)
          : "Sin fecha de envío",
        updatedAtLabel: formatDateTimeEs(article.updatedAt),
        checklistDone: checklist.done,
        checklistTotal: checklist.total,
        checklistMissing: checklist.missing,
        checklistComplete: checklist.done === checklist.total && checklist.total > 0,
        sourceName: article.sourceName,
        observation: article.observations[0]
          ? {
              message: article.observations[0].message,
              author:
                article.observations[0].author.name?.trim() ||
                article.observations[0].author.email,
              at: formatDateTimeEs(article.observations[0].createdAt),
            }
          : null,
        expectedAction: checklist.done === checklist.total
          ? "Publicar o devolver"
          : "Revisar pendientes y devolver o completar",
      };
    })
    .filter((item) => {
      if (checklistFilter === "incompleto") return !item.checklistComplete;
      if (checklistFilter === "listas") return item.checklistComplete;
      return true;
    });

  return (
    <PageShell
      title="Aprobaciones editoriales"
      description="Notas en revisión que esperan tu decisión. Sin aprobación masiva en este MVP."
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
        >
          ← Admin
        </Link>
        <p className="text-sm text-[var(--is-muted)]">
          {items.length} pendiente{items.length === 1 ? "" : "s"}
        </p>
      </div>

      <ApprovalQueue
        items={items}
        filters={{
          redactor: redactorId && Number.isFinite(redactorId) ? String(redactorId) : "",
          categoria: categoriaId ?? "",
          orden,
          checklist: checklistFilter,
        }}
        redactores={redactores.map((r) => ({
          id: String(r.userId),
          label: r.user.name?.trim() || r.user.email,
        }))}
        categorias={categorias.map((c) => ({ id: c.id, label: c.name }))}
      />
    </PageShell>
  );
}
