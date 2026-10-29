/**
 * Adornos en SVG para los fondos de los productos: laureles, medallas, birretes, globos, lápices,
 * planetas, flores, filigranas. Todo determinístico. Las medidas van en píxeles de la hoja.
 */
import { azar, estrella } from "../texturas";

const f = (n: number) => n.toFixed(1);

/** Una rama de laurel en arco, de abajo hacia el costado. `lado` 1 = derecha, -1 = izquierda. */
export function ramaDeLaurel(cx: number, cy: number, radio: number, color: string, lado: 1 | -1, hojas = 9): string {
  const punto = (t: number) => {
    const ang = ((-80 + 150 * t) * Math.PI) / 180;
    return {
      x: cx + lado * Math.cos(ang) * radio,
      y: cy - Math.sin(ang) * radio,
      // Hacia dónde avanza el tallo.
      giro: (Math.atan2(-Math.cos(ang), -lado * Math.sin(ang)) * 180) / Math.PI,
    };
  };
  const tallo = Array.from({ length: 41 }, (_, i) => punto(i / 40));
  let out = `<path d="M ${tallo.map((p) => `${f(p.x)} ${f(p.y)}`).join(" L ")}" fill="none" stroke="${color}" stroke-width="${f(radio * 0.022)}" stroke-linecap="round"/>`;
  for (let i = 0; i < hojas; i++) {
    const t = (i + 0.6) / hojas;
    const p = punto(t);
    const largo = radio * (0.19 - t * 0.07);
    for (const s of [1, -1]) {
      const g = p.giro + s * 40;
      out += `<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="${f(largo)}" ry="${f(largo * 0.34)}" fill="${color}" transform="rotate(${f(g)} ${f(p.x)} ${f(p.y)}) translate(${f(largo * 0.9)} 0)"/>`;
    }
  }
  // La punta de la rama.
  const fin = punto(1);
  out += `<ellipse cx="${f(fin.x)}" cy="${f(fin.y)}" rx="${f(radio * 0.1)}" ry="${f(radio * 0.035)}" fill="${color}" transform="rotate(${f(fin.giro)} ${f(fin.x)} ${f(fin.y)}) translate(${f(radio * 0.06)} 0)"/>`;
  return out;
}

/** Corona de laureles abierta arriba, alrededor de (cx, cy). */
export function laureles(cx: number, cy: number, radio: number, color: string): string {
  return ramaDeLaurel(cx, cy, radio, color, 1) + ramaDeLaurel(cx, cy, radio, color, -1);
}

/** Medalla con escarapela y cintas. */
export function medalla(cx: number, cy: number, r: number, oro: string, cinta: string, cinta2 = cinta): string {
  let picos = "";
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI * 2) / 24;
    picos += `<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(r * 0.16)}" fill="${oro}"/>`;
  }
  return `<g>
    <path d="M ${f(cx - r * 0.55)} ${f(cy + r * 0.5)} L ${f(cx - r * 0.95)} ${f(cy + r * 2.1)} L ${f(cx - r * 0.5)} ${f(cy + r * 1.8)} L ${f(cx - r * 0.2)} ${f(cy + r * 2.2)} L ${f(cx)} ${f(cy + r * 0.6)} Z" fill="${cinta}"/>
    <path d="M ${f(cx + r * 0.55)} ${f(cy + r * 0.5)} L ${f(cx + r * 0.95)} ${f(cy + r * 2.1)} L ${f(cx + r * 0.5)} ${f(cy + r * 1.8)} L ${f(cx + r * 0.2)} ${f(cy + r * 2.2)} L ${f(cx)} ${f(cy + r * 0.6)} Z" fill="${cinta2}"/>
    ${picos}<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${oro}"/>
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.78)}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${f(r * 0.05)}"/>
    <polygon points="${estrella(cx, cy, r * 0.5)}" fill="#ffffff" fill-opacity="0.75"/>
  </g>`;
}

/** Sello de lacre con cintas. */
export function sello(cx: number, cy: number, r: number, lacre: string, brillo: string): string {
  let ondas = "";
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18;
    ondas += `<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(r * 0.22)}" fill="${lacre}"/>`;
  }
  return `<g>${ondas}<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${lacre}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.72)}" fill="none" stroke="${brillo}" stroke-width="${f(r * 0.06)}"/>
    <polygon points="${estrella(cx, cy, r * 0.42)}" fill="${brillo}" opacity="0.8"/></g>`;
}

