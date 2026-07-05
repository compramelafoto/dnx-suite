"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Barreras con efecto real limitado (web no puede impedir capturas de pantalla del SO).
 *
 * - **Sí ayuda:** bloquear menú contextual y arrastre en `<img>` evita “Guardar imagen como…”
 *   y arrastrar la miniatura al escritorio (fricción para copia casual).
 * - **No bloquea:** Print Screen, herramientas del sistema, extensiones, DevTools, fotografiar el monitor,
 *   ni URLs si alguien ya las obtuvo por otra vía.
 *
 * La reducción de fuga comercial prioritaria está en: menos datos en UI, referencias `photo:{id}` sin
 * originalKey en JSON, previews vía `/api/photos/.../view` con comprobación de álbum y rate limit.
 */
export default function CheckoutLeakGuard({
  children,
  active = true,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    const onContextMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !root.contains(el)) return;
      if (el.tagName === "IMG" || el.closest("img")) {
        e.preventDefault();
      }
    };

    const onDragStart = (e: DragEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !root.contains(el)) return;
      if (el.tagName === "IMG" || el.closest("img")) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart, true);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart, true);
    };
  }, [active]);

  return <div ref={rootRef}>{children}</div>;
}
