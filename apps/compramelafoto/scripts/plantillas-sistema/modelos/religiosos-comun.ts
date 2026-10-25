/**
 * Motivos para los libritos de actos religiosos (modelos 41 a 50): cáliz y hostia, espigas de
 * trigo, racimos de uvas, paloma, cruz, vitral, rayos de luz, puntillas y flores blancas.
 *
 * Todo es SVG dibujado acá, sin imágenes de terceros. Las medidas van en píxeles del lienzo.
 */
import { azar } from "../texturas";

/** Degradado dorado (de oro viejo a oro claro) para usar como `fill="url(#id)"`. */
export function degradadoOro(id: string, claro = "#f1dfa4", medio = "#c9a24f", oscuro = "#9a7430"): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${medio}"/><stop offset="0.45" stop-color="${claro}"/><stop offset="0.7" stop-color="${medio}"/><stop offset="1" stop-color="${oscuro}"/>
  </linearGradient>`;
}

/** Resplandor suave (círculo con degradado radial que se desvanece). */
export function degradadoLuz(id: string, color: string, opacidad = 0.85): string {
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacidad}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

/** Rayos de luz alrededor de un punto: cuñas finas alternadas, largas y cortas. */
export function rayos(cx: number, cy: number, r0: number, r1: number, n: number, color: string, opacidad = 0.5, ancho = 0.05): string {
  let out = `<g fill="${color}" opacity="${opacidad}">`;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const largo = i % 2 === 0 ? r1 : r0 + (r1 - r0) * 0.62;
    const p = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`;
    out += `<polygon points="${p(a - ancho, r0)} ${p(a, largo)} ${p(a + ancho, r0)}"/>`;
  }
  return out + "</g>";
}

