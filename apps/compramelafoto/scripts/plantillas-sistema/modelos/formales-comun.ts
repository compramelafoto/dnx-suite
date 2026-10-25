/**
 * Texturas y adornos de los libritos formales (modelos 11 a 20): lino, cuero, mármol, papel
 * verjurado, relieve, filetes, esquinas, guardas, laureles y sellos.
 *
 * Todo es SVG determinístico (las semillas son fijas). Cada función devuelve un trozo de SVG; las
 * que necesitan un filtro reciben el id y piden su `defs` aparte.
 */
import { ALTO, ANCHO, PLIEGUE } from "../lienzo";
import { azar } from "../texturas";

/** Mitad de la hoja: 0 = izquierda (contratapa o interior izquierdo), 1 = derecha. */
export const x0De = (mitad: 0 | 1) => (mitad === 0 ? 0 : PLIEGUE);
export const MITAD = PLIEGUE;

// ── Texturas ──────────────────────────────────────────────────────────────────────────────────

/** Lino: hilos horizontales y verticales (ruido estirado), para mezclar sobre un color liso. */
export function defsLino(id: string, semilla = 7): string {
  return `<filter id="${id}H" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.75" numOctaves="2" seed="${semilla}"/>
      <feColorMatrix type="saturate" values="0"/></filter>
    <filter id="${id}V" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="0.75 0.012" numOctaves="2" seed="${semilla + 1}"/>
      <feColorMatrix type="saturate" values="0"/></filter>`;
}
export function lino(id: string, opacidad: number, modo: "multiply" | "overlay" | "screen" = "multiply"): string {
  return `<rect width="${ANCHO}" height="${ALTO}" filter="url(#${id}H)" opacity="${opacidad}" style="mix-blend-mode:${modo}"/>
    <rect width="${ANCHO}" height="${ALTO}" filter="url(#${id}V)" opacity="${opacidad}" style="mix-blend-mode:${modo}"/>`;
}

/** Cuero: grano con luz rasante (relieve), en gris para multiplicar sobre el color. */
export function defsCuero(id: string, semilla = 11): string {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="${semilla}" result="t"/>
    <feDiffuseLighting in="t" surfaceScale="3.2" lighting-color="#ffffff" result="l">
      <feDistantLight azimuth="235" elevation="52"/>
    </feDiffuseLighting>
    <feColorMatrix in="l" type="saturate" values="0"/>
  </filter>`;
}
export function cuero(id: string, opacidad: number): string {
  return `<rect width="${ANCHO}" height="${ALTO}" filter="url(#${id})" opacity="${opacidad}" style="mix-blend-mode:multiply"/>`;
}

/** Mármol: vetas finas y onduladas (bandas angostas de un ruido de baja frecuencia). */
export function defsMarmol(id: string, color: string, semilla = 21): string {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.0042" numOctaves="5" seed="${semilla}" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.2 0 0 0 -0.1" result="a"/>
    <feComponentTransfer in="a" result="v">
      <feFuncA type="table" tableValues="0 0 0 0 0.05 0.75 0.05 0 0 0 0"/>
    </feComponentTransfer>
    <feFlood flood-color="${color}" result="c"/>
    <feComposite in="c" in2="v" operator="in" result="vetas"/>
    <feGaussianBlur in="vetas" stdDeviation="1.6"/>
  </filter>`;
}
export function marmol(id: string, opacidad: number): string {
  return `<rect width="${ANCHO}" height="${ALTO}" filter="url(#${id})" opacity="${opacidad}"/>`;
}

