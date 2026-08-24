import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { ModuleSettingsForm } from "@/components/module-settings-form";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { formatFeeBpsAsPercent } from "@/lib/platform-fee/fee";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";

export default async function CoursesSettingsPage() {
  const { workspace } = await requireCoursesSalesContext();

  const settings = await prisma.courseSalesWorkspaceSettings.findUnique({
    where: { workspaceId: workspace.id },
  });

  const initialValues = {
    defaultCurrency: settings?.defaultCurrency ?? "ARS",
    enrollmentCtaLabel: settings?.enrollmentCtaLabel ?? "Quiero inscribirme",
    platformFee: formatFeeBpsAsPercent(
      await getPlatformFeeBps(workspace.id, COURSES_SALES_MODULE_KEY),
    ),
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Configuración del módulo"
        description="Ajustes comerciales de venta de cursos: moneda y texto de inscripción."
      />
      <ModuleSettingsForm initialValues={initialValues} />
    </div>
  );
}
