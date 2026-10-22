import type { EstiloFotolibro, Medidas, RolTexto, TextoDelEstilo, TipoPliego, Zona } from "../tipos";
import { azar, confeti, degradado, estrella, estrellas, fondoLiso, globo, grano, paginas, rama, svg, type Rect } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Cumpleaños infantiles: diez estilos para chicos de 1 a 10 años. Todos los motivos son genéricos
 * y dibujados acá (nada de personajes con derechos): carpas de circo, dinosaurios, cohetes,
 * castillos, acacias, arcoíris, pelotas, globos, peces y garabatos de crayón.
 *
 * Las piezas que no están en `dibujo.ts` viven al principio de este archivo. Todas se dibujan en
 * milímetros y relativas a `s` (el lado menor de la página), así sirven de 20x30 a 30x90.
 */

const f = (n: number) => Math.round(n * 100) / 100;

/** El lado menor de una página: la vara para medir todos los adornos. */
const lado = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);

/** La zona clásica (título y frase) más lo que reserva cada estilo, calculado según la medida. */
function zonaS(calc: (s: number, tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, l: "izq" | "der", m: Medidas): Partial<Zona> => zonaClasica(calc(lado(m), tipo, l, m), posicion)(tipo, l, m);
}

/** Retoca los títulos de `textosClasicos` (negrita, mayúsculas, otro color) sin reescribirlos. */
function ajustar(fn: (tipo: TipoPliego, m: Medidas) => TextoDelEstilo[], cambios: Partial<Record<RolTexto, Partial<TextoDelEstilo>>>) {
  return (tipo: TipoPliego, m: Medidas) => fn(tipo, m).map((t) => ({ ...t, ...cambios[t.rol] }));
}

// ───────────────────────── Piezas propias ─────────────────────────

/** Guirnalda de banderines: una cuerda que cuelga entre dos puntos y triángulos de colores. */
function banderines(x1: number, y1: number, x2: number, y2: number, n: number, colores: string[], alto: number, comba: number, cuerda = "#7a6a58"): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + comba * 2;
  const ancho = (Math.hypot(x2 - x1, y2 - y1) / n) * 0.82;
  let out = `<path d="M ${f(x1)} ${f(y1)} Q ${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}" stroke="${cuerda}" stroke-width="${f(alto * 0.04)}" fill="none"/>`;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    const dx = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
    const dy = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    out += `<path d="M ${f(-ancho / 2)} 0 L ${f(ancho / 2)} 0 L 0 ${f(alto)} Z" fill="${colores[i % colores.length]}" transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"/>`;
  }
  return out;
}

/** Toldo de carpa de circo: rayas verticales con el borde de abajo en ondas. */
function toldo(x: number, w: number, alto: number, n: number, c1: string, c2: string): string {
  const ws = w / n;
  let out = "";
  for (let i = 0; i < n; i++) {
    const x0 = x + i * ws;
    out += `<path d="M ${f(x0)} 0 L ${f(x0 + ws)} 0 L ${f(x0 + ws)} ${f(alto)} A ${f(ws / 2)} ${f(ws * 0.38)} 0 0 1 ${f(x0)} ${f(alto)} Z" fill="${i % 2 ? c2 : c1}"/>`;
  }
  // Una sombrita fina debajo de las ondas, para que el toldo se despegue del papel.
  out += `<rect x="${f(x)}" y="0" width="${f(w)}" height="${f(alto * 0.12)}" fill="#000000" opacity="0.08"/>`;
  return out;
}

/** Fila de dientes (triángulos) apoyada en una línea: el borde de la pista del circo. */
function dientes(x: number, w: number, base: number, alto: number, colores: string[]): string {
  const n = Math.max(4, Math.round(w / (alto * 1.4)));
  const a = w / n;
  let out = "";
  for (let i = 0; i < n; i++) out += `<path d="M ${f(x + i * a)} ${f(base)} L ${f(x + (i + 0.5) * a)} ${f(base - alto)} L ${f(x + (i + 1) * a)} ${f(base)} Z" fill="${colores[i % colores.length]}"/>`;
  return out;
}

/** Colinas suaves desde abajo, en capas. */
function colinas(r: Rect, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  return colores
    .map((c, capa) => {
      const base = r.y + r.h;
      const a = alto * (1 - capa * 0.3);
      const n = 3 + capa * 2;
      const paso = r.w / n;
      let d = `M ${f(r.x)} ${f(base)} L ${f(r.x)} ${f(base - a * 0.6)}`;
      for (let i = 0; i < n; i++) {
        const x0 = r.x + i * paso;
        d += ` Q ${f(x0 + paso / 2)} ${f(base - a * (0.85 + rnd() * 0.45))} ${f(x0 + paso)} ${f(base - a * (0.5 + rnd() * 0.2))}`;
      }
      return `<path d="${d} L ${f(r.x + r.w)} ${f(base)} Z" fill="${c}"/>`;
    })
    .join("");
}

/** Dinosaurio de cuello largo, genérico. Pies en (x, base); `mira` 1 = a la derecha, -1 = a la izquierda. */
function cuelloLargo(x: number, base: number, alto: number, color: string, panza: string, mira = 1): string {
  const k = alto / 100;
  return `<g transform="translate(${f(x)} ${f(base)}) scale(${f(k * mira)} ${f(k)})" fill="${color}">
<path d="M -34 -44 C -60 -42 -78 -26 -98 -18 L -95 -13 C -72 -18 -55 -26 -30 -28 Z"/>
<rect x="-28" y="-32" width="10" height="32" rx="4"/><rect x="-12" y="-32" width="10" height="32" rx="4"/>
<rect x="8" y="-32" width="10" height="32" rx="4"/><rect x="22" y="-32" width="10" height="32" rx="4"/>
<ellipse cx="0" cy="-40" rx="38" ry="22"/>
<path d="M 20 -50 C 36 -62 40 -86 52 -96" stroke="${color}" stroke-width="14" fill="none" stroke-linecap="round"/>
<ellipse cx="60" cy="-98" rx="11" ry="7.5"/>
<ellipse cx="2" cy="-30" rx="26" ry="9" fill="${panza}"/>
<circle cx="-12" cy="-50" r="4" fill="${panza}" opacity="0.7"/><circle cx="4" cy="-55" r="3" fill="${panza}" opacity="0.7"/><circle cx="16" cy="-48" r="3.5" fill="${panza}" opacity="0.7"/>
<circle cx="63" cy="-100" r="1.8" fill="#2b2b2b"/></g>`;
}

/** Dinosaurio con placas en el lomo, genérico. */
function conPlacas(x: number, base: number, alto: number, color: string, placas: string, mira = 1): string {
  const k = alto / 100;
  let p = "";
  const lomo = [-30, -18, -6, 6, 18];
  lomo.forEach((px, i) => {
    const h = 16 + (i === 2 ? 6 : i === 1 || i === 3 ? 3 : 0);
    const y = -58 + Math.abs(px) * 0.15;
    p += `<path d="M ${px - 7} ${y + 6} L ${px} ${y - h} L ${px + 7} ${y + 6} Z" fill="${placas}"/>`;
  });
  return `<g transform="translate(${f(x)} ${f(base)}) scale(${f(k * mira)} ${f(k)})" fill="${color}">${p}
<path d="M -30 -40 C -52 -40 -66 -34 -80 -26 L -78 -21 C -62 -26 -50 -28 -28 -26 Z"/>
<path d="M -70 -29 L -76 -40 L -64 -31 Z M -60 -32 L -63 -44 L -54 -34 Z" fill="${placas}"/>
<rect x="-24" y="-30" width="11" height="30" rx="4"/><rect x="-8" y="-30" width="11" height="30" rx="4"/>
<rect x="10" y="-30" width="11" height="30" rx="4"/><rect x="24" y="-28" width="10" height="28" rx="4"/>
<ellipse cx="0" cy="-38" rx="36" ry="21"/>
<path d="M 30 -36 C 40 -40 46 -36 52 -30" stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round"/>
<ellipse cx="54" cy="-28" rx="10" ry="7.5"/>
<circle cx="57" cy="-30" r="1.8" fill="#2b2b2b"/></g>`;
}

/** Huella de tres dedos. */
function huella(x: number, y: number, t: number, ang: number, color: string): string {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})" fill="${color}"><ellipse cx="0" cy="${f(t * 0.25)}" rx="${f(t * 0.32)}" ry="${f(t * 0.36)}"/><ellipse cx="${f(-t * 0.36)}" cy="${f(-t * 0.28)}" rx="${f(t * 0.12)}" ry="${f(t * 0.24)}" transform="rotate(-25 ${f(-t * 0.36)} ${f(-t * 0.28)})"/><ellipse cx="0" cy="${f(-t * 0.42)}" rx="${f(t * 0.12)}" ry="${f(t * 0.26)}"/><ellipse cx="${f(t * 0.36)}" cy="${f(-t * 0.28)}" rx="${f(t * 0.12)}" ry="${f(t * 0.24)}" transform="rotate(25 ${f(t * 0.36)} ${f(-t * 0.28)})"/></g>`;
}

/** Volcán con lava y humito. */
function volcan(cx: number, base: number, alto: number, color: string, lava: string): string {
  const a = alto;
  let out = `<path d="M ${f(cx - a * 0.75)} ${f(base)} L ${f(cx - a * 0.18)} ${f(base - a)} L ${f(cx + a * 0.18)} ${f(base - a)} L ${f(cx + a * 0.75)} ${f(base)} Z" fill="${color}"/>`;
  out += `<path d="M ${f(cx - a * 0.18)} ${f(base - a)} L ${f(cx + a * 0.18)} ${f(base - a)} L ${f(cx + a * 0.26)} ${f(base - a * 0.8)} Q ${f(cx + a * 0.12)} ${f(base - a * 0.72)} ${f(cx + a * 0.06)} ${f(base - a * 0.84)} Q ${f(cx - a * 0.04)} ${f(base - a * 0.66)} ${f(cx - a * 0.12)} ${f(base - a * 0.82)} L ${f(cx - a * 0.26)} ${f(base - a * 0.8)} Z" fill="${lava}"/>`;
  [0, 1, 2].forEach((i) => {
    out += `<circle cx="${f(cx + (i - 1) * a * 0.1)}" cy="${f(base - a * (1.12 + i * 0.12))}" r="${f(a * (0.08 + i * 0.02))}" fill="#ffffff" opacity="${f(0.75 - i * 0.15)}"/>`;
  });
  return out;
}

