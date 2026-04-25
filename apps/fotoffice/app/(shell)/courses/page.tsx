import Link from "next/link";
import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { formatMoney } from "@/lib/format";
import { BookOpen, ExternalLink } from "lucide-react";

const statusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  PAUSED: "Pausado",
};

export default async function CoursesListPage() {
  const { workspace } = await requireCoursesSalesContext();

  const [courses, branding] = await Promise.all([
    prisma.courseSalesCourse.findMany({
      where: { workspaceId: workspace.id },
      include: { teacher: { select: { fullName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: workspace.id },
      select: { publicSlug: true },
    }),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Cursos"
        description="Creá y editá cursos; cada uno genera una landing pública automática cuando está publicado."
        actions={
          <Link href="/courses/new" className="fo-btn fo-btn-primary text-sm">
            Nuevo curso
          </Link>
        }
      />

      {courses.length === 0 ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <BookOpen className="size-7" aria-hidden />
          </div>
          <div className="space-y-2 max-w-md">
            <p className="text-base font-semibold text-[var(--fo-text)]">Todavía no hay cursos</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Creá al menos un docente y luego un curso. El asistente te guía por bloques: datos
              generales, programa, precios y publicación.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/courses/teachers/new" className="fo-btn fo-btn-secondary text-sm">
              Nuevo docente
            </Link>
            <Link href="/courses/new" className="fo-btn fo-btn-primary text-sm">
              Crear curso
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id} className="fo-card flex flex-col gap-3">
              <div className="flex justify-between gap-2 items-start">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted-soft)]">
                    {statusLabel[c.status] ?? c.status}
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--fo-text)] mt-1 truncate">
                    {c.title}
                  </h2>
                  {c.subtitle ? (
                    <p className="text-sm text-[var(--fo-muted)] mt-1 line-clamp-2">{c.subtitle}</p>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-[var(--fo-muted)]">
                Docente:{" "}
                <span className="text-[var(--fo-text)]">{c.teacher.fullName}</span>
              </p>
              <p className="text-sm font-medium text-[var(--fo-text)]">
                {formatMoney(c.price, c.currency)}
                {c.discountPrice ? (
                  <span className="text-[var(--fo-muted)] line-through ml-2 font-normal">
                    {formatMoney(c.discountPrice, c.currency)}
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link href={`/courses/${c.id}/edit`} className="fo-btn fo-btn-secondary text-sm min-h-9">
                  Editar
                </Link>
                {branding && c.status === "PUBLISHED" ? (
                  <Link
                    href={`/w/${branding.publicSlug}/cursos/${c.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fo-btn fo-btn-ghost text-sm min-h-9 inline-flex items-center gap-1"
                  >
                    Ver landing
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
