import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { TeacherForm } from "@/components/teacher-form";

export default async function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireCoursesSalesContext();
  const teacher = await prisma.courseSalesTeacher.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!teacher) notFound();

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Editar: ${teacher.fullName}`}
        description="Actualizá datos de contacto, biografía y visibilidad."
        actions={
          <Link href="/courses/teachers" className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        }
      />
      <TeacherForm teacher={teacher} />
    </div>
  );
}
