import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWebsiteContext } from "@/lib/workspace";
import { WEBSITE_DEFAULT_COLORS } from "@/lib/website/branding-defaults";
import { websiteDesignCssVars } from "@/lib/website/design-presets";
import { datosDeMuestra } from "@/lib/website/dynamic-data";
import { HOME_PAGE_KEY } from "@/lib/website/pages";
import type { SiteNavItem } from "@/lib/website/site-nav";
import { fotosDeLaPlantilla, getWebsiteTemplate } from "@/lib/website/templates";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { WebsiteHeaderView } from "@/components/website/render/website-header-view";
import { SiteFrame } from "@/components/website/render/site-frame";

export const metadata: Metadata = { title: "Vista previa de la plantilla", robots: { index: false, follow: false } };

/**
 * Vista previa REAL de una plantilla: la dibuja el mismo renderer del sitio, con datos de
 * MUESTRA (6 trabajos y 3 testimonios ficticios con las fotos de muestra de la plantilla; nunca
 * datos de un cliente). Sólo para el panel: pide el workspace activo con el sitio web habilitado,
 * igual que `/website/preview`, y no se indexa.
 *
 * `?pagina=<clave>` dibuja otra página de la plantilla; `?miniatura=1` saca la franja de arriba
 * (la usa el selector, que la muestra achicada en un iframe).
 */
export default async function TemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string | string[]; miniatura?: string | string[] }>;
}) {
  const [{ id }, { pagina, miniatura }, { workspace }] = await Promise.all([params, searchParams, requireWebsiteContext()]);
  const plantilla = getWebsiteTemplate(id);
  if (!plantilla) notFound();

  const base = `/website/plantillas/${plantilla.id}/preview`;
  const sufijo = miniatura === "1" ? "&miniatura=1" : "";
  const hrefDe = (clave: string) => (clave === HOME_PAGE_KEY ? `${base}${sufijo ? `?${sufijo.slice(1)}` : ""}` : `${base}?pagina=${encodeURIComponent(clave)}${sufijo}`);

  const actual = plantilla.paginas.find((p) => p.clave === pagina) ?? plantilla.paginas[0]!;
  const paginas = Object.fromEntries(plantilla.paginas.flatMap((p) => (p.meta ? [[p.meta.slug, hrefDe(p.clave)]] : [])));
  const dynamicData = datosDeMuestra({ bloques: actual.bloques, fotos: fotosDeLaPlantilla(plantilla), paginas });

  // El menú de la plantilla, apuntando a sus propias páginas de muestra.
  const navItems: SiteNavItem[] = plantilla.menu.items.flatMap((item): SiteNavItem[] => {
    if (item.hidden) return [];
    if (item.kind === "page" && item.page === HOME_PAGE_KEY) return [{ id: item.id, label: item.label || "Inicio", href: hrefDe(HOME_PAGE_KEY), exact: true, children: [] }];
    if (item.kind !== "custom") return [];
    const destino = plantilla.paginas.find((p) => p.clave === item.pageKey);
    return destino?.meta ? [{ id: item.id, label: item.label || destino.meta.title, href: hrefDe(destino.clave), children: [] }] : [];
  });

  // Se ve con los colores sugeridos (así luce la plantilla); el sitio los toma sólo si el dueño acepta.
  const colors = plantilla.coloresSugeridos ?? { ...WEBSITE_DEFAULT_COLORS };
  const themeVars = {
    "--wsite-primary": colors.primaryColor,
    "--wsite-secondary": colors.secondaryColor,
    "--wsite-bg": colors.backgroundColor,
    "--wsite-text": colors.textColor,
    "--wsite-accent": colors.accentColor,
    ...websiteDesignCssVars(plantilla.design),
  } as CSSProperties;

  return (
    <div className="min-h-screen">
      {miniatura === "1" ? null : (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-[var(--fo-text)] px-4 py-2.5 text-sm text-white">
          <span>
            Plantilla «{plantilla.nombre}» con textos, fotos, trabajos y testimonios de muestra.
          </span>
          <Link href="/website" className="shrink-0 underline underline-offset-2">
            Volver al editor
          </Link>
        </div>
      )}
      <SiteFrame
        designPresets={plantilla.design}
        style={themeVars}
        header={
          <WebsiteHeaderView logoUrl={null} workspaceName={workspace.name} navItems={navItems} designPresets={plantilla.design} homeHref={hrefDe(HOME_PAGE_KEY)} loginHref="#" />
        }
      >
        <WebsitePageRenderer blocks={actual.bloques} colors={colors} designPresets={plantilla.design} dynamicData={dynamicData} />
      </SiteFrame>
    </div>
  );
}
