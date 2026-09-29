"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

const INTERACTIVOS = "a, button, input, select, textarea, label, summary";

/**
 * Una fila clickeable. En pantallas anchas abre el panel lateral (y, si ya estaba abierto para
 * esta fila, la ficha completa); en pantallas chicas va directo a la ficha. Los clics sobre
 * casillas, links o botones de la fila no la abren.
 */
export function Fila({
  id,
  hrefPanel,
  hrefFicha,
  activa,
  children,
}: {
  id: string;
  hrefPanel: string;
  hrefFicha: string;
  activa: boolean;
  children: ReactNode;
}) {
  const router = useRouter();

  function abrir(e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest(INTERACTIVOS)) return;
    if (window.getSelection()?.toString()) return; // estaba seleccionando texto para copiar
    const ancha = window.matchMedia("(min-width: 1024px)").matches;
    if (ancha && !activa) router.push(hrefPanel, { scroll: false });
    else router.push(hrefFicha);
  }

  return (
    <tr
      data-id={id}
      aria-selected={activa || undefined}
      onClick={abrir}
      className={`cursor-pointer transition-colors ${activa ? "bg-[var(--fo-accent-soft)]" : "hover:bg-[var(--fo-surface-hover)]"}`}
    >
      {children}
    </tr>
  );
}
