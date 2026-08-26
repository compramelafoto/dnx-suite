"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Estado *solo del Builder*, nunca persistido: qué placa del Hero se está editando ahora mismo,
 * para que la preview central salte a esa placa mientras escribís (pedido: "no quiero estar
 * editando una placa mientras la preview muestra otra"). `HeroBlockView` lee esto vía
 * `useHeroEditingSlide` y, si no hay Provider arriba (rutas públicas/preview de servidor), el
 * hook devuelve `null` — el carrusel sigue su comportamiento normal (autoplay, etc.), así el
 * mismo componente sirve para el builder y para el renderer público sin ninguna rama especial.
 */
type HeroEditingState = {
  /** `{ blockId, slideId }` de la placa que el inspector tiene abierta, o `null` si no hay ninguna. */
  editing: { blockId: string; slideId: string } | null;
  setEditing: (value: { blockId: string; slideId: string } | null) => void;
};

const HeroEditingContext = createContext<HeroEditingState | null>(null);

export function HeroEditingProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState<{ blockId: string; slideId: string } | null>(null);
  const value = useMemo(() => ({ editing, setEditing }), [editing]);
  return <HeroEditingContext.Provider value={value}>{children}</HeroEditingContext.Provider>;
}

/** Placa forzada para este Hero puntual (`blockId`), o `null` si no aplica — lo usa `HeroBlockView`. */
export function useHeroEditingSlideId(blockId: string): string | null {
  const ctx = useContext(HeroEditingContext);
  if (!ctx || !ctx.editing || ctx.editing.blockId !== blockId) return null;
  return ctx.editing.slideId;
}

/** Setter para que el inspector del Hero marque/limpie qué placa está editando. */
export function useSetHeroEditingSlide(): (value: { blockId: string; slideId: string } | null) => void {
  const ctx = useContext(HeroEditingContext);
  return ctx?.setEditing ?? (() => {});
}