/** Hostia: círculo con una cruz fina grabada. */
export function hostia(cx: number, cy: number, r: number, relleno: string, linea: string): string {
  const c = r * 0.5;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${relleno}" stroke="${linea}" stroke-width="${(r * 0.05).toFixed(1)}"/>
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.86).toFixed(1)}" fill="none" stroke="${linea}" stroke-width="${(r * 0.02).toFixed(1)}" opacity="0.7"/>
    <path d="M ${cx} ${cy - c} V ${cy + c} M ${cx - c * 0.7} ${cy - c * 0.25} H ${cx + c * 0.7}" stroke="${linea}" stroke-width="${(r * 0.06).toFixed(1)}" stroke-linecap="round"/>`;
}

/**
 * Cáliz con la hostia encima. `cx, cy` es el centro de la copa (su borde superior); `s` es el
 * ancho de la copa. `relleno` puede ser un color o `url(#oro)`.
 */
export function caliz(cx: number, cy: number, s: number, relleno: string, opts: { hostia?: boolean; linea?: string; colorHostia?: string } = {}): string {
  const k = s / 100;
  const P = (x: number, y: number) => `${(cx + x * k).toFixed(1)} ${(cy + y * k).toFixed(1)}`;
  const linea = opts.linea ?? "none";
  const copa = `<path d="M ${P(-50, 0)} C ${P(-50, 42)} ${P(-30, 66)} ${P(-7, 72)} L ${P(-6, 96)} C ${P(-14, 100)} ${P(-14, 110)} ${P(-6, 114)} L ${P(-6, 140)} C ${P(-20, 148)} ${P(-48, 156)} ${P(-52, 172)} L ${P(52, 172)} C ${P(48, 156)} ${P(20, 148)} ${P(6, 140)} L ${P(6, 114)} C ${P(14, 110)} ${P(14, 100)} ${P(6, 96)} L ${P(7, 72)} C ${P(30, 66)} ${P(50, 42)} ${P(50, 0)} Z" fill="${relleno}" stroke="${linea}" stroke-width="${(2 * k).toFixed(1)}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${(50 * k).toFixed(1)}" ry="${(7 * k).toFixed(1)}" fill="${relleno}" stroke="${linea}" stroke-width="${(2 * k).toFixed(1)}"/>
    <path d="M ${P(-44, 22)} C ${P(-20, 30)} ${P(20, 30)} ${P(44, 22)}" stroke="#ffffff" stroke-opacity="0.45" stroke-width="${(3 * k).toFixed(1)}" fill="none"/>`;
  const h = opts.hostia === false ? "" : hostia(cx, cy - 34 * k, 30 * k, opts.colorHostia ?? "#fffdf6", relleno.startsWith("url") ? "#b8923f" : relleno);
  return copa + h;
}

/** Espiga de trigo: tallo curvo y granos de a pares. `ang` en grados (0 = hacia arriba). */
export function espiga(x: number, y: number, largo: number, ang: number, color: string, granos = 9): string {
  const g = largo / 100;
  let out = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang})" fill="${color}">`;
  out += `<path d="M 0 0 Q ${3 * g} ${-50 * g} 0 ${-100 * g}" stroke="${color}" stroke-width="${(2.2 * g).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
  for (let i = 0; i < granos; i++) {
    const t = 0.42 + (i / granos) * 0.55;
    const yy = -100 * g * t;
    const tam = (1 - t * 0.45) * 7.5 * g;
    out += `<ellipse cx="${(-tam * 0.85).toFixed(1)}" cy="${yy.toFixed(1)}" rx="${(tam * 0.55).toFixed(1)}" ry="${tam.toFixed(1)}" transform="rotate(-28 ${(-tam * 0.85).toFixed(1)} ${yy.toFixed(1)})"/>`;
    out += `<ellipse cx="${(tam * 0.85).toFixed(1)}" cy="${(yy - tam * 0.4).toFixed(1)}" rx="${(tam * 0.55).toFixed(1)}" ry="${tam.toFixed(1)}" transform="rotate(28 ${(tam * 0.85).toFixed(1)} ${(yy - tam * 0.4).toFixed(1)})"/>`;
    // Barbas finas.
    out += `<path d="M ${(-tam * 1.2).toFixed(1)} ${(yy - tam).toFixed(1)} l ${(-tam * 0.9).toFixed(1)} ${(-tam * 2.6).toFixed(1)} M ${(tam * 1.2).toFixed(1)} ${(yy - tam * 1.4).toFixed(1)} l ${(tam * 0.9).toFixed(1)} ${(-tam * 2.6).toFixed(1)}" stroke="${color}" stroke-width="${(0.6 * g).toFixed(1)}" opacity="0.8"/>`;
  }
  out += `<ellipse cx="0" cy="${(-100 * g - 4 * g).toFixed(1)}" rx="${(3.4 * g).toFixed(1)}" ry="${(6 * g).toFixed(1)}"/>`;
  return out + "</g>";
}

/** Manojo de tres espigas abiertas en abanico. */
export function manojoEspigas(x: number, y: number, largo: number, color: string, giro = 0): string {
  return `<g transform="rotate(${giro} ${x} ${y})">${espiga(x, y, largo, -18, color)}${espiga(x, y, largo * 1.08, 0, color)}${espiga(x, y, largo, 18, color)}</g>`;
}

/** Racimo de uvas con una hoja y un zarcillo. `s` ≈ alto del racimo. */
export function racimo(cx: number, cy: number, s: number, uva: string, hoja: string): string {
  const r = s / 9;
  const filas = [4, 4, 3, 3, 2, 1];
  let out = "";
  filas.forEach((n, f) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * r * 1.75 + (f % 2 ? r * 0.12 : -r * 0.12);
      const y = cy + f * r * 1.5;
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${uva}"/><circle cx="${(x - r * 0.32).toFixed(1)}" cy="${(y - r * 0.32).toFixed(1)}" r="${(r * 0.28).toFixed(1)}" fill="#ffffff" opacity="0.35"/>`;
    }
  });
  const hx = cx + r * 1.2;
  const hy = cy - r * 1.6;
  const hojaPath = `M ${hx} ${hy} c ${r * 1.2} ${-r * 0.6} ${r * 2.2} ${-r * 2.4} ${r * 3.6} ${-r * 1.6} c ${-r * 0.2} ${r * 0.8} ${r * 0.5} ${r * 1.1} ${r * 0.1} ${r * 1.9} c ${-r * 0.5} ${r * 0.5} ${-r * 1} ${r * 0.2} ${-r * 1.6} ${r * 0.6} c ${-r * 0.6} ${r * 0.3} ${-r * 1.4} ${r * 0.1} ${-r * 2.1} ${-r * 0.9} Z`;
  out += `<path d="${hojaPath}" fill="${hoja}"/>`;
  out += `<path d="M ${cx} ${cy - r} Q ${cx - r * 0.2} ${cy - r * 2.2} ${cx - r * 0.8} ${cy - r * 2.6} q ${-r * 1.2} ${-r * 0.4} ${-r * 0.8} ${-r * 1.4} q ${r * 0.4} ${-r * 0.6} ${r * 0.9} ${-r * 0.1}" stroke="${hoja}" stroke-width="${(r * 0.18).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
  return out;
}

/**
 * Paloma en vuelo, mirando a la izquierda (`espejo` la da vuelta). `s` = ancho total. Silueta
 * de cuerpo, dos alas y cola en abanico.
 */
export function paloma(cx: number, cy: number, s: number, color: string, opts: { espejo?: boolean; giro?: number; linea?: string } = {}): string {
  const k = s / 200;
  const t = `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${opts.giro ?? 0}) scale(${opts.espejo ? -k : k} ${k}) translate(-100 -70)`;
  const linea = opts.linea ? `stroke="${opts.linea}" stroke-width="${(3.5 / k).toFixed(2)}" stroke-linejoin="round"` : "";
  // Ala de atrás (más clara), cuerpo con cabeza y cola, ala de adelante.
  return `<g transform="${t}" fill="${color}" ${linea}>
    <path d="M 98 60 C 98 36 110 14 138 -2 C 136 6 138 10 132 16 C 138 18 136 24 128 28 C 132 34 128 38 120 40 C 122 46 118 52 110 54 Z" opacity="0.7"/>
    <path d="M 14 60 C 18 52 26 48 34 49 C 42 50 47 55 52 60 C 64 64 84 66 104 64 C 128 62 150 58 172 50 L 196 40 C 192 50 190 56 194 66 C 184 68 178 70 170 74 C 156 84 132 92 104 92 C 80 92 62 86 50 76 C 42 70 34 66 26 65 C 20 64 16 63 14 60 Z"/>
    <path d="M 14 60 L 2 63 L 15 64 Z"/>
    <path d="M 76 66 C 72 36 92 8 152 -14 C 148 -4 152 2 142 10 C 150 14 148 22 136 26 C 144 32 140 38 128 40 C 134 46 128 52 118 54 C 120 60 112 64 100 64 C 92 66 84 66 76 66 Z"/>
  </g>`;
}

/** Ramita de olivo (para la paloma o como adorno). */
export function olivo(x: number, y: number, largo: number, ang: number, color: string): string {
  let out = `<g transform="translate(${x} ${y}) rotate(${ang})"><path d="M 0 0 Q ${largo * 0.5} ${-largo * 0.08} ${largo} 0" stroke="${color}" stroke-width="${(largo * 0.025).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
  for (let i = 1; i <= 5; i++) {
    const px = (largo * i) / 6;
    const lado = i % 2 ? -1 : 1;
    out += `<ellipse cx="${px.toFixed(1)}" cy="${(lado * largo * 0.07).toFixed(1)}" rx="${(largo * 0.11).toFixed(1)}" ry="${(largo * 0.035).toFixed(1)}" fill="${color}" transform="rotate(${lado * 30} ${px.toFixed(1)} ${(lado * largo * 0.07).toFixed(1)})"/>`;
  }
  return out + "</g>";
}

