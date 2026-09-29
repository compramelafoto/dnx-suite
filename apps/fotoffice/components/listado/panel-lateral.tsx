"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";

const CAMPOS = "input, select, textarea, [contenteditable='true']";

/**
 * Vista rápida de una fila, a la derecha de la tabla. Esc la cierra y ↑/↓ pasan a la fila
 * anterior o siguiente de la página (los enlaces vienen calculados del servidor).
 */
export function PanelLateral({
  titulo,
  hrefCerrar,
  hrefAnterior,
  hrefSiguiente,
  hrefFicha,
  children,
}: {
  titulo: string;
  hrefCerrar: string;
  hrefAnterior: string | null;
  hrefSiguiente: string | null;
  hrefFicha: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);

  // El panel se vuelve a montar con cada fila (tiene `key`): el foco va a él al abrirse.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest?.(CAMPOS)) return;
      const destino =
        e.key === "Escape" ? hrefCerrar : e.key === "ArrowUp" ? hrefAnterior : e.key === "ArrowDown" ? hrefSiguiente : null;
      if (!destino) return;
      e.preventDefault();
      router.push(destino, { scroll: false });
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [router, hrefCerrar, hrefAnterior, hrefSiguiente]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      role="complementary"
      aria-label={titulo}
      className="fo-card !p-0 outline-none lg:sticky lg:top-4 lg:w-[420px] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
    >
      <div className="flex items-center gap-1 border-b border-[var(--fo-border)] px-4 py-2">
        <Link href={hrefFicha} className="fo-btn fo-btn-secondary !min-h-9 !px-3 text-sm">
          <ExternalLink className="size-4" aria-hidden />
          Abrir ficha
        </Link>
        <div className="ml-auto flex items-center">
          {hrefAnterior ? (
            <Link href={hrefAnterior} scroll={false} className="fo-icon-btn" aria-label="Fila anterior" title="Anterior (↑)">
              <ChevronUp className="size-4" />
            </Link>
          ) : null}
          {hrefSiguiente ? (
            <Link href={hrefSiguiente} scroll={false} className="fo-icon-btn" aria-label="Fila siguiente" title="Siguiente (↓)">
              <ChevronDown className="size-4" />
            </Link>
          ) : null}
          <Link href={hrefCerrar} scroll={false} className="fo-icon-btn" aria-label="Cerrar panel" title="Cerrar (Esc)">
            <X className="size-4" />
          </Link>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </aside>
  );
}
