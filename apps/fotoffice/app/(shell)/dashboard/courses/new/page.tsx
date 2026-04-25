import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { CourseEditorForm } from "@/components/presential-courses/course-editor-form";

export default function DashboardCourseNewPage() {
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
