"use client";

import { useCallback, useState } from "react";

export type MedidaDeFoto = { ancho: number; alto: number };

/**
 * Ancho y alto reales de cada foto, medidos cuando carga su miniatura (la base no los guarda).
 * Sirve para decir si una copia se imprime horizontal o vertical.
 *
 * `registrar` va en el `onLoad` y en el `ref` del `<img>`: si la imagen ya estaba en caché
 * antes de que React escuche el `load`, el `ref` la encuentra completa y la mide igual.
 */
export function useMedidasDeFotos() {
  const [medidas, setMedidas] = useState<ReadonlyMap<number, MedidaDeFoto>>(() => new Map());
  const registrar = useCallback((photoId: number, img: HTMLImageElement | null) => {
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
    const ancho = img.naturalWidth;
    const alto = img.naturalHeight;
    setMedidas((prev) => {
      const m = prev.get(photoId);
      if (m && m.ancho === ancho && m.alto === alto) return prev;
      const next = new Map(prev);
      next.set(photoId, { ancho, alto });
      return next;
    });
  }, []);
  return { medidas, registrar };
}
