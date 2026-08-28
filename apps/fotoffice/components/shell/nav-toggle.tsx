"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useShellNav } from "./shell-frame";

/**
 * Botón de ocultar/mostrar el menú.
 *
 * Aparece dos veces a propósito, con la misma acción y distinto lugar:
 *
 * - `variant="header"` en la barra superior, siempre visible. Es el único camino de vuelta
 *   cuando el menú está oculto: sin él, la pantalla completa sería un callejón sin salida.
 * - `variant="sidebar"` dentro del propio menú, para cerrarlo desde donde estás mirando.
 */
export function NavToggle({ variant }: { variant: "header" | "sidebar" }) {
  const { hidden, drawerOpen, toggle } = useShellNav();
  const isOpen = variant === "sidebar" ? true : !hidden || drawerOpen;
  const label = isOpen ? "Ocultar el menú" : "Mostrar el menú";
  const Icon = isOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={isOpen}
      aria-controls="fo-shell-nav"
      aria-label={label}
      title={`${label} (Ctrl+B)`}
      className={[
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
        "text-[var(--fo-muted)] transition-colors",
        "hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-accent)]/45",
      ].join(" ")}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
