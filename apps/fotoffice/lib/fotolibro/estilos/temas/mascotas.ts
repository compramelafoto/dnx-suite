import type { EstiloFotolibro, Medidas, TextoDelEstilo, TipoPliego, Zona } from "../tipos";
import { arco, azar, degradado, estrellas, filtroAcuarela, fondoLiso, grano, manchaAcuarela, paginas, pampa, svg } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos para libros de mascotas: perros y gatos. Huellitas, huesos, ovillos, pescaditos,
 * cuchas y siluetas simples armadas con formas (círculos, elipses y curvas), sin personajes.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => Math.max(0, n);
const fuerte = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";
const esTitulo = (tipo: TipoPliego, lado: "izq" | "der") => (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");
const lado = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);

/**
 * La zona clásica (lugar del título) más lo que reservan los adornos de cada estilo. En las
 * páginas de título lo de abajo se recorta para que siempre quede lugar.
 */
function zonaCon(extra: (tipo: TipoPliego, l: "izq" | "der", m: Medidas) => Partial<Zona>, mg: number) {
  return (tipo: TipoPliego, l: "izq" | "der", m: Medidas): Partial<Zona> => {
    const e = extra(tipo, l, m);
    if (!esTitulo(tipo, l)) return e;
    const arriba = Math.max(zonaClasica()(tipo, l, m).arriba ?? 0, e.arriba ?? 0);
    const tope = pos(m.altoMm - 2 * mg - arriba - m.altoMm * 0.1);
    return { ...e, arriba, abajo: Math.min(e.abajo ?? 0, tope) };
  };
}

/**
 * Los títulos clásicos con algún retoque sólo en el título, y achicados si un texto largo no
 * entra a lo ancho de la página (en 20x30 la página es angosta).
 */
function textosCon(base: (tipo: TipoPliego, m: Medidas) => TextoDelEstilo[], ajustes: Partial<TextoDelEstilo> = {}) {
  return (tipo: TipoPliego, m: Medidas) =>
    base(tipo, m).map((t0) => {
      const t = t0.rol === "titulo" ? { ...t0, ...ajustes } : t0;
      const tam = (t.puntos * 25.4) / 72;
      const estimado = t.ejemplo.length * tam * (t.mayusculas ? 0.66 : 0.5);
      return estimado > t.w ? { ...t, puntos: (t.puntos * t.w) / estimado } : t;
    });
}

// ─── Piezas de dibujo de mascotas ────────────────────────────────────────────────────────────

/** Huellita: almohadilla y cuatro deditos. `giro` apunta los dedos (0 = hacia arriba). */
function huella(x: number, y: number, t: number, color: string, giro = 0, opacidad = 1): string {
  const dedos: [number, number, number][] = [
    [-0.36, -0.12, -18],
    [-0.13, -0.36, -6],
    [0.13, -0.36, 6],
    [0.36, -0.12, 18],
  ];
  let out = `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(giro)})" fill="${color}" opacity="${opacidad}">`;
  out += `<path d="M 0 ${r2(-0.02 * t)} C ${r2(0.22 * t)} ${r2(-0.02 * t)} ${r2(0.36 * t)} ${r2(0.2 * t)} ${r2(0.3 * t)} ${r2(0.3 * t)} C ${r2(0.24 * t)} ${r2(0.4 * t)} ${r2(0.1 * t)} ${r2(0.34 * t)} 0 ${r2(0.36 * t)} C ${r2(-0.1 * t)} ${r2(0.34 * t)} ${r2(-0.24 * t)} ${r2(0.4 * t)} ${r2(-0.3 * t)} ${r2(0.3 * t)} C ${r2(-0.36 * t)} ${r2(0.2 * t)} ${r2(-0.22 * t)} ${r2(-0.02 * t)} 0 ${r2(-0.02 * t)} Z"/>`;
  for (const [dx, dy, a] of dedos) out += `<ellipse cx="${r2(dx * t)}" cy="${r2(dy * t)}" rx="${r2(0.11 * t)}" ry="${r2(0.145 * t)}" transform="rotate(${a} ${r2(dx * t)} ${r2(dy * t)})"/>`;
  return `${out}</g>`;
}

/** Rastro de huellitas caminando de un punto a otro, alternando pata izquierda y derecha. */
function rastro(x0: number, y0: number, x1: number, y1: number, pasos: number, t: number, color: string, opacidad = 1): string {
  const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const nl = Math.hypot(nx, ny) || 1;
  let out = "";
  for (let i = 0; i < pasos; i++) {
    const k = pasos === 1 ? 0 : i / (pasos - 1);
    const s = (i % 2 === 0 ? 1 : -1) * t * 0.42;
    out += huella(x0 + (x1 - x0) * k + (nx / nl) * s, y0 + (y1 - y0) * k + (ny / nl) * s, t, color, ang + 90, opacidad);
  }
  return out;
}

/** Hueso: un cuerpo y dos lóbulos redondos en cada punta. Con `borde`, contorno de historieta. */
function hueso(x: number, y: number, L: number, color: string, giro = 0, grosor = 0.16, borde?: string): string {
  const g = L * grosor;
  const rr = g * 0.72;
  const e = L / 2 - rr;
  const formas = (extra: string) =>
    `<rect x="${r2(-e)}" y="${r2(-g / 2)}" width="${r2(2 * e)}" height="${r2(g)}"${extra}/>` +
    [[-e, -1], [-e, 1], [e, -1], [e, 1]].map(([cx, sy]) => `<circle cx="${r2(cx!)}" cy="${r2(sy! * g * 0.5)}" r="${r2(rr)}"${extra}/>`).join("");
  const contorno = borde ? `<g fill="${borde}" stroke="${borde}" stroke-width="${r2(g * 0.3)}">${formas("")}</g>` : "";
  return `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(giro)})">${contorno}<g fill="${color}">${formas("")}</g></g>`;
}

/** Ovillo de lana con sus vueltas de hilo. */
function ovillo(x: number, y: number, rr: number, color: string, linea: string): string {
  let out = `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(rr)}" fill="${color}"/><g fill="none" stroke="${linea}" stroke-width="${r2(rr * 0.06)}" stroke-linecap="round">`;
  const punto = (a: number) => [x + Math.cos((a * Math.PI) / 180) * rr * 0.96, y + Math.sin((a * Math.PI) / 180) * rr * 0.96] as const;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = punto(-150 + i * 22);
    const [bx, by] = punto(40 + i * 22);
    out += `<path d="M ${r2(ax)} ${r2(ay)} Q ${r2(x + rr * 0.2)} ${r2(y - rr * 0.2)} ${r2(bx)} ${r2(by)}"/>`;
  }
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = punto(110 + i * 25);
    const [bx, by] = punto(-20 + i * 25);
    out += `<path d="M ${r2(ax)} ${r2(ay)} Q ${r2(x - rr * 0.1)} ${r2(y + rr * 0.15)} ${r2(bx)} ${r2(by)}"/>`;
  }
  return `${out}</g>`;
}

