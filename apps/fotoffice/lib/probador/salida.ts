import { dimensionesRotadas, transformacion, type Encuadre } from "./encuadre";
import type { TipoCuadro } from "./composicion";

/**
 * El archivo que va al laboratorio por cada cuadro: a su medida exacta, al ppp que corresponde y,
 * en el canvas, con la envoltura para doblar sobre el bastidor. Acá vive la cuenta (pura, con
 * pruebas); `render.server.ts` la ejecuta con sharp. Es la misma cuenta que dibuja la pantalla
 * (`transformacion`), así lo que el cliente vio es lo que se imprime.
 */

export type RecetaProbador = {
  tipo: TipoCuadro;
  /** Rectángulo sobre el que se encuadró la foto (el cuadro, o el conjunto con "una foto"), en cm. */
  marco: { w: number; h: number };
  /** Dónde cae la foto de este cuadro dentro de `marco`, en cm. */
  ventana: { x: number; y: number; w: number; h: number };
  encuadre: Encuadre;
  /** Borde extra por lado para el bastidor (canvas); 0 en lo demás. */
  envolturaCm: number;
  /** Número del cuadro dentro del conjunto (1..total), para el nombre del archivo y el mapa. */
  orden: number;
  total: number;
};

export const ENVOLTURA_CANVAS_CM = 5;
const CM_POR_PULGADA = 2.54;

/** Resolución de salida según el lado largo: los grandes se miran de más lejos y no necesitan 300 ppp. */
export function pppPara(w: number, h: number): 300 | 200 | 150 {
  const largo = Math.max(w, h);
  if (largo <= 45) return 300;
  if (largo <= 90) return 200;
  return 150;
}

const aPx = (cm: number, ppp: number) => Math.round((cm * ppp) / CM_POR_PULGADA);

export type PlanDeSalida = {
  ppp: number;
  frente: { w: number; h: number };
  total: { w: number; h: number };
  envoltura: number;
  /** Píxeles de salida por píxel de la foto (ya girada de a 90°). */
  escala: number;
  theta: number;
  /** Parte de la foto girada que hace falta leer (con un margen), para no escalar la foto entera. */
  region: { left: number; top: number; width: number; height: number };
  /** Punto de la foto girada, relativo a `region`, que cae en la esquina superior izquierda del frente. */
  origen: { x: number; y: number };
};

export function planDeSalida(r: RecetaProbador, foto: { w: number; h: number }): PlanDeSalida {
  const ppp = pppPara(r.ventana.w, r.ventana.h), ppcm = ppp / CM_POR_PULGADA;
  const frente = { w: aPx(r.ventana.w, ppp), h: aPx(r.ventana.h, ppp) };
  const envoltura = aPx(r.envolturaCm, ppp);
  const t = transformacion(r.encuadre, r.marco, foto);
  const f = dimensionesRotadas(foto, r.encuadre.rot90);
  const escala = t.s * ppcm;
  const c = Math.cos(-t.theta), s = Math.sin(-t.theta);
  // Un punto del marco (cm, desde su esquina) a la foto girada (px): mismo camino que la pantalla.
  const aFoto = (x: number, y: number) => {
    const dx = x - r.marco.w / 2, dy = y - r.marco.h / 2;
    return { x: t.fx + (dx * c - dy * s) / t.s, y: t.fy + (dx * s + dy * c) / t.s };
  };
  const { x, y, w, h } = r.ventana;
  const esquinas = [aFoto(x, y), aFoto(x + w, y), aFoto(x + w, y + h), aFoto(x, y + h)];
  const margen = 2;
  const left = Math.max(0, Math.floor(Math.min(...esquinas.map((p) => p.x)) - margen));
  const top = Math.max(0, Math.floor(Math.min(...esquinas.map((p) => p.y)) - margen));
  const right = Math.min(f.w, Math.ceil(Math.max(...esquinas.map((p) => p.x)) + margen));
  const bottom = Math.min(f.h, Math.ceil(Math.max(...esquinas.map((p) => p.y)) + margen));
  const origen = esquinas[0];
  return {
    ppp,
    frente,
    total: { w: frente.w + 2 * envoltura, h: frente.h + 2 * envoltura },
    envoltura,
    escala,
    theta: t.theta,
    region: { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
    origen: { x: origen.x - left, y: origen.y - top },
  };
}

/**
 * Dónde queda `origen` después de escalar la región (a `escalada` px) y girarla `theta` con sharp,
 * que gira sobre el centro y agranda el lienzo hasta `girada` px.
 */
export function origenTrasGirar(
  origen: { x: number; y: number },
  escala: { x: number; y: number },
  theta: number,
  escalada: { w: number; h: number },
  girada: { w: number; h: number },
) {
  const px = origen.x * escala.x - escalada.w / 2, py = origen.y * escala.y - escalada.h / 2;
  const c = Math.cos(theta), s = Math.sin(theta);
  return { x: px * c - py * s + girada.w / 2, y: px * s + py * c + girada.h / 2 };
}

const NOMBRE_TIPO: Record<TipoCuadro, string> = { IMPRESION: "Impresión", CANVAS: "Canvas", MDF: "MDF", MARCO: "Con marco" };
const limpio = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "Cliente";
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));
const medida = (w: number, h: number) => `${num(Math.min(w, h))}x${num(Math.max(w, h))}`;