/** Birrete de egresado visto de frente, con borla. */
export function birrete(cx: number, cy: number, s: number, color: string, borla: string, giro = 0): string {
  return `<g transform="rotate(${f(giro)} ${f(cx)} ${f(cy)})">
    <path d="M ${f(cx - s * 0.55)} ${f(cy + s * 0.05)} L ${f(cx - s * 0.55)} ${f(cy + s * 0.42)} Q ${f(cx)} ${f(cy + s * 0.65)} ${f(cx + s * 0.55)} ${f(cy + s * 0.42)} L ${f(cx + s * 0.55)} ${f(cy + s * 0.05)} Z" fill="${color}"/>
    <polygon points="${f(cx - s)},${f(cy)} ${f(cx)},${f(cy - s * 0.42)} ${f(cx + s)},${f(cy)} ${f(cx)},${f(cy + s * 0.42)}" fill="${color}"/>
    <polygon points="${f(cx - s)},${f(cy)} ${f(cx)},${f(cy - s * 0.42)} ${f(cx + s)},${f(cy)} ${f(cx)},${f(cy + s * 0.42)}" fill="#ffffff" opacity="0.08"/>
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.06)}" fill="${borla}"/>
    <path d="M ${f(cx)} ${f(cy)} Q ${f(cx + s * 0.55)} ${f(cy + s * 0.05)} ${f(cx + s * 0.7)} ${f(cy + s * 0.55)}" fill="none" stroke="${borla}" stroke-width="${f(s * 0.035)}"/>
    <path d="M ${f(cx + s * 0.62)} ${f(cy + s * 0.5)} L ${f(cx + s * 0.78)} ${f(cy + s * 0.5)} L ${f(cx + s * 0.82)} ${f(cy + s * 0.85)} L ${f(cx + s * 0.58)} ${f(cy + s * 0.85)} Z" fill="${borla}"/>
  </g>`;
}

/** Globo con su hilo. */
export function globo(cx: number, cy: number, s: number, color: string): string {
  return `<g>
    <path d="M ${f(cx)} ${f(cy + s * 1.18)} q ${f(s * 0.25)} ${f(s * 0.5)} ${f(-s * 0.05)} ${f(s * 1)} t ${f(s * 0.1)} ${f(s * 1)}" fill="none" stroke="#9aa3ad" stroke-width="${f(s * 0.03)}"/>
    <ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(s * 0.85)}" ry="${f(s * 1.05)}" fill="${color}"/>
    <polygon points="${f(cx - s * 0.12)},${f(cy + s * 1.2)} ${f(cx + s * 0.12)},${f(cy + s * 1.2)} ${f(cx)},${f(cy + s * 1.02)}" fill="${color}"/>
    <ellipse cx="${f(cx - s * 0.32)}" cy="${f(cy - s * 0.42)}" rx="${f(s * 0.16)}" ry="${f(s * 0.3)}" fill="#ffffff" opacity="0.45" transform="rotate(-25 ${f(cx - s * 0.32)} ${f(cy - s * 0.42)})"/>
  </g>`;
}

/** Lápiz de color acostado (o girado `giro` grados) que empieza en (x, y). */
export function lapiz(x: number, y: number, largo: number, ancho: number, color: string, giro = 0): string {
  const punta = ancho * 1.4;
  const cuerpo = largo - punta;
  return `<g transform="rotate(${f(giro)} ${f(x)} ${f(y)})">
    <rect x="${f(x)}" y="${f(y - ancho / 2)}" width="${f(cuerpo)}" height="${f(ancho)}" fill="${color}"/>
    <rect x="${f(x)}" y="${f(y - ancho / 2)}" width="${f(cuerpo)}" height="${f(ancho * 0.28)}" fill="#ffffff" opacity="0.25"/>
    <rect x="${f(x - ancho * 0.5)}" y="${f(y - ancho / 2)}" width="${f(ancho * 0.5)}" height="${f(ancho)}" fill="#f2b5c0"/>
    <rect x="${f(x - ancho * 0.05)}" y="${f(y - ancho / 2)}" width="${f(ancho * 0.3)}" height="${f(ancho)}" fill="#c9c9c9"/>
    <polygon points="${f(x + cuerpo)},${f(y - ancho / 2)} ${f(x + largo)},${f(y)} ${f(x + cuerpo)},${f(y + ancho / 2)}" fill="#f3d7a6"/>
    <polygon points="${f(x + largo - punta * 0.35)},${f(y - ancho * 0.18)} ${f(x + largo)},${f(y)} ${f(x + largo - punta * 0.35)},${f(y + ancho * 0.18)}" fill="${color}"/>
  </g>`;
}

