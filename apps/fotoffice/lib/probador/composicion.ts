import { cuadrosDe, medidaDelConjunto, type ComposicionId, type Rect } from "./geometria";
import { ENCUADRE_INICIAL, type Encuadre } from "./encuadre";

/**
 * La composición del probador como dato puro, en cm: qué cuadros hay, dónde está cada uno, de qué
 * tipo es y cómo se encuadra su foto. El motor la dibuja y la guarda en el historial; acá sólo
 * viven las operaciones, que nunca modifican la composición recibida.
 */

export type TipoCuadro = "IMPRESION" | "CANVAS" | "MARCO";

export type Cuadro = {
  id: string;
  tipo: TipoCuadro;
  /** Esquina superior izquierda, relativa al origen del conjunto. */
  x: number;
  y: number;
  w: number;
  h: number;
  paspartu: number;
  /** Índice de la foto propia (cuando no es "una foto para todos"). */
  foto: number;
  encuadre: Encuadre;
};

export type Composicion = {
  cuadros: Cuadro[];
  unaFoto: boolean;
  fotoConjunto: number;
  encuadreConjunto: Encuadre;
  /** Origen del conjunto sobre la pared, en cm. */
  ox: number;
  oy: number;
};

export const PASPARTUS = [0, 3, 5, 8] as const;
/** Ancho del perfil del marco genérico mientras no se elijan modelos reales. */
export const PERFIL_MARCO_CM = 2.5;
const SEPARACION_AL_DUPLICAR = 5;

let siguienteId = 0;
const nuevoId = () => `c${++siguienteId}`;

export function desdePlantilla(
  id: ComposicionId,
  w: number,
  h: number,
  sep: number,
  tipo: TipoCuadro,
  centro: { x: number; y: number },
): Composicion {
  const rects = cuadrosDe(id, w, h, sep);
  const { w: bw, h: bh } = medidaDelConjunto(rects);
  return {
    cuadros: rects.map((r, i) => ({ id: nuevoId(), tipo, ...r, paspartu: tipo === "MARCO" ? 5 : 0, foto: i, encuadre: ENCUADRE_INICIAL })),
    unaFoto: false,
    fotoConjunto: 0,
    encuadreConjunto: ENCUADRE_INICIAL,
    ox: centro.x - bw / 2,
    oy: centro.y - bh / 2,
  };
}

export function rectanguloDelConjunto(c: Composicion): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of c.cuadros) {
    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x + q.w); y1 = Math.max(y1, q.y + q.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** El centro del conjunto sobre la pared. */
export function centroEnLaPared(c: Composicion) {
  const r = rectanguloDelConjunto(c);
  return { x: c.ox + r.x + r.w / 2, y: c.oy + r.y + r.h / 2 };
}

export function moverConjunto(c: Composicion, dx: number, dy: number): Composicion {
  return { ...c, ox: c.ox + dx, oy: c.oy + dy };
}

const conCuadro = (c: Composicion, id: string, f: (q: Cuadro) => Cuadro): Composicion => ({
  ...c,
  cuadros: c.cuadros.map((q) => (q.id === id ? f(q) : q)),
});

/**
 * Mueve un cuadro y lo encastra con los vecinos: bordes y centros a menos de `tolCm` se alinean,
 * como en un programa de diseño. Devuelve las guías que se activaron para dibujarlas.
 */
export function moverCuadro(c: Composicion, id: string, dx: number, dy: number, tolCm = 1) {
  const q = c.cuadros.find((x) => x.id === id);
  if (!q) return { comp: c, guias: { x: [] as number[], y: [] as number[] } };
  const otros = c.cuadros.filter((x) => x.id !== id);
  const encastrar = (pos: number, largo: number, refs: number[]) => {
    let mejor: { ajuste: number; guia: number } | null = null;
    for (const propio of [pos, pos + largo / 2, pos + largo]) {
      for (const ref of refs) {
        const d = ref - propio;
        if (Math.abs(d) <= tolCm && (!mejor || Math.abs(d) < Math.abs(mejor.ajuste))) mejor = { ajuste: d, guia: ref };
      }
    }
    return mejor;
  };
  const refsX = otros.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w]);
  const refsY = otros.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h]);
  let x = q.x + dx, y = q.y + dy;
  const ex = encastrar(x, q.w, refsX), ey = encastrar(y, q.h, refsY);
  if (ex) x += ex.ajuste;
  if (ey) y += ey.ajuste;
  return {
    comp: conCuadro(c, id, (v) => ({ ...v, x, y })),
    guias: { x: ex ? [ex.guia] : [], y: ey ? [ey.guia] : [] },
  };
}

export function cambiarMedida(c: Composicion, id: string, w: number, h: number): Composicion {
  return conCuadro(c, id, (q) => ({ ...q, x: q.x + (q.w - w) / 2, y: q.y + (q.h - h) / 2, w, h }));
}

export function cambiarCuadro(
  c: Composicion,
  id: string,
  cambios: Partial<Pick<Cuadro, "tipo" | "paspartu" | "foto" | "encuadre">>,
): Composicion {
  return conCuadro(c, id, (q) => ({ ...q, ...cambios }));
}

export function duplicarCuadro(c: Composicion, id: string): Composicion {
  const q = c.cuadros.find((x) => x.id === id);
  if (!q) return c;
  const r = rectanguloDelConjunto(c);
  return { ...c, cuadros: [...c.cuadros, { ...q, id: nuevoId(), x: r.x + r.w + SEPARACION_AL_DUPLICAR }] };
}

export function quitarCuadro(c: Composicion, id: string): Composicion {
  if (c.cuadros.length <= 1) return c;
  return { ...c, cuadros: c.cuadros.filter((q) => q.id !== id) };
}

export function aplicarATodos(
  c: Composicion,
  cambios: { w?: number; h?: number; tipo?: TipoCuadro; paspartu?: number },
): Composicion {
  let r = c;
  for (const q of c.cuadros) {
    if (cambios.w != null && cambios.h != null) r = cambiarMedida(r, q.id, cambios.w, cambios.h);
    const { w: _w, h: _h, ...resto } = cambios;
    if (Object.keys(resto).length) r = cambiarCuadro(r, q.id, resto);
  }
  return r;
}

/** La ventana donde va la foto: el canvas y la impresión la llevan entera; el marco descuenta perfil y paspartú. */
export function rectFoto(q: Cuadro): Rect {
  if (q.tipo !== "MARCO") return { x: q.x, y: q.y, w: q.w, h: q.h };
  const m = PERFIL_MARCO_CM + q.paspartu;
  return { x: q.x + m, y: q.y + m, w: Math.max(1, q.w - 2 * m), h: Math.max(1, q.h - 2 * m) };
}