/** Cruz latina llena. `h` = alto; el travesaño queda a un tercio. */
export function cruz(cx: number, cy: number, h: number, grosor: number, color: string): string {
  const w = h * 0.62;
  const yT = cy - h / 2 + h * 0.3;
  return `<g fill="${color}"><rect x="${cx - grosor / 2}" y="${cy - h / 2}" width="${grosor}" height="${h}" rx="${grosor * 0.15}"/><rect x="${cx - w / 2}" y="${yT - grosor / 2}" width="${w}" height="${grosor}" rx="${grosor * 0.15}"/></g>`;
}

/** Cruz de contorno (dos trazos finos), para un aire más moderno. */
export function cruzLinea(cx: number, cy: number, h: number, grosor: number, color: string, trazo = 4): string {
  const w = h * 0.62;
  const g = grosor / 2;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  const yT = top + h * 0.3;
  const d = `M ${cx - g} ${top} H ${cx + g} V ${yT - g} H ${cx + w / 2} V ${yT + g} H ${cx + g} V ${bot} H ${cx - g} V ${yT + g} H ${cx - w / 2} V ${yT - g} H ${cx - g} Z`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${trazo}" stroke-linejoin="miter"/>`;
}

/** Flor blanca de cinco pétalos con centro dorado. */
export function flor(cx: number, cy: number, r: number, petalo: string, centro: string, borde = "none", giro = 0): string {
  let out = `<g transform="rotate(${giro} ${cx} ${cy})">`;
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180 - Math.PI / 2;
    const px = cx + Math.cos(a) * r * 0.55;
    const py = cy + Math.sin(a) * r * 0.55;
    out += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(r * 0.36).toFixed(1)}" ry="${(r * 0.56).toFixed(1)}" fill="${petalo}" stroke="${borde}" stroke-width="${(r * 0.04).toFixed(1)}" transform="rotate(${i * 72} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
  }
  return out + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}" fill="${centro}"/></g>`;
}