/** Planeta, con anillo si se pide. */
export function planeta(cx: number, cy: number, r: number, color: string, anillo?: string): string {
  return `<g>
    ${anillo ? `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 1.75)}" ry="${f(r * 0.45)}" fill="none" stroke="${anillo}" stroke-width="${f(r * 0.14)}" transform="rotate(-18 ${f(cx)} ${f(cy)})"/>` : ""}
    <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${color}"/>
    <circle cx="${f(cx + r * 0.25)}" cy="${f(cy + r * 0.2)}" r="${f(r * 0.85)}" fill="#000000" opacity="0.12"/>
    <circle cx="${f(cx - r * 0.3)}" cy="${f(cy - r * 0.25)}" r="${f(r * 0.18)}" fill="#ffffff" opacity="0.25"/>
  </g>`;
}

/** Cohete chiquito, subiendo en diagonal. */
export function cohete(cx: number, cy: number, s: number, giro = 35): string {
  return `<g transform="rotate(${f(giro)} ${f(cx)} ${f(cy)})">
    <path d="M ${f(cx)} ${f(cy + s * 0.9)} q ${f(-s * 0.3)} ${f(s * 0.5)} 0 ${f(s * 1)} q ${f(s * 0.3)} ${f(-s * 0.5)} 0 ${f(-s * 1)}" fill="#ffb347"/>
    <path d="M ${f(cx - s * 0.28)} ${f(cy + s * 0.5)} L ${f(cx - s * 0.6)} ${f(cy + s * 0.95)} L ${f(cx - s * 0.25)} ${f(cy + s * 0.85)} Z" fill="#e94b3c"/>
    <path d="M ${f(cx + s * 0.28)} ${f(cy + s * 0.5)} L ${f(cx + s * 0.6)} ${f(cy + s * 0.95)} L ${f(cx + s * 0.25)} ${f(cy + s * 0.85)} Z" fill="#e94b3c"/>
    <path d="M ${f(cx)} ${f(cy - s)} C ${f(cx + s * 0.45)} ${f(cy - s * 0.5)} ${f(cx + s * 0.35)} ${f(cy + s * 0.5)} ${f(cx + s * 0.25)} ${f(cy + s * 0.9)} L ${f(cx - s * 0.25)} ${f(cy + s * 0.9)} C ${f(cx - s * 0.35)} ${f(cy + s * 0.5)} ${f(cx - s * 0.45)} ${f(cy - s * 0.5)} ${f(cx)} ${f(cy - s)} Z" fill="#f4f6fb"/>
    <circle cx="${f(cx)}" cy="${f(cy - s * 0.15)}" r="${f(s * 0.16)}" fill="#5aa9e6" stroke="#8a94a6" stroke-width="${f(s * 0.04)}"/>
  </g>`;
}

/** Flor simple de cinco pétalos. */
export function flor(cx: number, cy: number, r: number, petalo: string, centro: string, giro = 0): string {
  let out = `<g transform="rotate(${f(giro)} ${f(cx)} ${f(cy)})">`;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    out += `<ellipse cx="${f(cx + Math.cos(a) * r * 0.55)}" cy="${f(cy + Math.sin(a) * r * 0.55)}" rx="${f(r * 0.5)}" ry="${f(r * 0.34)}" fill="${petalo}" transform="rotate(${f((a * 180) / Math.PI)} ${f(cx + Math.cos(a) * r * 0.55)} ${f(cy + Math.sin(a) * r * 0.55)})"/>`;
  }
  return out + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.28)}" fill="${centro}"/></g>`;
}

/** Hojita (para acompañar flores). */
export function hoja(cx: number, cy: number, largo: number, color: string, giro: number): string {
  return `<path d="M ${f(cx)} ${f(cy)} q ${f(largo * 0.5)} ${f(-largo * 0.35)} ${f(largo)} 0 q ${f(-largo * 0.5)} ${f(largo * 0.35)} ${f(-largo)} 0 Z" fill="${color}" transform="rotate(${f(giro)} ${f(cx)} ${f(cy)})"/>`;
}

/**
 * Filigrana de esquina: dos volutas que salen de la esquina. `esquina` 0 = arriba izquierda,
 * 1 = arriba derecha, 2 = abajo derecha, 3 = abajo izquierda.
 */