/** Palmera de esquina: hojas largas y finas en abanico. */
function palmas(x: number, y: number, largo: number, angulos: number[], colores: string[], semilla: number): string {
  return angulos.map((a, i) => rama(x, y, largo * (1 - i * 0.08), a, colores[i % colores.length]!, semilla + i * 7, { hojas: 14, tamHoja: largo * 0.32, anchoHoja: 0.2 })).join("");
}

/** Planeta con sombra y, si se pide, anillo (la mitad de atrás va antes, la de adelante después). */
function planeta(id: string, x: number, y: number, r: number, color: string, sombra: string, anillo?: string): { defs: string; cuerpo: string } {
  const rx = r * 1.75;
  const ry = r * 0.42;
  const atras = anillo ? `<path d="M ${f(x - rx)} ${f(y)} A ${f(rx)} ${f(ry)} 0 0 1 ${f(x + rx)} ${f(y)}" stroke="${anillo}" stroke-width="${f(r * 0.16)}" fill="none" transform="rotate(-18 ${f(x)} ${f(y)})"/>` : "";
  const adelante = anillo ? `<path d="M ${f(x - rx)} ${f(y)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(x + rx)} ${f(y)}" stroke="${anillo}" stroke-width="${f(r * 0.16)}" fill="none" transform="rotate(-18 ${f(x)} ${f(y)})"/>` : "";
  return {
    defs: `<clipPath id="${id}"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/></clipPath>`,
    cuerpo: `${atras}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}"/><g clip-path="url(#${id})"><circle cx="${f(x + r * 0.45)}" cy="${f(y + r * 0.35)}" r="${f(r)}" fill="${sombra}" opacity="0.55"/><rect x="${f(x - r)}" y="${f(y - r * 0.35)}" width="${f(r * 2)}" height="${f(r * 0.14)}" fill="#ffffff" opacity="0.18"/><rect x="${f(x - r)}" y="${f(y + r * 0.1)}" width="${f(r * 2)}" height="${f(r * 0.1)}" fill="#ffffff" opacity="0.12"/></g>${adelante}`,
  };
}

/** Luna en cuarto creciente. */
function luna(cx: number, cy: number, r: number, color: string): string {
  return `<path d="M ${f(cx)} ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy + r)} A ${f(r * 0.55)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy - r)} Z" fill="${color}"/>`;
}

/** Cohete vertical con llama. Base (sin la llama) en (x, base). */
function cohete(x: number, base: number, alto: number, giro = 0): string {
  const k = alto / 100;
  return `<g transform="translate(${f(x)} ${f(base)}) rotate(${f(giro)}) scale(${f(k)})">
<path d="M -7 0 Q 0 30 7 0 Z" fill="#ffb703"/><path d="M -4 0 Q 0 18 4 0 Z" fill="#fff3b0"/>
<path d="M -12 -4 L -24 6 L -22 -22 Z M 12 -4 L 24 6 L 22 -22 Z" fill="#e63946"/>
<path d="M 0 -78 C 18 -60 18 -20 12 0 L -12 0 C -18 -20 -18 -60 0 -78 Z" fill="#f1f5f9"/>
<path d="M 0 -78 C 9 -70 13 -62 15 -55 L -15 -55 C -13 -62 -9 -70 0 -78 Z" fill="#e63946"/>
<circle cx="0" cy="-34" r="8" fill="#8ecae6" stroke="#3d5a80" stroke-width="3"/>
<rect x="-12" y="-6" width="24" height="5" fill="#cbd5e1"/></g>`;
}

/** Cometa: una cabeza brillante y una cola que se desvanece. */
function cometa(x: number, y: number, largo: number, ang: number, color: string): string {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"><path d="M 0 ${f(-largo * 0.05)} L ${f(-largo)} 0 L 0 ${f(largo * 0.05)} Z" fill="${color}" opacity="0.45"/><circle r="${f(largo * 0.06)}" fill="${color}"/></g>`;
}

/** Destello de cuatro puntas. */
function destello(x: number, y: number, r: number, color: string, opacidad = 1): string {
  return `<path d="M ${f(x)} ${f(y - r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Q ${f(x)} ${f(y)} ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x - r)} ${f(y)} Q ${f(x)} ${f(y)} ${f(x)} ${f(y - r)} Z" fill="${color}" opacity="${opacidad}"/>`;
}

/** Corona de cinco puntas con perlitas y una piedra al medio. Centro abajo en (cx, base). */
function corona(cx: number, base: number, w: number, color: string, piedra: string): string {
  const h = w * 0.62;
  const x0 = cx - w / 2;
  // Cinco puntas; la del medio sube más.
  const d = `M ${f(x0)} ${f(base)} L ${f(x0)} ${f(base - h * 0.7)} L ${f(x0 + w * 0.17)} ${f(base - h * 0.36)} L ${f(x0 + w * 0.3)} ${f(base - h * 0.85)} L ${f(x0 + w * 0.42)} ${f(base - h * 0.4)} L ${f(cx)} ${f(base - h)} L ${f(x0 + w * 0.58)} ${f(base - h * 0.4)} L ${f(x0 + w * 0.7)} ${f(base - h * 0.85)} L ${f(x0 + w * 0.83)} ${f(base - h * 0.36)} L ${f(x0 + w)} ${f(base - h * 0.7)} L ${f(x0 + w)} ${f(base)} Z`;
  let out = `<path d="${d}" fill="${color}"/><rect x="${f(x0)}" y="${f(base - h * 0.18)}" width="${f(w)}" height="${f(h * 0.18)}" fill="#ffffff" opacity="0.25"/>`;
  for (const [px, py] of [[0, 0.7], [0.3, 0.85], [0.5, 1], [0.7, 0.85], [1, 0.7]] as const) out += `<circle cx="${f(x0 + w * px)}" cy="${f(base - h * py)}" r="${f(w * 0.045)}" fill="${color}"/>`;
  out += `<ellipse cx="${f(cx)}" cy="${f(base - h * 0.32)}" rx="${f(w * 0.06)}" ry="${f(w * 0.08)}" fill="${piedra}"/>`;
  out += `<circle cx="${f(x0 + w * 0.22)}" cy="${f(base - h * 0.2)}" r="${f(w * 0.035)}" fill="${piedra}" opacity="0.8"/><circle cx="${f(x0 + w * 0.78)}" cy="${f(base - h * 0.2)}" r="${f(w * 0.035)}" fill="${piedra}" opacity="0.8"/>`;
  return out;
}

/** Guirnalda de perlas colgando del borde de arriba, en ondas. */
function perlas(x: number, w: number, comba: number, r: number, color: string): string {
  const ondas = Math.max(2, Math.round(w / (comba * 5)));
  const a = w / ondas;
  let out = "";
  for (let o = 0; o < ondas; o++) {
    const x1 = x + o * a;
    const n = Math.max(5, Math.round(a / (r * 3)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x1 + a * t;
      const py = r * 1.2 + 4 * comba * t * (1 - t);
      out += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(r * (i === 0 || i === n ? 1.4 : 1))}" fill="${color}"/>`;
    }
    out += `<path d="M ${f(x1 + a / 2)} ${f(r * 1.2 + comba)} l 0 ${f(comba * 0.5)}" stroke="${color}" stroke-width="${f(r * 0.4)}"/>`;
    out += `<path d="M ${f(x1 + a / 2)} ${f(r * 1.2 + comba * 1.5)} l ${f(r * 1.1)} ${f(r * 1.6)} l ${f(-r * 1.1)} ${f(r * 1.6)} l ${f(-r * 1.1)} ${f(-r * 1.6)} Z" fill="${color}"/>`;
  }
  return out;
}

/** Castillo de cuento (genérico): torres con techos cónicos y banderitas. */
function castillo(cx: number, base: number, ancho: number, muro: string, techo: string, bandera: string): string {
  const a = ancho;
  const torre = (x: number, w: number, h: number) =>
    `<rect x="${f(x - w / 2)}" y="${f(base - h)}" width="${f(w)}" height="${f(h)}" fill="${muro}"/>` +
    `<path d="M ${f(x - w * 0.62)} ${f(base - h)} L ${f(x)} ${f(base - h - w * 1.3)} L ${f(x + w * 0.62)} ${f(base - h)} Z" fill="${techo}"/>` +
    `<line x1="${f(x)}" y1="${f(base - h - w * 1.3)}" x2="${f(x)}" y2="${f(base - h - w * 1.75)}" stroke="${techo}" stroke-width="${f(w * 0.06)}"/>` +
    `<path d="M ${f(x)} ${f(base - h - w * 1.75)} l ${f(w * 0.45)} ${f(w * 0.12)} l ${f(-w * 0.45)} ${f(w * 0.12)} Z" fill="${bandera}"/>` +
    `<path d="M ${f(x - w * 0.12)} ${f(base - h * 0.62)} a ${f(w * 0.12)} ${f(w * 0.12)} 0 0 1 ${f(w * 0.24)} 0 l 0 ${f(w * 0.3)} l ${f(-w * 0.24)} 0 Z" fill="#ffffff" opacity="0.7"/>`;
  let out = `<rect x="${f(cx - a * 0.32)}" y="${f(base - a * 0.34)}" width="${f(a * 0.64)}" height="${f(a * 0.34)}" fill="${muro}"/>`;
  // Almenas.
  const n = 7;
  for (let i = 0; i < n; i++) out += `<rect x="${f(cx - a * 0.32 + (i * a * 0.64) / n + a * 0.01)}" y="${f(base - a * 0.38)}" width="${f((a * 0.64) / n - a * 0.03)}" height="${f(a * 0.05)}" fill="${muro}"/>`;
  out += torre(cx - a * 0.38, a * 0.14, a * 0.46) + torre(cx + a * 0.38, a * 0.14, a * 0.46) + torre(cx, a * 0.18, a * 0.62);
  out += `<path d="M ${f(cx - a * 0.07)} ${f(base)} L ${f(cx - a * 0.07)} ${f(base - a * 0.12)} A ${f(a * 0.07)} ${f(a * 0.07)} 0 0 1 ${f(cx + a * 0.07)} ${f(base - a * 0.12)} L ${f(cx + a * 0.07)} ${f(base)} Z" fill="${techo}" opacity="0.8"/>`;
  return out;
}

