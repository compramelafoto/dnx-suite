import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { resolveWebsiteColors } from "@/lib/website/branding-defaults";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { listBlogPosts } from "@/lib/blog/public";
import { withBlogPage } from "@/lib/website/site-menu";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { PageHeader } from "@/components/page-header";
import { WebsiteBuilder } from "@/components/website/builder/website-builder";

export default async function WebsiteBuilderPage({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const [{ workspace, canEdit, status, sections, designPresets, menu, draftUpdatedAtIso }, { panel }] = await Promise.all([
    loadWebsiteCmsContext(),
    searchParams,
  ]);

  const [branding, enabledModuleKeys, personVocabulary, hasPublishedBlog] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
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
    }),
    getEnabledModuleKeysForWorkspace(workspace.id),
    loadPersonVocabulary(workspace.id),
    // Misma regla que el sitio público: el blog va al menú si tiene al menos un artículo.
    listBlogPosts({ workspaceId: workspace.id, slug: "", nombre: workspace.name, logoUrl: null }, { limit: 1 }).then((p) => p.length > 0),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Sitio web" description="Construí tu sitio público eligiendo una plantilla, armando secciones y ajustando el diseño — todo con vista previa en vivo." />
      <WebsiteBuilder
        initialBlocks={sections.pages.home ?? []}
        initialColors={resolveWebsiteColors(branding)}
        initialLogoUrl={branding?.logoUrl ?? null}
        initialFaviconUrl={branding?.faviconUrl ?? null}
        initialDesignPresets={designPresets}
        initialMenu={menu}
        enabledModuleKeys={[...withBlogPage(enabledModuleKeys, hasPublishedBlog)]}
        personVocabulary={personVocabulary}
        initialPanel={panel === "menu" ? "MENU" : undefined}
        workspaceName={branding?.commercialName ?? workspace.name}
        organizationType={normalizeFotofficeOrganizationType(branding?.activityType) || null}
        canEdit={canEdit}
        draftUpdatedAt={draftUpdatedAtIso}
        status={status}
      />
    </div>
  );
}