/** Papel verjurado: líneas de corondel (verticales, separadas) y puntizones (horizontales, finas). */
export function verjurado(color: string, opacidadCorondel = 0.07, opacidadPuntizon = 0.035): string {
  let out = `<g stroke="${color}" fill="none">`;
  for (let x = 140; x < ANCHO; x += 290) out += `<line x1="${x}" y1="0" x2="${x}" y2="${ALTO}" stroke-width="5" opacity="${opacidadCorondel}"/>`;
  for (let y = 0; y < ALTO; y += 13) out += `<line x1="0" y1="${y}" x2="${ANCHO}" y2="${y}" stroke-width="2.4" opacity="${opacidadPuntizon}"/>`;
  return out + "</g>";
}

/**
 * Relieve en seco (gofrado): un dibujo repetido que no tiene color, sólo luz y sombra. `forma` es
 * el SVG de una celda de `paso` × `paso` dibujada en blanco.
 */
export function defsRelieve(id: string, forma: string, paso: number): string {
  return `<pattern id="${id}P" width="${paso}" height="${paso}" patternUnits="userSpaceOnUse">${forma}</pattern>
    <filter id="${id}" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>
      <feDiffuseLighting in="b" surfaceScale="4" lighting-color="#ffffff" result="l">
        <feDistantLight azimuth="225" elevation="48"/>
      </feDiffuseLighting>
      <feColorMatrix in="l" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.2 0 0 0 1.05" result="sombra"/>
      <feComposite in="sombra" in2="SourceAlpha" operator="over"/>
    </filter>`;
}
export function relieve(id: string, opacidad: number, zona = { x: 0, y: 0, w: ANCHO, h: ALTO }): string {
  return `<g filter="url(#${id})" opacity="${opacidad}"><rect x="${zona.x}" y="${zona.y}" width="${zona.w}" height="${zona.h}" fill="url(#${id}P)"/></g>`;
}

/** Viñeta: oscurece apenas los bordes de cada mitad, como una tapa encuadernada. */
export function defsVineta(id: string, color = "#000000"): string {
  return `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.75">
    <stop offset="0.55" stop-color="${color}" stop-opacity="0"/>
    <stop offset="1" stop-color="${color}" stop-opacity="0.38"/>
  </radialGradient>`;
}
export function vineta(id: string, mitad: 0 | 1, opacidad = 1): string {
  return `<rect x="${x0De(mitad)}" y="0" width="${MITAD}" height="${ALTO}" fill="url(#${id})" opacity="${opacidad}"/>`;
}

// ── Marcos y filetes ──────────────────────────────────────────────────────────────────────────

/** Rectángulo de una mitad con margen `m` (en px) desde el corte y desde el pliegue. */
export function cajaDeMitad(mitad: 0 | 1, m: number) {
  return { x: x0De(mitad) + m, y: m, w: MITAD - 2 * m, h: ALTO - 2 * m };
}

export function rect(r: { x: number; y: number; w: number; h: number }, color: string, grosor: number, extra = ""): string {
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${color}" stroke-width="${grosor}" ${extra}/>`;
}

/** Filete doble: uno grueso afuera y uno fino adentro. */
export function fileteDoble(mitad: 0 | 1, m: number, color: string, gruesoExt = 8, fino = 3, sep = 24, colorInt = color): string {
  const a = cajaDeMitad(mitad, m);
  const b = cajaDeMitad(mitad, m + sep);
  return rect(a, color, gruesoExt) + rect(b, colorInt, fino);
}

/** Esquinas «art déco»: escalones en L con un rombo. `sx`/`sy` dan la orientación. */
export function esquinaDeco(x: number, y: number, sx: 1 | -1, sy: 1 | -1, color: string, t = 1): string {
  const p = (dx: number, dy: number) => `${(x + sx * dx * t).toFixed(1)},${(y + sy * dy * t).toFixed(1)}`;
  return `<g fill="none" stroke="${color}" stroke-width="${4 * t}" stroke-linejoin="miter">
    <polyline points="${p(0, 150)} ${p(0, 0)} ${p(150, 0)}"/>
    <polyline points="${p(22, 110)} ${p(22, 22)} ${p(110, 22)}"/>
    <polyline points="${p(44, 70)} ${p(44, 44)} ${p(70, 44)}"/>
  </g><polygon points="${p(66, 54)} ${p(78, 66)} ${p(66, 78)} ${p(54, 66)}" fill="${color}"/>`;
}

