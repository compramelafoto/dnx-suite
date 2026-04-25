import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TeacherForm } from "@/components/teacher-form";

export default function NewTeacherPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Nuevo docente"
        description="Completá el perfil del docente. Podés editarlo en cualquier momento."
        actions={
          <Link href="/courses/teachers" className="fo-btn fo-btn-secondary text-sm">
            Volver al listado
          </Link>
        }
      />
      <TeacherForm />
    </div>
  );
}
