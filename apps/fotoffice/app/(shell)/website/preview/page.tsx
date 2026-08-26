import type { CSSProperties } from "react";
import Link from "next/link";
import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { resolveWebsiteColors } from "@/lib/website/branding-defaults";
import { websiteDesignCssVars } from "@/lib/website/design-presets";
import { deriveHomeNavItems } from "@/lib/website/navigation";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { WebsiteHeaderView } from "@/components/website/render/website-header-view";

/**
 * Vista previa del BORRADOR (nunca de la versión publicada) — ver Parte 11 del pedido. Ruta
 * protegida: hereda el gate de `(shell)/layout.tsx` (auth + acceso a la app) y además
 * `loadWebsiteCmsContext` exige el workspace activo con el módulo Website habilitado. No usa
 * `WebsiteShell` a propósito: debe parecerse al sitio, no al panel de administración. El sitio
 * público real (`/w/[slug]`) NO se toca en esta etapa — este renderer solo se usa acá.
 */
export default async function WebsitePreviewPage() {
  const { workspace, sections, designPresets } = await loadWebsiteCmsContext();

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { primaryColor: true, secondaryColor: true, backgroundColor: true, textColor: true, accentColor: true, logoUrl: true, commercialName: true },
  });
  const colors = resolveWebsiteColors(branding);
  const blocks = sections.pages.home ?? [];
  const navItems = deriveHomeNavItems(blocks);
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
      <div className="relative" style={themeVars}>
        <WebsiteHeaderView
          logoUrl={branding?.logoUrl ?? null}
          workspaceName={branding?.commercialName ?? workspace.name}
          navItems={navItems}
          designPresets={designPresets}
        />
        <WebsitePageRenderer blocks={blocks} colors={colors} designPresets={designPresets} />
      </div>
    </div>
  );
}
