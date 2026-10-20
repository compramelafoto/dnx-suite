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

/** Lo mínimo de un bloque del diseño que hace falta para saber cómo se lee una cara. */
export type BloqueParaLeer = {
  type: string;
  pageIndex?: number;
  layout: { x: number; y: number; width: number; height: number; rotation: number; visible?: boolean };
};

/** Lleva un ángulo a (-180, 180]. */
function normalizar(grados: number): number {
  const r = ((grados % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
}

/**
 * Cuánto hay que girar la vista para leer derecha una cara del librito.
 *
 * Mira los textos (TEXT y VARIABLE_TEXT) de esa página cuyo centro cae en la mitad pedida (o en
 * toda la página si `mitad` es null), redondea el giro de cada uno al múltiplo de 90 más cercano
 * y se queda con la orientación que ocupa más superficie. Devuelve el giro de vista que la
 * endereza, entre -90 y 180, o null si la cara no tiene textos.
 *
 * Convención: `layout.rotation` positivo es sentido horario (como en CSS) y el giro de la vista
 * también. Un texto a +90 se lee derecho con la vista a -90. Con `deEspaldas` (la contratapa, que
 * se muestra dando vuelta el librito sobre el eje vertical de la pantalla, por fuera del giro) el
 * giro de la vista se ve espejado, así que el mismo texto a +90 se endereza con la vista a +90.
 */
export function giroParaLeer(
  blocks: readonly BloqueParaLeer[],
  opciones: { pageIndex: number; mitad: "izquierda" | "derecha" | null; canvasW: number; deEspaldas?: boolean },
): number | null {
  const { pageIndex, mitad, canvasW, deEspaldas = false } = opciones;
  const medio = Math.max(1, canvasW) / 2;
  const peso = new Map<number, number>();
  for (const b of blocks) {
    if (b.type !== "TEXT" && b.type !== "VARIABLE_TEXT") continue;
    if ((b.pageIndex ?? 0) !== pageIndex) continue;
    const l = b.layout;
    if (!l || l.visible === false) continue;
    const cx = (Number(l.x) || 0) + (Number(l.width) || 0) / 2;
    if (mitad === "izquierda" && cx >= medio) continue;
    if (mitad === "derecha" && cx < medio) continue;
    const rot = normalizar(Math.round((Number(l.rotation) || 0) / 90) * 90);
    const area = Math.max(1, Math.abs(Number(l.width) || 0) * Math.abs(Number(l.height) || 0));
    peso.set(rot, (peso.get(rot) ?? 0) + area);
  }
  let mejor: number | null = null;
  let mejorPeso = -1;
  for (const [rot, p] of peso) {
    if (p > mejorPeso) {
      mejor = rot;
      mejorPeso = p;
    }
  }
  if (mejor == null) return null;
  return normalizar(deEspaldas ? mejor : -mejor);
}

/** El giro equivalente a `destino` (módulo 360) más cercano a `actual`: gira por el camino corto. */
export function giroMasCercano(actual: number, destino: number): number {
  return actual + normalizar(destino - actual);
}
