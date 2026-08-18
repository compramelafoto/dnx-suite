import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { ModuleSettingsForm } from "@/components/module-settings-form";

export default async function CoursesSettingsPage() {
  const { workspace } = await requireCoursesSalesContext();

  const settings = await prisma.courseSalesWorkspaceSettings.findUnique({
    where: { workspaceId: workspace.id },
  });

  const initialValues = {
    defaultCurrency: settings?.defaultCurrency ?? "ARS",
    enrollmentCtaLabel: settings?.enrollmentCtaLabel ?? "Quiero inscribirme",
    coursesFeePercent: settings?.coursesFeePercent.toString() ?? "10",
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Configuración del módulo"
        description="Ajustes comerciales de venta de cursos: moneda, fee de la plataforma y texto de inscripción."
      />
      <ModuleSettingsForm initialValues={initialValues} />
    </div>
  );
}
