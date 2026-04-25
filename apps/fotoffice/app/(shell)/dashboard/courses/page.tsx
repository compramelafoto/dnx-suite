import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/page-header";
import {
  duplicateCourse,
  listWorkspaceCourses,
} from "@/app/actions/presential-courses";

const statusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  UPCOMING: "Próximamente",
  HIDDEN: "Oculto",
};

export default async function DashboardCoursesPage() {
  const courses = await listWorkspaceCourses();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Cursos presenciales"
        description="Gestioná el catálogo de cursos, su estado y sus ediciones presenciales."
        actions={
          <Link href="/dashboard/courses/new" className="fo-btn fo-btn-primary text-sm">
            Crear curso
          </Link>
        }
      />

      {courses.length === 0 ? (
        <div className="fo-card">
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay cursos creados.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="fo-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
                  {statusLabel[course.status] ?? course.status}
                </p>
                <h2 className="text-lg font-semibold">{course.title}</h2>
                <p className="text-sm text-[var(--fo-muted)]">
                  Slug: <code className="text-xs">{course.slug}</code>
                </p>
                <p className="text-sm text-[var(--fo-muted)]">
                  Ediciones: {course._count.instances} · Inscripciones aprobadas: {course.approvedEnrollments}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/courses/${course.id}`} className="fo-btn fo-btn-secondary text-sm min-h-9">
                  Editar
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await duplicateCourse(course.id);
                    revalidatePath("/dashboard/courses");
                  }}
                >
                  <button type="submit" className="fo-btn fo-btn-ghost text-sm min-h-9">
                    Duplicar
                  </button>
                </form>
                <button type="button" disabled className="fo-btn fo-btn-ghost text-sm min-h-9 opacity-60 cursor-not-allowed">
                  Ver página (próximamente)
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
