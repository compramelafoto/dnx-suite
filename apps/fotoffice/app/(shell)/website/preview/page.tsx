import type { CSSProperties } from "react";
import Link from "next/link";
import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { resolveWebsiteColors } from "@/lib/website/branding-defaults";
import { websiteDesignCssVars } from "@/lib/website/design-presets";
import { resolveSiteNav, toPreviewNav } from "@/lib/website/site-menu";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { listBlogPosts } from "@/lib/blog/public";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { WebsiteHeaderView } from "@/components/website/render/website-header-view";
import { SiteFrame } from "@/components/website/render/site-frame";

/**
 * Vista previa del BORRADOR (nunca de la versión publicada) — ver Parte 11 del pedido. Ruta
 * protegida: hereda el gate de `(shell)/layout.tsx` (auth + acceso a la app) y además
 * `loadWebsiteCmsContext` exige el workspace activo con el módulo Website habilitado. No usa
 * `WebsiteShell` a propósito: debe parecerse al sitio, no al panel de administración.
 */
export default async function WebsitePreviewPage() {
  const { workspace, sections, designPresets, menu } = await loadWebsiteCmsContext();

  const [branding, enabledModuleKeys, personVocabulary, hasPublishedBlog] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: workspace.id },
      select: { primaryColor: true, secondaryColor: true, backgroundColor: true, textColor: true, accentColor: true, logoUrl: true, commercialName: true },
    }),
    getEnabledModuleKeysForWorkspace(workspace.id),
    loadPersonVocabulary(workspace.id),
    listBlogPosts({ workspaceId: workspace.id, slug: "", nombre: workspace.name, logoUrl: null }, { limit: 1 }).then((p) => p.length > 0),
  ]);
  const colors = resolveWebsiteColors(branding);
  const blocks = sections.pages.home ?? [];
  const navItems = toPreviewNav(
    resolveSiteNav({ workspaceSlug: "vista-previa", homeBlocks: blocks, enabledModuleKeys, hasPublishedSite: true, menu, personVocabulary, hasPublishedBlog }),
  );
  const themeVars = {
    "--wsite-primary": colors.primaryColor,
    "--wsite-secondary": colors.secondaryColor,
    "--wsite-bg": colors.backgroundColor,
    "--wsite-text": colors.textColor,
    "--wsite-accent": colors.accentColor,
    ...websiteDesignCssVars(designPresets),
  } as CSSProperties;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[var(--fo-text)] px-4 py-2.5 text-white text-sm">
        <span>Vista previa del borrador — esto todavía no es lo publicado.</span>
        <Link href="/website" className="underline underline-offset-2 shrink-0">
          Volver al editor
        </Link>
      </div>
      <div className="relative">
        <SiteFrame
          designPresets={designPresets}
          style={themeVars}
          header={
            <WebsiteHeaderView
              logoUrl={branding?.logoUrl ?? null}
              workspaceName={branding?.commercialName ?? workspace.name}
              navItems={navItems}
              designPresets={designPresets}
              homeHref="#"
            />
          }
        >
          <WebsitePageRenderer blocks={blocks} colors={colors} designPresets={designPresets} />
        </SiteFrame>
      </div>
    </div>
  );
}
