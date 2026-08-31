import Link from "next/link";
import type { ReactNode } from "react";
import { portalBottomBar, type ResolvedPortalItem } from "@/lib/portal/menu";
import { PortalIcon } from "./portal-icon";

/**
 * El marco del portal: identidad arriba, contenido en el medio, navegación abajo.
 *
 * La navegación va abajo y no en un menú lateral porque el portal se usa desde el teléfono, con
 * una mano. Un menú lateral copiado del panel obliga a estirar el pulgar hasta la esquina más
 * lejana de la pantalla para lo que se hace todo el tiempo.
 *
 * En pantalla grande la barra pasa a ser horizontal arriba: abajo del todo, en un monitor, es
 * el lugar donde nadie mira.
 */
export function PortalShell({
  items,
  activeHref,
  member,
  institution,
  children,
}: {
  items: ResolvedPortalItem[];
  activeHref: string;
  member: { fullName: string; memberNumber: string; category: string | null; photoUrl: string | null };
  institution: { name: string; logoUrl: string | null };
  children: ReactNode;
}) {
  const barra = portalBottomBar(items);

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] pb-20 text-[var(--fo-text)] sm:pb-0">
      <header className="border-b border-[var(--fo-border)] bg-[var(--fo-surface)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <PortalAvatar name={member.fullName} src={member.photoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{member.fullName}</p>
            <p className="truncate text-xs text-[var(--fo-muted)]">
              Socio N° <span className="tabular-nums">{member.memberNumber}</span>
              {member.category ? ` · ${member.category}` : ""}
            </p>
          </div>
          {institution.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={institution.logoUrl}
              alt={institution.name}
              className="h-8 w-auto max-w-24 shrink-0 object-contain"
            />
          ) : (
            <span className="shrink-0 text-xs font-medium text-[var(--fo-muted)]">
              {institution.name}
            </span>
          )}
        </div>

        {/* En pantalla grande la navegación vive acá arriba; en el teléfono, abajo. */}
        <nav aria-label="Secciones" className="mx-auto hidden max-w-3xl gap-1 px-2 sm:flex">
          {barra.map((i) => (
            <PortalTab key={i.href} item={i} active={activeHref === i.href} />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--fo-border)] bg-[var(--fo-surface)] pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {barra.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={activeHref === i.href ? "page" : undefined}
            className={[
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              activeHref === i.href
                ? "text-[var(--fo-accent)]"
                : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
            ].join(" ")}
          >
            <PortalIcon name={i.icon} className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function PortalTab({ item, active }: { item: ResolvedPortalItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={[
        "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-[var(--fo-accent)] font-semibold text-[var(--fo-accent)]"
          : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
      ].join(" ")}
    >
      {item.label}
    </Link>
  );
}

/**
 * La foto del socio, con sus iniciales cuando todavía no cargó ninguna.
 *
 * Las iniciales no son un relleno: un círculo vacío se lee como que algo falló, y las iniciales
 * dicen "sos vos, todavía sin foto".
 */
export function PortalAvatar({
  name,
  src,
  className = "h-11 w-11",
}: {
  name: string;
  src: string | null;
  className?: string;
}) {
  const iniciales = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${className} shrink-0 rounded-full border border-[var(--fo-border)] object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${className} grid shrink-0 place-items-center rounded-full border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-sm font-semibold text-[var(--fo-muted)]`}
    >
      {iniciales || "·"}
    </span>
  );
}
