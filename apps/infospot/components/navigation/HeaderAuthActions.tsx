"use client";

import Link from "next/link";
import { logoutAction } from "@/app/ingresar/actions";
import { cx } from "@/components/foundations/cx";

export type SiteHeaderAuth = {
  /** Nombre corto o parte local del email. */
  label: string;
  panelHref: string;
  /** "Panel" con acceso editorial; "Acceso" si aún no tiene rol. */
  panelLabel: string;
};

const quietLink =
  "inline-flex h-8 shrink-0 items-center px-2.5 text-[13px] font-medium tracking-[-0.01em] text-[var(--is-text-secondary)] transition-colors duration-200 hover:text-[var(--is-text)]";

const quietOutline =
  "inline-flex h-8 shrink-0 items-center px-3 text-[13px] font-medium tracking-[-0.01em] text-[var(--is-text-secondary)] ring-1 ring-[var(--is-border)] transition-colors duration-200 hover:text-[var(--is-text)] hover:ring-[var(--is-graphite-400)]";

type Props = {
  auth: SiteHeaderAuth | null;
  /** Variante compacta para la barra (desktop/tablet). */
  className?: string;
  /** En menú móvil: apilar a ancho completo. */
  stacked?: boolean;
  /** Cerrar menú móvil al navegar. */
  onNavigate?: () => void;
};

/**
 * Acciones de identidad DNX en el header público.
 * Sin sesión: Ingresar. Con sesión: Panel + Salir.
 */
export function HeaderAuthActions({
  auth,
  className,
  stacked = false,
  onNavigate,
}: Props) {
  if (!auth) {
    return (
      <div className={cx(stacked ? "w-full" : "flex items-center", className)}>
        <Link
          href="/ingresar"
          onClick={onNavigate}
          className={
            stacked
              ? "inline-flex h-11 w-full items-center justify-center text-sm font-semibold text-[var(--is-text)] ring-1 ring-[var(--is-border)] transition-colors hover:ring-[var(--is-graphite-400)]"
              : quietOutline
          }
        >
          Ingresar
        </Link>
      </div>
    );
  }

  if (stacked) {
    return (
      <div className={cx("w-full space-y-3", className)}>
        <p className="truncate text-center text-sm text-[var(--is-muted)]">{auth.label}</p>
        <Link
          href={auth.panelHref}
          onClick={onNavigate}
          className="inline-flex h-11 w-full items-center justify-center text-sm font-semibold text-[var(--is-text)] ring-1 ring-[var(--is-border)] transition-colors hover:ring-[var(--is-graphite-400)]"
        >
          {auth.panelLabel === "Panel" ? "Ir al panel" : "Ver acceso"}
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center text-sm font-medium text-[var(--is-text-secondary)] transition-colors hover:text-[var(--is-text)]"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      className={cx("flex items-center gap-1 sm:gap-2", className)}
      aria-label="Cuenta"
    >
      <span
        className="hidden max-w-[7rem] truncate text-[12px] text-[var(--is-muted)] lg:inline"
        title={auth.label}
      >
        {auth.label}
      </span>
      <Link href={auth.panelHref} className={quietOutline}>
        {auth.panelLabel}
      </Link>
      <form action={logoutAction} className="inline">
        <button type="submit" className={quietLink}>
          Salir
        </button>
      </form>
    </div>
  );
}
