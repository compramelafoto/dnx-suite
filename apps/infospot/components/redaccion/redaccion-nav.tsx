"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/app/ingresar/actions";
import {
  NEWSROOM_NAV,
  newsroomNavActive,
  type NewsroomNavItem,
} from "@/lib/redaccion-ia";

type AdminNavItem = {
  href: string;
  label: string;
  short: string;
  exact?: boolean;
};

type Props = {
  showAdmin: boolean;
  showUsers: boolean;
  showApprovals: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
};

function adminActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href;
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

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NewsroomNavItem | AdminNavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      className={navLinkClass(active, collapsed)}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={collapsed ? item.label : "hint" in item ? item.hint : item.label}
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
        <span className="flex min-w-0 flex-col">
          <span>{item.label}</span>
          {"hint" in item && item.hint ? (
            <span className="truncate text-[10px] font-normal text-[var(--is-muted)]">
              {item.hint}
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}

export function RedaccionNav({
  showAdmin,
  showUsers,
  showApprovals,
  collapsed = false,
  onNavigate,
}: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  const adminNav: AdminNavItem[] = [
    { href: "/admin", label: "Panel de dirección", short: "D", exact: true },
    ...(showApprovals
      ? [{ href: "/admin/aprobaciones", label: "Aprobaciones", short: "A" }]
      : []),
    ...(showUsers
      ? [{ href: "/admin/usuarios", label: "Equipo y roles", short: "U" }]
      : []),
    { href: "/admin/eventos", label: "Eventos (admin)", short: "Ev" },
    { href: "/admin/ayuda", label: "Cómo publicar", short: "?" },
    { href: "/admin/configuracion", label: "Configuración", short: "⚙" },
    {
      href: "/admin/sponsors-dnx-partners",
      label: "Sponsors — DNX Partners",
      short: "Sp",
    },
  ];

  return (
    <nav className="mt-4 flex flex-col gap-1" aria-label="Centro Editorial">
      {!collapsed ? (
        <p className="mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)] lg:block">
          Centro Editorial
        </p>
      ) : null}
      {NEWSROOM_NAV.map((item) => (
        <NavLink
          key={item.id}
          item={item}
          active={newsroomNavActive(pathname, search, item)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}

      {showAdmin ? (
        <div className="mt-4 border-t border-[var(--is-border)] pt-4">
          {!collapsed ? (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)]">
              Dirección
            </p>
          ) : null}
          <div className="flex flex-col gap-1">
            {adminNav.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={adminActive(pathname, item)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-[var(--is-border)] pt-4">
        <Link
          href="/"
          className={navLinkClass(false, collapsed)}
          aria-label="Ver sitio público"
          title={collapsed ? "Ver sitio" : undefined}
          onClick={onNavigate}
        >
          {collapsed ? (
            <span
              aria-hidden
              className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xs font-semibold"
            >
              ↗
            </span>
          ) : (
            "Ver sitio"
          )}
        </Link>
        <form action={logoutAction} className="mt-1">
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
      </div>
    </nav>
  );
}
