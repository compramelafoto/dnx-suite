"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalBottomBar, type ResolvedPortalItem } from "@/lib/portal/menu";
import { PortalIcon } from "./portal-icon";

/**
 * La navegación del portal.
 *
 * Es de cliente por una sola razón: necesita saber en qué pantalla está para marcarla. El
 * encabezado con la identidad del socio se sigue dibujando en el servidor — se lo pasa el
 * layout — así que lo que llega al navegador es solo esto.
 *
 * `usePathname` en vez de recibir la ruta como propiedad: el layout que monta esto no sabe qué
 * pantalla se está mostrando, y hacérselo saber obligaría a que cada pantalla lo declare, que es
 * justamente lo que hay que evitar.
 */

function esActiva(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Barra inferior del teléfono, al alcance del pulgar. */
export function PortalNav({ items }: { items: ResolvedPortalItem[] }) {
  const pathname = usePathname() ?? "";
  const barra = portalBottomBar(items);

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--fo-border)] bg-[var(--fo-surface)] pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {barra.map((i) => {
        const activa = esActiva(pathname, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={activa ? "page" : undefined}
            className={[
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              activa
                ? "text-[var(--fo-accent)]"
                : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
            ].join(" ")}
          >
            <PortalIcon name={i.icon} className="h-5 w-5" />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Pestañas de pantalla grande. Abajo del todo, en un monitor, es donde nadie mira. */
export function PortalTabs({ items }: { items: ResolvedPortalItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Secciones" className="mx-auto hidden max-w-3xl gap-1 px-2 sm:flex">
      {portalBottomBar(items).map((i) => {
        const activa = esActiva(pathname, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={activa ? "page" : undefined}
            className={[
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              activa
                ? "border-[var(--fo-accent)] font-semibold text-[var(--fo-accent)]"
                : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
            ].join(" ")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
