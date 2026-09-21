"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isPathCurrent, type SiteNavItem } from "@/lib/website/site-nav";

/**
 * Sólo los enlaces del menú del header —de escritorio y el `<details>` de celular— cruzan al
 * navegador. `WebsiteHeaderView` sigue siendo un Server Component: arma el logo, el botón de
 * login y el marco del `<header>`, y le pasa `children` a esto para que quede posicionado entre
 * el menú de escritorio y el de celular, sin que ese botón tenga que pasar por el cliente.
 *
 * La única razón de que esto exista es saber en qué página está el visitante: `buildSiteNav`
 * corre en el servidor y no conoce la ruta, así que quien marca el ítem actual es este
 * componente, con `usePathname()`. La regla de qué cuenta como "actual" vive en un solo lugar:
 * se importa de `isPathCurrent`, en `site-nav.ts`.
 */
export function WebsiteHeaderNavClient({
  navItems,
  colorTexto,
  minimal,
  centered,
  children,
}: {
  navItems: SiteNavItem[];
  colorTexto: string;
  minimal: boolean;
  centered: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const itemsVisibles = minimal ? navItems.slice(0, 1) : navItems;

  const esActual = (item: SiteNavItem) => isPathCurrent(pathname, item.href, { exact: item.id === "home" });

  const enlace = (item: SiteNavItem) => (
    <a
      key={item.id}
      href={item.href}
      aria-current={esActual(item) ? "page" : undefined}
      className="transition-opacity hover:opacity-70"
      style={{ color: colorTexto, opacity: esActual(item) ? 1 : 0.75, fontWeight: esActual(item) ? 600 : 400 }}
    >
      {item.label}
    </a>
  );

  // En pantalla grande: los ítems en fila. Los submenús de Inicio no se despliegan acá —
  // son anclas de la portada y aparecen sólo en el menú de celular, donde hay lugar.
  const navEscritorio = (
    <nav className={`hidden items-center gap-6 text-sm md:flex ${centered ? "flex-wrap justify-center" : ""}`}>
      {itemsVisibles.map(enlace)}
    </nav>
  );

  const navCelular = (
    <details className="md:hidden">
      <summary
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg"
        aria-label="Abrir el menú"
        style={{ color: colorTexto }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </summary>
      <nav
        className="absolute inset-x-0 z-20 flex flex-col gap-1 border-t p-4 text-sm shadow-lg"
        style={{ backgroundColor: "var(--wsite-bg)", borderColor: "rgba(127,127,127,0.2)" }}
      >
        {navItems.map((item) => (
          <div key={item.id} className="flex flex-col">
            <a
              href={item.href}
              aria-current={esActual(item) ? "page" : undefined}
              className="py-2"
              style={{ color: "var(--wsite-text)", fontWeight: esActual(item) ? 600 : 400 }}
            >
              {item.label}
            </a>
            {item.children.map((hijo) => (
              <a key={hijo.id} href={hijo.href} className="py-1.5 pl-4 text-sm opacity-70" style={{ color: "var(--wsite-text)" }}>
                {hijo.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </details>
  );

  return (
    <>
      {navEscritorio}
      {children}
      {navCelular}
    </>
  );
}
