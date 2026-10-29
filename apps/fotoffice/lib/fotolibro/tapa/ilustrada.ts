import type { EstiloFotolibro, Medidas, TextoDelEstilo } from "../estilos/tipos";
import { aislarIds, cajaDeFotos } from "../estilos/vista-previa";
import type { GeometriaTapa, Rect } from "./geometria";

/**
 * Portadas ilustradas por temática, para los 170 estilos sin dibujar ninguna aparte.
 *
 * Cada estilo ya sabe dibujar la página de portada de un libro: es la izquierda de su primer
 * pliego (la "apertura"), con sus adornos y el lugar del título. Y la página de cierre: la derecha
 * de su último pliego, con la frase. La tapa usa exactamente eso, a la medida de cada cara:
 *
 * - en la **tapa**, la página de portada del estilo, con el título en su lugar y su tipografía;
 * - en la **contratapa** (si el modelo la imprime), la página de cierre, con la frase;
 * - el lomo, del color del papel del estilo.
 *
 * Los adornos siguen un poco por la demasía, así un corte corrido no deja una raya blanca.
 */

/** Demasía de dibujo alrededor de cada cara, en mm. */
const DEMASIA_ARTE = 4;

/** El pliego cuya página izquierda (o derecha) mide exactamente como esta cara. */
export const pliegoDeCara = (cara: Rect): Medidas => ({ anchoMm: cara.w * 2, altoMm: cara.h });

const f = (n: number) => Math.round(n * 100) / 100;

/**
 * Una página del fondo del estilo puesta en un rectángulo de la pieza. Se dibuja dos veces: un
 * poco agrandada (lo que cae en la demasía) y exacta encima, para que adornos y títulos coincidan.
 */
function pagina(estilo: EstiloFotolibro, tipo: "apertura" | "cierre", lado: "izq" | "der", cara: Rect, prefijo: string): string {
  const m = pliegoDeCara(cara);
  const fondo = estilo.fondo(tipo, m);
  const vx = lado === "izq" ? 0 : cara.w;
  const en = (r: Rect, p: string) =>
    aislarIds(fondo, p).replace(/^<svg[^>]*>/, `<svg x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" viewBox="${f(vx)} 0 ${f(cara.w)} ${f(cara.h)}" preserveAspectRatio="none">`);
  const d = DEMASIA_ARTE;
  return en({ x: cara.x - d, y: cara.y - d, w: cara.w + 2 * d, h: cara.h + 2 * d }, `${prefijo}b-`) + en(cara, `${prefijo}e-`);
}

/** El dibujo de toda la pieza de tapa, en SVG con medidas en mm. */
export function svgDeTapaIlustrada(estilo: EstiloFotolibro, g: GeometriaTapa): string {
  const { ancho, alto } = g.pieza;
  let cuerpo = `<rect width="${f(ancho)}" height="${f(alto)}" fill="${estilo.papel}"/>`;
  if (g.contratapa) cuerpo += pagina(estilo, "cierre", "der", g.contratapa, "ct");
  cuerpo += pagina(estilo, "apertura", "izq", g.tapa, "tp");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(ancho)} ${f(alto)}" width="${f(ancho)}mm" height="${f(alto)}mm">${cuerpo}</svg>`;
}

/**
 * Qué dibujo corresponde: si cambia el estilo, el modelo o el lomo (las hojas), hay que volver a
 * dibujarlo. Se guarda con la imagen para saber si sigue sirviendo.
 */
export const claveDeArte = (estiloId: string, modeloId: string, g: GeometriaTapa) =>
  `${estiloId}|${modeloId}|${f(g.pieza.ancho)}x${f(g.pieza.alto)}|${f(g.tapa.x)}`;

/** Los títulos de la portada del estilo, llevados a la cara de la tapa (mm de la pieza). */
export function textosDePortada(estilo: EstiloFotolibro, cara: Rect): TextoDelEstilo[] {
  return (estilo.textos?.("apertura", pliegoDeCara(cara)) ?? [])
    .filter((t) => t.x < cara.w && t.rol !== "frase")
    .map((t) => ({ ...t, x: t.x + cara.x, y: t.y + cara.y }));
}

/** La frase del cierre del estilo, llevada a la contratapa. */
export function fraseDeContratapa(estilo: EstiloFotolibro, contratapa: Rect): TextoDelEstilo | null {
  const t = (estilo.textos?.("cierre", pliegoDeCara(contratapa)) ?? []).find((x) => x.rol === "frase" && x.x >= contratapa.w - 1);
  return t ? { ...t, x: t.x - contratapa.w + contratapa.x, y: t.y + contratapa.y } : null;
}

/** Dónde va la foto en la portada ilustrada: la zona que el estilo deja libre de títulos. */
export function fotoDePortada(estilo: EstiloFotolibro, cara: Rect): Rect {
  const c = cajaDeFotos(estilo, "apertura", "izq", pliegoDeCara(cara));
  return { x: c.x + cara.x, y: c.y + cara.y, w: c.w, h: c.h };
}