/** Hoja alargada (para ramos). */
export function hoja(x: number, y: number, largo: number, ang: number, color: string): string {
  return `<path d="M 0 0 C ${largo * 0.3} ${-largo * 0.13} ${largo * 0.7} ${-largo * 0.13} ${largo} 0 C ${largo * 0.7} ${largo * 0.13} ${largo * 0.3} ${largo * 0.13} 0 0 Z" fill="${color}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})"/>`;
}

/** Ramito de flores blancas con hojas, abierto hacia arriba desde (x, y). */
export function ramito(x: number, y: number, s: number, petalo: string, centro: string, verde: string, semilla: number, borde = "none"): string {
  const a = azar(semilla);
  let tallos = "";
  let hojas = "";
  let flores = "";
  const pos = [[0, -0.62, 0.2], [-0.3, -0.45, 0.16], [0.3, -0.47, 0.17], [-0.12, -0.3, 0.14], [0.16, -0.27, 0.13], [-0.45, -0.22, 0.11], [0.45, -0.24, 0.11]] as const;
  for (const [dx, dy] of pos) {
    const fx = x + dx * s;
    const fy = y + dy * s;
    tallos += `<path d="M ${x} ${y} Q ${(x + dx * s * 0.3).toFixed(1)} ${(y + dy * s * 0.6).toFixed(1)} ${fx.toFixed(1)} ${fy.toFixed(1)}" stroke="${verde}" stroke-width="${(s * 0.012).toFixed(1)}" fill="none"/>`;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    hojas += hoja(x + dx * s * 0.55, y + dy * s * 0.55, s * a.entre(0.16, 0.22), ang + a.elegir([-38, 38]), verde);
  }
  for (const [dx, dy, r] of pos) flores += flor(x + dx * s, y + dy * s, r * s, petalo, centro, borde, a.entre(0, 72));
  return tallos + hojas + flores;
}

/**
 * Puntilla: borde de encaje con festones (medios círculos calados) a lo largo de una línea
 * horizontal. `abajo` = los festones cuelgan hacia abajo.
 */
export function puntilla(x0: number, x1: number, y: number, r: number, color: string, abajo = true, opacidad = 1): string {
  const s = abajo ? 1 : -1;
  const n = Math.max(1, Math.round((x1 - x0) / (2 * r)));
  const paso = (x1 - x0) / n;
  let d = `M ${x0} ${y}`;
  let calado = "";
  for (let i = 0; i < n; i++) {
    const cx = x0 + paso * (i + 0.5);
    d += ` A ${paso / 2} ${paso / 2 * 0.9} 0 0 ${abajo ? 0 : 1} ${(x0 + paso * (i + 1)).toFixed(1)} ${y}`;
    calado += `<circle cx="${cx.toFixed(1)}" cy="${(y + s * paso * 0.3).toFixed(1)}" r="${(paso * 0.12).toFixed(1)}" fill="#ffffff"/>`;
    calado += `<circle cx="${(cx - paso * 0.24).toFixed(1)}" cy="${(y + s * paso * 0.12).toFixed(1)}" r="${(paso * 0.06).toFixed(1)}" fill="#ffffff"/><circle cx="${(cx + paso * 0.24).toFixed(1)}" cy="${(y + s * paso * 0.12).toFixed(1)}" r="${(paso * 0.06).toFixed(1)}" fill="#ffffff"/>`;
  }
  d += " Z";
  let puntos = "";
  for (let i = 0; i <= n * 2; i++) {
    puntos += `<circle cx="${(x0 + (paso / 2) * i).toFixed(1)}" cy="${(y - s * paso * 0.14).toFixed(1)}" r="${(paso * 0.05).toFixed(1)}"/>`;
  }
  return `<g opacity="${opacidad}"><rect x="${x0}" y="${Math.min(y, y - s * paso * 0.22)}" width="${x1 - x0}" height="${paso * 0.22}" fill="${color}"/><path d="${d}" fill="${color}"/>${calado}<g fill="#ffffff">${puntos}</g></g>`;
}

