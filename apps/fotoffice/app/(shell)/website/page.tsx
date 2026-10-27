import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { resolveWebsiteColors } from "@/lib/website/branding-defaults";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { listBlogPosts } from "@/lib/blog/public";
import { hayTrabajosPublicados } from "@/lib/trabajos/publico";
import { hayTestimoniosPublicados } from "@/lib/testimonios/publico";
import { withTestimoniosPage, withTrabajosPage } from "@/lib/website/public-modules";
import { withBlogPage } from "@/lib/website/site-menu";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { PageHeader } from "@/components/page-header";
import { WebsiteBuilder } from "@/components/website/builder/website-builder";
import { canEditWebsiteIdentity } from "@/lib/website/identity-access";
import { resumenDeVisitas } from "@/lib/website/visitas.server";
import { visitasPorSlug } from "@/lib/website/visitas";

export default async function WebsiteBuilderPage({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const [{ workspace, user, canEdit, status, sections, designPresets, menu, draftUpdatedAtIso }, { panel }] = await Promise.all([
    loadWebsiteCmsContext(),
    searchParams,
  ]);
  // El logo y el favicon son la identidad de la institución: sólo dueño/admin (ver la acción).
  const canEditIdentity = canEdit && (await canEditWebsiteIdentity(user.id, workspace.id));

  const [branding, modulosEncendidos, personVocabulary, hasPublishedBlog, hasPublishedTrabajos, hasPublishedTestimonios, visitas] = await Promise.all([
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
    // Y Trabajos, con al menos un trabajo publicado.
    hayTrabajosPublicados(workspace.id).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudo saber si hay trabajos publicados:", err);
      return false;
    }),
    // Y Testimonios, con al menos un testimonio publicado.
    hayTestimoniosPublicados(workspace.id).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudo saber si hay testimonios publicados:", err);
      return false;
    }),
    // Visitas de los últimos 30 días, para mostrarlas junto a cada página (null = falta la tabla).
    resumenDeVisitas(workspace.id, 30).catch((err: unknown) => {
      console.error("[fotoffice][website] no se pudieron leer las visitas:", err);
      return null;
    }),
  ]);
  const enabledModuleKeys = withTestimoniosPage(withTrabajosPage(modulosEncendidos, hasPublishedTrabajos), hasPublishedTestimonios);

  return (
    <div className="space-y-4">
      <PageHeader title="Sitio web" description="Construí tu sitio público eligiendo una plantilla, armando secciones y ajustando el diseño — todo con vista previa en vivo." />
      <WebsiteBuilder
        initialPages={{ pages: sections.pages, pageMeta: sections.pageMeta }}
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
        canEditIdentity={canEditIdentity}
        draftUpdatedAt={draftUpdatedAtIso}
        status={status}
        visitasPorPagina={visitas ? visitasPorSlug(visitas.porPagina) : null}
      />
    </div>
  );
}
