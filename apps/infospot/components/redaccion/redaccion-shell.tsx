import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/ingresar/actions";
import { getAuthUser } from "@/lib/auth";
import {
  canAccessInfoSpotAdmin,
  canManageInfoSpotUsers,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";

const editorialNav = [
  { href: "/redaccion", label: "Sala de redacción" },
  { href: "/redaccion/nueva", label: "Nueva nota" },
  { href: "/redaccion/perfil", label: "Mi perfil" },
  { href: "/", label: "Ver sitio" },
] as const;

const linkClass =
  "inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] px-3 text-sm font-medium text-[var(--is-text-secondary)] hover:bg-[var(--is-surface)] hover:text-[var(--is-accent)]";

export async function RedaccionShell({
  title,
  description,
  actions,
  header,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** Si se pasa, reemplaza el bloque título / descripción / acciones. */
  header?: ReactNode;
  children: ReactNode;
}) {
  const user = await getAuthUser();
  const membership = user ? await getInfoSpotMembership(user.id) : null;
  const subject = user ? toPermissionSubject(user, membership) : null;
  const showAdmin = canAccessInfoSpotAdmin(subject);
  const showUsers = canManageInfoSpotUsers(subject);

  const label = user?.name?.trim() || user?.email || "";
  const initial = (label.trim()[0] || "?").toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10">
      <aside className="lg:w-56 lg:shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
          Info Spot
        </p>
        <p className="mt-1 text-sm text-[var(--is-muted)]">Redacción</p>

        {user ? (
          <div className="mt-4 flex items-center gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-surface)] px-3 py-3">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar externo (Google)
              <img
                src={user.avatarUrl}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xs font-semibold text-[var(--is-muted)]"
              >
                {initial}
              </span>
            )}
            <p className="min-w-0 truncate text-sm font-medium text-[var(--is-text)]">{label}</p>
          </div>
        ) : null}

        <nav className="mt-4 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {editorialNav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}

          {showAdmin ? (
            <div className="mt-2 w-full border-t border-[var(--is-border)] pt-2 lg:mt-4 lg:pt-4">
              <p className="mb-1 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--is-muted)] lg:block">
                Dirección
              </p>
              <Link href="/admin" className={linkClass}>
                Admin
              </Link>
              {showUsers ? (
                <Link href="/admin/usuarios" className={linkClass}>
                  Equipo y roles
                </Link>
              ) : null}
              <Link href="/admin/eventos" className={linkClass}>
                Eventos
              </Link>
              <Link href="/admin/configuracion" className={linkClass}>
                Configuración
              </Link>
            </div>
          ) : null}

          <form action={logoutAction} className="mt-2 lg:mt-6">
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center rounded-[var(--is-radius-sm)] px-3 text-left text-sm font-medium text-[var(--is-muted)] hover:bg-[var(--is-surface)] hover:text-[var(--is-text)]"
            >
              Cerrar sesión
            </button>
          </form>
        </nav>
      </aside>

      <div className="min-w-0 flex-1 space-y-6 pb-20 lg:pb-0">
        {header ? (
          header
        ) : title ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tracking-tight">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--is-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
            {actions}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