/** Hilo suelto que serpentea por una línea horizontal. */
function hilo(x0: number, x1: number, y: number, amp: number, color: string, grosor: number): string {
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / (amp * 6)));
  const paso = (x1 - x0) / n;
  let d = `M ${r2(x0)} ${r2(y)}`;
  for (let i = 0; i < n; i++) d += ` q ${r2(paso / 2)} ${r2(i % 2 ? amp * 2 : -amp * 2)} ${r2(paso)} 0`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${r2(grosor)}" stroke-linecap="round"/>`;
}

/** Pescadito: cuerpo, cola y ojo. Mira a la izquierda (o a la derecha con `dir = -1`). */
function pescado(x: number, y: number, L: number, color: string, dir = 1, ojo = "#ffffff"): string {
  return `<g transform="translate(${r2(x)} ${r2(y)}) scale(${dir} 1)"><path d="M ${r2(0.28 * L)} 0 L ${r2(0.55 * L)} ${r2(-0.2 * L)} L ${r2(0.5 * L)} 0 L ${r2(0.55 * L)} ${r2(0.2 * L)} Z" fill="${color}"/><ellipse rx="${r2(0.36 * L)}" ry="${r2(0.19 * L)}" fill="${color}"/><circle cx="${r2(-0.2 * L)}" cy="${r2(-0.04 * L)}" r="${r2(0.04 * L)}" fill="${ojo}"/></g>`;
}

/** Espina de pescado (la de los dibujitos), en trazo. */
function espina(x: number, y: number, L: number, color: string, giro = 0): string {
  const g = L * 0.045;
  let out = `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(giro)})" fill="none" stroke="${color}" stroke-width="${r2(g)}" stroke-linecap="round" stroke-linejoin="round">`;
  out += `<path d="M ${r2(-0.25 * L)} 0 L ${r2(0.32 * L)} 0"/><path d="M ${r2(-0.25 * L)} 0 Q ${r2(-0.38 * L)} ${r2(-0.18 * L)} ${r2(-0.5 * L)} 0 Q ${r2(-0.38 * L)} ${r2(0.18 * L)} ${r2(-0.25 * L)} 0 Z"/>`;
  for (let i = 0; i < 4; i++) {
    const cx = -0.12 * L + i * 0.1 * L;
    const h = 0.15 * L * (1 - i * 0.15);
    out += `<path d="M ${r2(cx)} ${r2(-h)} Q ${r2(cx + 0.03 * L)} 0 ${r2(cx)} ${r2(h)}"/>`;
  }
  out += `<path d="M ${r2(0.32 * L)} 0 L ${r2(0.48 * L)} ${r2(-0.13 * L)} M ${r2(0.32 * L)} 0 L ${r2(0.48 * L)} ${r2(0.13 * L)}"/>`;
  return `${out}</g>`;
}

/** Silueta de gato sentado, de espaldas a la cola. `base` es el piso. */
function gatoSentado(x: number, base: number, u: number, color: string, mira = 1): string {
  return `<g transform="translate(${r2(x)} ${r2(base)}) scale(${mira} 1)" fill="${color}"><path d="M ${r2(-0.27 * u)} 0 C ${r2(-0.33 * u)} ${r2(-0.32 * u)} ${r2(-0.2 * u)} ${r2(-0.6 * u)} 0 ${r2(-0.62 * u)} C ${r2(0.2 * u)} ${r2(-0.6 * u)} ${r2(0.33 * u)} ${r2(-0.32 * u)} ${r2(0.27 * u)} 0 Z"/><circle cy="${r2(-0.74 * u)}" r="${r2(0.17 * u)}"/><path d="M ${r2(-0.16 * u)} ${r2(-0.8 * u)} L ${r2(-0.13 * u)} ${r2(-1 * u)} L ${r2(-0.03 * u)} ${r2(-0.89 * u)} Z M ${r2(0.16 * u)} ${r2(-0.8 * u)} L ${r2(0.13 * u)} ${r2(-1 * u)} L ${r2(0.03 * u)} ${r2(-0.89 * u)} Z"/><path d="M ${r2(0.2 * u)} ${r2(-0.04 * u)} C ${r2(0.52 * u)} 0 ${r2(0.52 * u)} ${r2(-0.3 * u)} ${r2(0.4 * u)} ${r2(-0.42 * u)}" fill="none" stroke="${color}" stroke-width="${r2(0.07 * u)}" stroke-linecap="round"/></g>`;
}

/** Silueta de perro sentado, de orejas caídas. */
function perroSentado(x: number, base: number, u: number, color: string, mira = 1): string {
  return `<g transform="translate(${r2(x)} ${r2(base)}) scale(${mira} 1)" fill="${color}"><path d="M ${r2(-0.27 * u)} 0 C ${r2(-0.31 * u)} ${r2(-0.3 * u)} ${r2(-0.2 * u)} ${r2(-0.56 * u)} ${r2(-0.02 * u)} ${r2(-0.6 * u)} C ${r2(0.14 * u)} ${r2(-0.6 * u)} ${r2(0.2 * u)} ${r2(-0.4 * u)} ${r2(0.24 * u)} 0 Z"/><rect x="${r2(0.06 * u)}" y="${r2(-0.42 * u)}" width="${r2(0.09 * u)}" height="${r2(0.42 * u)}" rx="${r2(0.04 * u)}"/><circle cx="${r2(0.02 * u)}" cy="${r2(-0.72 * u)}" r="${r2(0.16 * u)}"/><ellipse cx="${r2(0.18 * u)}" cy="${r2(-0.67 * u)}" rx="${r2(0.12 * u)}" ry="${r2(0.075 * u)}"/><ellipse cx="${r2(-0.1 * u)}" cy="${r2(-0.68 * u)}" rx="${r2(0.065 * u)}" ry="${r2(0.15 * u)}" transform="rotate(18 ${r2(-0.1 * u)} ${r2(-0.68 * u)})"/><path d="M ${r2(-0.22 * u)} ${r2(-0.06 * u)} C ${r2(-0.42 * u)} ${r2(-0.1 * u)} ${r2(-0.44 * u)} ${r2(-0.3 * u)} ${r2(-0.36 * u)} ${r2(-0.4 * u)}" fill="none" stroke="${color}" stroke-width="${r2(0.07 * u)}" stroke-linecap="round"/></g>`;
}