/** Acacia de la sabana: tronco que se abre y copa chata. */
function acacia(x: number, base: number, alto: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  const a = alto;
  let out = `<path d="M ${f(x - a * 0.03)} ${f(base)} Q ${f(x - a * 0.02)} ${f(base - a * 0.4)} ${f(x - a * 0.2)} ${f(base - a * 0.78)} L ${f(x - a * 0.16)} ${f(base - a * 0.8)} Q ${f(x)} ${f(base - a * 0.55)} ${f(x + a * 0.02)} ${f(base - a * 0.5)} Q ${f(x + a * 0.08)} ${f(base - a * 0.66)} ${f(x + a * 0.22)} ${f(base - a * 0.8)} L ${f(x + a * 0.25)} ${f(base - a * 0.78)} Q ${f(x + a * 0.06)} ${f(base - a * 0.5)} ${f(x + a * 0.04)} ${f(base)} Z" fill="${color}"/>`;
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    out += `<ellipse cx="${f(x - a * 0.38 + t * a * 0.76)}" cy="${f(base - a * (0.84 + rnd() * 0.06) - Math.sin(t * Math.PI) * a * 0.05)}" rx="${f(a * (0.14 + rnd() * 0.05))}" ry="${f(a * 0.06)}" fill="${color}"/>`;
  }
  return out;
}

/** Matas de pasto: hojitas finas en abanico a lo largo de una línea. */
function pastos(x1: number, x2: number, base: number, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  const n = Math.max(3, Math.round((x2 - x1) / (alto * 1.6)));
  for (let i = 0; i < n; i++) {
    const x = x1 + ((i + rnd() * 0.6) * (x2 - x1)) / n;
    const c = colores[i % colores.length]!;
    for (let j = -2; j <= 2; j++) {
      const h = alto * (0.6 + rnd() * 0.5) * (1 - Math.abs(j) * 0.12);
      const dx = j * alto * 0.22;
      out += `<path d="M ${f(x - alto * 0.04)} ${f(base)} Q ${f(x + dx * 0.4)} ${f(base - h * 0.6)} ${f(x + dx)} ${f(base - h)} Q ${f(x + dx * 0.4 + alto * 0.03)} ${f(base - h * 0.55)} ${f(x + alto * 0.04)} ${f(base)} Z" fill="${c}"/>`;
    }
  }
  return out;
}

/** Bandada de pájaros: uves curvas. */
function pajaros(area: Rect, n: number, color: string, semilla: number, tam: number): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    const t = tam * (0.6 + rnd() * 0.6);
    out += `<path d="M ${f(x - t)} ${f(y)} Q ${f(x - t * 0.5)} ${f(y - t * 0.5)} ${f(x)} ${f(y)} Q ${f(x + t * 0.5)} ${f(y - t * 0.5)} ${f(x + t)} ${f(y)}" stroke="${color}" stroke-width="${f(t * 0.14)}" fill="none" stroke-linecap="round"/>`;
  }
  return out;
}

/** Manchas de leopardo: rosetas de manchitas alrededor de un centro más oscuro. */
function leopardo(area: Rect, paso: number, color: string, centro: string, semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  let fila = 0;
  for (let y = area.y + paso * 0.5; y < area.y + area.h; y += paso * 0.85, fila++) {
    for (let x = area.x + paso * (fila % 2 ? 0.75 : 0.3); x < area.x + area.w; x += paso) {
      const cx = x + (rnd() - 0.5) * paso * 0.25;
      const cy = y + (rnd() - 0.5) * paso * 0.25;
      const r = paso * (0.22 + rnd() * 0.06);
      out += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 0.7)}" ry="${f(r * 0.55)}" fill="${centro}"/>`;
      const k = 4 + Math.floor(rnd() * 2);
      for (let i = 0; i < k; i++) {
        const a = (i / k) * Math.PI * 2 + rnd() * 0.6;
        out += `<ellipse cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r * 0.85)}" rx="${f(r * 0.32)}" ry="${f(r * 0.2)}" fill="${color}" transform="rotate(${f((a * 180) / Math.PI + 90)} ${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r * 0.85)})"/>`;
      }
    }
  }
  return out;
}

/** Arcoíris: bandas concéntricas entre dos ángulos (en grados, 0 = derecha, sentido horario). */
function arcoiris(cx: number, cy: number, rExt: number, grosor: number, colores: string[], desde: number, hasta: number): string {
  const rad = (g: number) => (g * Math.PI) / 180;
  return colores
    .map((c, i) => {
      const r = rExt - grosor * (i + 0.5);
      const x1 = cx + Math.cos(rad(desde)) * r;
      const y1 = cy + Math.sin(rad(desde)) * r;
      const x2 = cx + Math.cos(rad(hasta)) * r;
      const y2 = cy + Math.sin(rad(hasta)) * r;
      return `<path d="M ${f(x1)} ${f(y1)} A ${f(r)} ${f(r)} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)}" stroke="${c}" stroke-width="${f(grosor * 1.02)}" fill="none"/>`;
    })
    .join("");
}

/** Nube redondita con un borde fino. Centro abajo en (cx, base). */
function nube(cx: number, base: number, w: number, color: string, borde: string): string {
  const bolas: [number, number, number][] = [
    [-0.3, -0.18, 0.2],
    [-0.05, -0.3, 0.26],
    [0.24, -0.2, 0.2],
    [0.38, -0.1, 0.12],
    [-0.42, -0.08, 0.1],
  ];
  const g = w * 0.025;
  const dibujar = (extra: number, c: string) =>
    bolas.map(([x, y, r]) => `<circle cx="${f(cx + x * w)}" cy="${f(base + y * w)}" r="${f(r * w + extra)}" fill="${c}"/>`).join("") +
    `<rect x="${f(cx - w * 0.5 - extra)}" y="${f(base - w * 0.16 - extra)}" width="${f(w + extra * 2)}" height="${f(w * 0.16 + extra * 2)}" rx="${f(w * 0.08 + extra)}" fill="${c}"/>`;
  return dibujar(g, borde) + dibujar(0, color);
}