/** Las cuatro esquinas de una caja con el adorno dado. */
export function cuatroEsquinas(
  r: { x: number; y: number; w: number; h: number },
  adorno: (x: number, y: number, sx: 1 | -1, sy: 1 | -1) => string,
): string {
  return (
    adorno(r.x, r.y, 1, 1) + adorno(r.x + r.w, r.y, -1, 1) + adorno(r.x, r.y + r.h, 1, -1) + adorno(r.x + r.w, r.y + r.h, -1, -1)
  );
}

/** Esquina de hojas: una ramita curva con hojas, para marcos clásicos. */
export function esquinaHojas(x: number, y: number, sx: 1 | -1, sy: 1 | -1, color: string): string {
  const P = (dx: number, dy: number) => [x + sx * dx, y + sy * dy] as const;
  let hojas = "";
  const puntos: Array<[number, number, number]> = [
    [30, 150, 80], [60, 95, 60], [95, 60, 30], [150, 30, 10],
  ];
  for (const [dx, dy, ang] of puntos) {
    const [hx, hy] = P(dx, dy);
    const giro = sx * sy * ang;
    hojas += `<ellipse cx="${hx}" cy="${hy}" rx="34" ry="11" fill="${color}" transform="rotate(${giro} ${hx} ${hy})"/>`;
  }
  const [a, b] = P(10, 210);
  const [c, d] = P(10, 10);
  const [e, f] = P(210, 10);
  return `<path d="M ${a} ${b} Q ${c} ${d} ${e} ${f}" stroke="${color}" stroke-width="4" fill="none"/>${hojas}<circle cx="${P(18, 18)[0]}" cy="${P(18, 18)[1]}" r="9" fill="${color}"/>`;
}

/** Separador: línea — rombo — línea, centrado en `cx`. */
export function separador(cx: number, y: number, ancho: number, color: string, grosor = 3, rombo = 14): string {
  const g = rombo * 1.6;
  return `<line x1="${cx - ancho / 2}" y1="${y}" x2="${cx - g}" y2="${y}" stroke="${color}" stroke-width="${grosor}"/>
    <line x1="${cx + g}" y1="${y}" x2="${cx + ancho / 2}" y2="${y}" stroke="${color}" stroke-width="${grosor}"/>
    <polygon points="${cx},${y - rombo} ${cx + rombo},${y} ${cx},${y + rombo} ${cx - rombo},${y}" fill="${color}"/>`;
}

