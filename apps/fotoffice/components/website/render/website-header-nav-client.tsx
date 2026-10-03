"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { isPathCurrent, type SiteNavItem } from "@/lib/website/site-nav";

/**
 * Sólo los enlaces del menú cruzan al navegador. `WebsiteHeaderView` sigue siendo un Server
 * Component: arma el logo, el botón de login y el marco del encabezado.
 *
 * La única razón de que esto exista es saber en qué página está el visitante: `resolveSiteNav`
 * corre en el servidor y no conoce la ruta, así que quien marca el ítem actual es este
 * componente, con `usePathname()`. La regla de qué cuenta como "actual" vive en un solo lugar:
 * se importa de `isPathCurrent`, en `site-nav.ts`.
 */
export function useIsCurrentNavItem() {
  const pathname = usePathname() ?? "";
  return (item: SiteNavItem) => isPathCurrent(pathname, item.href, { exact: Boolean(item.exact) });
}

export function SiteNavLink({
  item,
  current,
  className,
  style,
  onNavigate,
}: {
  item: SiteNavItem;
  current: boolean;
  className?: string;
  style?: CSSProperties;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={item.href}
      aria-current={current ? "page" : undefined}
      target={item.newTab ? "_blank" : undefined}
      rel={item.newTab ? "noopener noreferrer" : undefined}
      className={className}
      style={style}
      onClick={onNavigate}
    >
      {item.label}
    </a>
  );
}

/**
 * Los ítems a la vista, para pantallas grandes: en fila (barra superior) o en columna (barra
 * lateral fija). En el celular no se muestra: ahí manda `WebsiteMenuOverlay`.
 *
 * Los `@3xl:` son consultas de contenedor, no de pantalla: el marco del sitio (`SiteFrame`) es el
 * contenedor, así la vista previa del constructor en modo celular se ve como un celular de verdad.
 */
export function WebsiteHeaderNavClient({
  navItems,
  colorTexto,
  minimal = false,
  centered = false,
  vertical = false,
}: {
  navItems: SiteNavItem[];
  colorTexto: string;
  minimal?: boolean;
  centered?: boolean;
  vertical?: boolean;
}) {
  const esActual = useIsCurrentNavItem();
  const itemsVisibles = minimal ? navItems.slice(0, 1) : navItems;

  // Los submenús de Inicio (anclas de la portada) no se despliegan acá: aparecen en el panel
  // del menú, donde hay lugar.
  return (
    <nav
      aria-label="Menú principal"
      className={
        vertical
          ? "hidden flex-col gap-3 text-sm @3xl:flex"
          : `hidden items-center gap-6 text-sm @3xl:flex ${centered ? "flex-wrap justify-center" : ""}`
      }
    >
      {itemsVisibles.map((item) => {
        const actual = esActual(item);
        return (
          <SiteNavLink
            key={item.id}
            item={item}
            current={actual}
            className="transition-opacity hover:opacity-70"
            style={{ color: colorTexto, opacity: actual ? 1 : 0.75, fontWeight: actual ? 600 : 400 }}
          />
        );
      })}
    </nav>
  );
}
