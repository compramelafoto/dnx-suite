import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/ingresar/actions";

const nav = [
  { href: "/redaccion", label: "Sala de redacción" },
  { href: "/redaccion/nueva", label: "Nueva nota" },
  { href: "/", label: "Ver sitio" },
] as const;

export function RedaccionShell({
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
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10">
      <aside className="lg:w-56 lg:shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
          Info Spot
        </p>
        <p className="mt-1 text-sm text-[var(--is-muted)]">Redacción</p>
        <nav className="mt-4 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] px-3 text-sm font-medium text-[var(--is-text-secondary)] hover:bg-[var(--is-surface)] hover:text-[var(--is-accent)]"
            >
              {item.label}
            </Link>
          ))}
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