/** Guarda griega (meandro) en una franja horizontal de alto `h` entre x0 y x1. */
export function guardaGriega(x0: number, x1: number, y: number, h: number, color: string, grosor = 5): string {
  const u = h / 4;
  let d = "";
  for (let x = x0; x + 4 * u <= x1; x += 4 * u) {
    d += `M ${x} ${y + h} L ${x} ${y} L ${x + 3 * u} ${y} L ${x + 3 * u} ${y + 3 * u} L ${x + u} ${y + 3 * u} L ${x + u} ${y + u} L ${x + 2 * u} ${y + u} L ${x + 2 * u} ${y + 2 * u} `;
    d += `M ${x} ${y + h} L ${x + 4 * u} ${y + h} `;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${grosor}" fill="none" stroke-linecap="square"/>`;
}

/** Orla de rombos encadenados entre dos filetes (para bandas heráldicas). */
export function orlaRombos(x0: number, x1: number, y: number, h: number, color: string, fondo: string): string {
  let out = `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" fill="${fondo}"/>`;
  out += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${color}" stroke-width="4"/><line x1="${x0}" y1="${y + h}" x2="${x1}" y2="${y + h}" stroke="${color}" stroke-width="4"/>`;
  const paso = h * 1.2;
  for (let x = x0 + paso / 2; x < x1 - paso / 4; x += paso) {
    const cy = y + h / 2;
    const r = h * 0.36;
    out += `<polygon points="${x},${cy - r} ${x + r},${cy} ${x},${cy + r} ${x - r},${cy}" fill="none" stroke="${color}" stroke-width="3.5"/><circle cx="${x}" cy="${cy}" r="${h * 0.08}" fill="${color}"/>`;
    if (x + paso / 2 < x1 - paso / 4) out += `<circle cx="${x + paso / 2}" cy="${cy}" r="${h * 0.06}" fill="${color}"/>`;
  }
  return out;
}

/** Lo mismo pero vertical. */
export function orlaRombosVertical(x: number, y0: number, y1: number, w: number, color: string, fondo: string): string {
  let out = `<rect x="${x}" y="${y0}" width="${w}" height="${y1 - y0}" fill="${fondo}"/>`;
  out += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${color}" stroke-width="4"/><line x1="${x + w}" y1="${y0}" x2="${x + w}" y2="${y1}" stroke="${color}" stroke-width="4"/>`;
  const paso = w * 1.2;
  for (let y = y0 + paso / 2; y < y1 - paso / 4; y += paso) {
    const cx = x + w / 2;
    const r = w * 0.36;
    out += `<polygon points="${cx},${y - r} ${cx + r},${y} ${cx},${y + r} ${cx - r},${y}" fill="none" stroke="${color}" stroke-width="3.5"/><circle cx="${cx}" cy="${y}" r="${w * 0.08}" fill="${color}"/>`;
    if (y + paso / 2 < y1 - paso / 4) out += `<circle cx="${cx}" cy="${y + paso / 2}" r="${w * 0.06}" fill="${color}"/>`;
  }
  return out;
}

/** Rama de laurel siguiendo un arco alrededor de (cx, cy); `lado` 1 = derecha, -1 = izquierda. */
export function ramaLaurel(cx: number, cy: number, r: number, lado: 1 | -1, color: string, hojas = 10, largo = 1.25, tam = 1): string {
  let out = "";
  for (let i = 0; i < hojas; i++) {
    const ang = Math.PI / 2 + lado * (0.25 + (i * largo) / hojas);
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;
    const giro = (ang * 180) / Math.PI + (lado > 0 ? -60 : 60);
    out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(44 * tam).toFixed(1)}" ry="${(15 * tam).toFixed(1)}" fill="${color}" transform="rotate(${giro.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    const xi = cx + Math.cos(ang) * (r - 34 * tam);
    const yi = cy + Math.sin(ang) * (r - 34 * tam);
    out += `<ellipse cx="${xi.toFixed(1)}" cy="${yi.toFixed(1)}" rx="${(34 * tam).toFixed(1)}" ry="${(12 * tam).toFixed(1)}" fill="${color}" opacity="0.85" transform="rotate(${(giro + lado * 70).toFixed(1)} ${xi.toFixed(1)} ${yi.toFixed(1)})"/>`;
  }
  const a0 = Math.PI / 2 + lado * 0.18;
  const a1 = Math.PI / 2 + lado * (0.25 + largo);
  return `<path d="M ${(cx + Math.cos(a0) * r).toFixed(1)} ${(cy + Math.sin(a0) * r).toFixed(1)} A ${r} ${r} 0 0 ${lado > 0 ? 1 : 0} ${(cx + Math.cos(a1) * r).toFixed(1)} ${(cy + Math.sin(a1) * r).toFixed(1)}" stroke="${color}" stroke-width="${5 * tam}" fill="none"/>${out}`;
}

/** Corona de laurel completa (dos ramas atadas abajo). */
export function corona(cx: number, cy: number, r: number, color: string, tam = 1): string {
  return `${ramaLaurel(cx, cy, r, 1, color, 11, 2.35, tam)}${ramaLaurel(cx, cy, r, -1, color, 11, 2.35, tam)}
    <path d="M ${cx - 30} ${cy + r + 10} q 30 -26 60 0 M ${cx - 10} ${cy + r} l -40 60 M ${cx + 10} ${cy + r} l 40 60" stroke="${color}" stroke-width="${6 * tam}" fill="none" stroke-linecap="round"/>`;
}

/** Birrete de egresado, centrado en (cx, cy), de ancho `w`. */
export function birrete(cx: number, cy: number, w: number, color: string, borla: string): string {
  const h = w * 0.28;
  return `<polygon points="${cx - w / 2},${cy} ${cx},${cy - h} ${cx + w / 2},${cy} ${cx},${cy + h}" fill="${color}"/>
    <path d="M ${cx - w * 0.3} ${cy + h * 0.55} L ${cx - w * 0.3} ${cy + h * 1.35} Q ${cx} ${cy + h * 1.85} ${cx + w * 0.3} ${cy + h * 1.35} L ${cx + w * 0.3} ${cy + h * 0.55} L ${cx} ${cy + h} Z" fill="${color}"/>
    <circle cx="${cx}" cy="${cy}" r="${w * 0.03}" fill="${borla}"/>
    <path d="M ${cx} ${cy} L ${cx + w * 0.38} ${cy + h * 0.25} L ${cx + w * 0.38} ${cy + h * 1.5}" stroke="${borla}" stroke-width="${w * 0.018}" fill="none"/>
    <path d="M ${cx + w * 0.34} ${cy + h * 1.5} l ${w * 0.08} 0 l ${w * 0.02} ${h * 0.7} l ${-w * 0.12} 0 Z" fill="${borla}"/>`;
}

/** Sello de lacre: círculo de borde irregular con un anillo y una estrella en relieve. */
export function selloLacre(cx: number, cy: number, r: number, color: string, semilla = 5): string {
  const a = azar(semilla);
  const pts: string[] = [];
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * Math.PI * 2;
    const rr = r * (1 + a.entre(-0.06, 0.07));
    pts.push(`${(cx + Math.cos(ang) * rr).toFixed(1)},${(cy + Math.sin(ang) * rr).toFixed(1)}`);
  }
  let estrella = "";
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r * 0.38 : r * 0.16;
    const ang = (-90 + i * 36) * (Math.PI / 180);
    estrella += `${(cx + Math.cos(ang) * rr).toFixed(1)},${(cy + Math.sin(ang) * rr).toFixed(1)} `;
  }
  return `<polygon points="${pts.join(" ")}" fill="${color}"/>
    <circle cx="${cx + 4}" cy="${cy + 5}" r="${r * 0.72}" fill="none" stroke="#000000" stroke-opacity="0.28" stroke-width="${r * 0.06}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="${r * 0.05}"/>
    <polygon points="${estrella}" fill="#000000" fill-opacity="0.22" transform="translate(4 5)"/>
    <polygon points="${estrella}" fill="#ffffff" fill-opacity="0.18"/>`;
}

