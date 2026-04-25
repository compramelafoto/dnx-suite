import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { ModuleSettingsForm } from "@/components/module-settings-form";
import { slugify } from "@/lib/slug";

export default async function CoursesSettingsPage() {
  const { workspace } = await requireCoursesSalesContext();

  const [branding, settings] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id } }),
    prisma.courseSalesWorkspaceSettings.findUnique({ where: { workspaceId: workspace.id } }),
  ]);

  const fallbackSlug = slugify(workspace.name) || `ws-${workspace.id.slice(0, 8)}`;

  const initialValues = {
    publicSlug: branding?.publicSlug ?? fallbackSlug,
    commercialName: branding?.commercialName ?? workspace.name,
    logoUrl: branding?.logoUrl ?? null,
    coverImageUrl: branding?.coverImageUrl ?? null,
    contactEmail: branding?.contactEmail ?? null,
    phone: branding?.phone ?? null,
    whatsapp: branding?.whatsapp ?? null,
    instagram: branding?.instagram ?? null,
    website: branding?.website ?? null,
    defaultCurrency: settings?.defaultCurrency ?? "ARS",
    enrollmentCtaLabel: settings?.enrollmentCtaLabel ?? "Quiero inscribirme",
    coursesFeePercent: settings?.coursesFeePercent.toString() ?? "10",
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Configuración del módulo"
        description="Branding y datos de contacto que verán tus visitantes en las páginas públicas de venta."
      />
      <ModuleSettingsForm initialValues={initialValues} />
    </div>
  );
}