export function filigrana(x: number, y: number, s: number, color: string, esquina: 0 | 1 | 2 | 3, grosor = s * 0.025): string {
  const sx = esquina === 1 || esquina === 2 ? -1 : 1;
  const sy = esquina >= 2 ? -1 : 1;
  const P = (dx: number, dy: number) => `${f(x + sx * dx * s)} ${f(y + sy * dy * s)}`;
  return `<g fill="none" stroke="${color}" stroke-width="${f(grosor)}" stroke-linecap="round">
    <path d="M ${P(0, 0.9)} C ${P(0, 0.35)} ${P(0.05, 0.05)} ${P(0.9, 0)}"/>
    <path d="M ${P(0.12, 0.62)} C ${P(0.15, 0.3)} ${P(0.3, 0.15)} ${P(0.62, 0.12)}"/>
    <path d="M ${P(0.9, 0)} C ${P(1.05, 0.02)} ${P(1.08, 0.16)} ${P(0.98, 0.2)} C ${P(0.9, 0.23)} ${P(0.84, 0.14)} ${P(0.9, 0.1)}"/>
    <path d="M ${P(0, 0.9)} C ${P(0.02, 1.05)} ${P(0.16, 1.08)} ${P(0.2, 0.98)} C ${P(0.23, 0.9)} ${P(0.14, 0.84)} ${P(0.1, 0.9)}"/>
    <path d="M ${P(0.3, 0.3)} C ${P(0.45, 0.22)} ${P(0.5, 0.4)} ${P(0.38, 0.42)}"/>
  </g>
  <circle cx="${f(x + sx * 0.22 * s)}" cy="${f(y + sy * 0.22 * s)}" r="${f(grosor * 1.6)}" fill="${color}"/>`;
}

/** Las cuatro filigranas, a `m` del borde de una hoja de `w × h`. */
export function filigranas(w: number, h: number, m: number, s: number, color: string, grosor?: number): string {
  return (
    filigrana(m, m, s, color, 0, grosor) +
    filigrana(w - m, m, s, color, 1, grosor) +
    filigrana(w - m, h - m, s, color, 2, grosor) +
    filigrana(m, h - m, s, color, 3, grosor)
  );
}

/** Marco doble: una línea gruesa y una fina adentro. */
export function marcoDoble(w: number, h: number, m: number, color: string, grueso: number, fino: number, sep: number): string {
  return `<rect x="${f(m)}" y="${f(m)}" width="${f(w - 2 * m)}" height="${f(h - 2 * m)}" fill="none" stroke="${color}" stroke-width="${f(grueso)}"/>
    <rect x="${f(m + sep)}" y="${f(m + sep)}" width="${f(w - 2 * (m + sep))}" height="${f(h - 2 * (m + sep))}" fill="none" stroke="${color}" stroke-width="${f(fino)}"/>`;
}

/** Guarda clásica de certificado: una cadena de rombos entre dos líneas. */
export function guarda(w: number, h: number, m: number, ancho: number, color: string, fondo: string): string {
  const paso = ancho * 1.1;
  let rombos = "";
  const lado = (x0: number, y0: number, x1: number, y1: number) => {
    const largo = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(largo / paso));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const r = ancho * 0.36;
      rombos += `<polygon points="${f(x)},${f(y - r)} ${f(x + r)},${f(y)} ${f(x)},${f(y + r)} ${f(x - r)},${f(y)}" fill="none" stroke="${color}" stroke-width="${f(ancho * 0.07)}"/>`;
    }
  };
  const c = m + ancho / 2;
  lado(c, c, w - c, c);
  lado(c, h - c, w - c, h - c);
  lado(c, c, c, h - c);
  lado(w - c, c, w - c, h - c);
  return `<rect x="${f(m)}" y="${f(m)}" width="${f(w - 2 * m)}" height="${f(h - 2 * m)}" fill="none" stroke="${color}" stroke-width="${f(ancho * 0.08)}"/>
    <rect x="${f(m + ancho)}" y="${f(m + ancho)}" width="${f(w - 2 * (m + ancho))}" height="${f(h - 2 * (m + ancho))}" fill="${fondo}" stroke="${color}" stroke-width="${f(ancho * 0.08)}"/>
    ${rombos}`;
}

/** Estrellitas al azar en una zona, evitando rectángulos. */
export function cielo(
  zona: { x: number; y: number; w: number; h: number },
  cantidad: number,
  colores: readonly string[],
  semilla: number,
  tam: [number, number],
  evitar: Array<{ x: number; y: number; w: number; h: number }> = [],
): string {
  const a = azar(semilla);
  let out = "";
  let puestas = 0;
  for (let i = 0; i < cantidad * 30 && puestas < cantidad; i++) {
    const x = a.entre(zona.x, zona.x + zona.w);
    const y = a.entre(zona.y, zona.y + zona.h);
    if (evitar.some((e) => x > e.x && x < e.x + e.w && y > e.y && y < e.y + e.h)) continue;
    const r = a.entre(tam[0], tam[1]);
    out += a.r() < 0.35
      ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.3)}" fill="${a.elegir(colores)}" opacity="${a.entre(0.5, 1).toFixed(2)}"/>`
      : `<polygon points="${estrella(x, y, r, 5, 0.45, a.entre(-110, -70))}" fill="${a.elegir(colores)}" opacity="${a.entre(0.6, 1).toFixed(2)}"/>`;
    puestas++;
  }
  return out;
}