/** Arco de medio punto (para vitrales y marcos): de (x, y) a (x+w, y+h), con medio círculo arriba. */
export function arcoPath(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  return `M ${x} ${y + h} V ${y + r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h} Z`;
}

/** Arco ojival (gótico): dos arcos que se cruzan en punta. */
export function ojivaPath(x: number, y: number, w: number, h: number): string {
  const r = w * 0.85;
  const ys = y + w * 0.6;
  return `M ${x} ${y + h} V ${ys} A ${r} ${r} 0 0 1 ${x + w / 2} ${y} A ${r} ${r} 0 0 1 ${x + w} ${ys} V ${y + h} Z`;
}

/**
 * Vitral: un arco recortado en vidrios de colores (triángulos de una grilla movida al azar) con
 * plomo entre los vidrios. `id` tiene que ser único en el SVG.
 */
export function vitral(id: string, forma: string, caja: { x: number; y: number; w: number; h: number }, colores: readonly string[], plomo: string, semilla: number, paso = 150): { defs: string; out: string } {
  const a = azar(semilla);
  const cols = Math.ceil(caja.w / paso) + 1;
  const filas = Math.ceil(caja.h / paso) + 1;
  const pts: Array<Array<[number, number]>> = [];
  for (let j = 0; j <= filas; j++) {
    const fila: Array<[number, number]> = [];
    for (let i = 0; i <= cols; i++) {
      const borde = i === 0 || j === 0 || i === cols || j === filas;
      const jx = borde ? 0 : a.entre(-0.32, 0.32) * paso;
      const jy = borde ? 0 : a.entre(-0.32, 0.32) * paso;
      fila.push([caja.x + i * paso + jx - paso / 2, caja.y + j * paso + jy - paso / 2]);
    }
    pts.push(fila);
  }
  let vidrios = "";
  const tri = (p: Array<[number, number]>) => {
    vidrios += `<polygon points="${p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${a.elegir(colores)}"/>`;
  };
  for (let j = 0; j < filas; j++) {
    for (let i = 0; i < cols; i++) {
      const p00 = pts[j]![i]!;
      const p10 = pts[j]![i + 1]!;
      const p01 = pts[j + 1]![i]!;
      const p11 = pts[j + 1]![i + 1]!;
      if ((i + j) % 2 === 0) {
        tri([p00, p10, p11]);
        tri([p00, p11, p01]);
      } else {
        tri([p00, p10, p01]);
        tri([p10, p11, p01]);
      }
    }
  }
  const defs = `<clipPath id="${id}"><path d="${forma}"/></clipPath>`;
  const out = `<g clip-path="url(#${id})"><g stroke="${plomo}" stroke-width="${(paso * 0.07).toFixed(1)}" stroke-linejoin="round">${vidrios}</g></g>
    <path d="${forma}" fill="none" stroke="${plomo}" stroke-width="${(paso * 0.16).toFixed(1)}"/>`;
  return { defs, out };
}

/** Llamita (lengua de fuego de Pentecostés). */
export function llama(cx: number, cy: number, h: number, color: string, interior: string): string {
  const w = h * 0.5;
  const p = (dx: number, dy: number) => `${(cx + dx * w).toFixed(1)} ${(cy + dy * h).toFixed(1)}`;
  return `<path d="M ${p(0, 0.5)} C ${p(-0.62, 0.48)} ${p(-0.7, 0.05)} ${p(-0.28, -0.2)} C ${p(-0.12, -0.3)} ${p(-0.08, -0.4)} ${p(0.05, -0.5)} C ${p(0.08, -0.32)} ${p(0.62, -0.1)} ${p(0.58, 0.18)} C ${p(0.55, 0.42)} ${p(0.3, 0.5)} ${p(0, 0.5)} Z" fill="${color}"/>
    <path d="M ${p(0, 0.48)} C ${p(-0.3, 0.46)} ${p(-0.32, 0.18)} ${p(-0.08, 0.02)} C ${p(0, 0.12)} ${p(0.28, 0.2)} ${p(0.26, 0.34)} C ${p(0.22, 0.45)} ${p(0.12, 0.48)} ${p(0, 0.48)} Z" fill="${interior}"/>`;
}

