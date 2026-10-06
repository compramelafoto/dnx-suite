import type { ReactNode } from "react";
import { RoleSelector } from "@/components/shell/role-selector";
import type { RoleSelector as RoleSelectorData } from "@/lib/portal/profiles";
import { type ResolvedPortalItem } from "@/lib/portal/menu";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { PortalNav, PortalSidebar } from "./portal-nav";
import { NotificationBell } from "./notification-bell";

/**
 * El marco del portal: identidad arriba, navegación al costado (computadora) o abajo
 * (teléfono), contenido en el medio.
 *
 * En el teléfono la navegación va abajo porque el portal se usa con una mano: estirar el pulgar
 * hasta la esquina más lejana para lo que se hace todo el tiempo no sirve. En computadora va en
 * un panel lateral con todas las secciones a la vista, y el contenido aprovecha el ancho.
 *
 * Lo monta el layout de `/portal`, no cada pantalla. Así ninguna se lo puede olvidar y el socio
 * nunca queda en una pantalla sin saber quién es ni cómo volver.
 */
export function PortalShell({
  items,
  member,
  institution,
  vocabulary,
  roleSelector = null,
  notifications = false,
  children,
}: {
  items: ResolvedPortalItem[];
  member: { fullName: string; memberNumber: string | null; category: string | null; photoUrl: string | null };
  institution: { name: string; logoUrl: string | null };
  vocabulary: PersonVocabulary;
  /** Si el socio también es equipo de esta institución: el selector de rol (socio activo). */
  roleSelector?: RoleSelectorData | null;
  /** La campanita de novedades: sólo para el socio (el alumno no tiene de qué enterarse acá). */
  notifications?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--fo-bg)] pb-20 text-[var(--fo-text)] md:pb-0">
      {/*
        Pegado arriba: la identidad del socio tiene que estar a mano en cualquier punto de una
        lista larga de cuotas, no solo al principio. Mide 5rem en el teléfono y 6rem desde
        pantalla mediana: el panel lateral se engancha justo debajo con `top-24`.
      */}
      <header className="sticky top-0 z-30 h-20 border-b border-[var(--fo-border)] md:h-24 bg-[var(--fo-surface)]">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {institution.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={institution.logoUrl}
                alt={institution.name}
                className="h-14 w-auto max-w-40 shrink-0 object-contain md:h-20 md:max-w-64"
              />
            ) : null}
            <span className="hidden truncate text-sm font-semibold sm:block">{institution.name}</span>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            {/* A la izquierda del nombre: se ve sin tapar la identidad y queda a mano del pulgar. */}
            {notifications ? <NotificationBell /> : null}
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold leading-tight">{member.fullName}</p>
              <p className="truncate text-xs text-[var(--fo-muted)]">
                {member.memberNumber !== null ? (
                  <>
                    {vocabulary.Singular} N° <span className="tabular-nums">{member.memberNumber}</span>
                  </>
                ) : (
                  "Alumno"
                )}
                {member.category ? <span className="hidden sm:inline"> · {member.category}</span> : null}
              </p>
            </div>
            <PortalAvatar name={member.fullName} src={member.photoUrl} className="h-10 w-10" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 md:px-6">
        <PortalSidebar
          items={items}
          vocabulary={vocabulary}
          top={<RoleSelector selector={roleSelector} className="mb-5" />}
        />
        <main className="min-w-0 flex-1 px-4 py-5 md:px-0 md:py-6">
          {/* En el teléfono la navegación va abajo: el selector queda arriba del contenido. */}
          <RoleSelector selector={roleSelector} className="mb-5 md:hidden" />
          {children}
        </main>
      </div>

      <PortalNav items={items} vocabulary={vocabulary} />
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
