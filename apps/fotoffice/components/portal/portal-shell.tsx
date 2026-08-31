import type { ReactNode } from "react";
import { type ResolvedPortalItem } from "@/lib/portal/menu";
import { PortalNav, PortalTabs } from "./portal-nav";

/**
 * El marco del portal: identidad arriba, contenido en el medio, navegación abajo.
 *
 * La navegación va abajo y no en un menú lateral porque el portal se usa desde el teléfono, con
 * una mano. Un menú lateral copiado del panel obliga a estirar el pulgar hasta la esquina más
 * lejana de la pantalla para lo que se hace todo el tiempo.
 *
 * En pantalla grande la barra pasa a ser horizontal arriba: abajo del todo, en un monitor, es
 * el lugar donde nadie mira.
 *
 * Lo monta el layout de `/portal`, no cada pantalla. Así ninguna se lo puede olvidar y el socio
 * nunca queda en una pantalla sin saber quién es ni cómo volver.
 */
export function PortalShell({
  items,
  member,
  institution,
  children,
}: {
  items: ResolvedPortalItem[];
  member: { fullName: string; memberNumber: string; category: string | null; photoUrl: string | null };
  institution: { name: string; logoUrl: string | null };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--fo-bg)] pb-20 text-[var(--fo-text)] sm:pb-0">
      {/*
        Pegado arriba: la identidad del socio y el acceso a las secciones tienen que estar a
        mano en cualquier punto de una lista larga de cuotas, no solo al principio.
      */}
      <header className="sticky top-0 z-30 border-b border-[var(--fo-border)] bg-[var(--fo-surface)]">
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
              className="h-16 w-auto max-w-48 shrink-0 object-contain"
            />
          ) : (
            <span className="shrink-0 text-xs font-medium text-[var(--fo-muted)]">
              {institution.name}
            </span>
          )}
        </div>

        {/* En pantalla grande la navegación vive acá arriba; en el teléfono, abajo. */}
        <PortalTabs items={items} />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <PortalNav items={items} />
    </div>
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
