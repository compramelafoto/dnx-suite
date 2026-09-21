"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { PublicSiteContact } from "@/lib/website/public-site";
import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";
import { WebsiteHeaderView } from "./website-header-view";
import { WebsiteFooterView } from "./website-footer-view";

/** Sin la barra final — el mismo criterio que usa `buildSiteNav` en `lib/website/site-nav.ts`,
 * para que `/reservas` y `/reservas/` marquen el mismo ítem. */
function normalizar(path: string): string {
  const limpio = path.replace(/\/+$/, "");
  return limpio === "" ? "/" : limpio;
}

/**
 * Vuelve a decidir qué ítem del menú es "el actual", con la ruta real del navegador.
 *
 * NO arma el menú de nuevo: `navItems` ya viene armado por `buildSiteNav`, en el servidor, con
 * sus etiquetas, links y jerarquía — acá sólo se corrige el flag `current` de cada ítem de primer
 * nivel (los hijos son anclas de la portada y ninguna vista los pinta como actuales). "Inicio"
 * compara por igualdad exacta; el resto por prefijo, así una ruta más profunda —el detalle de un
 * curso— sigue marcando a la página de su módulo.
 */
function marcarActual(navItems: SiteNavItem[], pathname: string): SiteNavItem[] {
  const actual = normalizar(pathname);
  return navItems.map((item) => {
    const href = normalizar(item.href);
    const current = item.id === "home" ? actual === href : actual === href || actual.startsWith(`${href}/`);
    return { ...item, current };
  });
}

/**
 * El header y el pie necesitan saber en qué página está el visitante para marcarla en el menú.
 * El layout no puede dárselo: `x-invoke-path` (la cabecera con la que Next 16 promete resolverlo
 * en un Server Component) no llega en este entorno — se comprobó en el navegador, ver el
 * reporte de la tarea 7. `usePathname` sí es confiable en un Client Component, así que este es
 * el único rincón de todo el sitio público que corre en el navegador: el resto del armazón y
 * las páginas de módulo siguen siendo Server Components.
 */
export function PublicSiteNavCurrentClient({
  navItems,
  header,
  footer,
  children,
}: {
  navItems: SiteNavItem[];
  header: {
    logoUrl: string | null;
    workspaceName: string;
    designPresets: WebsiteDesignPresets;
    homeHref: string;
  };
  footer: {
    commercialName: string;
    logoUrl: string | null;
    contact: PublicSiteContact;
    designPresets: WebsiteDesignPresets;
  };
  children: ReactNode;
}) {
  const pathname = usePathname() ?? header.homeHref;
  const items = marcarActual(navItems, pathname);

  return (
    <>
      <WebsiteHeaderView
        logoUrl={header.logoUrl}
        workspaceName={header.workspaceName}
        navItems={items}
        designPresets={header.designPresets}
        homeHref={header.homeHref}
      />
      {children}
      <WebsiteFooterView
        commercialName={footer.commercialName}
        logoUrl={footer.logoUrl}
        contact={footer.contact}
        navItems={items}
        designPresets={footer.designPresets}
      />
    </>
  );
}
