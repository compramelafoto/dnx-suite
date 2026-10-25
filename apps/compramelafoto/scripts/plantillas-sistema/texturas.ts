/**
 * Piezas de SVG para dibujar los fondos de los libritos (texturas, manchas, adornos).
 *
 * Todo es determinístico: el azar sale de una semilla fija, así que correr el generador dos
 * veces da exactamente los mismos archivos.
 */
import { ALTO, ANCHO } from "./lienzo";

/** Azar con semilla (mulberry32). */
export function azar(semilla: number) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    entre: (min: number, max: number) => min + r() * (max - min),
    elegir: <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!,
  };
}

export function svg(contenido: string, defs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}"><defs>${defs}</defs>${contenido}</svg>`;
}

/** Filtro de grano de papel: ruido fino en gris, para mezclar con baja opacidad. */
export function filtroGrano(id: string, frecuencia = 0.9, octavas = 2, semilla = 3): string {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="${frecuencia}" numOctaves="${octavas}" seed="${semilla}" result="n"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>`;
}

/** Capa de grano sobre toda la página. */
export function grano(id: string, opacidad: number, modo: "multiply" | "screen" | "overlay" = "multiply"): string {
  return `<rect width="${ANCHO}" height="${ALTO}" filter="url(#${id})" opacity="${opacidad}" style="mix-blend-mode:${modo}"/>`;
}

/** Nubes de color suaves (manchas grandes y difusas). */
export function filtroNube(id: string, semilla: number, desenfoque = 40): string {
  return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="${semilla}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="160" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${desenfoque}"/>
  </filter>`;
}

/** Filtro de acuarela: borde irregular, interior más claro y borde apenas más oscuro. */
export function filtroAcuarela(id: string, semilla: number): string {
  return `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="${semilla}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="120" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="5"/>
  </filter>`;
}

/** Trazo irregular, como de crayón o tiza. */
export function filtroCrayon(id: string, semilla: number, escala = 14): string {
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="${semilla}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="${escala}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="${semilla + 7}" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.7" result="huecos"/>
    <feComposite in="d" in2="huecos" operator="in"/>
  </filter>`;
}

/** Estrella de `puntas` puntas centrada en (cx, cy). */
export function estrella(cx: number, cy: number, r: number, puntas = 5, interior = 0.45, giro = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < puntas * 2; i++) {
    const rr = i % 2 === 0 ? r : r * interior;
    const a = ((giro + (i * 180) / puntas) * Math.PI) / 180;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Corazón aproximado (para jardín). */
export function corazon(cx: number, cy: number, s: number): string {
  return `M ${cx} ${cy + s * 0.35} C ${cx - s * 0.9} ${cy - s * 0.25}, ${cx - s * 0.45} ${cy - s * 0.95}, ${cx} ${cy - s * 0.45} C ${cx + s * 0.45} ${cy - s * 0.95}, ${cx + s * 0.9} ${cy - s * 0.25}, ${cx} ${cy + s * 0.35} Z`;
}

/** Línea ondulada horizontal entre x0 y x1. */
export function onda(x0: number, x1: number, y: number, amplitud: number, largo: number): string {
  let d = `M ${x0} ${y}`;
  for (let x = x0; x < x1; x += largo) {
    d += ` q ${largo / 4} ${-amplitud} ${largo / 2} 0 t ${largo / 2} 0`;
  }
  return d;
}

/** Confeti: rectangulitos y círculos al azar dentro de una zona. */
export function confeti(
  zona: { x: number; y: number; w: number; h: number },
  cantidad: number,
  colores: readonly string[],
  semilla: number,
  tam: [number, number] = [14, 34],
  evitar: Array<{ x: number; y: number; w: number; h: number }> = [],
): string {
  const a = azar(semilla);
  let out = "";
  let puestos = 0;
  let intentos = 0;
  while (puestos < cantidad && intentos < cantidad * 20) {
    intentos++;
    const x = a.entre(zona.x, zona.x + zona.w);
    const y = a.entre(zona.y, zona.y + zona.h);
    if (evitar.some((e) => x > e.x && x < e.x + e.w && y > e.y && y < e.y + e.h)) continue;
    const t = a.entre(tam[0], tam[1]);
    const c = a.elegir(colores);
    const op = a.entre(0.55, 0.95).toFixed(2);
    if (a.r() < 0.5) {
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(t * 1.8).toFixed(1)}" height="${(t * 0.7).toFixed(1)}" fill="${c}" opacity="${op}" transform="rotate(${a.entre(0, 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    } else {
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(t / 2).toFixed(1)}" fill="${c}" opacity="${op}"/>`;
    }
    puestos++;
  }
  return out;
}

/** Trama de puntos regular en una zona. */
export function puntos(zona: { x: number; y: number; w: number; h: number }, paso: number, r: number, color: string, opacidad = 1): string {
  let out = `<g fill="${color}" opacity="${opacidad}">`;
  for (let y = zona.y; y <= zona.y + zona.h; y += paso) {
    for (let x = zona.x; x <= zona.x + zona.w; x += paso) {
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;
    }
  }
  return out + "</g>";
}
