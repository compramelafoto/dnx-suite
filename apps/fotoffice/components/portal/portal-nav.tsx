"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { portalBottomBar, type ResolvedPortalItem } from "@/lib/portal/menu";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import { PortalIcon } from "./portal-icon";

/**
 * La navegación del portal.
 *
 * Es de cliente por una sola razón: necesita saber en qué pantalla está para marcarla. El
 * encabezado con la identidad del socio se sigue dibujando en el servidor — se lo pasa el
 * layout — así que lo que llega al navegador es solo esto.
 *
 * Dos formas según la pantalla:
 * - Computadora: panel lateral fijo con todas las secciones a la vista. Antes las secciones
 *   eran tarjetas apiladas en la portada y para pasar de una a otra había que volver al inicio.
 * - Teléfono: barra inferior con las cuatro de todos los días más "Más", que abre el resto.
 */

function esActiva(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const PROXIMAS_TITULO = "Próximas funcionalidades";

/** Panel lateral de pantalla mediana en adelante. */
export function PortalSidebar({
  items,
  vocabulary,
  top = null,
}: {
  items: ResolvedPortalItem[];
  vocabulary: PersonVocabulary;
  /** Lo que va arriba de las secciones: el selector de rol, si corresponde. */
  top?: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const disponibles = items.filter((i) => i.state === "DISPONIBLE");
  const proximas = items.filter((i) => i.state === "PROXIMAMENTE");

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-60 shrink-0 flex-col overflow-y-auto py-5 md:flex">
      {top}
      <nav aria-label="Secciones" className="space-y-0.5">
        {disponibles.map((i) => {
          const activa = esActiva(pathname, i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={activa ? "page" : undefined}
              className={[
                "flex items-center gap-3 rounded-[var(--fo-radius-sm)] px-3 py-2 text-sm transition-colors",
                activa
                  ? "bg-[var(--fo-accent-soft)] font-semibold text-[var(--fo-accent-hover)]"
                  : "text-[var(--fo-text-secondary)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]",
              ].join(" ")}
            >
              <PortalIcon name={i.icon} className="h-[18px] w-[18px] shrink-0" />
              {aplicarVocabulario(i.label, vocabulary)}
            </Link>
          );
        })}
      </nav>

      {proximas.length > 0 ? (
        <div className="mt-6 space-y-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            {PROXIMAS_TITULO}
          </p>
          {proximas.map((i) => (
            <p
              key={i.href}
              title={aplicarVocabulario(i.description, vocabulary)}
              className="flex cursor-default items-center gap-3 px-3 py-1.5 text-sm text-[var(--fo-muted-soft)]"
            >
              <PortalIcon name={i.icon} className="h-[18px] w-[18px] shrink-0" />
              {aplicarVocabulario(i.label, vocabulary)}
            </p>
          ))}
        </div>
      ) : null}

      <form action="/api/auth/logout" method="post" className="mt-auto pt-6">
        <button
          type="submit"
          className="w-full rounded-[var(--fo-radius-sm)] px-3 py-2 text-left text-sm text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
        >
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}

/**
 * Barra inferior del teléfono, al alcance del pulgar. Las cuatro secciones de todos los días y
 * un "Más" que abre el resto: sin él, Reservas o Sorteos solo se encontraban volviendo al inicio.
 */
export function PortalNav({
  items,
  vocabulary,
}: {
  items: ResolvedPortalItem[];
  vocabulary: PersonVocabulary;
}) {
  const pathname = usePathname() ?? "";
  // Se guarda en qué pantalla se abrió y no un sí/no: al navegar la ruta cambia y el panel
  // queda cerrado solo. El socio eligió adónde ir, no tiene que cerrar nada.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;
  const setAbierto = (v: boolean) => setAbiertoEn(v ? pathname : null);
  const barra = portalBottomBar(items);
  const resto = items.filter((i) => !barra.includes(i));
  const restoDisponible = resto.filter((i) => i.state === "DISPONIBLE");
  const proximas = resto.filter((i) => i.state === "PROXIMAMENTE");
  const masActiva = restoDisponible.some((i) => esActiva(pathname, i.href));

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbiertoEn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const tab = (activa: boolean) =>
    [
      "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
      activa ? "text-[var(--fo-accent)]" : "text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
    ].join(" ");

  return (
    <>
      {abierto ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal aria-label="Más secciones">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/40"
            onClick={() => setAbierto(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-[var(--fo-surface)] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--fo-shadow-md)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--fo-border-strong)]" />
            {restoDisponible.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2">
                {restoDisponible.map((i) => (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setAbierto(false)}
                      className="flex h-full flex-col items-center gap-1.5 rounded-[var(--fo-radius)] bg-[var(--fo-surface-hover)] px-2 py-3 text-center text-xs font-medium"
                    >
                      <span className="text-[var(--fo-accent)]">
                        <PortalIcon name={i.icon} className="h-6 w-6" />
                      </span>
                      {aplicarVocabulario(i.label, vocabulary)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {proximas.length > 0 ? (
              <div className="mt-5">
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
                  {PROXIMAS_TITULO}
                </p>
                <ul className="space-y-2">
                  {proximas.map((i) => (
                    <li key={i.href} className="flex items-start gap-3 text-[var(--fo-muted-soft)]">
                      <PortalIcon name={i.icon} className="mt-0.5 h-5 w-5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm text-[var(--fo-muted)]">
                          {aplicarVocabulario(i.label, vocabulary)}
                        </span>
                        <span className="block text-xs leading-relaxed">
                          {aplicarVocabulario(i.description, vocabulary)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <form action="/api/auth/logout" method="post" className="mt-5 border-t border-[var(--fo-border)] pt-3">
              <button type="submit" className="w-full py-2 text-left text-sm text-[var(--fo-muted)]">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[var(--fo-border)] bg-[var(--fo-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {barra.map((i) => {
          const activa = !abierto && esActiva(pathname, i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={activa ? "page" : undefined}
              className={tab(activa)}
            >
              <PortalIcon name={i.icon} className="h-5 w-5" />
              {aplicarVocabulario(i.label, vocabulary)}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto(!abierto)}
          className={tab(abierto || masActiva)}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Más
        </button>
      </nav>
    </>
  );
}