/** `Pedido 12 - Ana Pérez/Canvas 30x40/Cuadro 2 de 5.jpg` */
export function rutaEnZip(numero: number, cliente: string, r: Pick<RecetaProbador, "tipo" | "ventana" | "orden" | "total">): string {
  return `Pedido ${numero} - ${limpio(cliente)}/${NOMBRE_TIPO[r.tipo]} ${medida(r.ventana.w, r.ventana.h)}/Cuadro ${r.orden} de ${r.total}.jpg`;
}

export type CuadroDelMapa = { x: number; y: number; w: number; h: number; tipo: TipoCuadro };

/**
 * El mapa de armado: el conjunto de frente, numerado, con medidas y distancias. Sirve al laboratorio
 * y a quien cuelga los cuadros. Va como SVG (se abre en cualquier navegador) y como texto.
 */
export function mapaDeArmado(cuadros: readonly CuadroDelMapa[], numero: number, cliente: string): { svg: string; texto: string } {
  const x0 = Math.min(...cuadros.map((q) => q.x)), y0 = Math.min(...cuadros.map((q) => q.y));
  const ancho = Math.max(...cuadros.map((q) => q.x + q.w)) - x0, alto = Math.max(...cuadros.map((q) => q.y + q.h)) - y0;
  const m = 12, esc = 6;
  const W = Math.round((ancho + 2 * m) * esc), H = Math.round((alto + 2 * m) * esc) + 40;
  const rects = cuadros.map((q, i) => {
    const x = (q.x - x0 + m) * esc, y = (q.y - y0 + m) * esc + 40, w = q.w * esc, h = q.h * esc;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#f2f2f2" stroke="#222" stroke-width="2"/>`
      + `<text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700">${i + 1}</text>`
      + `<text x="${(x + w / 2).toFixed(1)}" y="${(y + h / 2 + 30).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="18">${num(q.w)} × ${num(q.h)} cm</text>`;
  }).join("");
  const titulo = `Pedido ${numero} · ${cliente.replace(/[<>&]/g, "")} · conjunto de ${num(ancho)} × ${num(alto)} cm`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/><text x="16" y="28" font-family="sans-serif" font-size="20">${titulo}</text>${rects}</svg>`;
  const lineas = cuadros.map((q, i) =>
    `Cuadro ${i + 1} · ${NOMBRE_TIPO[q.tipo]} ${num(q.w)} × ${num(q.h)} cm · a ${num(q.x - x0)} cm de la izquierda y ${num(q.y - y0)} cm de arriba`);
  const texto = [`Mapa de armado — pedido ${numero} (${cliente})`, `Conjunto: ${num(ancho)} × ${num(alto)} cm (ancho × alto). Medidas desde la esquina superior izquierda del conjunto.`, "", ...lineas, ""].join("\n");
  return { svg, texto };
}