/** Pelota de fútbol clásica (genérica): pentágono negro al centro y parches en el borde. */
function pelota(id: string, cx: number, cy: number, r: number): { defs: string; cuerpo: string } {
  const pent = (x: number, y: number, rr: number, giro: number) => {
    const p: string[] = [];
    for (let i = 0; i < 5; i++) {
      const a = ((giro + i * 72 - 90) * Math.PI) / 180;
      p.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`);
    }
    return `<polygon points="${p.join(" ")}" fill="#1f2937"/>`;
  };
  let dentro = pent(cx, cy, r * 0.32, 0);
  for (let i = 0; i < 5; i++) {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    const x = cx + Math.cos(a) * r * 0.32;
    const y = cy + Math.sin(a) * r * 0.32;
    const xe = cx + Math.cos(a) * r * 0.62;
    const ye = cy + Math.sin(a) * r * 0.62;
    dentro += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(xe)}" y2="${f(ye)}" stroke="#1f2937" stroke-width="${f(r * 0.05)}"/>`;
    const b = ((i * 72 - 54) * Math.PI) / 180;
    dentro += pent(cx + Math.cos(b) * r * 1.02, cy + Math.sin(b) * r * 1.02, r * 0.3, i * 72 + 36);
  }
  return {
    defs: `<clipPath id="${id}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/></clipPath>`,
    cuerpo: `<circle cx="${f(cx + r * 0.08)}" cy="${f(cy + r * 0.1)}" r="${f(r)}" fill="#000000" opacity="0.18"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="#ffffff"/><g clip-path="url(#${id})">${dentro}</g><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="#1f2937" stroke-width="${f(r * 0.05)}"/>`,
  };
}

/** Racimo de globos subiendo desde abajo, pegado a un borde de la página. */
function racimo(borde: number, hacia: 1 | -1, base: number, s: number, colores: string[], semilla: number, cantidad = 4): string {
  const rnd = azar(semilla);
  const nudoX = borde + hacia * s * 0.075;
  const nudoY = base;
  let hilos = "";
  let globos = "";
  for (let i = 0; i < cantidad; i++) {
    const r = s * (0.034 + rnd() * 0.012);
    const x = borde + hacia * s * (0.035 + (i % 2) * 0.055 + rnd() * 0.012);
    const y = base - s * (0.2 + i * 0.075 + rnd() * 0.02);
    hilos += `<path d="M ${f(x)} ${f(y + r * 1.15)} Q ${f((x + nudoX) / 2 + hacia * s * 0.01)} ${f((y + nudoY) / 2)} ${f(nudoX)} ${f(nudoY)}" stroke="#9aa1b1" stroke-width="${f(s * 0.0016)}" fill="none"/>`;
    globos += globo(x, y, r, colores[(i + semilla) % colores.length]!, "#9aa1b1", 0);
  }
  return hilos + globos + `<path d="M ${f(nudoX - s * 0.008)} ${f(nudoY)} q ${f(s * 0.008)} ${f(s * 0.012)} ${f(s * 0.016)} 0" stroke="#e76f8a" stroke-width="${f(s * 0.003)}" fill="none"/>`;
}

/** Serpentina enrulada. */
function serpentina(x: number, y: number, largo: number, ang: number, color: string, grosor: number): string {
  let d = "M 0 0";
  const vueltas = 5;
  for (let i = 0; i < vueltas; i++) {
    const x0 = (largo * i) / vueltas;
    const p = largo / vueltas;
    d += ` C ${f(x0 + p * 0.9)} ${f(-p * 0.9)} ${f(x0 + p * 0.1)} ${f(-p * 0.9)} ${f(x0 + p)} 0`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${f(grosor)}" fill="none" stroke-linecap="round" transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"/>`;
}

/** Alga que ondula hacia arriba. */
function alga(x: number, base: number, alto: number, ancho: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  const fase = rnd() * Math.PI;
  const amp = ancho * (0.8 + rnd() * 0.6);
  const n = 18;
  const izq: string[] = [];
  const der: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x + Math.sin(t * Math.PI * 2.2 + fase) * amp * t;
    const w = (ancho / 2) * (1 - t * 0.85);
    izq.push(`${f(cx - w)},${f(base - alto * t)}`);
    der.unshift(`${f(cx + w)},${f(base - alto * t)}`);
  }
  return `<polygon points="${[...izq, ...der].join(" ")}" fill="${color}" stroke="${color}" stroke-width="${f(ancho * 0.15)}" stroke-linejoin="round"/>`;
}

/** Pececito de colores. */
function pez(x: number, y: number, l: number, color: string, aleta: string, mira = 1): string {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${mira} 1)"><path d="M ${f(-l * 0.32)} 0 L ${f(-l * 0.6)} ${f(-l * 0.2)} L ${f(-l * 0.56)} 0 L ${f(-l * 0.6)} ${f(l * 0.2)} Z" fill="${aleta}"/><ellipse rx="${f(l * 0.4)}" ry="${f(l * 0.24)}" fill="${color}"/><path d="M ${f(-l * 0.05)} ${f(-l * 0.22)} q ${f(l * 0.1)} ${f(-l * 0.14)} ${f(l * 0.2)} ${f(-l * 0.02)} Z" fill="${aleta}"/><path d="M ${f(l * 0.05)} ${f(-l * 0.2)} q ${f(-l * 0.08)} ${f(l * 0.2)} 0 ${f(l * 0.4)}" stroke="${aleta}" stroke-width="${f(l * 0.04)}" fill="none"/><circle cx="${f(l * 0.22)}" cy="${f(-l * 0.04)}" r="${f(l * 0.05)}" fill="#1f2937"/></g>`;
}

/** Columna de burbujas que suben. */
function burbujas(x: number, y1: number, y2: number, r: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  let y = y1;
  let i = 0;
  while (y > y2 && i < 30) {
    const rr = r * (0.4 + rnd() * 0.8);
    out += `<circle cx="${f(x + (rnd() - 0.5) * r * 3)}" cy="${f(y)}" r="${f(rr)}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="${f(r * 0.12)}" opacity="0.85"/>`;
    y -= rr * 2 + r * (0.8 + rnd() * 1.5);
    i++;
  }
  return out;
}

/** Estrella de mar: estrella con las puntas redondeadas. */
function estrellaDeMar(x: number, y: number, r: number, color: string, giro: number): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.5;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`);
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"><polygon points="${p.join(" ")}" fill="${color}" stroke="${color}" stroke-width="${f(r * 0.25)}" stroke-linejoin="round"/><circle r="${f(r * 0.1)}" fill="#ffffff" opacity="0.5"/></g>`;
}

/** Caracola en abanico. */
function caracola(x: number, y: number, r: number, color: string, raya: string): string {
  let out = `<path d="M ${f(x)} ${f(y)} L ${f(x - r)} ${f(y - r * 0.4)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y - r * 0.4)} Z" fill="${color}"/>`;
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    out += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + Math.cos(a) * r * 0.9)}" y2="${f(y - r * 0.3 + Math.sin(a) * r * 0.75)}" stroke="${raya}" stroke-width="${f(r * 0.06)}"/>`;
  }
  return out;
}

/** Superficie del agua: banda ondulada arriba. */
function superficie(r: Rect, alto: number, color: string, opacidad: number): string {
  const n = Math.max(3, Math.round(r.w / (alto * 4)));
  const p = r.w / n;
  let d = `M ${f(r.x)} 0 L ${f(r.x)} ${f(alto)}`;
  for (let i = 0; i < n; i++) d += ` q ${f(p / 4)} ${f(alto * 0.6)} ${f(p / 2)} 0 t ${f(p / 2)} 0`;
  return `<path d="${d} L ${f(r.x + r.w)} 0 Z" fill="${color}" opacity="${opacidad}"/>`;
}

// Garabatos de crayón: todos trazos, con un filtro que les come el borde como cera sobre papel.

const filtroCrayon = (id: string) =>
  `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="r"/><feDisplacementMap in="SourceGraphic" in2="r" scale="0.9" xChannelSelector="R" yChannelSelector="G"/></filter>`;

const trazo = (color: string, g: number) => `stroke="${color}" stroke-width="${f(g)}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

function solCrayon(x: number, y: number, r: number, color: string, g: number): string {
  let out = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" ${trazo(color, g)}/>`;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    out += `<line x1="${f(x + Math.cos(a) * r * 1.3)}" y1="${f(y + Math.sin(a) * r * 1.3)}" x2="${f(x + Math.cos(a) * r * (i % 2 ? 1.6 : 1.8))}" y2="${f(y + Math.sin(a) * r * (i % 2 ? 1.6 : 1.8))}" ${trazo(color, g)}/>`;
  }
  out += `<circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.2)}" r="${f(g * 0.7)}" fill="${color}"/><circle cx="${f(x + r * 0.35)}" cy="${f(y - r * 0.2)}" r="${f(g * 0.7)}" fill="${color}"/>`;
  out += `<path d="M ${f(x - r * 0.45)} ${f(y + r * 0.2)} Q ${f(x)} ${f(y + r * 0.65)} ${f(x + r * 0.45)} ${f(y + r * 0.2)}" ${trazo(color, g)}/>`;
  return out;
}

