"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/ingresar/actions";

type NavItem = {
  href: string;
  label: string;
  short: string;
  /** Match exact path only (e.g. /redaccion vs /redaccion/nueva). */
  exact?: boolean;
};

const editorialNav: NavItem[] = [
  { href: "/redaccion", label: "Noticias", short: "N", exact: true },
  { href: "/redaccion/eventos", label: "Eventos", short: "E" },
  { href: "/redaccion/coberturas", label: "Coberturas", short: "C" },
  { href: "/redaccion/distribucion", label: "Portada", short: "P" },
  { href: "/redaccion/nueva", label: "Nueva nota", short: "+" },
  { href: "/redaccion/perfil", label: "Mi perfil", short: "Yo" },
  { href: "/", label: "Ver sitio", short: "↗", exact: true },
];

type Props = {
  showAdmin: boolean;
  showUsers: boolean;
  showApprovals: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
};

function isNoticiasEditPath(pathname: string): boolean {
  return /^\/redaccion\/noticias\/[^/]+\/editar\/?$/.test(pathname);
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/redaccion" && item.exact) {
    return pathname === "/redaccion" || isNoticiasEditPath(pathname);
  }
  if (item.exact) return pathname === item.href;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function navLinkClass(active: boolean, collapsed: boolean): string {
  return [
    "flex min-h-11 w-full items-center rounded-[var(--is-radius-sm)] text-sm font-medium transition-colors",
    collapsed ? "justify-center px-2" : "px-3",
    active
      ? "bg-[var(--is-orange-50)] text-[var(--is-accent)]"
      : "text-[var(--is-text-secondary)] hover:bg-[var(--is-surface)] hover:text-[var(--is-accent)]",
  ].join(" ");
}

export function RedaccionNav({
  showAdmin,
  showUsers,
  showApprovals,
  collapsed = false,
  onNavigate,
}: Props) {
  const pathname = usePathname() ?? "";

  const adminNav: NavItem[] = [
    { href: "/admin", label: "Panel de dirección", short: "D", exact: true },
    ...(showApprovals
      ? [
          {
            href: "/admin/aprobaciones",
            label: "Aprobaciones",
            short: "A",
          } satisfies NavItem,
        ]
      : []),
    ...(showUsers
      ? [
          {
            href: "/admin/usuarios",
            label: "Equipo y roles",
            short: "U",
          } satisfies NavItem,
        ]
      : []),
    { href: "/admin/eventos", label: "Eventos (admin)", short: "Ev" },
    { href: "/admin/configuracion", label: "Configuración", short: "⚙" },
  ];

  return (
    <nav className="mt-4 flex flex-col gap-1" aria-label="Navegación de redacción">
      {!collapsed ? (
        <p className="mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)] lg:block">
          Redacción
        </p>
      ) : null}
      {editorialNav.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={navLinkClass(active, collapsed)}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
          >
            {collapsed ? (
              <span
                aria-hidden
                className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xs font-semibold"
              >
                {item.short}
              </span>
            ) : (
              item.label
            )}
          </Link>
        );
      })}

      {showAdmin ? (
        <div className="mt-4 border-t border-[var(--is-border)] pt-4">
          {!collapsed ? (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)]">
              Dirección
            </p>
          ) : null}
          <div className="flex flex-col gap-1">
            {adminNav.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navLinkClass(active, collapsed)}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={collapsed ? item.label : undefined}
                  onClick={onNavigate}
                >
                  {collapsed ? (
                    <span
                      aria-hidden
                      className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xs font-semibold"
                    >
                      {item.short}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <form action={logoutAction} className="mt-4 border-t border-[var(--is-border)] pt-4">
        <button
          type="submit"
          className={[
            "flex min-h-11 w-full items-center rounded-[var(--is-radius-sm)] text-sm font-medium text-[var(--is-muted)] hover:bg-[var(--is-surface)] hover:text-[var(--is-text)]",
            collapsed ? "justify-center px-2" : "px-3 text-left",
          ].join(" ")}
          aria-label="Cerrar sesión"
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          {collapsed ? (
            <span
              aria-hidden
              className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xs font-semibold"
            >
              ⎋
            </span>
          ) : (
            "Cerrar sesión"
          )}
        </button>
      </form>
    </nav>
  );
}
