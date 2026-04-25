import Link from "next/link";
import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { CourseFormWizard } from "@/components/course-form-wizard";
import { GraduationCap } from "lucide-react";

export default async function NewCoursePage() {
  const { workspace } = await requireCoursesSalesContext();
  const teachers = await prisma.courseSalesTeacher.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Nuevo curso"
        description="Asistente en cuatro bloques: datos generales, programa, comercial y SEO/FAQ."
        actions={
          <Link href="/courses" className="fo-btn fo-btn-secondary text-sm">
            Cancelar
          </Link>
        }
      />

      {teachers.length === 0 ? (
        <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <GraduationCap className="size-7" aria-hidden />
          </div>
          <p className="text-sm text-[var(--fo-muted)] max-w-md leading-relaxed">
            Necesitás al menos un docente antes de crear un curso.
          </p>
          <Link href="/courses/teachers/new" className="fo-btn fo-btn-primary text-sm">
            Crear docente
          </Link>
        </div>
      ) : (
        <CourseFormWizard mode="create" teachers={teachers} />
      )}
    </div>
  );
}
