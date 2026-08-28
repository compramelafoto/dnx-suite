"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { serializeShellNavCookie } from "@/lib/shell/nav-preference";

/**
 * Armazón del panel administrativo: menú, encabezado y contenido.
 *
 * Existe para que el menú se pueda ocultar. El layout es un componente de servidor y no puede
 * tener estado, así que la decisión "menú visible o no" vive acá, y el encabezado y el propio
 * menú la leen por contexto en vez de recibirla como prop a través de tres niveles.
 *
 * Son DOS comportamientos distintos, no uno con dos tamaños:
 *
 * - En pantalla grande, ocultar el menú le da el ancho completo al contenido. Es una
 *   preferencia: se guarda en cookie y la próxima visita abre igual que como se dejó.
 * - En el teléfono el menú es un cajón que se abre encima del contenido y se cierra al elegir
 *   una opción. Ahí "oculto" es el estado normal, no una preferencia que valga la pena guardar.
 */

type ShellNavState = {
  /** Solo pantalla grande: el menú está oculto y el contenido ocupa todo el ancho. */
  hidden: boolean;
  /** Solo teléfono: el cajón del menú está abierto encima del contenido. */
  drawerOpen: boolean;
  /** Oculta o muestra, según el tamaño de pantalla en el que se toque. */
  toggle: () => void;
  /** Cierra el cajón del teléfono. Lo llama cada enlace del menú al ser elegido. */
  closeDrawer: () => void;
};

const ShellNavContext = createContext<ShellNavState | null>(null);

export function useShellNav(): ShellNavState {
  const state = useContext(ShellNavContext);
  if (!state) {
    throw new Error("useShellNav se usó fuera de <ShellFrame>.");
  }
  return state;
}

function isWideScreen() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
}

export function ShellFrame({
  navHidden,
  sidebar,
  header,
  children,
}: {
  /** Preferencia leída de la cookie en el servidor: evita el parpadeo del menú al cargar. */
  navHidden: boolean;
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(navHidden);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = useCallback(() => {
    if (isWideScreen()) {
      setHidden((current) => {
        const next = !current;
        document.cookie = serializeShellNavCookie(next ? "hidden" : "open");
        return next;
      });
      return;
    }
    setDrawerOpen((current) => !current);
  }, []);

  // Elegir una opción del cajón tiene que cerrarlo: si no, el contenido queda tapado por el
  // menú que acabás de usar y hay que volver a tocar para verlo. Lo cierra el propio enlace
  // al ser pulsado, y no un efecto sobre la ruta: reaccionar al cambio de ruta obliga a
  // renderizar dos veces cada navegación para deshacer algo que ya se sabía en el click.
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && drawerOpen) {
        closeDrawer();
        return;
      }
      // Ctrl+B / ⌘B, el atajo que ya usan los editores para lo mismo.
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, drawerOpen, toggle]);

  return (
    <ShellNavContext.Provider value={{ hidden, drawerOpen, toggle, closeDrawer }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-[var(--fo-bg)]">
        {drawerOpen ? (
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={closeDrawer}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
          />
        ) : null}

        <div
          id="fo-shell-nav"
          className={[
            // Teléfono: cajón fuera de pantalla que entra deslizándose.
            "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] overflow-y-auto",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
            // Pantalla grande: columna fija al lado del contenido, o nada si está oculto.
            hidden
              ? "md:hidden"
              : "md:static md:z-auto md:translate-x-0 md:w-72 md:max-w-none md:shrink-0 md:overflow-visible md:transition-none",
          ].join(" ")}
        >
          {sidebar}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {header}
          <main
            className={[
              "flex-1 p-6 md:p-10 w-full mx-auto",
              hidden ? "max-w-none" : "max-w-6xl",
            ].join(" ")}
          >
            {children}
          </main>
        </div>
      </div>
    </ShellNavContext.Provider>
  );
}