/** Gato que se asoma desde el borde de abajo: cabeza, orejas y dos patitas. */
function gatoAsomado(x: number, base: number, a: number, color: string, ojos: string): string {
  return `<g fill="${color}"><path d="M ${r2(x - 0.42 * a)} ${r2(base)} C ${r2(x - 0.44 * a)} ${r2(base - 0.42 * a)} ${r2(x + 0.44 * a)} ${r2(base - 0.42 * a)} ${r2(x + 0.42 * a)} ${r2(base)} Z"/><path d="M ${r2(x - 0.34 * a)} ${r2(base - 0.2 * a)} L ${r2(x - 0.3 * a)} ${r2(base - 0.48 * a)} L ${r2(x - 0.12 * a)} ${r2(base - 0.3 * a)} Z M ${r2(x + 0.34 * a)} ${r2(base - 0.2 * a)} L ${r2(x + 0.3 * a)} ${r2(base - 0.48 * a)} L ${r2(x + 0.12 * a)} ${r2(base - 0.3 * a)} Z"/><ellipse cx="${r2(x - 0.5 * a)}" cy="${r2(base - 0.03 * a)}" rx="${r2(0.12 * a)}" ry="${r2(0.07 * a)}"/><ellipse cx="${r2(x + 0.5 * a)}" cy="${r2(base - 0.03 * a)}" rx="${r2(0.12 * a)}" ry="${r2(0.07 * a)}"/><ellipse cx="${r2(x - 0.14 * a)}" cy="${r2(base - 0.14 * a)}" rx="${r2(0.045 * a)}" ry="${r2(0.06 * a)}" fill="${ojos}"/><ellipse cx="${r2(x + 0.14 * a)}" cy="${r2(base - 0.14 * a)}" rx="${r2(0.045 * a)}" ry="${r2(0.06 * a)}" fill="${ojos}"/></g>`;
}

/** Gato enroscado durmiendo: cuerpo, cabeza apoyada y la cola rodeándolo. */
function gatoDurmiendo(x: number, y: number, u: number, color: string): string {
  return `<g fill="${color}"><ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(0.5 * u)}" ry="${r2(0.27 * u)}"/><circle cx="${r2(x + 0.38 * u)}" cy="${r2(y - 0.06 * u)}" r="${r2(0.19 * u)}"/><path d="M ${r2(x + 0.24 * u)} ${r2(y - 0.14 * u)} L ${r2(x + 0.25 * u)} ${r2(y - 0.36 * u)} L ${r2(x + 0.38 * u)} ${r2(y - 0.24 * u)} Z M ${r2(x + 0.44 * u)} ${r2(y - 0.24 * u)} L ${r2(x + 0.56 * u)} ${r2(y - 0.34 * u)} L ${r2(x + 0.56 * u)} ${r2(y - 0.12 * u)} Z"/><path d="M ${r2(x - 0.46 * u)} ${r2(y + 0.06 * u)} Q ${r2(x - 0.36 * u)} ${r2(y + 0.4 * u)} ${r2(x + 0.3 * u)} ${r2(y + 0.24 * u)}" fill="none" stroke="${color}" stroke-width="${r2(0.09 * u)}" stroke-linecap="round"/></g>`;
}

/** Cucha de madera: paredes, techo a dos aguas y puerta en arco. */
function cucha(x: number, base: number, w: number, pared: string, techo: string, puerta: string): string {
  let out = `<rect x="${r2(x - 0.4 * w)}" y="${r2(base - 0.56 * w)}" width="${r2(0.8 * w)}" height="${r2(0.56 * w)}" fill="${pared}"/>`;
  for (let i = 1; i < 4; i++) out += `<line x1="${r2(x - 0.4 * w)}" y1="${r2(base - 0.14 * w * i)}" x2="${r2(x + 0.4 * w)}" y2="${r2(base - 0.14 * w * i)}" stroke="${techo}" stroke-width="${r2(w * 0.008)}" opacity="0.35"/>`;
  out += `<path d="M ${r2(x - 0.52 * w)} ${r2(base - 0.5 * w)} L ${r2(x)} ${r2(base - 0.95 * w)} L ${r2(x + 0.52 * w)} ${r2(base - 0.5 * w)} L ${r2(x + 0.44 * w)} ${r2(base - 0.46 * w)} L ${r2(x)} ${r2(base - 0.82 * w)} L ${r2(x - 0.44 * w)} ${r2(base - 0.46 * w)} Z" fill="${techo}"/>`;
  out += arco(x, base, 0.34 * w, 0.4 * w, puerta);
  return out;
}

/** Platito de comida. */
function platito(x: number, base: number, w: number, color: string, comida: string): string {
  return `<ellipse cx="${r2(x)}" cy="${r2(base - w * 0.22)}" rx="${r2(w * 0.42)}" ry="${r2(w * 0.08)}" fill="${comida}"/><path d="M ${r2(x - w / 2)} ${r2(base - w * 0.22)} L ${r2(x + w / 2)} ${r2(base - w * 0.22)} L ${r2(x + w * 0.38)} ${r2(base)} L ${r2(x - w * 0.38)} ${r2(base)} Z" fill="${color}"/>`;
}

/** Cerco de tablitas con travesaño. */
function cerco(x0: number, x1: number, base: number, alto: number, color: string, sombra: string): string {
  const w = alto * 0.22;
  let out = `<rect x="${r2(x0)}" y="${r2(base - alto * 0.62)}" width="${r2(x1 - x0)}" height="${r2(alto * 0.1)}" fill="${sombra}"/><rect x="${r2(x0)}" y="${r2(base - alto * 0.28)}" width="${r2(x1 - x0)}" height="${r2(alto * 0.1)}" fill="${sombra}"/>`;
  for (let x = x0 + w * 0.3; x < x1 - w * 0.5; x += w * 1.7) {
    out += `<path d="M ${r2(x)} ${r2(base)} L ${r2(x)} ${r2(base - alto * 0.85)} L ${r2(x + w / 2)} ${r2(base - alto)} L ${r2(x + w)} ${r2(base - alto * 0.85)} L ${r2(x + w)} ${r2(base)} Z" fill="${color}" stroke="${sombra}" stroke-width="${r2(w * 0.08)}"/>`;
  }
  return out;
}

/** Pasto: una franja con matas de hojitas puntiagudas. */
function pasto(x0: number, x1: number, base: number, alto: number, color: string, claro: string, semilla: number): string {
  const rnd = azar(semilla);
  let d = `M ${r2(x0)} ${r2(base)} L ${r2(x0)} ${r2(base - alto * 0.45)}`;
  for (let x = x0; x < x1; ) {
    const w = alto * (0.18 + rnd() * 0.14);
    d += ` L ${r2(Math.min(x + w / 2, x1))} ${r2(base - alto * (0.65 + rnd() * 0.35))} L ${r2(Math.min(x + w, x1))} ${r2(base - alto * 0.45)}`;
    x += w;
  }
  return `<path d="${d} L ${r2(x1)} ${r2(base)} Z" fill="${color}"/><rect x="${r2(x0)}" y="${r2(base - alto * 0.2)}" width="${r2(x1 - x0)}" height="${r2(alto * 0.2)}" fill="${claro}" opacity="0.35"/>`;
}