/** Escudo genérico (heráldico, sin marcas): contorno, partición y una banda. */
export function escudoGenerico(cx: number, cy: number, w: number, color: string, relleno: string): string {
  const h = w * 1.2;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const contorno = `M ${x0} ${y0} L ${x0 + w} ${y0} L ${x0 + w} ${y0 + h * 0.5} C ${x0 + w} ${y0 + h * 0.78} ${cx + w * 0.18} ${y0 + h * 0.92} ${cx} ${y0 + h} C ${cx - w * 0.18} ${y0 + h * 0.92} ${x0} ${y0 + h * 0.78} ${x0} ${y0 + h * 0.5} Z`;
  return `<path d="${contorno}" fill="${relleno}" stroke="${color}" stroke-width="${w * 0.035}"/>
    <path d="${contorno}" fill="none" stroke="${color}" stroke-width="${w * 0.01}" transform="translate(${cx} ${cy}) scale(0.86) translate(${-cx} ${-cy})"/>
    <path d="M ${x0 + w * 0.08} ${y0 + h * 0.08} L ${x0 + w * 0.92} ${y0 + h * 0.72}" stroke="${color}" stroke-width="${w * 0.11}" opacity="0.9"/>
    <circle cx="${cx - w * 0.22}" cy="${y0 + h * 0.6}" r="${w * 0.07}" fill="${color}"/>
    <circle cx="${cx + w * 0.22}" cy="${y0 + h * 0.22}" r="${w * 0.07}" fill="${color}"/>`;
}