function corazonCrayon(x: number, y: number, r: number, color: string, g: number, giro = 0): string {
  return `<path d="M 0 ${f(r * 0.9)} C ${f(-r * 1.4)} ${f(-r * 0.1)} ${f(-r * 0.6)} ${f(-r * 1.1)} 0 ${f(-r * 0.35)} C ${f(r * 0.6)} ${f(-r * 1.1)} ${f(r * 1.4)} ${f(-r * 0.1)} 0 ${f(r * 0.9)} Z" ${trazo(color, g)} transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

function espiralCrayon(x: number, y: number, r: number, color: string, g: number): string {
  let d = "";
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 5;
    const rr = (r * i) / 40;
    d += `${i ? " L" : "M"} ${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`;
  }
  return `<path d="${d}" ${trazo(color, g)}/>`;
}

function estrellaCrayon(x: number, y: number, r: number, color: string, g: number, giro = 0): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`);
  }
  return `<polygon points="${p.join(" ")}" ${trazo(color, g)} transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

function florCrayon(x: number, base: number, alto: number, color: string, tallo: string, g: number): string {
  const r = alto * 0.16;
  const cy = base - alto + r;
  let out = `<path d="M ${f(x)} ${f(base)} Q ${f(x - alto * 0.08)} ${f(base - alto * 0.5)} ${f(x)} ${f(cy + r)}" ${trazo(tallo, g)}/>`;
  out += `<path d="M ${f(x - alto * 0.03)} ${f(base - alto * 0.35)} q ${f(-alto * 0.18)} ${f(-alto * 0.02)} ${f(-alto * 0.2)} ${f(-alto * 0.16)} q ${f(alto * 0.14)} ${f(-alto * 0.02)} ${f(alto * 0.2)} ${f(alto * 0.16)}" ${trazo(tallo, g)}/>`;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    out += `<circle cx="${f(x + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(r * 0.6)}" ${trazo(color, g)}/>`;
  }
  return out + `<circle cx="${f(x)}" cy="${f(cy)}" r="${f(r * 0.45)}" fill="${color}" opacity="0.6"/>`;
}

function nubeCrayon(x: number, y: number, w: number, color: string, g: number): string {
  return `<path d="M ${f(x - w / 2)} ${f(y)} q ${f(-w * 0.05)} ${f(-w * 0.25)} ${f(w * 0.2)} ${f(-w * 0.22)} q ${f(w * 0.08)} ${f(-w * 0.25)} ${f(w * 0.32)} ${f(-w * 0.14)} q ${f(w * 0.25)} ${f(-w * 0.06)} ${f(w * 0.3)} ${f(w * 0.16)} q ${f(w * 0.2)} ${f(w * 0.08)} ${f(w * 0.18)} ${f(w * 0.2)} Z" ${trazo(color, g)}/>`;
}

function rulos(x1: number, x2: number, y: number, alto: number, color: string, g: number): string {
  const n = Math.max(3, Math.round((x2 - x1) / (alto * 1.4)));
  const p = (x2 - x1) / n;
  let d = `M ${f(x1)} ${f(y)}`;
  for (let i = 0; i < n; i++) d += ` c ${f(p * 0.9)} 0 ${f(p * 0.9)} ${f(-alto)} ${f(p * 0.45)} ${f(-alto)} c ${f(-p * 0.45)} 0 ${f(-p * 0.45)} ${f(alto)} ${f(p * 0.55)} ${f(alto)}`;
  return `<path d="${d}" ${trazo(color, g)}/>`;
}

// ───────────────────────── Los estilos ─────────────────────────

const PRIMARIOS = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#ffb703"];

export const INFANTIL: EstiloFotolibro[] = [
  {
    id: "infantil-01-circo",
    tema: "infantil",
    nombre: "Gran circo",
    descripcion: "Toldo de carpa a rayas rojas, banderines y estrellas: la fiesta de circo de siempre.",
    papel: "#fff6e5",
    margenMm: 14,
    esquinasMm: 1.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const g = grano("g", m, 0.05);
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#fff6e5");
      const colores = ["#d62828", "#fcbf49", "#2a9d8f", "#003049"];
      if (tipo === "interior-alt") {
        for (const p of [izq, der]) c += banderines(p.x + s * 0.03, s * 0.025, p.x + p.w - s * 0.03, s * 0.025, Math.max(6, Math.round(p.w / (s * 0.075))), colores, s * 0.06, s * 0.035);
      } else {
        const alto = s * (tipo === "interior" ? 0.05 : 0.075);
        c += toldo(0, W, alto, Math.max(10, Math.round(W / (s * 0.085))) | 1, "#d62828", "#fdf0d5");
      }
      // La pista: dientes de colores al pie de las dos páginas.
      c += dientes(0, W, H, s * 0.025, ["#2a9d8f", "#fcbf49", "#d62828"]);
      if (tipo === "apertura") {
        // Estrellas alrededor del título.
        const cx = izq.w / 2;
        c += estrella(cx - izq.w * 0.34, H * 0.24, s * 0.025, "#fcbf49", 12) + estrella(cx + izq.w * 0.34, H * 0.24, s * 0.025, "#fcbf49", -12);
        c += estrella(cx - izq.w * 0.26, H * 0.19, s * 0.014, "#d62828", 30) + estrella(cx + izq.w * 0.26, H * 0.19, s * 0.014, "#d62828", -30);
      }
      if (tipo === "cierre") {
        c += estrella(der.x + der.w * 0.12, H * 0.2, s * 0.02, "#fcbf49", 10) + estrella(der.x + der.w * 0.88, H * 0.2, s * 0.02, "#fcbf49", -10);
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaS((s, tipo) => ({ arriba: s * (tipo === "interior-alt" ? 0.1 : tipo === "interior" ? 0.05 : 0.07), abajo: s * 0.02 })),
    textos: textosClasicos({
      titulo: "Bebas Neue",
      texto: "Nunito",
      color: "#d62828",
      acento: "#003049",
      escalaTitulo: 0.13,
      ejemplos: { titulo: "Los 5 de Valentina", subtitulo: "¡Pasen y vean!", fecha: "14 · 03 · 2026", frase: "¡Gracias por venir a mi función!" },
    }),
  },
  {
    id: "infantil-02-dinosaurios",
    tema: "infantil",
    nombre: "Valle de dinosaurios",
    descripcion: "Dinosaurios simpáticos, volcán, palmeras y huellas: para los fanáticos de los dinos.",
    papel: "#f1f6e4",
    margenMm: 14,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#f1f6e4");
      const verdes = ["#6a994e", "#a7c957", "#386641"];
      const base = H - s * 0.035;
      // Palmeras en las esquinas de arriba (menos en interior-alt, que lleva huellas).
      if (tipo !== "interior-alt") {
        c += palmas(izq.x - s * 0.01, -s * 0.01, s * 0.21, [8, 30, 52], verdes, 3);
        if (tipo !== "cierre") c += `<g transform="translate(${f(2 * der.x + der.w)} 0) scale(-1 1)">${palmas(der.x - s * 0.01, -s * 0.01, s * 0.21, [8, 30, 52], verdes, 9)}</g>`;
      } else {
        for (let i = 0; i < 9; i++) {
          const x = izq.x + s * 0.06 + (i * (W - s * 0.12)) / 8;
          c += huella(x, s * (i % 2 ? 0.075 : 0.045), s * 0.035, 100, "#a98467");
        }
      }
      if (tipo === "apertura") c += volcan(der.x + der.w - s * 0.16, base, s * 0.2, "#a98467", "#f4a259");
      if (tipo === "interior-alt") {
        // Huevos de dinosaurio con pintitas.
        for (const [x, sem] of [[izq.x + s * 0.08, 1], [der.x + der.w - s * 0.08, 2]] as const) {
          const rnd = azar(sem);
          c += `<ellipse cx="${f(x)}" cy="${f(base - s * 0.045)}" rx="${f(s * 0.032)}" ry="${f(s * 0.045)}" fill="#fefae0" stroke="#d4a373" stroke-width="${f(s * 0.003)}"/>`;
          for (let i = 0; i < 4; i++) c += `<circle cx="${f(x + (rnd() - 0.5) * s * 0.035)}" cy="${f(base - s * (0.02 + rnd() * 0.05))}" r="${f(s * 0.006)}" fill="#a7c957"/>`;
        }
      }
      c += colinas({ x: 0, y: 0, w: W, h: H }, s * (tipo === "interior-alt" ? 0.045 : 0.06), ["#c7dfa5", "#a7c957"], 5);
      if (tipo === "interior") {
        c += cuelloLargo(izq.x + s * 0.26, base, s * 0.2, "#52a08a", "#9ed2c0");
        c += conPlacas(der.x + der.w - s * 0.19, base, s * 0.18, "#f4a259", "#e76f51", -1);
      }
      if (tipo === "apertura") c += conPlacas(der.x + der.w - s * 0.42, base, s * 0.17, "#52a08a", "#f4a259");
      if (tipo === "cierre") c += cuelloLargo(der.x + der.w - s * 0.26, base, s * 0.2, "#f4a259", "#ffd6a5", -1) + cuelloLargo(izq.x + s * 0.2, base, s * 0.12, "#52a08a", "#9ed2c0");
      return svg(m, c);
    },
    zona: zonaS((s, tipo, l) => {
      const conDino = (tipo === "interior") || (tipo === "apertura" && l === "der") || tipo === "cierre";
      const titulo = (tipo === "apertura" && l === "izq") || (tipo === "cierre" && l === "der");
      return {
        arriba: s * (tipo === "interior-alt" ? 0.07 : 0.1),
        abajo: s * (titulo ? 0.06 : conDino ? (tipo === "cierre" && l === "izq" ? 0.14 : 0.2) : 0.05),
      };
    }),
    textos: textosClasicos({
      titulo: "Permanent Marker",
      texto: "Nunito",
      color: "#386641",
      acento: "#bc6c25",
      escalaTitulo: 0.11,
      ejemplos: { titulo: "Benja cumple 4", subtitulo: "Fiesta jurásica", fecha: "22 · 08 · 2026", frase: "¡Fue un cumple ROARRR!" },
    }),
  },
  {
    id: "infantil-03-espacio",
    tema: "infantil",
    nombre: "Viaje al espacio",
    descripcion: "Azul de noche, planetas con anillos, cohete y luna: un cumple que despega.",
    papel: "#0f1d4a",
    margenMm: 14,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const total = { x: 0, y: 0, w: W, h: H };
      const fondo = degradado("cielo", total, tipo === "interior-alt" ? "#1d1748" : "#0b1a3f", tipo === "interior-alt" ? "#2b2366" : "#1b2d63");
      let c = fondo.cuerpo;
      let defs = fondo.defs;
      c += estrellas(total, "#fff7d6", Math.round((W * H) / (s * s) * 45), 17, s * 0.014);
      const pl = (id: string, x: number, y: number, r: number, col: string, som: string, an?: string) => {
        const p = planeta(id, x, y, r, col, som, an);
        defs += p.defs;
        c += p.cuerpo;
      };
      if (tipo === "apertura") {
        c += `<ellipse cx="${f(izq.x + s * 0.13)}" cy="${f(s * 0.13)}" rx="${f(s * 0.17)}" ry="${f(s * 0.06)}" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="${f(s * 0.003)}" stroke-dasharray="${f(s * 0.012)} ${f(s * 0.012)}"/>`;
        pl("p1", izq.x + s * 0.13, s * 0.13, s * 0.06, "#f4a261", "#9c4a1a", "#ffd6a5");
        pl("p2", izq.x + izq.w - s * 0.1, s * 0.1, s * 0.03, "#8ecae6", "#3d5a80");
        c += cohete(der.x + der.w - s * 0.085, H - s * 0.12, s * 0.22, 8);
        c += luna(der.x + der.w - s * 0.07, s * 0.12, s * 0.045, "#ffe8a3");
      }
      if (tipo === "interior") {
        c += luna(izq.x + s * 0.09, s * 0.11, s * 0.05, "#ffe8a3");
        pl("p3", izq.x + s * 0.08, H - s * 0.12, s * 0.035, "#cdb4db", "#5a3d7a");
        pl("p4", der.x + der.w - s * 0.09, H - s * 0.14, s * 0.05, "#e76f51", "#7a2a14", "#f6bd60");
        c += cometa(der.x + der.w - s * 0.05, s * 0.1, s * 0.14, 25, "#ffffff");
      }
      if (tipo === "interior-alt") {
        c += cometa(izq.x + s * 0.22, s * 0.07, s * 0.18, 12, "#ffffff");
        pl("p5", der.x + der.w - s * 0.12, s * 0.065, s * 0.032, "#90be6d", "#2d5a27", "#d9ed92");
        pl("p6", izq.x + s * 0.06, s * 0.06, s * 0.02, "#f9c74f", "#a06d00");
      }
      if (tipo === "cierre") {
        c += cohete(izq.x + s * 0.085, H - s * 0.12, s * 0.22, -8);
        pl("p7", izq.x + s * 0.09, s * 0.12, s * 0.045, "#8ecae6", "#3d5a80", "#ffffff");
        c += luna(der.x + der.w - s * 0.08, H - s * 0.1, s * 0.05, "#ffe8a3");
      }
      return svg(m, c, defs);
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "interior-alt") return { arriba: s * 0.06 };
      if (tipo === "apertura") return l === "der" ? { exterior: s * 0.14 } : {};
      if (tipo === "cierre") return l === "izq" ? { exterior: s * 0.14 } : { exterior: s * 0.1 };
      return { exterior: s * 0.13 };
    }),
    textos: ajustar(
      textosClasicos({
        titulo: "Rubik",
        texto: "Quicksand",
        color: "#ffd166",
        acento: "#cfe1ff",
        escalaTitulo: 0.1,
        ejemplos: { titulo: "Mateo · 6", subtitulo: "Misión cumpleaños", fecha: "05 · 11 · 2026", frase: "Hasta el infinito y más allá" },
      }),
      { titulo: { negrita: true, mayusculas: true } },
    ),
  },
  {
    id: "infantil-04-princesa",
    tema: "infantil",
    nombre: "Princesa de cuento",
    descripcion: "Rosa empolvado con perlas, coronas doradas, destellos y un castillo de cuento.",
    papel: "#fff5f7",
    margenMm: 15,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const fondo = degradado("rosa", { x: 0, y: 0, w: W, h: H }, "#fff7f9", "#fde3ec");
      let c = fondo.cuerpo;
      const oro = "#d4a24c";
      for (const p of [izq, der]) c += perlas(p.x, p.w, s * 0.035, s * 0.006, tipo === "interior" ? "#e8b7c8" : oro);
      const destellos = (x: number, y: number, k: number, sem: number) => {
        const rnd = azar(sem);
        let o = "";
        for (let i = 0; i < 5; i++) o += destello(x + (rnd() - 0.5) * s * 0.12 * k, y + (rnd() - 0.5) * s * 0.06 * k, s * (0.014 + rnd() * 0.018) * k, i % 2 ? oro : "#f2a7c3");
        return o;
      };
      if (tipo === "apertura") {
        c += corona(izq.w / 2, H * 0.27, Math.min(s * 0.16, H * 0.14), oro, "#e98aa8");
        c += destellos(izq.w / 2 - s * 0.16, H * 0.2, 1, 3) + destellos(izq.w / 2 + s * 0.16, H * 0.2, 1, 4);
        c += destellos(der.x + der.w - s * 0.08, H - s * 0.06, 1, 5);
      }
      if (tipo === "interior") {
        c += destellos(izq.x + s * 0.07, H - s * 0.06, 1, 6) + destellos(der.x + der.w - s * 0.07, H - s * 0.06, 1, 7);
      }
      if (tipo === "interior-alt" || tipo === "cierre") {
        const p = tipo === "cierre" ? izq : der;
        const ancho = Math.min(p.w * 0.6, s * 0.36);
        c += nube(p.x + p.w / 2 - ancho * 0.75, H - s * 0.015, ancho * 0.5, "#ffffff", "#f6cfdc");
        c += castillo(p.x + p.w / 2, H - s * 0.02, ancho, "#f6c6d4", "#e98aa8", oro);
        c += nube(p.x + p.w / 2 + ancho * 0.7, H - s * 0.01, ancho * 0.45, "#ffffff", "#f6cfdc");
        c += `<rect x="${f(p.x)}" y="${f(H - s * 0.02)}" width="${f(p.w)}" height="${f(s * 0.02)}" fill="#f6cfdc"/>`;
        const otra = tipo === "cierre" ? der : izq;
        c += destellos(otra.x + (tipo === "cierre" ? otra.w - s * 0.07 : s * 0.07), H - s * 0.06, 1, 8);
      }
      return svg(m, c, fondo.defs);
    },
    zona: zonaS((s, tipo, l) => {
      const conCastillo = (tipo === "interior-alt" && l === "der") || (tipo === "cierre" && l === "izq");
      return { arriba: s * 0.05, abajo: s * (conCastillo ? 0.33 : 0.04) };
    }),
    textos: textosClasicos({
      titulo: "Parisienne",
      texto: "Quicksand",
      color: "#b04a72",
      acento: "#a67a33",
      escalaTitulo: 0.12,
      ejemplos: { titulo: "Los 5 de Valentina", subtitulo: "Mi fiesta de princesa", fecha: "14 · 03 · 2026", frase: "Y fue un cumple de cuento" },
    }),
  },
  {
    id: "infantil-05-safari",
    tema: "infantil",
    nombre: "Safari en la sabana",
    descripcion: "Tonos arena, acacias, sol de la tarde y manchas de leopardo: aventura salvaje.",
    papel: "#f8e7c2",
    margenMm: 14,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const fondo = degradado("arena", { x: 0, y: 0, w: W, h: H }, "#fbeccc", "#f2d39a");
      let c = fondo.cuerpo;
      const tronco = "#5c3a1e";
      const suelo = H - s * 0.035;
      if (tipo === "interior-alt") {
        // Bandas de piel de leopardo en los bordes de afuera.
        for (const r of [{ x: 0, y: 0, w: s * 0.09, h: H }, { x: W - s * 0.09, y: 0, w: s * 0.09, h: H }]) {
          c += fondoLiso(r, "#e9b872") + leopardo(r, s * 0.06, "#4a2f1b", "#c98f45", r.x > 0 ? 7 : 3);
        }
        c += `<line x1="${f(s * 0.09)}" y1="0" x2="${f(s * 0.09)}" y2="${f(H)}" stroke="#4a2f1b" stroke-width="${f(s * 0.004)}"/><line x1="${f(W - s * 0.09)}" y1="0" x2="${f(W - s * 0.09)}" y2="${f(H)}" stroke="#4a2f1b" stroke-width="${f(s * 0.004)}"/>`;
        return svg(m, c, fondo.defs);
      }
      // El suelo de la sabana con pasto.
      c += `<path d="M 0 ${f(suelo)} Q ${f(W * 0.25)} ${f(suelo - s * 0.012)} ${f(W * 0.5)} ${f(suelo)} T ${f(W)} ${f(suelo)} L ${f(W)} ${f(H)} L 0 ${f(H)} Z" fill="#d9a55b"/>`;
      if (tipo === "apertura") {
        const cx = izq.w / 2;
        for (let i = 3; i >= 1; i--) c += `<circle cx="${f(cx)}" cy="${f(H * 0.15)}" r="${f(s * 0.06 * (1 + i * 0.28))}" fill="#f4a259" opacity="${f(0.08 + (3 - i) * 0.04)}"/>`;
        c += `<circle cx="${f(cx)}" cy="${f(H * 0.15)}" r="${f(s * 0.06)}" fill="#ee8434"/>`;
        c += pajaros({ x: cx + s * 0.1, y: H * 0.07, w: s * 0.12, h: H * 0.06 }, 3, "#5c3a1e", 2, s * 0.012);
        c += acacia(der.x + der.w - s * 0.14, suelo + s * 0.01, s * 0.3, tronco, 4);
      }
      if (tipo === "interior") {
        c += acacia(izq.x + s * 0.11, suelo + s * 0.01, s * 0.27, tronco, 5);
        c += pajaros({ x: der.x + der.w - s * 0.2, y: s * 0.03, w: s * 0.16, h: s * 0.05 }, 4, "#5c3a1e", 6, s * 0.011);
      }
      if (tipo === "cierre") {
        c += `<circle cx="${f(izq.x + s * 0.15)}" cy="${f(suelo - s * 0.15)}" r="${f(s * 0.07)}" fill="#ee8434" opacity="0.85"/>`;
        c += acacia(izq.x + s * 0.11, suelo + s * 0.01, s * 0.27, tronco, 8);
        c += pajaros({ x: der.x + der.w * 0.7, y: s * 0.03, w: der.w * 0.2, h: s * 0.04 }, 3, "#5c3a1e", 9, s * 0.011);
      }
      c += pastos(0, W, suelo + s * 0.01, s * 0.03, ["#8a7a2e", "#a5932f", "#6b6a24"], 11);
      return svg(m, c, fondo.defs);
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "interior-alt") return { exterior: s * 0.07 };
      const arbol = (tipo === "apertura" && l === "der") || (tipo !== "apertura" && l === "izq");
      return { abajo: s * 0.04, exterior: arbol ? s * 0.25 : 0, arriba: tipo === "interior" && l === "der" ? s * 0.06 : 0 };
    }),
    textos: ajustar(
      textosClasicos({
        titulo: "Amatic SC",
        texto: "Kalam",
        color: "#6b3e1d",
        acento: "#9c6b30",
        escalaTitulo: 0.13,
        ejemplos: { titulo: "Joaquín cumple 3", subtitulo: "Expedición safari", fecha: "09 · 05 · 2026", frase: "¡Qué aventura salvaje!" },
      }),
      { titulo: { negrita: true } },
    ),
  },
  {
    id: "infantil-06-arcoiris",
    tema: "infantil",
    nombre: "Arcoíris pastel",
    descripcion: "Blanco luminoso con arcoíris en colores pastel y nubes esponjosas.",
    papel: "#fffdf8",
    margenMm: 14,
    esquinasMm: 3,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const colores = ["#f4a7a7", "#f9c899", "#f7e3a1", "#bfe3c6", "#a9d0ef", "#c9b8e4"];
      const borde = "#dfe6ee";
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#fffdf8");
      const cuarto = (cx: number, cy: number, r: number, desde: number) => arcoiris(cx, cy, r, (r * 0.55) / colores.length, colores, desde, desde + 90);
      if (tipo === "apertura") {
        const r = Math.min(s * 0.19, izq.w * 0.3, H * 0.2);
        const cx = izq.w / 2;
        const cy = H * 0.26;
        c += arcoiris(cx, cy, r, (r * 0.5) / colores.length, colores, 180, 360);
        c += nube(cx - r * 0.75, cy + r * 0.08, r * 0.75, "#ffffff", borde) + nube(cx + r * 0.75, cy + r * 0.08, r * 0.75, "#ffffff", borde);
        c += cuarto(der.x + der.w, H, s * 0.2, 180);
      }
      if (tipo === "interior") {
        c += cuarto(0, 0, s * 0.2, 0) + cuarto(W, H, s * 0.2, 180);
        c += nube(der.x + der.w - s * 0.24, H - s * 0.012, s * 0.12, "#ffffff", borde) + nube(izq.x + s * 0.24, s * 0.09, s * 0.1, "#ffffff", borde);
      }
      if (tipo === "interior-alt") {
        const alto = s * 0.045;
        colores.forEach((col, i) => {
          c += fondoLiso({ x: 0, y: H - alto + (i * alto) / colores.length, w: W, h: alto / colores.length + 0.05 }, col);
        });
        c += nube(izq.x + s * 0.12, s * 0.09, s * 0.14, "#ffffff", borde) + nube(der.x + der.w - s * 0.12, s * 0.09, s * 0.14, "#ffffff", borde);
        c += nube(izq.x + s * 0.25, s * 0.065, s * 0.08, "#ffffff", borde) + nube(der.x + der.w - s * 0.25, s * 0.065, s * 0.08, "#ffffff", borde);
      }
      if (tipo === "cierre") {
        c += cuarto(0, H, s * 0.2, 270) + cuarto(W, H, s * 0.2, 180);
        c += nube(izq.x + s * 0.25, H - s * 0.012, s * 0.12, "#ffffff", borde);
      }
      return svg(m, c);
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "interior-alt") return { arriba: s * 0.08, abajo: s * 0.04 };
      if (tipo === "interior") return l === "izq" ? { arriba: s * 0.11, exterior: s * 0.11 } : { abajo: s * 0.11, exterior: s * 0.11 };
      if (tipo === "apertura") return l === "der" ? { abajo: s * 0.11, exterior: s * 0.11 } : {};
      return { abajo: s * 0.11, exterior: s * 0.11 };
    }),
    textos: textosClasicos({
      titulo: "Pacifico",
      texto: "Nunito",
      color: "#e66f86",
      acento: "#7f8cb0",
      escalaTitulo: 0.1,
      ejemplos: { titulo: "Mía cumple 2", subtitulo: "Un cumple de colores", fecha: "18 · 10 · 2026", frase: "Gracias por llenar mi día de color" },
    }),
  },
  {
    id: "infantil-07-futbol",
    tema: "infantil",
    nombre: "Picado de fútbol",
    descripcion: "Césped a rayas, líneas de cancha, banderines de córner y pelota: ¡a la cancha!",
    papel: "#3a8d3f",
    margenMm: 15,
    esquinasMm: 0,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#3d9142");
      // El corte del césped: franjas verticales.
      const franja = s * 0.11;
      for (let x = 0, i = 0; x < W; x += franja, i++) if (i % 2) c += fondoLiso({ x, y: 0, w: Math.min(franja, W - x), h: H }, "#358539");
      const linea = `stroke="#ffffff" stroke-opacity="0.85" stroke-width="${f(s * 0.006)}" fill="none"`;
      const e = s * 0.04;
      c += `<rect x="${f(e)}" y="${f(e)}" width="${f(W - 2 * e)}" height="${f(H - 2 * e)}" ${linea}/>`;
      c += `<line x1="${f(W / 2)}" y1="${f(e)}" x2="${f(W / 2)}" y2="${f(H - e)}" ${linea}/>`;
      // Arcos de córner y banderines.
      const rc = s * 0.035;
      c += `<path d="M ${f(e + rc)} ${f(e)} A ${f(rc)} ${f(rc)} 0 0 1 ${f(e)} ${f(e + rc)} M ${f(W - e - rc)} ${f(e)} A ${f(rc)} ${f(rc)} 0 0 0 ${f(W - e)} ${f(e + rc)} M ${f(e)} ${f(H - e - rc)} A ${f(rc)} ${f(rc)} 0 0 1 ${f(e + rc)} ${f(H - e)} M ${f(W - e)} ${f(H - e - rc)} A ${f(rc)} ${f(rc)} 0 0 0 ${f(W - e - rc)} ${f(H - e)}" ${linea}/>`;
      for (const [x, y, sx] of [[e, e, 1], [W - e, e, -1]] as const) {
        c += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y - e * 0.9)}" stroke="#f8f9fa" stroke-width="${f(s * 0.004)}"/><path d="M ${f(x)} ${f(y - e * 0.9)} l ${f(sx * e * 0.6)} ${f(e * 0.18)} l ${f(-sx * e * 0.6)} ${f(e * 0.18)} Z" fill="#ffd60a"/>`;
      }
      let defs = "";
      // El área grande, el área chica y la medialuna, del lado de afuera de las páginas sin título.
      const area = (x: number, sx: 1 | -1) => {
        const prof = s * 0.15;
        const alto = Math.min(H * 0.56, s * 0.6);
        const chica = s * 0.055;
        const y0 = H / 2;
        return `<path d="M ${f(x)} ${f(y0 - alto / 2)} l ${f(sx * prof)} 0 l 0 ${f(alto)} l ${f(-sx * prof)} 0 M ${f(x)} ${f(y0 - alto * 0.25)} l ${f(sx * chica)} 0 l 0 ${f(alto * 0.5)} l ${f(-sx * chica)} 0" ${linea}/>` +
          `<path d="M ${f(x + sx * prof)} ${f(y0 - s * 0.06)} A ${f(s * 0.07)} ${f(s * 0.07)} 0 0 ${sx === 1 ? 1 : 0} ${f(x + sx * prof)} ${f(y0 + s * 0.06)}" ${linea}/>` +
          `<circle cx="${f(x + sx * s * 0.1)}" cy="${f(y0)}" r="${f(s * 0.006)}" fill="#ffffff" opacity="0.85"/>` +
          `<rect x="${f(sx === 1 ? x - s * 0.028 : x)}" y="${f(y0 - alto * 0.13)}" width="${f(s * 0.028)}" height="${f(alto * 0.26)}" fill="#ffffff" fill-opacity="0.2" stroke="#ffffff" stroke-width="${f(s * 0.004)}"/>`;
      };
      if (tipo === "apertura") c += area(W - e, -1);
      if (tipo === "cierre") c += area(e, 1);
      if (tipo === "interior") c += `<circle cx="${f(W / 2)}" cy="${f(H / 2)}" r="${f(s * 0.008)}" fill="#ffffff" opacity="0.85"/>`;
      if (tipo === "interior-alt" || tipo === "apertura") {
        const p = pelota("pel", izq.x + s * 0.11, H - s * 0.1, s * 0.045);
        c += p.cuerpo;
        defs += p.defs;
      }
      if (tipo === "interior-alt") {
        const p = pelota("pel2", der.x + der.w - s * 0.11, s * 0.1, s * 0.035);
        c += p.cuerpo;
        defs += p.defs;
      }
      return svg(m, c, defs);
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "apertura") return l === "der" ? { exterior: s * 0.15 } : { abajo: s * 0.05 };
      if (tipo === "cierre") return l === "izq" ? { exterior: s * 0.15 } : {};
      if (tipo === "interior-alt") return l === "izq" ? { abajo: s * 0.1 } : { arriba: s * 0.1 };
      return {};
    }),
    textos: ajustar(
      textosClasicos({
        titulo: "Anton",
        texto: "Oswald",
        color: "#ffffff",
        acento: "#ffd60a",
        escalaTitulo: 0.12,
        ejemplos: { titulo: "Santi cumple 8", subtitulo: "El picado del año", fecha: "30 · 06 · 2026", frase: "¡Golazo de cumple!" },
      }),
      { titulo: { mayusculas: true } },
    ),
  },
  {
    id: "infantil-08-globos",
    tema: "infantil",
    nombre: "Fiesta de globos",
    descripcion: "Racimos de globos, serpentinas y papel picado en colores caramelo.",
    papel: "#fdf3f8",
    margenMm: 14,
    esquinasMm: 2.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const fondo = degradado("cielo", { x: 0, y: 0, w: W, h: H }, "#fdf2f8", "#eef4ff");
      let c = fondo.cuerpo;
      const colores = ["#ff8fab", "#ffd166", "#8ecae6", "#b8e0a5", "#cdb4db"];
      c += confeti({ x: 0, y: s * 0.01, w: W, h: s * 0.06 }, colores, Math.round(W / (s * 0.03)), 3, s * 0.012);
      if (tipo === "interior-alt") {
        c += confeti({ x: 0, y: H - s * 0.07, w: W, h: s * 0.06 }, colores, Math.round(W / (s * 0.03)), 8, s * 0.012);
        c += serpentina(izq.x + s * 0.02, s * 0.1, s * 0.18, -25, "#ff8fab", s * 0.006) + serpentina(der.x + der.w - s * 0.02, s * 0.1, s * 0.18, 205, "#8ecae6", s * 0.006);
        return svg(m, c, fondo.defs);
      }
      const base = H - s * 0.02;
      const cuantos = tipo === "cierre" ? 5 : 4;
      if (tipo !== "apertura") c += racimo(izq.x + s * 0.02, 1, base, s, colores, 1, cuantos);
      else c += racimo(izq.x + s * 0.02, 1, base, s, colores, 1, 3);
      c += racimo(der.x + der.w - s * 0.02, -1, base, s, colores, 2, cuantos);
      if (tipo === "apertura") c += serpentina(izq.w / 2 - s * 0.12, H * 0.22, s * 0.24, 0, "#cdb4db", s * 0.005);
      return svg(m, c, fondo.defs);
    },
    zona: zonaS((s, tipo) => (tipo === "interior-alt" ? { arriba: s * 0.08, abajo: s * 0.06 } : { arriba: s * 0.06, exterior: s * 0.13 })),
    textos: textosClasicos({
      titulo: "Courgette",
      texto: "Poppins",
      color: "#d6457a",
      acento: "#6c6f93",
      escalaTitulo: 0.11,
      ejemplos: { titulo: "Los 7 de Juana", subtitulo: "¡Hoy es mi cumple!", fecha: "12 · 09 · 2026", frase: "Gracias por festejar conmigo" },
    }),
  },
  {
    id: "infantil-09-bajo-el-mar",
    tema: "infantil",
    nombre: "Bajo el mar",
    descripcion: "Agua turquesa, algas, burbujas, pececitos y estrellas de mar sobre la arena.",
    papel: "#bfe6ee",
    margenMm: 14,
    esquinasMm: 3,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const fondo = degradado("agua", { x: 0, y: 0, w: W, h: H }, "#d6f2f6", "#7fc8d8");
      let c = fondo.cuerpo;
      c += superficie({ x: 0, y: 0, w: W, h: H }, s * 0.03, "#ffffff", 0.55);
      const arena = H - s * 0.04;
      const algas = (x: number, sx: 1 | -1, sem: number, alto: number) =>
        alga(x, arena + s * 0.02, alto, s * 0.025, "#2a9d8f", sem) + alga(x + sx * s * 0.04, arena + s * 0.02, alto * 0.7, s * 0.022, "#52b788", sem + 1) + alga(x + sx * s * 0.08, arena + s * 0.02, alto * 0.45, s * 0.02, "#40916c", sem + 2);
      const peces = (x: number, y: number, mira: 1 | -1, sem: number) => {
        const rnd = azar(sem);
        const col = [["#f77f00", "#fcbf49"], ["#ffd60a", "#f77f00"], ["#ef476f", "#ffafcc"]];
        let o = "";
        for (let i = 0; i < 3; i++) {
          const [a, b] = col[i]!;
          o += pez(x + mira * i * s * 0.07 + rnd() * s * 0.02, y + (i % 2) * s * 0.03, s * (0.05 + rnd() * 0.015), a!, b!, mira);
        }
        return o;
      };
      if (tipo === "apertura") {
        c += peces(izq.w / 2 - s * 0.07, H * 0.15, 1, 3);
        c += algas(izq.x + s * 0.03, 1, 10, s * 0.2);
        c += algas(der.x + der.w - s * 0.03, -1, 20, s * 0.32) + burbujas(der.x + der.w - s * 0.08, H * 0.6, s * 0.08, s * 0.012, "#ffffff", 4);
      }
      if (tipo === "interior") {
        c += algas(izq.x + s * 0.03, 1, 30, s * 0.32) + algas(der.x + der.w - s * 0.03, -1, 40, s * 0.26);
        c += burbujas(izq.x + s * 0.1, H * 0.55, s * 0.08, s * 0.012, "#ffffff", 5);
      }
      if (tipo === "interior-alt") {
        c += peces(izq.x + s * 0.06, s * 0.08, 1, 6) + peces(der.x + der.w - s * 0.06, s * 0.08, -1, 7);
      }
      if (tipo === "cierre") {
        c += algas(izq.x + s * 0.03, 1, 50, s * 0.3) + algas(der.x + der.w - s * 0.03, -1, 60, s * 0.22);
        c += burbujas(izq.x + s * 0.1, H * 0.6, s * 0.1, s * 0.012, "#ffffff", 8);
      }
      // La arena con piedritas, estrellas de mar y caracolas.
      c += `<path d="M 0 ${f(arena)} Q ${f(W * 0.2)} ${f(arena - s * 0.015)} ${f(W * 0.4)} ${f(arena)} T ${f(W * 0.8)} ${f(arena)} T ${f(W * 1.2)} ${f(arena)} L ${f(W)} ${f(H)} L 0 ${f(H)} Z" fill="#f3dfb0"/>`;
      c += lunaresArena({ x: 0, y: arena + s * 0.01, w: W, h: H - arena - s * 0.01 }, s, 12);
      c += estrellaDeMar(izq.x + s * (tipo === "interior-alt" ? 0.08 : 0.17), H - s * 0.025, s * 0.022, "#f4845f", 15);
      c += caracola(der.x + der.w - s * (tipo === "interior-alt" ? 0.08 : 0.17), H - s * 0.012, s * 0.022, "#ffcad4", "#e5989b");
      if (tipo === "interior-alt") c += estrellaDeMar(der.x + der.w * 0.5, H - s * 0.02, s * 0.018, "#ffb703", -10) + caracola(izq.x + izq.w * 0.5, H - s * 0.012, s * 0.02, "#fff1e6", "#ddbea9");
      return svg(m, c, fondo.defs);
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "interior-alt") return { arriba: s * 0.08, abajo: s * 0.04 };
      const titulo = (tipo === "apertura" && l === "izq") || (tipo === "cierre" && l === "der");
      return { arriba: s * 0.02, abajo: s * 0.04, exterior: s * (titulo ? 0.06 : 0.1) };
    }),
    textos: textosClasicos({
      titulo: "Patrick Hand",
      texto: "Nunito",
      color: "#0f4c6e",
      acento: "#1b7a94",
      escalaTitulo: 0.12,
      ejemplos: { titulo: "Lola cumple 5", subtitulo: "Fiesta bajo el mar", fecha: "07 · 02 · 2026", frase: "¡Un cumple de película submarina!" },
    }),
  },
  {
    id: "infantil-10-crayones",
    tema: "infantil",
    nombre: "Cuaderno de crayones",
    descripcion: "Hoja cuadriculada con soles, corazones y flores dibujados en crayón, como hechos por ellos.",
    papel: "#fdfdf8",
    margenMm: 14,
    esquinasMm: 0,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#fdfdf8");
      // Cuadriculado de 5 mm, como un cuaderno de verdad.
      let d = "";
      for (let x = 5; x < W; x += 5) d += `M ${x} 0 V ${f(H)} `;
      for (let y = 5; y < H; y += 5) d += `M 0 ${y} H ${f(W)} `;
      c += `<path d="${d}" stroke="#cfe3f3" stroke-width="0.15"/>`;
      c += `<line x1="${f(s * 0.055)}" y1="0" x2="${f(s * 0.055)}" y2="${f(H)}" stroke="#f08080" stroke-width="0.35"/><line x1="${f(W - s * 0.055)}" y1="0" x2="${f(W - s * 0.055)}" y2="${f(H)}" stroke="#f08080" stroke-width="0.35"/>`;
      const g = Math.max(0.5, s * 0.007);
      const [rojo, naranja, verde, azul, amarillo] = PRIMARIOS as [string, string, string, string, string];
      let dib = "";
      if (tipo === "apertura") {
        dib += solCrayon(izq.x + s * 0.13, s * 0.13, s * 0.045, amarillo, g);
        dib += corazonCrayon(izq.x + izq.w - s * 0.1, s * 0.1, s * 0.03, rojo, g, 12) + estrellaCrayon(izq.x + izq.w - s * 0.18, s * 0.07, s * 0.02, azul, g, 10);
        dib += rulos(izq.w * 0.32, izq.w * 0.68, H * 0.645, s * 0.022, verde, g);
        for (let i = 0; i < 3; i++) dib += florCrayon(der.x + der.w - s * (0.08 + i * 0.06), H - s * 0.02, s * (0.12 + (i % 2) * 0.03), [rojo, naranja, azul][i]!, verde, g);
        dib += nubeCrayon(der.x + der.w - s * 0.14, s * 0.11, s * 0.13, azul, g);
      }
      if (tipo === "interior") {
        dib += solCrayon(izq.x + s * 0.13, s * 0.13, s * 0.045, amarillo, g);
        dib += nubeCrayon(der.x + der.w - s * 0.14, s * 0.11, s * 0.13, azul, g) + estrellaCrayon(der.x + der.w - s * 0.26, s * 0.06, s * 0.018, naranja, g, -12);
      }
      if (tipo === "interior-alt") {
        const figuras = [
          (x: number, y: number) => corazonCrayon(x, y, s * 0.025, rojo, g, -8),
          (x: number, y: number) => estrellaCrayon(x, y, s * 0.028, amarillo, g, 8),
          (x: number, y: number) => espiralCrayon(x, y, s * 0.025, azul, g),
          (x: number, y: number) => estrellaCrayon(x, y, s * 0.022, verde, g, -15),
          (x: number, y: number) => corazonCrayon(x, y, s * 0.022, naranja, g, 10),
        ];
        const n = Math.max(6, Math.round(W / (s * 0.12)));
        for (let i = 0; i < n; i++) dib += figuras[i % figuras.length]!(s * 0.1 + (i * (W - s * 0.2)) / (n - 1), H - s * (i % 2 ? 0.055 : 0.07));
      }
      if (tipo === "cierre") {
        for (let i = 0; i < 4; i++) dib += florCrayon(izq.x + s * (0.08 + i * 0.065), H - s * 0.02, s * (0.11 + (i % 2) * 0.04), [azul, rojo, amarillo, naranja][i]!, verde, g);
        dib += corazonCrayon(der.x + der.w - s * 0.08, H - s * 0.07, s * 0.03, rojo, g, 10) + corazonCrayon(der.x + der.w - s * 0.15, H - s * 0.05, s * 0.02, naranja, g, -12);
      }
      c += `<g filter="url(#cr)" opacity="0.9">${dib}</g>`;
      return svg(m, c, filtroCrayon("cr"));
    },
    zona: zonaS((s, tipo, l) => {
      const x = { exterior: s * 0.03 };
      if (tipo === "apertura") return l === "der" ? { ...x, arriba: s * 0.11, abajo: s * 0.12, exterior: s * 0.03 } : x;
      if (tipo === "interior") return { ...x, arriba: s * 0.12 };
      if (tipo === "interior-alt") return { ...x, abajo: s * 0.08 };
      return l === "izq" ? { ...x, abajo: s * 0.15 } : { ...x, abajo: s * 0.08 };
    }),
    textos: textosClasicos({
      titulo: "Indie Flower",
      texto: "Architects Daughter",
      color: "#e63946",
      acento: "#457b9d",
      escalaTitulo: 0.13,
      ejemplos: { titulo: "Juli cumple 6", subtitulo: "Mi cumple dibujado", fecha: "25 · 04 · 2026", frase: "¡El mejor día del mundo!" },
    }),
  },
];

/** Piedritas en la arena. */
function lunaresArena(r: Rect, s: number, semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  const n = Math.round(r.w / (s * 0.03));
  for (let i = 0; i < n; i++) out += `<circle cx="${f(r.x + rnd() * r.w)}" cy="${f(r.y + rnd() * r.h)}" r="${f(s * (0.002 + rnd() * 0.003))}" fill="#d4b483" opacity="0.8"/>`;
  return out;
}