/** Collar: una correa con costura, hebilla y argolla con chapita colgando. */
function collar(x0: number, x1: number, y: number, g: number, cuero: string, metal: string, hebillaEn: number, chapaEn: number): string {
  let out = `<rect x="${r2(x0)}" y="${r2(y - g / 2)}" width="${r2(x1 - x0)}" height="${r2(g)}" fill="${cuero}"/>`;
  out += `<line x1="${r2(x0)}" y1="${r2(y - g * 0.3)}" x2="${r2(x1)}" y2="${r2(y - g * 0.3)}" stroke="#ffffff" stroke-width="${r2(g * 0.04)}" stroke-dasharray="${r2(g * 0.18)} ${r2(g * 0.12)}" opacity="0.6"/><line x1="${r2(x0)}" y1="${r2(y + g * 0.3)}" x2="${r2(x1)}" y2="${r2(y + g * 0.3)}" stroke="#ffffff" stroke-width="${r2(g * 0.04)}" stroke-dasharray="${r2(g * 0.18)} ${r2(g * 0.12)}" opacity="0.6"/>`;
  out += `<rect x="${r2(hebillaEn - g * 0.45)}" y="${r2(y - g * 0.75)}" width="${r2(g * 0.9)}" height="${r2(g * 1.5)}" rx="${r2(g * 0.18)}" fill="none" stroke="${metal}" stroke-width="${r2(g * 0.16)}"/><line x1="${r2(hebillaEn)}" y1="${r2(y - g * 0.7)}" x2="${r2(hebillaEn)}" y2="${r2(y + g * 0.7)}" stroke="${metal}" stroke-width="${r2(g * 0.12)}"/>`;
  for (let i = 1; i <= 3; i++) out += `<circle cx="${r2(hebillaEn + g * 0.9 * i)}" cy="${r2(y)}" r="${r2(g * 0.09)}" fill="#ffffff" opacity="0.7"/>`;
  out += `<circle cx="${r2(chapaEn)}" cy="${r2(y + g * 0.75)}" r="${r2(g * 0.3)}" fill="none" stroke="${metal}" stroke-width="${r2(g * 0.12)}"/>`;
  out += `<circle cx="${r2(chapaEn)}" cy="${r2(y + g * 1.75)}" r="${r2(g * 0.75)}" fill="${metal}"/>`;
  out += huellaChica(chapaEn, y + g * 1.78, g * 0.75);
  return out;
}

function huellaChica(x: number, y: number, t: number): string {
  return huella(x, y, t, "#ffffff", 0, 0.75);
}

function corazon(x: number, y: number, t: number, color: string, giro = 0, opacidad = 1): string {
  return `<path d="M 0 ${r2(0.35 * t)} C ${r2(-0.55 * t)} ${r2(-0.05 * t)} ${r2(-0.35 * t)} ${r2(-0.5 * t)} 0 ${r2(-0.22 * t)} C ${r2(0.35 * t)} ${r2(-0.5 * t)} ${r2(0.55 * t)} ${r2(-0.05 * t)} 0 ${r2(0.35 * t)} Z" fill="${color}" opacity="${opacidad}" transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(giro)})"/>`;
}

/** Luna en cuarto: un círculo menos otro corrido (con máscara). */
function lunaCreciente(id: string, x: number, y: number, rr: number, color: string): { defs: string; cuerpo: string } {
  return {
    defs: `<mask id="${id}"><rect x="${r2(x - rr * 2)}" y="${r2(y - rr * 2)}" width="${r2(rr * 4)}" height="${r2(rr * 4)}" fill="#ffffff"/><circle cx="${r2(x + rr * 0.45)}" cy="${r2(y - rr * 0.25)}" r="${r2(rr * 0.85)}" fill="#000000"/></mask>`,
    cuerpo: `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(rr)}" fill="${color}" mask="url(#${id})"/>`,
  };
}

/** Burbujas: circulitos huecos al azar en un área. */
function burbujas(x: number, y: number, w: number, h: number, n: number, color: string, t: number, semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) out += `<circle cx="${r2(x + rnd() * w)}" cy="${r2(y + rnd() * h)}" r="${r2(t * (0.4 + rnd()))}" fill="none" stroke="${color}" stroke-width="${r2(t * 0.18)}" opacity="0.7"/>`;
  return out;
}

/** Recorre el contorno de una página a una distancia del borde y devuelve puntos repartidos. */
function puntosDelBorde(x: number, y: number, w: number, h: number, paso: number): [number, number][] {
  const out: [number, number][] = [];
  const nx = Math.max(2, Math.round(w / paso));
  const ny = Math.max(2, Math.round(h / paso));
  for (let i = 0; i < nx; i++) out.push([x + (w * i) / nx, y], [x + (w * (i + 1)) / nx, y + h]);
  for (let i = 1; i < ny; i++) out.push([x, y + (h * i) / ny], [x + w, y + (h * (ny - i)) / ny]);
  return out;
}

// ─── Los estilos ─────────────────────────────────────────────────────────────────────────────