/** Cartela: rectángulo con las esquinas cortadas en chaflán. */
export function cartela(r: { x: number; y: number; w: number; h: number }, corte: number, relleno: string, borde: string, grosor: number): string {
  const { x, y, w, h } = r;
  const c = corte;
  return `<polygon points="${x + c},${y} ${x + w - c},${y} ${x + w},${y + c} ${x + w},${y + h - c} ${x + w - c},${y + h} ${x + c},${y + h} ${x},${y + h - c} ${x},${y + c}" fill="${relleno}" stroke="${borde}" stroke-width="${grosor}"/>`;
}

/** Líneas de guilloche: ondas finas superpuestas en una franja (bordes de diploma). */
export function guilloche(x0: number, x1: number, yc: number, alto: number, color: string, lineas = 5, ciclos = 26): string {
  let out = `<g fill="none" stroke="${color}" stroke-width="2.4">`;
  for (let k = 0; k < lineas; k++) {
    const fase = (k / lineas) * Math.PI * 2;
    let d = "";
    const pasos = 600;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const x = x0 + t * (x1 - x0);
      const y = yc + Math.sin(t * ciclos * Math.PI * 2 + fase) * (alto / 2) * (0.75 + 0.25 * Math.cos(t * 7 * Math.PI + fase));
      d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    out += `<path d="${d}"/>`;
  }
  return out + "</g>";
}

/** Lo mismo en vertical. */
export function guillocheVertical(xc: number, y0: number, y1: number, ancho: number, color: string, lineas = 5, ciclos = 34): string {
  let out = `<g fill="none" stroke="${color}" stroke-width="2.4">`;
  for (let k = 0; k < lineas; k++) {
    const fase = (k / lineas) * Math.PI * 2;
    let d = "";
    const pasos = 700;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const y = y0 + t * (y1 - y0);
      const x = xc + Math.sin(t * ciclos * Math.PI * 2 + fase) * (ancho / 2) * (0.75 + 0.25 * Math.cos(t * 7 * Math.PI + fase));
      d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    out += `<path d="${d}"/>`;
  }
  return out + "</g>";
}

/** Marco de guilloche alrededor de una caja (cuatro franjas). */
export function marcoGuilloche(r: { x: number; y: number; w: number; h: number }, ancho: number, color: string): string {
  return (
    guilloche(r.x, r.x + r.w, r.y, ancho, color, 4, Math.round(r.w / 60)) +
    guilloche(r.x, r.x + r.w, r.y + r.h, ancho, color, 4, Math.round(r.w / 60)) +
    guillocheVertical(r.x, r.y, r.y + r.h, ancho, color, 4, Math.round(r.h / 60)) +
    guillocheVertical(r.x + r.w, r.y, r.y + r.h, ancho, color, 4, Math.round(r.h / 60))
  );
}

/** Rayado diagonal fino (para grafito). */
export function rayado(color: string, paso: number, grosor: number, opacidad: number): string {
  let out = `<g stroke="${color}" stroke-width="${grosor}" opacity="${opacidad}">`;
  for (let k = -ALTO; k < ANCHO; k += paso) out += `<line x1="${k}" y1="${ALTO}" x2="${k + ALTO}" y2="0"/>`;
  return out + "</g>";
}