/** Gota de agua. */
export function gota(cx: number, cy: number, h: number, color: string, opacidad = 1): string {
  const w = h * 0.36;
  return `<path d="M ${cx} ${cy - h / 2} C ${cx + w * 0.3} ${cy - h * 0.15} ${cx + w} ${cy + h * 0.05} ${cx + w} ${cy + h * 0.2} A ${w} ${w} 0 0 1 ${cx - w} ${cy + h * 0.2} C ${cx - w} ${cy + h * 0.05} ${cx - w * 0.3} ${cy - h * 0.15} ${cx} ${cy - h / 2} Z" fill="${color}" opacity="${opacidad}"/>`;
}

/** Concha de vieira (símbolo del bautismo): abanico de costillas. */
export function concha(cx: number, cy: number, s: number, color: string, linea: string): string {
  const r = s / 2;
  let costillas = "";
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    costillas += `<path d="M ${cx} ${cy + r * 0.55} L ${(cx + Math.cos(a) * r * 0.95).toFixed(1)} ${(cy + Math.sin(a) * r * 0.95 + r * 0.2).toFixed(1)}" stroke="${linea}" stroke-width="${(s * 0.012).toFixed(1)}"/>`;
  }
  let festones = `M ${cx - r} ${cy + r * 0.2}`;
  for (let i = 0; i < 8; i++) {
    const a1 = Math.PI + ((i + 1) / 8) * Math.PI;
    festones += ` A ${r * 0.2} ${r * 0.2} 0 0 1 ${(cx + Math.cos(a1) * r).toFixed(1)} ${(cy + Math.sin(a1) * r + r * 0.2).toFixed(1)}`;
  }
  festones += ` L ${cx + r * 0.22} ${cy + r * 0.62} L ${cx - r * 0.22} ${cy + r * 0.62} Z`;
  return `<path d="${festones}" fill="${color}" stroke="${linea}" stroke-width="${(s * 0.014).toFixed(1)}"/>${costillas}
    <path d="M ${cx - r * 0.34} ${cy + r * 0.62} h ${r * 0.68} l ${-r * 0.1} ${r * 0.16} h ${-r * 0.48} Z" fill="${color}" stroke="${linea}" stroke-width="${(s * 0.012).toFixed(1)}"/>`;
}

/** Filete con un rombito al medio. */
export function filete(cx: number, y: number, ancho: number, color: string, grosor = 3): string {
  return `<line x1="${cx - ancho / 2}" y1="${y}" x2="${cx - 22}" y2="${y}" stroke="${color}" stroke-width="${grosor}"/><line x1="${cx + 22}" y1="${y}" x2="${cx + ancho / 2}" y2="${y}" stroke="${color}" stroke-width="${grosor}"/><rect x="${cx - 10}" y="${y - 10}" width="20" height="20" fill="${color}" transform="rotate(45 ${cx} ${y})"/>`;
}

/**
 * Manchas de acuarela suaves: cada una es un racimo de círculos deformados por el filtro, con
 * relleno translúcido y el borde apenas más marcado.
 */
export function acuarelas(
  prefijo: string,
  semilla: number,
  manchas: Array<{ x: number; y: number; r: number; color: string; opacidad?: number }>,
): { defs: string; out: string } {
  const a = azar(semilla);
  let defs = "";
  let out = "";
  manchas.forEach((m, i) => {
    const id = `${prefijo}${i}`;
    defs += `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">
      <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="${semilla + i * 7}" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="${(m.r * 0.5).toFixed(0)}" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="${(m.r * 0.02).toFixed(1)}"/>
    </filter>`;
    const op = m.opacidad ?? 0.45;
    let circulos = `<circle cx="${m.x}" cy="${m.y}" r="${m.r}"/>`;
    for (let k = 0; k < 3; k++) {
      circulos += `<circle cx="${(m.x + m.r * a.entre(-0.6, 0.6)).toFixed(1)}" cy="${(m.y + m.r * a.entre(-0.5, 0.5)).toFixed(1)}" r="${(m.r * a.entre(0.45, 0.75)).toFixed(1)}"/>`;
    }
    out += `<g filter="url(#${id})" fill="${m.color}" fill-opacity="${op}" stroke="${m.color}" stroke-opacity="${Math.min(1, op + 0.2)}" stroke-width="${(m.r * 0.02).toFixed(1)}">${circulos}</g>`;
  });
  return { defs, out };
}

/** Fallback de la fecha cuando el álbum no la tiene. */
export const FECHA_FALLBACK = "Fecha de la celebración";
