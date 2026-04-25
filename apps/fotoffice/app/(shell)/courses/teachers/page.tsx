import Link from "next/link";
import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { Users } from "lucide-react";

export default async function TeachersListPage() {
  const { workspace } = await requireCoursesSalesContext();
  const teachers = await prisma.courseSalesTeacher.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { fullName: "asc" },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Docentes"
        description="Perfiles públicos asociados a tus cursos: biografía, contacto y visibilidad."
        actions={
          <Link href="/courses/teachers/new" className="fo-btn fo-btn-primary text-sm">
            Nuevo docente
          </Link>
        }
      />

      {teachers.length === 0 ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Users className="size-7" aria-hidden />
          </div>
          <div className="space-y-2 max-w-md">
            <p className="text-base font-semibold text-[var(--fo-text)]">Sin docentes cargados</p>
            <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
              Los docentes aparecen en la landing del curso. Cargá nombre, bio y medios de contacto
              antes de publicar.
            </p>
          </div>
          <Link href="/courses/teachers/new" className="fo-btn fo-btn-primary text-sm">
            Crear primer docente
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Especialidad</th>
                <th className="px-4 py-3 font-semibold">Visible</th>
                <th className="px-4 py-3 font-semibold w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-[var(--fo-surface-hover)]/60">
                  <td className="px-4 py-3 font-medium text-[var(--fo-text)]">{t.fullName}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)] font-mono text-xs">{t.slug}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{t.specialty ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">
                    {t.isPublished ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/courses/teachers/${t.id}/edit`}
                      className="text-[var(--fo-accent)] font-medium hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
