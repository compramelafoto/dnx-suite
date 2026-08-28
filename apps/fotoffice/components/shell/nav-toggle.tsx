"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useShellNav } from "./shell-frame";

function ToggleButton({
  open,
  onClick,
  display,
}: {
  open: boolean;
  onClick: () => void;
  /** Clases de visibilidad: deciden en qué tamaño de pantalla se muestra este botón. */
  display: string;
}) {
  const label = open ? "Ocultar el menú" : "Mostrar el menú";
  const Icon = open ? PanelLeftClose : PanelLeftOpen;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="fo-shell-nav"
      aria-label={label}
      title={`${label} (Ctrl+B)`}
      className={[
        display,
        "size-9 shrink-0 items-center justify-center rounded-lg",
        "text-[var(--fo-muted)] transition-colors",
        "hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fo-accent)]/45",
      ].join(" ")}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

/**
 * Botón de ocultar/mostrar el menú.
 *
 * Aparece dos veces a propósito, con la misma acción y distinto lugar:
 *
 * - `variant="header"` en la barra superior, siempre visible. Es el único camino de vuelta
 *   cuando el menú está oculto: sin él, la pantalla completa sería un callejón sin salida.
 * - `variant="sidebar"` dentro del propio menú, para cerrarlo desde donde estás mirando.
 *
 * El del encabezado son en realidad dos botones, uno por tamaño de pantalla, y solo uno se
 * muestra a la vez. Es porque el estado que describen es distinto: en el teléfono el menú es
 * un cajón que suele estar cerrado, y en pantalla grande suele estar abierto. Con un solo
 * botón, el teléfono mostraba "Ocultar el menú" cuando el menú ya estaba oculto. Resolverlo
 * midiendo el ancho desde JavaScript obligaría a pintar la barra dos veces en cada carga.
 */
export function NavToggle({ variant }: { variant: "header" | "sidebar" }) {
  const { hidden, drawerOpen, toggle } = useShellNav();

  if (variant === "sidebar") {
    // Dentro del menú, el menú siempre está a la vista: este botón solo cierra.
    return <ToggleButton open onClick={toggle} display="inline-flex" />;
  }

  return (
    <>
      <ToggleButton open={drawerOpen} onClick={toggle} display="inline-flex md:hidden" />
      <ToggleButton open={!hidden} onClick={toggle} display="hidden md:inline-flex" />
    </>
  );
}
