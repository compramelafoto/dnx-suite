import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { resolveWebsiteColors } from "@/lib/website/branding-defaults";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { PageHeader } from "@/components/page-header";
import { WebsiteBuilder } from "@/components/website/builder/website-builder";
import { canEditWebsiteIdentity } from "@/lib/website/identity-access";

export default async function WebsiteBuilderPage() {
  const { workspace, user, canEdit, status, sections, designPresets, draftUpdatedAtIso } = await loadWebsiteCmsContext();
  // El logo y el favicon son la identidad de la institución: sólo dueño/admin (ver la acción).
  const canEditIdentity = canEdit && (await canEditWebsiteIdentity(user.id, workspace.id));

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: {
      primaryColor: true,
      secondaryColor: true,
      backgroundColor: true,
      textColor: true,
      accentColor: true,
      logoUrl: true,
      faviconUrl: true,
      activityType: true,
      commercialName: true,
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Sitio web" description="Construí tu sitio público eligiendo una plantilla, armando secciones y ajustando el diseño — todo con vista previa en vivo." />
      <WebsiteBuilder
        initialBlocks={sections.pages.home ?? []}
        initialColors={resolveWebsiteColors(branding)}
        initialLogoUrl={branding?.logoUrl ?? null}
        initialFaviconUrl={branding?.faviconUrl ?? null}
        initialDesignPresets={designPresets}
        workspaceName={branding?.commercialName ?? workspace.name}
        organizationType={normalizeFotofficeOrganizationType(branding?.activityType) || null}
        canEdit={canEdit}
        canEditIdentity={canEditIdentity}
        draftUpdatedAt={draftUpdatedAtIso}
        status={status}
      />
    </div>
  );
}