/** Llama (para Confirmación). */
export function llama(cx: number, cy: number, s: number, color: string, interior: string): string {
  return `<path d="M ${f(cx)} ${f(cy - s)} C ${f(cx + s * 0.6)} ${f(cy - s * 0.3)} ${f(cx + s * 0.55)} ${f(cy + s * 0.55)} ${f(cx)} ${f(cy + s * 0.6)} C ${f(cx - s * 0.55)} ${f(cy + s * 0.55)} ${f(cx - s * 0.6)} ${f(cy - s * 0.3)} ${f(cx)} ${f(cy - s)} Z" fill="${color}"/>
    <path d="M ${f(cx)} ${f(cy - s * 0.35)} C ${f(cx + s * 0.3)} ${f(cy)} ${f(cx + s * 0.25)} ${f(cy + s * 0.45)} ${f(cx)} ${f(cy + s * 0.48)} C ${f(cx - s * 0.25)} ${f(cy + s * 0.45)} ${f(cx - s * 0.3)} ${f(cy)} ${f(cx)} ${f(cy - s * 0.35)} Z" fill="${interior}"/>`;
}

/** Paloma estilizada en vuelo, mirando a la derecha. */
export function paloma(cx: number, cy: number, s: number, color: string): string {
  return `<g fill="${color}">
    <path d="M ${f(cx - s)} ${f(cy + s * 0.1)} C ${f(cx - s * 0.4)} ${f(cy - s * 0.05)} ${f(cx + s * 0.3)} ${f(cy - s * 0.05)} ${f(cx + s * 0.7)} ${f(cy - s * 0.2)} C ${f(cx + s * 0.85)} ${f(cy - s * 0.28)} ${f(cx + s * 1)} ${f(cy - s * 0.2)} ${f(cx + s * 1.05)} ${f(cy - s * 0.12)} L ${f(cx + s * 0.9)} ${f(cy - s * 0.08)} C ${f(cx + s * 0.7)} ${f(cy + s * 0.25)} ${f(cx + s * 0.1)} ${f(cy + s * 0.35)} ${f(cx - s * 0.55)} ${f(cy + s * 0.3)} L ${f(cx - s * 1.05)} ${f(cy + s * 0.5)} Z"/>
    <path d="M ${f(cx - s * 0.2)} ${f(cy)} C ${f(cx - s * 0.3)} ${f(cy - s * 0.6)} ${f(cx - s * 0.05)} ${f(cy - s * 0.95)} ${f(cx + s * 0.35)} ${f(cy - s * 1.05)} C ${f(cx + s * 0.25)} ${f(cy - s * 0.7)} ${f(cx + s * 0.3)} ${f(cy - s * 0.35)} ${f(cx + s * 0.35)} ${f(cy - s * 0.1)} Z"/>
  </g>`;
}

/** Rayos de luz alrededor de un punto (para lo religioso y lo festivo). */
export function rayos(cx: number, cy: number, r0: number, r1: number, n: number, color: string, opacidad: number): string {
  let out = `<g fill="${color}" opacity="${opacidad}">`;
  for (let i = 0; i < n; i++) {
    const a0 = (i * 2 * Math.PI) / n;
    const a1 = a0 + Math.PI / n / 1.6;
    out += `<polygon points="${f(cx + Math.cos(a0) * r0)},${f(cy + Math.sin(a0) * r0)} ${f(cx + Math.cos(a0) * r1)},${f(cy + Math.sin(a0) * r1)} ${f(cx + Math.cos(a1) * r1)},${f(cy + Math.sin(a1) * r1)} ${f(cx + Math.cos(a1) * r0)},${f(cy + Math.sin(a1) * r0)}"/>`;
  }
  return out + "</g>";
}

/** Cruz latina. */
export function cruz(cx: number, cy: number, alto: number, color: string): string {
  const g = alto * 0.16;
  return `<g fill="${color}"><rect x="${f(cx - g / 2)}" y="${f(cy - alto / 2)}" width="${f(g)}" height="${f(alto)}"/><rect x="${f(cx - alto * 0.33)}" y="${f(cy - alto * 0.22)}" width="${f(alto * 0.66)}" height="${f(g)}"/></g>`;
}
