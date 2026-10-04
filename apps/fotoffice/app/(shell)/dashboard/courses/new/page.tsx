import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CourseEditorForm } from "@/components/presential-courses/course-editor-form";
import { requireCoursesSalesContext } from "@/lib/workspace";

export default async function DashboardCourseNewPage() {
  // Es un formulario de alta: sin MANAGE en cursos no hay nada que hacer acá (la acción lo vuelve
  // a pedir). Antes la página no tenía guarda propia.
  await requireCoursesSalesContext("MANAGE");
  return (
    <div className="space-y-10">
      <PageHeader
        title="Crear curso"
        description="Completá la información base, la página de venta, FAQ y Classroom."
        actions={
          <Link href="/dashboard/courses" className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        }
      />
      <CourseEditorForm mode="create" />
    </div>
  );
}
