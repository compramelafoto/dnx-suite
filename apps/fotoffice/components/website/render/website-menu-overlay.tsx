"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { MenuSideId } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";
import { levelStyle } from "@/lib/website/typography";
import { PESO_ACTUAL, SiteNavLink, useIsCurrentNavItem } from "./website-header-nav-client";

export type MenuOverlayVariant = "drawer" | "fullscreen" | "modal";

/**
 * El botón de menú (las tres rayitas) y lo que abre: un panel que se desliza desde un costado,
 * una pantalla completa o una tarjeta al centro. Es el menú del celular en todas las
 * disposiciones, y también el de la compu en las tres que lo esconden detrás de un botón.
 *
 * Usa `position: fixed`. En la vista previa del constructor, el marco del dispositivo tiene un
 * `transform`, que hace que "fijo" quede atado a ese marco y no a la ventana del panel.
 *
 * Accesible: el botón dice si está abierto, Escape cierra, al abrir el foco va al botón de
 * cerrar y al cerrar vuelve al de abrir. Cerrado queda `inert`: no se puede tabular adentro.
 */
export function WebsiteMenuOverlay({
  navItems,
  variant,
  side,
  colorTexto,
  triggerClassName = "",
  children,
}: {
  navItems: SiteNavItem[];
  variant: MenuOverlayVariant;
  side: MenuSideId;
  colorTexto: string;
  triggerClassName?: string;
  /** Lo que va al pie del panel (el botón de iniciar sesión). */
  children?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const botonAbrir = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const yaAbrio = useRef(false);
  const esActual = useIsCurrentNavItem();

  useEffect(() => {
    if (!abierto) {
      // Devolver el foco sólo si de verdad se cerró algo (no en el primer render).
      if (yaAbrio.current) botonAbrir.current?.focus();
      return;
    }
    yaAbrio.current = true;
    botonCerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  const cerrar = () => setAbierto(false);
  const desdeIzquierda = side === "left";

  const posicionPanel =
    variant === "drawer"
      ? `top-0 bottom-0 ${desdeIzquierda ? "left-0" : "right-0"} w-[min(20rem,85%)] p-6 transition-transform duration-300 ${
          abierto ? "translate-x-0" : desdeIzquierda ? "-translate-x-full" : "translate-x-full"
        }`
      : variant === "fullscreen"
        ? `inset-0 items-center justify-center p-8 text-center transition-opacity duration-300 ${abierto ? "opacity-100" : "opacity-0"}`
        : `left-1/2 top-1/2 w-[min(24rem,90%)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-8 text-center shadow-2xl transition duration-200 ${
            abierto ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`;

  const tamanoItem = variant === "fullscreen" ? "text-3xl py-3" : variant === "modal" ? "text-lg py-2" : "text-base py-2";

  return (
    <>
      <button
        ref={botonAbrir}
        type="button"
        aria-label="Abrir el menú"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto(true)}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${triggerClassName}`}
        style={{ color: colorTexto }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div
        className={`fixed inset-0 z-50 ${abierto ? "visible" : "invisible"}`}
        inert={!abierto}
        aria-hidden={!abierto}
      >
        {variant !== "fullscreen" ? (
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${abierto ? "opacity-100" : "opacity-0"}`}
            onClick={cerrar}
            aria-hidden="true"
          />
        ) : null}

        <div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className={`absolute flex flex-col ${posicionPanel}`}
          style={{ backgroundColor: "var(--wsite-bg)", color: "var(--wsite-menu-color)" }}
        >
          <button
            ref={botonCerrar}
            type="button"
            aria-label="Cerrar el menú"
            onClick={cerrar}
            className={`absolute top-3 flex h-11 w-11 items-center justify-center rounded-lg ${
              variant === "drawer" && desdeIzquierda ? "left-3" : "right-3"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>

          <nav aria-label="Menú principal" className={`flex flex-col ${variant === "drawer" ? "mt-10" : ""}`}>
            {navItems.map((item) => {
              const actual = esActual(item);
              return (
                <div key={item.id} className="flex flex-col">
                  <SiteNavLink
                    item={item}
                    current={actual}
                    onNavigate={cerrar}
                    className={`${tamanoItem} transition-opacity hover:opacity-70`}
                    // Letra, grosor y mayúsculas del nivel Menú; el tamaño, el de cada panel.
                    style={{ ...levelStyle("menu", { color: false }), fontSize: undefined, ...(actual ? PESO_ACTUAL : {}) }}
                  />
                  {item.children.map((hijo) => (
                    <SiteNavLink
                      key={hijo.id}
                      item={hijo}
                      current={false}
                      onNavigate={cerrar}
                      className={`py-1.5 text-sm opacity-70 hover:opacity-100 ${variant === "drawer" ? "pl-4" : ""}`}
                    />
                  ))}
                </div>
              );
            })}
          </nav>

          {children ? <div className={variant === "drawer" ? "mt-auto pt-6" : "mt-8"}>{children}</div> : null}
        </div>
      </div>
    </>
  );
}