export const MASCOTAS: EstiloFotolibro[] = [
  {
    id: "mascotas-01-huellitas",
    tema: "mascotas",
    nombre: "Huellitas",
    descripcion: "Papel crema con un rastro de huellitas que camina por todo el libro.",
    papel: "#fbf6ee",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const t = s * 0.06;
      const g = grano("g", m, 0.05);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbf6ee");
      const yb = m.altoMm - s * 0.07;
      if (tipo === "apertura" || tipo === "interior-alt") {
        const pasos = Math.round(m.anchoMm / (t * 1.6));
        c += rastro(s * 0.06, yb, m.anchoMm - s * 0.06, yb, pasos, t, tipo === "apertura" ? "#c08552" : "#d9a77a");
      } else if (tipo === "interior") {
        c += rastro(izq.x + s * 0.03, s * 0.2, izq.x + s * 0.22, s * 0.03, 4, t * 0.9, "#d9a77a");
        c += rastro(der.x + der.w - s * 0.22, der.h - s * 0.03, der.x + der.w - s * 0.03, der.h - s * 0.2, 4, t * 0.9, "#d9a77a");
      } else {
        c += rastro(s * 0.06, yb, der.x + der.w * 0.62, yb, Math.round((der.x + der.w * 0.6) / (t * 1.6)), t, "#c08552");
        c += corazon(der.x + der.w * 0.72, yb - t * 0.1, t * 1.3, "#d86f5c");
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      if (tipo === "interior") return l === "izq" ? { arriba: pos(s * 0.2 - 14 + 2) } : { abajo: pos(s * 0.2 - 14 + 2) };
      return { abajo: pos(s * 0.11 - 14 + 3) };
    }, 14),
    textos: textosCon(textosClasicos({ titulo: "Pacifico", texto: "Quicksand", color: "#6b4226", acento: "#c08552", escalaTitulo: 0.12, ejemplos: { titulo: "Toby, mi mejor amigo", subtitulo: "Sus primeros años", fecha: "2023 – 2026", frase: "Huellitas para siempre" } })),
  },
  {
    id: "mascotas-02-huesitos-pastel",
    tema: "mascotas",
    nombre: "Huesitos pastel",
    descripcion: "Verde agua con guardas de huesitos y un gran hueso para el título.",
    papel: "#e6f4ef",
    margenMm: 14,
    esquinasMm: 3,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const colores = ["#ffffff", "#f6c1a6", "#f9e29c"];
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#e6f4ef");
      const L = s * 0.065;
      const paso = s * 0.1;
      const guarda = (y: number, x0: number, x1: number, sem: number) => {
        let out = "";
        for (let i = 0, x = x0 + paso / 2; x < x1; i++, x += paso) out += hueso(x, y, L, colores[(i + sem) % 3]!, i % 2 ? 25 : -25);
        return out;
      };
      const col = (x: number, sem: number) => {
        let out = "";
        for (let i = 0, y = paso / 2; y < m.altoMm; i++, y += paso) out += hueso(x, y, L, colores[(i + sem) % 3]!, i % 2 ? 65 : 115);
        return out;
      };
      if (tipo === "interior-alt") c += col(izq.x + s * 0.05, 0) + col(der.x + der.w - s * 0.05, 1);
      else c += guarda(s * 0.05, 0, m.anchoMm, 0) + guarda(m.altoMm - s * 0.05, 0, m.anchoMm, 1);
      const grande = (pg: typeof izq, y: number) => hueso(pg.x + pg.w / 2, y, pg.w * 0.86, "#ffffff", 0, Math.min(m.altoMm * 0.15, pg.w * 0.17) / (pg.w * 0.86));
      if (tipo === "apertura") c += grande(izq, m.altoMm * 0.44);
      if (tipo === "cierre") c += grande(der, m.altoMm * 0.19);
      return svg(m, c);
    },
    zona: zonaCon((tipo, _l, m) => {
      const s = lado(m);
      const b = pos(s * 0.09 - 14 + 2);
      return tipo === "interior-alt" ? { exterior: b } : { arriba: b, abajo: b };
    }, 14),
    textos: textosCon(textosClasicos({ titulo: "Patrick Hand", texto: "Nunito", color: "#2f5d62", acento: "#d9825b", escalaTitulo: 0.11, ejemplos: { titulo: "Lola", subtitulo: "Mi perrita compañera", fecha: "Marzo 2026", frase: "Amor de cuatro patas" } })),
  },
  {
    id: "mascotas-03-michi-ovillos",
    tema: "mascotas",
    nombre: "Michi y ovillos",
    descripcion: "Lavanda suave, ovillos de lana con su hilo suelto y un michi en silueta.",
    papel: "#efe8f5",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#efe8f5");
      const yh = m.altoMm - s * 0.035;
      const rr = s * 0.06;
      if (tipo === "apertura") {
        c += hilo(izq.x + s * 0.2, der.x + der.w - s * 0.1, yh, s * 0.012, "#c4627f", s * 0.006);
        c += gatoSentado(izq.x + s * 0.13, m.altoMm - s * 0.02, s * 0.28, "#3d3550", 1);
        c += ovillo(der.x + der.w - s * 0.09, m.altoMm - rr - s * 0.02, rr, "#e88ca6", "#c4627f");
      } else if (tipo === "interior") {
        c += hilo(izq.x + s * 0.12, der.x + der.w * 0.7, yh, s * 0.01, "#4f9c95", s * 0.005);
        c += ovillo(izq.x + s * 0.08, m.altoMm - rr - s * 0.02, rr, "#6cb7b0", "#4f9c95");
      } else if (tipo === "interior-alt") {
        c += hilo(izq.x + s * 0.12, der.x + der.w - s * 0.26, yh, s * 0.01, "#c4627f", s * 0.005);
        c += ovillo(izq.x + s * 0.08, m.altoMm - rr - s * 0.02, rr * 0.85, "#e88ca6", "#c4627f");
        c += gatoAsomado(der.x + der.w - s * 0.16, m.altoMm, s * 0.2, "#3d3550", "#f3d36b");
      } else {
        c += hilo(izq.x + s * 0.1, der.x + der.w - s * 0.24, yh, s * 0.012, "#4f9c95", s * 0.006);
        c += ovillo(der.x + der.w - s * 0.3, m.altoMm - rr * 0.8 - s * 0.02, rr * 0.8, "#6cb7b0", "#4f9c95");
        c += gatoSentado(der.x + der.w - s * 0.12, m.altoMm - s * 0.02, s * 0.28, "#3d3550", -1);
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const base = { abajo: pos(s * 0.13 - 14 + 2) };
      if (tipo === "interior-alt" && l === "der") return { abajo: pos(s * 0.15 - 14 + 2) };
      if (tipo === "apertura" && l === "der") return { ...base, exterior: 0 };
      return base;
    }, 14),
    textos: textosCon(textosClasicos({ titulo: "Caveat", texto: "Quicksand", color: "#3d3550", acento: "#c4627f", escalaTitulo: 0.14, ejemplos: { titulo: "La vida con Michi", subtitulo: "Siete vidas, mil fotos", fecha: "Mayo 2026", frase: "Ronroneos y siestas" } })),
  },
  {
    id: "mascotas-04-pescaditos",
    tema: "mascotas",
    nombre: "Pescaditos",
    descripcion: "Azul profundo y agua clara con pescaditos y burbujas: un festín para gatos.",
    papel: "#e3f3f6",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#e3f3f6");
      const pecera = (pg: typeof izq, sem: number) => {
        const rnd = azar(sem);
        let out = fondoLiso(pg, "#1d3557");
        const L = s * 0.07;
        for (let x = pg.x + L; x < pg.x + pg.w - L * 0.6; x += L * 1.5) {
          out += pescado(x, s * 0.07 + (rnd() - 0.5) * s * 0.03, L, rnd() > 0.5 ? "#f4a68c" : "#7fc8d6", rnd() > 0.5 ? 1 : -1, "#1d3557");
          out += pescado(x + L * 0.5, pg.h - s * 0.07 + (rnd() - 0.5) * s * 0.03, L, rnd() > 0.5 ? "#f4a68c" : "#f1e3b3", rnd() > 0.5 ? 1 : -1, "#1d3557");
        }
        out += burbujas(pg.x, s * 0.12, pg.w, pg.h * 0.12, 8, "#7fc8d6", s * 0.008, sem + 3);
        return out;
      };
      const columna = (x: number, sem: number) => {
        const rnd = azar(sem);
        let out = "";
        const L = s * 0.075;
        for (let i = 0, y = s * 0.08; y < m.altoMm - s * 0.04; i++, y += L * 1.2) out += pescado(x + (i % 2 ? L * 0.15 : -L * 0.15), y, L, ["#f4a68c", "#1d3557", "#4fa3b5"][Math.floor(rnd() * 3)]!, i % 2 ? 1 : -1);
        return out;
      };
      if (tipo === "apertura") c += pecera(izq, 5) + columna(der.x + der.w - s * 0.07, 9);
      else if (tipo === "cierre") c += pecera(der, 7) + columna(izq.x + s * 0.07, 11);
      else if (tipo === "interior") {
        c += columna(izq.x + s * 0.07, 13) + columna(der.x + der.w - s * 0.07, 17);
        c += burbujas(izq.x + s * 0.02, 0, s * 0.1, m.altoMm, 6, "#4fa3b5", s * 0.008, 4);
      } else {
        c += espina(izq.x + s * 0.12, s * 0.07, s * 0.16, "#1d3557", -20) + espina(der.x + der.w - s * 0.12, der.h - s * 0.07, s * 0.16, "#1d3557", 160);
        c += burbujas(izq.x + s * 0.03, s * 0.1, s * 0.12, s * 0.12, 5, "#4fa3b5", s * 0.009, 8) + burbujas(der.x + der.w - s * 0.15, der.h - s * 0.24, s * 0.12, s * 0.12, 5, "#4fa3b5", s * 0.009, 6);
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      if (esTitulo(tipo, l)) return { abajo: s * 0.1 };
      if (tipo === "interior-alt") return l === "izq" ? { arriba: pos(s * 0.13 - 14 + 2) } : { abajo: pos(s * 0.13 - 14 + 2) };
      return { exterior: pos(s * 0.12 - 14 + 2) };
    }, 14),
    textos: textosCon((tipo, m) =>
      textosClasicos({ titulo: "Handlee", texto: "Rubik", color: "#fdf6e3", acento: "#f4a68c", escalaTitulo: 0.12, ejemplos: { titulo: "Simba", subtitulo: "El rey de la casa", fecha: "Junio 2026", frase: "Gracias por elegirnos" } })(tipo, m),
    ),
  },
  {
    id: "mascotas-05-cucha-y-jardin",
    tema: "mascotas",
    nombre: "Cucha y jardín",
    descripcion: "Cielo celeste, pasto, cerquito blanco y la cucha con su platito.",
    papel: "#eef7fc",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const cielo = degradado("c", { x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#d9eefa", "#fbfaf2");
      let c = cielo.cuerpo;
      const pz = s * 0.06;
      if (tipo !== "interior-alt") c += cerco(0, m.anchoMm, m.altoMm - pz * 0.6, s * 0.09, "#ffffff", "#c9d6dc");
      c += pasto(0, m.anchoMm, m.altoMm, pz, "#8cc56a", "#5e9e43", tipo === "interior-alt" ? 9 : 3);
      const nube = (x: number, y: number, k: number) => `<g fill="#ffffff"><ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(k)}" ry="${r2(k * 0.4)}"/><circle cx="${r2(x - k * 0.3)}" cy="${r2(y - k * 0.2)}" r="${r2(k * 0.35)}"/><circle cx="${r2(x + k * 0.2)}" cy="${r2(y - k * 0.28)}" r="${r2(k * 0.42)}"/></g>`;
      if (tipo === "apertura") {
        c += nube(izq.x + izq.w * 0.22, s * 0.1, s * 0.07) + nube(izq.x + izq.w * 0.78, s * 0.16, s * 0.05);
        c += cucha(izq.x + izq.w * 0.7, m.altoMm - pz * 0.5, s * 0.3, "#d9824f", "#8c4a2f", "#4a2a1c");
        c += platito(izq.x + izq.w * 0.3, m.altoMm - pz * 0.5, s * 0.1, "#3f7fbf", "#b0703f");
      } else if (tipo === "cierre") {
        c += nube(der.x + der.w * 0.8, s * 0.08, s * 0.05);
        c += cucha(der.x + der.w * 0.3, m.altoMm - pz * 0.5, s * 0.3, "#d9824f", "#8c4a2f", "#4a2a1c");
        c += hueso(der.x + der.w * 0.66, m.altoMm - pz * 0.7, s * 0.1, "#ffffff", -12, 0.2, "#c9d6dc");
      } else if (tipo === "interior-alt") {
        c += platito(izq.x + s * 0.1, m.altoMm - pz * 0.5, s * 0.1, "#3f7fbf", "#b0703f");
        c += hueso(der.x + der.w - s * 0.12, m.altoMm - pz * 0.7, s * 0.1, "#ffffff", 15, 0.2, "#c9d6dc");
      }
      return svg(m, c, cielo.defs);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      if (esTitulo(tipo, l)) return { abajo: s * 0.3 };
      return { abajo: pos(s * (tipo === "interior-alt" ? 0.08 : 0.12) - 14 + 2) };
    }, 14),
    textos: textosCon(textosClasicos({ titulo: "Kalam", texto: "Ubuntu", color: "#2e4a62", acento: "#8c4a2f", escalaTitulo: 0.12, posicion: "arriba", ejemplos: { titulo: "Rocco", subtitulo: "Las aventuras de un perro feliz", fecha: "Abril 2026", frase: "Hogar es donde está tu perro" } })),
  },
  {
    id: "mascotas-06-collar-rojo",
    tema: "mascotas",
    nombre: "Collar rojo",
    descripcion: "Blanco y minimalista, con un collar rojo de cuero y la chapita dorada.",
    papel: "#ffffff",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = s * 0.055;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#ffffff");
      if (tipo === "apertura") c += collar(izq.x, izq.x + izq.w, m.altoMm * 0.14, g, "#c0392b", "#d4a24c", izq.x + izq.w * 0.22, izq.x + izq.w / 2);
      else if (tipo === "interior-alt") c += collar(der.x, der.x + der.w, s * 0.05, g * 0.8, "#c0392b", "#d4a24c", der.x + der.w * 0.18, der.x + der.w * 0.84);
      else if (tipo === "cierre") c += collar(der.x, der.x + der.w, m.altoMm - s * 0.2, g, "#c0392b", "#d4a24c", der.x + der.w * 0.2, der.x + der.w / 2);
      else {
        // Interior: una correa fina que cruza abajo y termina en el mosquetón.
        const y = m.altoMm - s * 0.04;
        c += `<path d="M ${r2(izq.x + s * 0.04)} ${r2(y)} L ${r2(der.x + der.w - s * 0.08)} ${r2(y)}" stroke="#c0392b" stroke-width="${r2(g * 0.4)}" stroke-linecap="round"/>`;
        c += `<circle cx="${r2(der.x + der.w - s * 0.06)}" cy="${r2(y)}" r="${r2(g * 0.4)}" fill="none" stroke="#d4a24c" stroke-width="${r2(g * 0.15)}"/>`;
        c += `<circle cx="${r2(izq.x + s * 0.04)}" cy="${r2(y)}" r="${r2(g * 0.35)}" fill="#d4a24c"/>`;
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      if (tipo === "interior-alt") return l === "der" ? { arriba: pos(s * 0.2 - 15 + 2) } : {};
      if (tipo === "interior") return { abajo: pos(s * 0.06 - 15 + 2) };
      if (tipo === "cierre" && l === "der") return { abajo: s * 0.3 };
      return {};
    }, 15),
    textos: textosCon(textosClasicos({ titulo: "Playfair Display", texto: "Montserrat", color: "#222222", acento: "#c0392b", escalaTitulo: 0.11, ejemplos: { titulo: "Bruno", subtitulo: "Diez años de lealtad", fecha: "2016 – 2026", frase: "El mejor amigo que tuvimos" } }), { italica: true }),
  },
  {
    id: "mascotas-07-siluetas-boho",
    tema: "mascotas",
    nombre: "Perro y gato boho",
    descripcion: "Arcos terracota, espigas de pampa y siluetas de perro y gato en tonos tierra.",
    papel: "#f3e9dc",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f3e9dc");
      if (tipo === "apertura" || tipo === "cierre") {
        const pg = tipo === "apertura" ? izq : der;
        c += arco(pg.x + pg.w / 2, pg.h * 0.95, Math.min(pg.w * 0.66, pg.h * 0.6), pg.h * 0.8, "#e6cdb4");
        c += perroSentado(pg.x + pg.w / 2 - s * 0.09, pg.h * 0.95, s * 0.24, "#b5653f", 1);
        c += gatoSentado(pg.x + pg.w / 2 + s * 0.1, pg.h * 0.95, s * 0.2, "#6f5845", -1);
        c += `<line x1="${r2(pg.x + pg.w * 0.12)}" y1="${r2(pg.h * 0.95)}" x2="${r2(pg.x + pg.w * 0.88)}" y2="${r2(pg.h * 0.95)}" stroke="#b5653f" stroke-width="0.5"/>`;
        const otra = tipo === "apertura" ? der : izq;
        c += pampa(otra.x + otra.w * (tipo === "apertura" ? 0.97 : 0.03), otra.h * 0.99, s * 0.32, tipo === "apertura" ? -110 : -70, "#c9a27c", 5);
      } else if (tipo === "interior") {
        c += arco(der.x + der.w - s * 0.1, der.h, s * 0.15, s * 0.32, "#d79a78", 0.8);
        c += gatoSentado(der.x + der.w - s * 0.1, der.h - s * 0.02, s * 0.17, "#6f5845", -1);
        c += pampa(izq.x + s * 0.02, s * 0.02, s * 0.28, 50, "#c9a27c", 3);
      } else {
        c += arco(izq.x + s * 0.1, izq.h, s * 0.15, s * 0.32, "#d79a78", 0.8);
        c += perroSentado(izq.x + s * 0.1, izq.h - s * 0.02, s * 0.2, "#b5653f", 1);
        c += pampa(der.x + der.w - s * 0.02, s * 0.02, s * 0.28, 130, "#c9a27c", 8);
      }
      return svg(m, c);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      if (esTitulo(tipo, l)) return { abajo: m.altoMm * 0.3 };
      if (tipo === "apertura" || tipo === "cierre") return { exterior: pos(s * 0.14 - 15 + 2) };
      return { exterior: pos(s * 0.19 - 15 + 2) };
    }, 15),
    textos: textosCon(textosClasicos({ titulo: "Parisienne", texto: "Raleway", color: "#7a4a32", acento: "#b5653f", escalaTitulo: 0.11, posicion: "arriba", ejemplos: { titulo: "Nala y Pancho", subtitulo: "Hermanos de otra especie", fecha: "Septiembre 2026", frase: "La casa es más linda con ellos" } })),
  },
  {
    id: "mascotas-08-pop-divertido",
    tema: "mascotas",
    nombre: "Pop divertido",
    descripcion: "Amarillo pleno, marco negro grueso y una guarda loca de huesos y huellas de colores.",
    papel: "#ffd84d",
    margenMm: 15,
    esquinasMm: 2,
    separacionMm: 5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const B = s * 0.1;
      const colores = ["#ff6fa5", "#4d9de0", "#222222", "#ffffff"];
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#ffd84d");
      const guarda = (pg: typeof izq, sem: number, soloArribaAbajo: boolean) => {
        const rnd = azar(sem);
        let out = "";
        const pts = puntosDelBorde(pg.x + B / 2, B / 2, pg.w - B, pg.h - B, s * 0.1).filter(([, y]) => !soloArribaAbajo || y < B || y > pg.h - B);
        pts.forEach(([x, y], i) => {
          const col = colores[Math.floor(rnd() * colores.length)]!;
          out += i % 2 ? hueso(x, y, s * 0.075, col, rnd() * 180, 0.18, "#222222") : huella(x, y, s * 0.05, col, (rnd() - 0.5) * 70);
        });
        out += `<rect x="${r2(pg.x + B)}" y="${r2(B)}" width="${r2(pg.w - 2 * B)}" height="${r2(pg.h - 2 * B)}" rx="${r2(s * 0.02)}" fill="none" stroke="#222222" stroke-width="${r2(s * 0.008)}"/>`;
        return out;
      };
      c += guarda(izq, tipo === "interior-alt" ? 13 : 3, false) + guarda(der, tipo === "interior-alt" ? 19 : 7, false);
      const tarjeta = (pg: typeof izq) =>
        `<rect x="${r2(pg.x + pg.w * 0.16 + s * 0.008)}" y="${r2(pg.h * 0.25 + s * 0.008)}" width="${r2(pg.w * 0.68)}" height="${r2(pg.h * 0.4)}" rx="${r2(s * 0.03)}" fill="#222222"/><rect x="${r2(pg.x + pg.w * 0.16)}" y="${r2(pg.h * 0.25)}" width="${r2(pg.w * 0.68)}" height="${r2(pg.h * 0.4)}" rx="${r2(s * 0.03)}" fill="#ffffff" stroke="#222222" stroke-width="${r2(s * 0.008)}"/>`;
      if (tipo === "apertura") c += tarjeta(izq);
      if (tipo === "cierre") c += `<rect x="${r2(der.x + der.w * 0.16)}" y="${r2(der.h * 0.09)}" width="${r2(der.w * 0.68)}" height="${r2(der.h * 0.15)}" rx="${r2(s * 0.03)}" fill="#ffffff" stroke="#222222" stroke-width="${r2(s * 0.008)}"/>`;
      // En el interior alternado el marco va en rosa, para variar.
      if (tipo === "interior-alt") c = c.replace(/stroke="#222222" stroke-width="([\d.]+)"\/>/g, 'stroke="#e0457f" stroke-width="$1"/>');
      return svg(m, c);
    },
    zona: zonaCon((tipo, _l, m) => {
      const b = pos(lado(m) * 0.1 - 15 + 4);
      return { arriba: b, abajo: b, exterior: b, interior: b };
    }, 15),
    textos: (tipo, m) =>
      textosCon(textosClasicos({ titulo: "Permanent Marker", texto: "Poppins", color: "#222222", acento: "#e0457f", escalaTitulo: 0.1, ejemplos: { titulo: "¡Hola, soy Coco!", subtitulo: "Mi primer año", fecha: "2026", frase: "Travesuras garantizadas" } }))(tipo, m).map((t) => {
        // En la apertura los textos van adentro de la tarjeta blanca.
        const w = m.anchoMm / 2;
        return tipo === "apertura" ? { ...t, x: w * 0.2, w: w * 0.6, puntos: t.puntos * Math.min(1, (w * 0.6) / t.w) } : t;
      }),
  },
  {
    id: "mascotas-09-acuarela-tierna",
    tema: "mascotas",
    nombre: "Acuarela tierna",
    descripcion: "Manchas de acuarela durazno y celeste con huellitas y corazones.",
    papel: "#fffaf5",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const g = grano("g", m, 0.05);
      const k = fuerte(tipo) ? 1 : 0.7;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fffaf5");
      const rincon = (x: number, y: number, dx: number, dy: number, color: string, sem: number) => {
        let out = manchaAcuarela(x, y, s * 0.34 * k, color, "a", sem, 4);
        out += manchaAcuarela(x + dx * s * 0.16 * k, y + dy * s * 0.08 * k, s * 0.18 * k, color === "#a8c8e0" ? "#c9b3dd" : "#f2a98f", "a", sem + 5, 3);
        out += rastro(x + dx * s * 0.04, y + dy * s * 0.04, x + dx * s * 0.24 * k, y + dy * s * 0.14 * k, 4, s * 0.05 * k, "#b8735c", 0.8);
        out += corazon(x + dx * s * 0.08 * k, y + dy * s * 0.2 * k, s * 0.03, "#e8908a", dx * 12, 0.8);
        return out;
      };
      if (tipo === "interior-alt") {
        c += rincon(der.x + der.w - s * 0.04, s * 0.04, -1, 1, "#a8c8e0", 4) + rincon(izq.x + s * 0.04, izq.h - s * 0.04, 1, -1, "#f4c7b0", 9);
      } else {
        c += rincon(izq.x + s * 0.04, s * 0.04, 1, 1, "#f4c7b0", 3) + rincon(der.x + der.w - s * 0.04, der.h - s * 0.04, -1, -1, "#a8c8e0", 7);
      }
      return svg(m, c + g.cuerpo, filtroAcuarela("a", 5) + g.defs);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      const k = fuerte(tipo) ? 1 : 0.7;
      const r = pos(s * 0.3 * k - 16 + 2);
      if (tipo === "interior-alt") return l === "der" ? { arriba: r } : { abajo: r };
      return l === "izq" ? { arriba: r } : { abajo: r };
    }, 16),
    textos: textosCon(textosClasicos({ titulo: "Dancing Script", texto: "Lora", color: "#8a5a4a", acento: "#c9826a", escalaTitulo: 0.12, ejemplos: { titulo: "Mi gordita Luna", subtitulo: "Bienvenida a la familia", fecha: "Febrero 2026", frase: "Te elegimos y nos elegiste" } })),
  },
  {
    id: "mascotas-10-siesta-luna",
    tema: "mascotas",
    nombre: "Siesta bajo la luna",
    descripcion: "Azul noche con estrellas, luna en cuarto y un gato que duerme enroscado.",
    papel: "#1b2340",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const cielo = degradado("c", total, "#151c36", "#2b3561");
      let defs = cielo.defs;
      let c = cielo.cuerpo + estrellas(total, "#f6e7b0", Math.round(m.anchoMm / (fuerte(tipo) ? 6 : 12)), tipo === "interior-alt" ? 19 : 7, s * 0.014);
      const luna = (id: string, x: number, y: number, rr: number) => {
        const l = lunaCreciente(id, x, y, rr, "#f6e7b0");
        defs += l.defs;
        return l.cuerpo;
      };
      if (tipo === "apertura") {
        c += luna("l", izq.x + izq.w / 2, m.altoMm * 0.15, Math.min(s * 0.07, m.altoMm * 0.07));
        c += `<ellipse cx="${r2(izq.x + izq.w / 2)}" cy="${r2(m.altoMm - s * 0.05)}" rx="${r2(s * 0.2)}" ry="${r2(s * 0.035)}" fill="#3b4a80"/>`;
        c += gatoDurmiendo(izq.x + izq.w / 2 - s * 0.02, m.altoMm - s * 0.1, s * 0.22, "#0d1226");
      } else if (tipo === "interior") {
        c += luna("l", der.x + der.w - 8, 8, Math.min(5, s * 0.03));
      } else if (tipo === "interior-alt") {
        c += luna("l", izq.x + 8, 8, Math.min(5, s * 0.03));
        c += gatoSentado(der.x + der.w - s * 0.1, m.altoMm - s * 0.015, s * 0.22, "#0d1226", -1);
        c += `<rect x="${r2(der.x + der.w - s * 0.24)}" y="${r2(m.altoMm - s * 0.015)}" width="${r2(s * 0.24)}" height="${r2(s * 0.015)}" fill="#0d1226"/>`;
      } else {
        c += luna("l", der.x + der.w * 0.85, s * 0.08, Math.min(s * 0.045, 9));
        c += `<ellipse cx="${r2(der.x + der.w / 2)}" cy="${r2(m.altoMm - s * 0.05)}" rx="${r2(s * 0.2)}" ry="${r2(s * 0.035)}" fill="#3b4a80"/>`;
        c += gatoDurmiendo(der.x + der.w / 2 - s * 0.02, m.altoMm - s * 0.1, s * 0.22, "#0d1226");
      }
      return svg(m, c, defs);
    },
    zona: zonaCon((tipo, l, m) => {
      const s = lado(m);
      if (esTitulo(tipo, l)) return { abajo: s * 0.2 };
      if (tipo === "interior-alt" && l === "der") return { exterior: pos(s * 0.2 - 14 + 2) };
      return {};
    }, 14),
    textos: textosCon(textosClasicos({ titulo: "Bad Script", texto: "Nunito", color: "#f6e7b0", acento: "#a9b6e8", escalaTitulo: 0.12, ejemplos: { titulo: "Dulces sueños, Milo", subtitulo: "Nuestro gato dormilón", fecha: "Agosto 2026", frase: "Buenas noches, pequeño" } })),
  },
];
