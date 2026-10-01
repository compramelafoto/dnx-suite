import type { CSSProperties, ReactNode } from "react";
import { websiteDesignCssVars } from "@/lib/website/design-presets";
import { buildSiteNav } from "@/lib/website/site-nav";
import type { PublicSite } from "@/lib/website/public-site";
import { WebsiteHeaderView } from "./website-header-view";
import { WebsiteFooterView } from "./website-footer-view";

/**
 * El armazón que envuelve TODAS las páginas de `/w/[slug]` — la portada del sitio y las
 * páginas de los módulos por igual. Es lo que hace que dejen de ser páginas sueltas.
 *
 * Define acá las variables CSS del sitio (`--wsite-*`) para que valgan también dentro de las
 * páginas de módulos, que están escritas con los tokens del panel (`--fo-*`) y no las conocen.
 * Por eso el `<main>` no fuerza fondo ni color: cada página sigue pintándose como sabe, y lo
 * que se unifica es el marco.
 *
 * `WebsiteHeaderView` y `WebsiteFooterView` siguen siendo Server Components enteros — ninguno de
 * los dos se envuelve en un límite de cliente acá. El pie no necesita saber la ruta actual (sólo
 * pinta `label`/`href`). El header sí, pero resuelve eso por dentro con un componente de cliente
 * chiquito acotado sólo al menú (`WebsiteHeaderNavClient`), con `usePathname()` — ver el
 * comentario en `website-header-view.tsx`. `buildSiteNav` no conoce la ruta actual: sólo arma
 * la lista de ítems, sin marcar ninguno.
 */
export function PublicSiteShell({
  site,
  children,
}: {
  site: PublicSite;
  children: ReactNode;
}) {
  const navItems = buildSiteNav({
    workspaceSlug: site.workspaceSlug,
    homeBlocks: site.homeBlocks,
    enabledModuleKeys: site.enabledModuleKeys,
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
      <WebsiteHeaderView
        logoUrl={site.logoUrl}
        workspaceName={site.commercialName}
        navItems={navItems}
        designPresets={site.designPresets}
        homeHref={`/w/${site.workspaceSlug}`}
      />
      <div style={{ flex: 1 }}>{children}</div>
      <WebsiteFooterView
        commercialName={site.commercialName}
        logoUrl={site.logoUrl}
        contact={site.contact}
        navItems={navItems}
        designPresets={site.designPresets}
      />
    </div>
  );
}
