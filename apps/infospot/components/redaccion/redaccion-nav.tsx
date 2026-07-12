"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/ingresar/actions";

type NavItem = {
  href: string;
  label: string;
  /** Match exact path only (e.g. /redaccion vs /redaccion/nueva). */
  exact?: boolean;
};

const editorialNav: NavItem[] = [
  { href: "/redaccion", label: "Noticias", exact: true },
  { href: "/redaccion/eventos", label: "Eventos" },
  { href: "/redaccion/coberturas", label: "Coberturas" },
  { href: "/redaccion/distribucion", label: "Portada" },
  { href: "/redaccion/nueva", label: "Nueva nota" },
  { href: "/redaccion/perfil", label: "Mi perfil" },
  { href: "/", label: "Ver sitio", exact: true },
];

type Props = {
  showAdmin: boolean;
  showUsers: boolean;
  showApprovals: boolean;
};

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function navLinkClass(active: boolean): string {
  return [
    "flex min-h-11 w-full items-center rounded-[var(--is-radius-sm)] px-3 text-sm font-medium transition-colors",
    active
      ? "bg-[var(--is-orange-50)] text-[var(--is-accent)]"
      : "text-[var(--is-text-secondary)] hover:bg-[var(--is-surface)] hover:text-[var(--is-accent)]",
  ].join(" ");
}

export function RedaccionNav({ showAdmin, showUsers, showApprovals }: Props) {
  const pathname = usePathname();

  const adminNav: NavItem[] = [
    { href: "/admin", label: "Panel de dirección", exact: true },
    ...(showApprovals
      ? [{ href: "/admin/aprobaciones", label: "Aprobaciones" } satisfies NavItem]
      : []),
    ...(showUsers
      ? [{ href: "/admin/usuarios", label: "Equipo y roles" } satisfies NavItem]
      : []),
    { href: "/admin/eventos", label: "Eventos (admin)" },
    { href: "/admin/configuracion", label: "Configuración" },
  ];

  return (
    <nav className="mt-4 flex flex-col gap-1" aria-label="Navegación de redacción">
      <p className="mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)] lg:block">
        Redacción
      </p>
      {editorialNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={navLinkClass(isActive(pathname, item))}
          aria-current={isActive(pathname, item) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}

      {showAdmin ? (
        <div className="mt-4 border-t border-[var(--is-border)] pt-4">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)]">
            Dirección
          </p>
          <div className="flex flex-col gap-1">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(isActive(pathname, item))}
                aria-current={isActive(pathname, item) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <form action={logoutAction} className="mt-4 border-t border-[var(--is-border)] pt-4">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center rounded-[var(--is-radius-sm)] px-3 text-left text-sm font-medium text-[var(--is-muted)] hover:bg-[var(--is-surface)] hover:text-[var(--is-text)]"
        >
          Cerrar sesión
        </button>
      </form>
    </nav>
  );
}
