/**
 * Qué forma tiene el librito en 3D, a partir del lienzo del diseño.
 *
 * - **Plegado**: lienzo apaisado con 2 páginas (la carpeta de San Patricio). La página 0 es el
 *   exterior (contratapa a la izquierda, tapa a la derecha) y la página 1 el interior. Es una
 *   sola hoja doblada al medio, que se abre y se cierra sobre el doblez.
 * - **Hojas**: cualquier otro formato. Cada hoja tiene frente y dorso: las páginas 0 y 1 van en
 *   la primera hoja, 2 y 3 en la segunda, y así. Si sobra una página, su dorso queda en blanco.
 *
 * Las medidas van en unidades de escena: el alto de la hoja vale 1.
 */

export type HojaDelLibrito = { frente: number; dorso: number | null };

export type ModeloLibrito =
  | {
      tipo: "plegado";
      /** Ancho de cada mitad (tapa o contratapa), con el alto en 1. */
      anchoMitad: number;
      exterior: number;
      interior: number;
    }
  | {
      tipo: "hojas";
      /** Ancho de la hoja, con el alto en 1. */
      ancho: number;
      hojas: HojaDelLibrito[];
    };

export function modeloDelLibrito(canvasW: number, canvasH: number, pageCount: number): ModeloLibrito {
  const w = Math.max(1, canvasW);
  const h = Math.max(1, canvasH);
  const paginas = Math.max(1, Math.floor(pageCount));
  if (paginas === 2 && w > h) {
    return { tipo: "plegado", anchoMitad: w / h / 2, exterior: 0, interior: 1 };
  }
  const hojas: HojaDelLibrito[] = [];
  for (let i = 0; i < paginas; i += 2) {
    hojas.push({ frente: i, dorso: i + 1 < paginas ? i + 1 : null });
  }
  return { tipo: "hojas", ancho: w / h, hojas };
}

/** Tamaño en píxeles de la textura de una página: el lado mayor no pasa de `maxLado`. */
export function tamanoTextura(canvasW: number, canvasH: number, maxLado = 2048): { w: number; h: number } {
  const w = Math.max(1, canvasW);
  const h = Math.max(1, canvasH);
  const k = Math.min(1, maxLado / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
