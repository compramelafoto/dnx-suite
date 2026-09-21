import type { CSSProperties, ReactNode } from "react";
import { websiteDesignCssVars } from "@/lib/website/design-presets";
import { buildSiteNav } from "@/lib/website/site-nav";
import type { PublicSite } from "@/lib/website/public-site";
import { PublicSiteNavCurrentClient } from "./site-nav-current-client";

/**
 * El armazón que envuelve TODAS las páginas de `/w/[slug]` — la portada del sitio y las
 * páginas de los módulos por igual. Es lo que hace que dejen de ser páginas sueltas.
 *
 * Define acá las variables CSS del sitio (`--wsite-*`) para que valgan también dentro de las
 * páginas de módulos, que están escritas con los tokens del panel (`--fo-*`) y no las conocen.
 * Por eso el `<main>` no fuerza fondo ni color: cada página sigue pintándose como sabe, y lo
 * que se unifica es el marco.
 *
 * El menú se arma acá, en el servidor (`buildSiteNav`), con `currentPath` como mejor esfuerzo
 * inicial — hoy nunca se marca bien, porque la cabecera de la que depende no llega (ver el
 * comentario en `PublicSiteNavCurrentClient`). Quien corrige de verdad qué ítem es el actual es
 * ese componente de cliente: recibe el menú ya armado y sólo le corrige la marca con la ruta real
 * del navegador.
 */
export function PublicSiteShell({
  site,
  currentPath,
  children,
}: {
  site: PublicSite;
  currentPath: string;
  children: ReactNode;
}) {
  const navItems = buildSiteNav({
    workspaceSlug: site.workspaceSlug,
    homeBlocks: site.homeBlocks,
    enabledModuleKeys: site.enabledModuleKeys,
    currentPath,
    hasPublishedSite: site.hasPublishedSite,
  });

  const themeVars = {
    "--wsite-primary": site.colors.primaryColor,
    "--wsite-secondary": site.colors.secondaryColor,
    "--wsite-bg": site.colors.backgroundColor,
    "--wsite-text": site.colors.textColor,
    "--wsite-accent": site.colors.accentColor,
    ...websiteDesignCssVars(site.designPresets),
  } as CSSProperties;

  return (
    <div style={{ ...themeVars, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicSiteNavCurrentClient
        navItems={navItems}
        header={{
          logoUrl: site.logoUrl,
          workspaceName: site.commercialName,
          designPresets: site.designPresets,
          homeHref: `/w/${site.workspaceSlug}`,
        }}
        footer={{
          commercialName: site.commercialName,
          logoUrl: site.logoUrl,
          contact: site.contact,
          designPresets: site.designPresets,
        }}
      >
        <main style={{ flex: 1 }}>{children}</main>
      </PublicSiteNavCurrentClient>
    </div>
  );
}
