import type { EstiloFotolibro, Medidas, TextoDelEstilo, TipoPliego, Zona } from "../tipos";
import { azar, degradado, estrella, estrellas, fondoLiso, grano, olas, paginas, svg } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos para libros de viaje a Estados Unidos: Nueva York, Miami, la ruta 66, Las Vegas,
 * California y los parques del oeste. Todo dibujado con formas simples (rectángulos, curvas,
 * estrellas): nada de marcas, logos ni personajes.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => Math.max(0, n);
const fuerte = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";
const esTitulo = (tipo: TipoPliego, lado: "izq" | "der") => (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");

/**
 * La zona clásica (lugar del título) más lo que reservan los adornos de cada estilo. En las
 * páginas de título lo de abajo se recorta para que siempre quede lugar.
 */
function zonaCon(extra: (tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>, mg: number) {
  return (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> => {
    const e = extra(tipo, lado, m);
    if (!esTitulo(tipo, lado)) return e;
    const arriba = Math.max(zonaClasica()(tipo, lado, m).arriba ?? 0, e.arriba ?? 0);
    const tope = pos(m.altoMm - 2 * mg - arriba - m.altoMm * 0.1);
    return { ...e, arriba, abajo: Math.min(e.abajo ?? 0, tope) };
  };
}

/**
 * Los títulos clásicos con algún retoque (mayúsculas, negrita) sólo en el título. Además achica
 * el título y la frase si un texto largo no entra a lo ancho (en 20x30 la página es angosta).
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

// ─── Piezas de dibujo propias de Estados Unidos ─────────────────────────────────────────────

/** Skyline: edificios de rectángulos con remates, antenas y ventanas encendidas al azar. */
function skyline(x0: number, base: number, ancho: number, altoMax: number, color: string, semilla: number, ventana?: string): string {
  const rnd = azar(semilla);
  let out = "";
  let x = x0;
  while (x < x0 + ancho - 0.5) {
    const w = Math.min(altoMax * (0.16 + rnd() * 0.28), x0 + ancho - x);
    const h = altoMax * (0.3 + rnd() * 0.58);
    out += `<rect x="${r2(x)}" y="${r2(base - h)}" width="${r2(w + 0.2)}" height="${r2(h)}" fill="${color}"/>`;
    const remate = rnd();
    if (remate > 0.62) {
      out += `<rect x="${r2(x + w * 0.2)}" y="${r2(base - h * 1.08)}" width="${r2(w * 0.6)}" height="${r2(h * 0.08 + 0.2)}" fill="${color}"/>`;
      if (remate > 0.86) out += `<rect x="${r2(x + w * 0.47)}" y="${r2(base - h * 1.16)}" width="${r2(Math.max(0.3, w * 0.06))}" height="${r2(h * 0.09)}" fill="${color}"/>`;
    } else if (remate < 0.12) {
      out += `<path d="M ${r2(x)} ${r2(base - h)} L ${r2(x + w / 2)} ${r2(base - h - w * 0.45)} L ${r2(x + w)} ${r2(base - h)} Z" fill="${color}"/>`;
    }
    if (ventana) {
      const vw = altoMax * 0.022;
      const paso = vw * 2.6;
      for (let vy = base - h + paso * 0.8; vy < base - paso * 0.6; vy += paso) {
        for (let vx = x + paso * 0.5; vx < x + w - vw - paso * 0.3; vx += paso) {
          if (rnd() < 0.28) out += `<rect x="${r2(vx)}" y="${r2(vy)}" width="${r2(vw)}" height="${r2(vw * 1.3)}" fill="${ventana}" opacity="${r2(0.55 + rnd() * 0.45)}"/>`;
        }
      }
    }
    x += w + altoMax * (rnd() > 0.7 ? 0.03 : 0);
  }
  return out;
}

/** Palmera: tronco curvo que se afina y una copa de hojas arqueadas que caen. */
function palmera(x: number, base: number, alto: number, color: string, inclinacion: number, semilla: number): string {
  const rnd = azar(semilla);
  const tx = x + inclinacion * alto;
  const ty = base - alto;
  const mx = x + inclinacion * alto * 0.35;
  const my = base - alto * 0.5;
  let out = `<path d="M ${r2(x - alto * 0.028)} ${r2(base)} Q ${r2(mx - alto * 0.012)} ${r2(my)} ${r2(tx - alto * 0.011)} ${r2(ty)} L ${r2(tx + alto * 0.011)} ${r2(ty)} Q ${r2(mx + alto * 0.016)} ${r2(my)} ${r2(x + alto * 0.028)} ${r2(base)} Z" fill="${color}"/>`;
  const hojas: [number, number][] = [
    [1, -62], [1, -30], [1, -2], [1, 26], [-1, -62], [-1, -30], [-1, -2], [-1, 26], [1, -86],
  ];
  for (const [dir, ang] of hojas) {
    const L = alto * (0.3 + rnd() * 0.12);
    const a = ang + (rnd() - 0.5) * 10;
    out += `<path d="M 0 0 Q ${r2(L * 0.5)} ${r2(-L * 0.24)} ${r2(L)} ${r2(L * 0.2)} Q ${r2(L * 0.48)} ${r2(-L * 0.04)} 0 ${r2(L * 0.05)} Z" fill="${color}" transform="translate(${r2(tx)} ${r2(ty)}) scale(${dir} 1) rotate(${r2(a)})"/>`;
  }
  out += `<circle cx="${r2(tx - alto * 0.02)}" cy="${r2(ty + alto * 0.03)}" r="${r2(alto * 0.022)}" fill="${color}"/><circle cx="${r2(tx + alto * 0.022)}" cy="${r2(ty + alto * 0.035)}" r="${r2(alto * 0.02)}" fill="${color}"/>`;
  return out;
}

/** Cartel de ruta genérico: escudo con borde y una franja, sin números ni marcas. */
function escudoRuta(cx: number, cy: number, t: number, fondo: string, borde: string): string {
  const p = (k: number) =>
    `M ${r2(cx - 0.45 * t * k)} ${r2(cy - 0.5 * t * k)} Q ${r2(cx)} ${r2(cy - 0.4 * t * k)} ${r2(cx + 0.45 * t * k)} ${r2(cy - 0.5 * t * k)} L ${r2(cx + 0.5 * t * k)} ${r2(cy - 0.12 * t * k)} Q ${r2(cx + 0.5 * t * k)} ${r2(cy + 0.36 * t * k)} ${r2(cx)} ${r2(cy + 0.56 * t * k)} Q ${r2(cx - 0.5 * t * k)} ${r2(cy + 0.36 * t * k)} ${r2(cx - 0.5 * t * k)} ${r2(cy - 0.12 * t * k)} Z`;
  return (
    `<path d="${p(1)}" fill="${borde}"/><path d="${p(0.86)}" fill="${fondo}"/>` +
    `<path d="M ${r2(cx - 0.42 * t)} ${r2(cy - 0.2 * t)} L ${r2(cx + 0.42 * t)} ${r2(cy - 0.2 * t)}" stroke="${borde}" stroke-width="${r2(t * 0.04)}"/>` +
    `<rect x="${r2(cx - 0.2 * t)}" y="${r2(cy - 0.02 * t)}" width="${r2(0.4 * t)}" height="${r2(0.07 * t)}" rx="${r2(t * 0.03)}" fill="${borde}"/>` +
    `<rect x="${r2(cx - 0.13 * t)}" y="${r2(cy + 0.14 * t)}" width="${r2(0.26 * t)}" height="${r2(0.07 * t)}" rx="${r2(t * 0.03)}" fill="${borde}"/>`
  );
}

/** Taxi amarillo simplificado, mirando a la derecha. `x` es la cola, `base` el piso. */
function taxi(x: number, base: number, L: number, amarillo: string, oscuro: string, vidrio: string): string {
  const rr = L * 0.085;
  let out = `<rect x="${r2(x + L * 0.42)}" y="${r2(base - L * 0.58)}" width="${r2(L * 0.12)}" height="${r2(L * 0.06)}" rx="${r2(L * 0.01)}" fill="${amarillo}" stroke="${oscuro}" stroke-width="${r2(L * 0.008)}"/>`;
  out += `<path d="M ${r2(x + L * 0.24)} ${r2(base - L * 0.34)} L ${r2(x + L * 0.33)} ${r2(base - L * 0.52)} L ${r2(x + L * 0.67)} ${r2(base - L * 0.52)} L ${r2(x + L * 0.79)} ${r2(base - L * 0.34)} Z" fill="${amarillo}"/>`;
  out += `<path d="M ${r2(x + L * 0.3)} ${r2(base - L * 0.35)} L ${r2(x + L * 0.36)} ${r2(base - L * 0.48)} L ${r2(x + L * 0.49)} ${r2(base - L * 0.48)} L ${r2(x + L * 0.49)} ${r2(base - L * 0.35)} Z" fill="${vidrio}"/>`;
  out += `<path d="M ${r2(x + L * 0.52)} ${r2(base - L * 0.35)} L ${r2(x + L * 0.52)} ${r2(base - L * 0.48)} L ${r2(x + L * 0.65)} ${r2(base - L * 0.48)} L ${r2(x + L * 0.73)} ${r2(base - L * 0.35)} Z" fill="${vidrio}"/>`;
  out += `<rect x="${r2(x)}" y="${r2(base - L * 0.36)}" width="${r2(L)}" height="${r2(L * 0.25)}" rx="${r2(L * 0.05)}" fill="${amarillo}"/>`;
  const c = L * 0.03;
  for (let i = 0, cx = x + L * 0.1; cx < x + L * 0.9; i++, cx += c) {
    out += `<rect x="${r2(cx)}" y="${r2(base - L * 0.25 + (i % 2) * c)}" width="${r2(c)}" height="${r2(c)}" fill="${oscuro}"/>`;
  }
  out += `<rect x="${r2(x + L * 0.95)}" y="${r2(base - L * 0.32)}" width="${r2(L * 0.04)}" height="${r2(L * 0.05)}" rx="${r2(L * 0.01)}" fill="#fff6c9"/>`;
  out += `<rect x="${r2(x + L * 0.005)}" y="${r2(base - L * 0.32)}" width="${r2(L * 0.03)}" height="${r2(L * 0.04)}" fill="#d64a3a"/>`;
  for (const wx of [x + L * 0.21, x + L * 0.79]) {
    out += `<circle cx="${r2(wx)}" cy="${r2(base - rr)}" r="${r2(rr)}" fill="${oscuro}"/><circle cx="${r2(wx)}" cy="${r2(base - rr)}" r="${r2(rr * 0.42)}" fill="#bdbdbd"/>`;
  }
  return out;
}

/** Banda de cuadritos tipo taxi, a lo largo de un rectángulo. */
function cuadrille(x: number, y: number, w: number, h: number, filas: number, c1: string, c2: string): string {
  const t = h / filas;
  let out = `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${c2}"/>`;
  for (let fi = 0; fi < filas; fi++) {
    for (let i = 0, cx = x; cx < x + w - 0.01; i++, cx += t) {
      if ((i + fi) % 2 === 0) out += `<rect x="${r2(cx)}" y="${r2(y + fi * t)}" width="${r2(Math.min(t, x + w - cx))}" height="${r2(t)}" fill="${c1}"/>`;
    }
  }
  return out;
}

/** Mesetas del desierto: cerros de techo plano, en capas. */
function mesetas(x0: number, x1: number, base: number, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  return colores
    .map((c, capa) => {
      const a = alto * (1 - capa * 0.3);
      const suelo = base - a * 0.14;
      let d = `M ${r2(x0)} ${r2(base)} L ${r2(x0)} ${r2(suelo)}`;
      let x = x0 + (capa % 2 ? a * 0.6 : 0);
      while (x < x1) {
        x += a * (0.3 + rnd() * 1.2);
        const h = a * (0.55 + rnd() * 0.45);
        const bw = a * (0.9 + rnd() * 1.8);
        const p = [x, x + bw * 0.14, x + bw * 0.86, x + bw].map((v) => Math.min(v, x1));
        d += ` L ${r2(p[0]!)} ${r2(suelo)} L ${r2(p[1]!)} ${r2(base - h)} L ${r2(p[2]!)} ${r2(base - h)} L ${r2(p[3]!)} ${r2(suelo)}`;
        x += bw;
      }
      return `<path d="${d} L ${r2(x1)} ${r2(suelo)} L ${r2(x1)} ${r2(base)} Z" fill="${c}"/>`;
    })
    .join("");
}

/** Cactus saguaro de trazos redondeados. */
function saguaro(x: number, base: number, alto: number, color: string, espejo = 1): string {
  const g = alto * 0.13;
  const e = espejo;
  return `<g stroke="${color}" stroke-width="${r2(g)}" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M ${r2(x)} ${r2(base)} L ${r2(x)} ${r2(base - alto + g / 2)}"/><path d="M ${r2(x)} ${r2(base - alto * 0.42)} L ${r2(x - e * alto * 0.22)} ${r2(base - alto * 0.42)} L ${r2(x - e * alto * 0.22)} ${r2(base - alto * 0.7)}"/><path d="M ${r2(x)} ${r2(base - alto * 0.55)} L ${r2(x + e * alto * 0.2)} ${r2(base - alto * 0.55)} L ${r2(x + e * alto * 0.2)} ${r2(base - alto * 0.8)}"/></g>`;
}

/** Pino de tres pisos de triángulos. */
function pino(x: number, base: number, alto: number, color: string): string {
  const w = alto * 0.42;
  let d = `M ${r2(x - alto * 0.04)} ${r2(base)} L ${r2(x - alto * 0.04)} ${r2(base - alto * 0.15)} L ${r2(x + alto * 0.04)} ${r2(base - alto * 0.15)} L ${r2(x + alto * 0.04)} ${r2(base)} Z`;
  for (let i = 0; i < 3; i++) {
    const y = base - alto * (0.12 + i * 0.24);
    const k = 1 - i * 0.22;
    d += ` M ${r2(x - w * k)} ${r2(y)} L ${r2(x)} ${r2(y - alto * 0.42)} L ${r2(x + w * k)} ${r2(y)} Z`;
  }
  return `<path d="${d}" fill="${color}"/>`;
}

/** Fila de pinos de alturas variadas a lo largo de una base. */
function bosque(x0: number, x1: number, base: number, alto: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  for (let x = x0 + alto * 0.2; x < x1 - alto * 0.2; x += alto * (0.28 + rnd() * 0.3)) out += pino(x, base, alto * (0.55 + rnd() * 0.45), color);
  return out;
}

/** Marcador de mapa (gota con agujero). */
function marcador(x: number, y: number, t: number, color: string, centro: string): string {
  return `<path d="M ${r2(x)} ${r2(y)} C ${r2(x - 0.3 * t)} ${r2(y - 0.42 * t)} ${r2(x - 0.5 * t)} ${r2(y - 0.6 * t)} ${r2(x - 0.5 * t)} ${r2(y - 0.86 * t)} A ${r2(0.5 * t)} ${r2(0.5 * t)} 0 1 1 ${r2(x + 0.5 * t)} ${r2(y - 0.86 * t)} C ${r2(x + 0.5 * t)} ${r2(y - 0.6 * t)} ${r2(x + 0.3 * t)} ${r2(y - 0.42 * t)} ${r2(x)} ${r2(y)} Z" fill="${color}"/><circle cx="${r2(x)}" cy="${r2(y - 0.86 * t)}" r="${r2(0.2 * t)}" fill="${centro}"/>`;
}

/** Cinta de papel (washi) con las puntas en zigzag. */
function washi(cx: number, cy: number, largo: number, ancho: number, giro: number, color: string, raya?: string): string {
  const l = largo / 2;
  const a = ancho / 2;
  const z = ancho / 6;
  let d = `M ${r2(-l)} ${r2(-a)} L ${r2(l)} ${r2(-a)}`;
  for (let i = 0; i < 6; i++) d += ` L ${r2(l + (i % 2 === 0 ? z : 0))} ${r2(-a + (i + 1) * z)}`;
  d += ` L ${r2(-l)} ${r2(a)}`;
  for (let i = 0; i < 6; i++) d += ` L ${r2(-l - (i % 2 === 0 ? z : 0))} ${r2(a - (i + 1) * z)}`;
  let rayas = "";
  if (raya) for (let x = -l + ancho * 0.4; x < l; x += ancho * 0.8) rayas += `<line x1="${r2(x)}" y1="${r2(-a)}" x2="${r2(x - ancho * 0.5)}" y2="${r2(a)}" stroke="${raya}" stroke-width="${r2(ancho * 0.18)}" opacity="0.5"/>`;
  return `<g transform="translate(${r2(cx)} ${r2(cy)}) rotate(${r2(giro)})" opacity="0.82"><path d="${d} Z" fill="${color}"/>${rayas}</g>`;
}

/** Entrada de papel con muescas y línea de corte. */
function ticket(x: number, y: number, w: number, h: number, color: string, papel: string, linea: string): string {
  const n = h * 0.14;
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(h * 0.06)}" fill="${color}"/><circle cx="${r2(x)}" cy="${r2(y + h / 2)}" r="${r2(n)}" fill="${papel}"/><circle cx="${r2(x + w)}" cy="${r2(y + h / 2)}" r="${r2(n)}" fill="${papel}"/><line x1="${r2(x + w * 0.72)}" y1="${r2(y + h * 0.1)}" x2="${r2(x + w * 0.72)}" y2="${r2(y + h * 0.9)}" stroke="${linea}" stroke-width="${r2(h * 0.025)}" stroke-dasharray="${r2(h * 0.06)} ${r2(h * 0.05)}"/><rect x="${r2(x + w * 0.1)}" y="${r2(y + h * 0.28)}" width="${r2(w * 0.5)}" height="${r2(h * 0.08)}" fill="${linea}" opacity="0.6"/><rect x="${r2(x + w * 0.1)}" y="${r2(y + h * 0.46)}" width="${r2(w * 0.38)}" height="${r2(h * 0.06)}" fill="${linea}" opacity="0.4"/><rect x="${r2(x + w * 0.1)}" y="${r2(y + h * 0.6)}" width="${r2(w * 0.44)}" height="${r2(h * 0.06)}" fill="${linea}" opacity="0.4"/>`;
}

/** Estampilla con borde picado: franjas y una estrella. */
function estampilla(x: number, y: number, w: number, h: number, papel: string, c1: string, c2: string, fondoSello: string): string {
  let out = `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${fondoSello}"/>`;
  const rp = Math.min(w, h) * 0.035;
  const paso = rp * 3;
  for (let px = x + paso / 2; px < x + w; px += paso) out += `<circle cx="${r2(px)}" cy="${r2(y)}" r="${r2(rp)}" fill="${papel}"/><circle cx="${r2(px)}" cy="${r2(y + h)}" r="${r2(rp)}" fill="${papel}"/>`;
  for (let py = y + paso / 2; py < y + h; py += paso) out += `<circle cx="${r2(x)}" cy="${r2(py)}" r="${r2(rp)}" fill="${papel}"/><circle cx="${r2(x + w)}" cy="${r2(py)}" r="${r2(rp)}" fill="${papel}"/>`;
  const ix = x + w * 0.12;
  const iy = y + h * 0.1;
  const iw = w * 0.76;
  const ih = h * 0.8;
  out += `<rect x="${r2(ix)}" y="${r2(iy)}" width="${r2(iw)}" height="${r2(ih)}" fill="${c2}"/>`;
  for (let i = 0; i < 4; i++) out += `<rect x="${r2(ix)}" y="${r2(iy + ih * 0.5 + i * ih * 0.125)}" width="${r2(iw)}" height="${r2(ih * 0.0625)}" fill="${c1}"/>`;
  out += estrella(ix + iw / 2, iy + ih * 0.27, iw * 0.2, fondoSello);
  return out;
}

/** Matasellos: dos círculos y ondas. */
function matasellos(cx: number, cy: number, rr: number, color: string): string {
  let out = `<g fill="none" stroke="${color}" stroke-width="${r2(rr * 0.05)}" opacity="0.7"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr)}"/><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr * 0.72)}"/>`;
  for (let i = -1; i <= 1; i++) {
    const y = cy + i * rr * 0.32;
    out += `<path d="M ${r2(cx + rr * 1.1)} ${r2(y)} q ${r2(rr * 0.25)} ${r2(-rr * 0.2)} ${r2(rr * 0.5)} 0 t ${r2(rr * 0.5)} 0 t ${r2(rr * 0.5)} 0 t ${r2(rr * 0.5)} 0"/>`;
  }
  return `${out}</g>`;
}

/** Arcos de colores concéntricos (estilo setentoso), centrados en (cx, cy), entre dos ángulos. */
function arcoiris(cx: number, cy: number, rMax: number, colores: string[], desde: number, hasta: number): string {
  const b = rMax / (colores.length + 0.6);
  return colores
    .map((c, i) => {
      const rr = rMax - b * (i + 0.5);
      const a0 = (desde * Math.PI) / 180;
      const a1 = (hasta * Math.PI) / 180;
      return `<path d="M ${r2(cx + Math.cos(a0) * rr)} ${r2(cy + Math.sin(a0) * rr)} A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(cx + Math.cos(a1) * rr)} ${r2(cy + Math.sin(a1) * rr)}" stroke="${c}" stroke-width="${r2(b * 0.98)}" fill="none"/>`;
    })
    .join("");
}

/** Sol retro con franjas horizontales recortadas (necesita su clipPath en defs). */
function solRetro(id: string, cx: number, cy: number, rr: number, color: string, hueco: string): { defs: string; cuerpo: string } {
  let franjas = "";
  for (let i = 0; i < 5; i++) {
    const y = cy + rr * (0.12 + i * 0.18);
    franjas += `<rect x="${r2(cx - rr)}" y="${r2(y)}" width="${r2(rr * 2)}" height="${r2(rr * (0.03 + i * 0.022))}" fill="${hueco}"/>`;
  }
  return {
    defs: `<clipPath id="${id}"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr)}"/></clipPath>`,
    cuerpo: `<g clip-path="url(#${id})"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rr)}" fill="${color}"/>${franjas}</g>`,
  };
}

/** Brillo de neón para trazos. */
const filtroNeon = (id: string, fuerza: number) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${r2(fuerza)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

/** Un trazo de neón: el tubo de color con brillo y un alma clara. */
function neon(d: string, color: string, grosor: number, filtro: string): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${r2(grosor)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${filtro})"/><path d="${d}" fill="none" stroke="#ffffff" stroke-width="${r2(grosor * 0.35)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`;
}

function contornoEstrella(x: number, y: number, rr: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const k = i % 2 === 0 ? rr : rr * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"} ${r2(x + Math.cos(a) * k)} ${r2(y + Math.sin(a) * k)} `;
  }
  return `${d}Z`;
}

/** Franjas rojas y blancas (verticales u horizontales) dentro de un rectángulo. */
function franjas(x: number, y: number, w: number, h: number, n: number, c1: string, c2: string, vertical: boolean): string {
  let out = `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${c2}"/>`;
  for (let i = 0; i < n; i += 2) {
    out += vertical
      ? `<rect x="${r2(x + (w / n) * i)}" y="${r2(y)}" width="${r2(w / n)}" height="${r2(h)}" fill="${c1}"/>`
      : `<rect x="${r2(x)}" y="${r2(y + (h / n) * i)}" width="${r2(w)}" height="${r2(h / n)}" fill="${c1}"/>`;
  }
  return out;
}

// ─── Los estilos ─────────────────────────────────────────────────────────────────────────────

export const EEUU: EstiloFotolibro[] = [
  {
    id: "eeuu-01-nueva-york-noche",
    tema: "eeuu",
    nombre: "Nueva York de noche",
    descripcion: "Skyline azul noche con ventanas encendidas: la ciudad que nunca duerme.",
    papel: "#0e1630",
    margenMm: 14,
    fondo: (tipo, m) => {
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const cielo = degradado("c", total, "#0b1228", "#24315c");
      const H = m.altoMm * (fuerte(tipo) ? 0.25 : 0.15);
      let c = cielo.cuerpo + estrellas({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm * 0.5 }, "#e8e2c8", Math.round(m.anchoMm / (fuerte(tipo) ? 9 : 18)), 12, s * 0.012);
      if (tipo === "interior-alt") {
        c += `<circle cx="${r2(der.x + der.w - 8)}" cy="8" r="${r2(Math.min(5, s * 0.025))}" fill="#f1e6c3"/>`;
        c += skyline(0, m.altoMm, m.anchoMm, H * 0.8, "#1c2850", 41);
        c += skyline(0, m.altoMm, m.anchoMm, H * 0.6, "#0a0f22", 47, "#f3c969");
      } else {
        c += skyline(0, m.altoMm, m.anchoMm, H, "#22305a", 3);
        c += skyline(0, m.altoMm, m.anchoMm, H * 0.72, "#0a0f22", 9, "#f3c969");
      }
      return svg(m, c, cielo.defs);
    },
    zona: zonaCon((tipo, _l, m) => ({ abajo: pos(m.altoMm * (fuerte(tipo) ? 0.25 : 0.15) * 1.02 - 14 + 3) }), 14),
    textos: textosCon(
      textosClasicos({ titulo: "Bebas Neue", texto: "Montserrat", color: "#f5efe0", acento: "#f3c969", escalaTitulo: 0.13, ejemplos: { titulo: "Nueva York", subtitulo: "Nuestro viaje", fecha: "Marzo 2026", frase: "La ciudad que nunca duerme" } }),
      { mayusculas: true },
    ),
  },
  {
    id: "eeuu-02-postal-retro",
    tema: "eeuu",
    nombre: "Postal retro",
    descripcion: "Borde de correo aéreo, estampillas y matasellos: el viaje como una postal.",
    papel: "#f4ead5",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.07);
      const p = s * 0.012;
      const defs = `<pattern id="am" width="${r2(p * 3)}" height="${r2(p * 3)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${r2(p)}" height="${r2(p * 3)}" fill="#c0392b"/><rect x="${r2(p)}" width="${r2(p)}" height="${r2(p * 3)}" fill="#f4ead5"/><rect x="${r2(p * 2)}" width="${r2(p)}" height="${r2(p * 3)}" fill="#1f3a68"/></pattern>`;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f4ead5");
      const ins = s * 0.022;
      const bw = s * 0.022;
      for (const pg of [izq, der]) {
        const o = { x: pg.x + ins, y: ins, w: pg.w - 2 * ins, h: pg.h - 2 * ins };
        c += `<path d="M ${r2(o.x)} ${r2(o.y)} h ${r2(o.w)} v ${r2(o.h)} h ${r2(-o.w)} Z M ${r2(o.x + bw)} ${r2(o.y + bw)} v ${r2(o.h - 2 * bw)} h ${r2(o.w - 2 * bw)} v ${r2(-(o.h - 2 * bw))} Z" fill="url(#am)" fill-rule="evenodd"/>`;
      }
      const ew = s * 0.15;
      const eh = s * 0.18;
      const e0 = ins + bw + s * 0.03;
      if (tipo === "apertura" || tipo === "interior-alt") {
        c += estampilla(der.x + der.w - e0 - ew, e0, ew, eh, "#f4ead5", "#c0392b", "#1f3a68", "#fbf6ea");
        c += matasellos(der.x + der.w - e0 - ew * 1.05, e0 + eh * 0.75, ew * 0.38, "#3b3b3b");
      }
      if (tipo === "interior" || tipo === "cierre") {
        c += estampilla(izq.x + e0, e0, ew, eh, "#f4ead5", "#1f3a68", "#c0392b", "#fbf6ea");
        c += matasellos(izq.x + e0 + ew * 0.55, e0 + eh * 0.8, ew * 0.38, "#3b3b3b");
      }
      return svg(m, c + g.cuerpo, defs + g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const borde = pos(s * 0.044 + 3 - 16);
      const estampa = (lado === "der" && (tipo === "apertura" || tipo === "interior-alt")) || (lado === "izq" && (tipo === "interior" || tipo === "cierre"));
      return { arriba: borde, abajo: borde, interior: borde, exterior: estampa ? pos(s * 0.074 + s * 0.15 + s * 0.08 - 16) : borde };
    }, 16),
    textos: textosCon(textosClasicos({ titulo: "Pacifico", texto: "Oswald", color: "#b23a3a", acento: "#1f3a68", ejemplos: { titulo: "Saludos desde Miami", subtitulo: "Vacaciones en familia", fecha: "Enero 2026", frase: "Ojalá estuvieras acá" }, escalaTitulo: 0.085 })),
  },
  {
    id: "eeuu-03-miami-atardecer",
    tema: "eeuu",
    nombre: "Atardecer en Miami",
    descripcion: "Cielo rosa y naranja con palmeras en silueta y líneas art déco.",
    papel: "#fff4ea",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      let defs = "";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fff4ea");
      const atardecer = (pg: typeof izq, id: string, espejo: boolean) => {
        const d = degradado(id, pg, "#ff8fa3", "#ffc27a");
        defs += d.defs;
        const sol = solRetro(`${id}s`, pg.x + pg.w / 2, pg.h * 0.86, Math.min(pg.w * 0.3, pg.h * 0.24), "#fff1c1", "#ffb98a");
        defs += sol.defs;
        let out = d.cuerpo + sol.cuerpo + `<rect x="${r2(pg.x)}" y="${r2(pg.h * 0.86)}" width="${r2(pg.w)}" height="${r2(pg.h * 0.14)}" fill="#ef8a7f"/>`;
        const bx = espejo ? pg.x + pg.w - s * 0.1 : pg.x + s * 0.1;
        out += palmera(bx, pg.h, s * 0.5, "#5a2a4a", espejo ? -0.12 : 0.12, 4);
        out += palmera(espejo ? bx - s * 0.12 : bx + s * 0.12, pg.h, s * 0.34, "#5a2a4a", espejo ? -0.2 : 0.2, 8);
        return out;
      };
      if (tipo === "apertura") c += atardecer(izq, "a", false);
      else if (tipo === "cierre") c += atardecer(der, "a", true);
      else {
        // Interiores: palmeras chicas en las esquinas exteriores y un filete art déco triple.
        const k = tipo === "interior" ? 0.36 : 0.3;
        c += palmera(izq.x + s * 0.06, izq.h, s * k, "#e7849a", 0.1, 3) + palmera(der.x + der.w - s * 0.06, der.h, s * k, "#e7849a", -0.1, 7);
        if (tipo === "interior-alt") c += palmera(der.x + der.w - s * 0.15, der.h, s * k * 0.7, "#f2a988", -0.18, 9);
        for (const pg of [izq, der]) {
          for (let i = 0; i < 3; i++) {
            const y = 5 + i * 1.6;
            c += `<line x1="${r2(pg.x + pg.w * 0.3)}" y1="${r2(y)}" x2="${r2(pg.x + pg.w * 0.7)}" y2="${r2(y)}" stroke="${i === 1 ? "#4fb3b0" : "#f19a8e"}" stroke-width="0.5"/>`;
          }
        }
      }
      return svg(m, c, defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      if (tipo === "apertura" && lado === "der") return {};
      if (tipo === "cierre" && lado === "izq") return {};
      return { exterior: pos(s * (tipo === "interior-alt" && lado === "der" ? 0.28 : 0.22) - 14 + 3) };
    }, 14),
    textos: textosCon((tipo, m) =>
      textosClasicos({
        titulo: "Satisfy",
        texto: "Poppins",
        color: fuerte(tipo) ? "#ffffff" : "#8a3b55",
        acento: fuerte(tipo) ? "#7a2f4c" : "#4fb3b0",
        ejemplos: { titulo: "Miami Beach", subtitulo: "Sol, mar y palmeras", fecha: "Febrero 2026", frase: "Vitamina mar" },
        posicion: "arriba",
        escalaTitulo: 0.12,
      })(tipo, m)),
  },
  {
    id: "eeuu-04-ruta-66",
    tema: "eeuu",
    nombre: "Ruta 66",
    descripcion: "Asfalto, línea amarilla, mesetas del desierto y carteles de ruta.",
    papel: "#f1e3c8",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.1, 1);
      const ruta = m.altoMm * 0.055;
      const H = m.altoMm * (fuerte(tipo) ? 0.2 : 0.11);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f1e3c8");
      if (fuerte(tipo)) c += `<circle cx="${r2(tipo === "apertura" ? izq.x + izq.w * 0.78 : der.x + der.w * 0.22)}" cy="${r2(m.altoMm - ruta - H * 0.75)}" r="${r2(s * 0.08)}" fill="#f2a65a"/>`;
      c += mesetas(0, m.anchoMm, m.altoMm - ruta, H, ["#d98b5f", "#b75a3a"], tipo === "interior-alt" ? 17 : 5);
      if (tipo === "interior-alt") c += saguaro(izq.x + s * 0.08, m.altoMm - ruta, H * 1.4, "#5f7a4a") + saguaro(der.x + der.w - s * 0.08, m.altoMm - ruta, H * 1.4, "#5f7a4a", -1);
      c += `<rect x="0" y="${r2(m.altoMm - ruta)}" width="${r2(m.anchoMm)}" height="${r2(ruta)}" fill="#3b3a38"/>`;
      c += `<line x1="0" y1="${r2(m.altoMm - ruta / 2)}" x2="${r2(m.anchoMm)}" y2="${r2(m.altoMm - ruta / 2)}" stroke="#f2c94c" stroke-width="${r2(ruta * 0.12)}" stroke-dasharray="${r2(ruta * 1.2)} ${r2(ruta * 0.9)}"/>`;
      const t = s * 0.14;
      if (tipo === "apertura") c += escudoRuta(der.x + der.w - s * 0.05 - t / 2, s * 0.05 + t / 2, t, "#fbf6ea", "#2b2b2b");
      if (tipo === "cierre") c += escudoRuta(izq.x + s * 0.05 + t / 2, s * 0.05 + t / 2, t, "#fbf6ea", "#2b2b2b");
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const abajo = pos(m.altoMm * (0.055 + (fuerte(tipo) ? 0.2 : tipo === "interior-alt" ? 0.155 : 0.11)) - 14 + 3);
      const cartel = (tipo === "apertura" && lado === "der") || (tipo === "cierre" && lado === "izq");
      return { abajo, exterior: cartel ? pos(s * 0.21 - 14 + 3) : 0 };
    }, 14),
    textos: textosCon(
      textosClasicos({ titulo: "Anton", texto: "Roboto", color: "#3a2a1f", acento: "#b75a3a", escalaTitulo: 0.12, ejemplos: { titulo: "Ruta 66", subtitulo: "De Chicago a Santa Mónica", fecha: "Abril 2026", frase: "Lo importante es el camino" }, posicion: "arriba" }),
      { mayusculas: true },
    ),
  },
  {
    id: "eeuu-05-las-vegas-neon",
    tema: "eeuu",
    nombre: "Neón de Las Vegas",
    descripcion: "Fondo negro con marcos y estrellas de neón rosa, celeste y amarillo.",
    papel: "#0d0b14",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const gl = s * 0.006;
      const defs = filtroNeon("n", gl * 1.6) + `<radialGradient id="rg" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="#2a1640"/><stop offset="1" stop-color="#0d0b14"/></radialGradient>`;
      let c = `<rect width="${r2(m.anchoMm)}" height="${r2(m.altoMm)}" fill="url(#rg)"/>`;
      const ins = s * 0.035;
      const rad = s * 0.03;
      for (const pg of [izq, der]) {
        const d = `M ${r2(pg.x + ins + rad)} ${r2(ins)} H ${r2(pg.x + pg.w - ins - rad)} A ${r2(rad)} ${r2(rad)} 0 0 1 ${r2(pg.x + pg.w - ins)} ${r2(ins + rad)} V ${r2(pg.h - ins - rad)} A ${r2(rad)} ${r2(rad)} 0 0 1 ${r2(pg.x + pg.w - ins - rad)} ${r2(pg.h - ins)} H ${r2(pg.x + ins + rad)} A ${r2(rad)} ${r2(rad)} 0 0 1 ${r2(pg.x + ins)} ${r2(pg.h - ins - rad)} V ${r2(ins + rad)} A ${r2(rad)} ${r2(rad)} 0 0 1 ${r2(pg.x + ins + rad)} ${r2(ins)} Z`;
        c += neon(d, tipo === "interior-alt" ? "#35e0ff" : "#ff3fa4", gl, "n");
      }
      const est = (x: number, y: number, k: number, col: string) => neon(contornoEstrella(x, y, s * 0.028 * k), col, gl * 0.8, "n");
      if (tipo === "apertura") {
        // Marquesina de lamparitas arriba del título.
        const cx = izq.x + izq.w / 2;
        const rx = izq.w * 0.32;
        const ry = izq.h * 0.09;
        const cy = izq.h * 0.26;
        for (let i = 0; i <= 14; i++) {
          const a = Math.PI + (Math.PI * i) / 14;
          c += `<circle cx="${r2(cx + Math.cos(a) * rx)}" cy="${r2(cy + Math.sin(a) * ry)}" r="${r2(s * 0.007)}" fill="#ffe27a" filter="url(#n)"/>`;
        }
        c += est(cx, cy - ry * 0.35, 1.2, "#ffe27a");
      }
      if (tipo !== "interior") {
        const pg = tipo === "cierre" ? izq : der;
        c += est(pg.x + pg.w - ins - s * 0.05, ins + s * 0.05, 1, "#ffe27a") + est(pg.x + pg.w - ins - s * 0.1, ins + s * 0.035, 0.6, "#35e0ff");
      }
      if (tipo !== "apertura") {
        c += est(izq.x + ins + s * 0.05, izq.h - ins - s * 0.05, 0.9, tipo === "interior-alt" ? "#ff3fa4" : "#35e0ff");
      }
      c += est(der.x + der.w - ins - s * 0.05, der.h - ins - s * 0.05, 0.8, "#ffe27a");
      return svg(m, c, defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const marco = pos(s * 0.05 - 16 + 3);
      const esq = pos(s * 0.12 - 16 + 3);
      return { arriba: marco, abajo: marco, interior: marco, exterior: esq };
    }, 16),
    textos: textosCon(textosClasicos({ titulo: "Sacramento", texto: "Rubik", color: "#ff7ac8", acento: "#6fe9ff", escalaTitulo: 0.14, ejemplos: { titulo: "Las Vegas", subtitulo: "Lo que pasa en Las Vegas…", fecha: "Noviembre 2026", frase: "…queda en este libro" } })),
  },
  {
    id: "eeuu-06-americana-sutil",
    tema: "eeuu",
    nombre: "Estrellas y franjas",
    descripcion: "Azul marino, rojo suave y estrellitas: un guiño a la bandera, sin estridencias.",
    papel: "#fbf8f2",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.05);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbf8f2");
      const bloque = (pg: typeof izq) => {
        let out = fondoLiso(pg, "#1d2b4f");
        out += estrellas({ x: pg.x + pg.w * 0.06, y: pg.h * 0.04, w: pg.w * 0.88, h: pg.h * 0.2 }, "#f3ede0", Math.round(pg.w / 7), 23, s * 0.02);
        out += franjas(pg.x, pg.h * 0.8, pg.w, pg.h * 0.2, 7, "#b8433f", "#f3ede0", false);
        return out;
      };
      const bw = s * 0.055;
      if (tipo === "apertura") {
        c += bloque(izq);
        c += franjas(der.x + der.w - bw, 0, bw, der.h, 7, "#b8433f", "#f3ede0", true);
      } else if (tipo === "cierre") {
        c += bloque(der);
        c += franjas(izq.x, 0, bw, izq.h, 7, "#b8433f", "#f3ede0", true);
      } else if (tipo === "interior") {
        c += franjas(izq.x, 0, bw, izq.h, 7, "#b8433f", "#f3ede0", true) + franjas(der.x + der.w - bw, 0, bw, der.h, 7, "#b8433f", "#f3ede0", true);
        c += `<rect x="${r2(izq.x)}" y="0" width="${r2(bw)}" height="${r2(bw * 1.4)}" fill="#1d2b4f"/>${estrella(izq.x + bw / 2, bw * 0.7, bw * 0.28, "#f3ede0")}`;
        c += `<rect x="${r2(der.x + der.w - bw)}" y="0" width="${r2(bw)}" height="${r2(bw * 1.4)}" fill="#1d2b4f"/>${estrella(der.x + der.w - bw / 2, bw * 0.7, bw * 0.28, "#f3ede0")}`;
      } else {
        c += franjas(0, m.altoMm - bw * 0.8, m.anchoMm, bw * 0.8, 5, "#b8433f", "#f3ede0", false);
        for (let i = 0; i < 3; i++) c += estrella(der.x + der.w - s * 0.035 - i * s * 0.035, s * 0.035, s * 0.011, "#1d2b4f");
        for (let i = 0; i < 3; i++) c += estrella(izq.x + s * 0.035 + i * s * 0.035, s * 0.035, s * 0.011, "#1d2b4f");
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const banda = pos(s * 0.055 + 4 - 15);
      if (tipo === "interior-alt") return { abajo: banda, arriba: pos(s * 0.05 - 15 + 3) };
      if (tipo === "apertura" && lado === "izq") return { abajo: m.altoMm * 0.2 };
      if (tipo === "cierre" && lado === "der") return { abajo: m.altoMm * 0.2 };
      return { exterior: banda };
    }, 15),
    textos: textosCon((tipo, m) =>
      textosClasicos({
        titulo: "Playfair Display",
        texto: "Lato",
        color: "#f3ede0",
        acento: "#e7a19b",
        escalaTitulo: 0.1,
        ejemplos: { titulo: "Estados Unidos", subtitulo: "De costa a costa", fecha: "Julio 2026", frase: "Volveremos" },
      })(tipo, m).map((t) => (t.rol === "frase" ? { ...t, y: m.altoMm * 0.3 } : t))),
  },
  {
    id: "eeuu-07-taxi-manhattan",
    tema: "eeuu",
    nombre: "Taxi amarillo",
    descripcion: "Blanco limpio, bandas a cuadros y un taxi amarillo: puro Manhattan.",
    papel: "#fffdf6",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const bh = s * 0.035;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fffdf6");
      if (tipo === "interior-alt") {
        const w = der.w * 0.14;
        c += fondoLiso({ x: der.x + der.w - w, y: 0, w, h: der.h }, "#f7c518");
        // Cuadritos en vertical: la misma banda, girada.
        c += `<g transform="translate(${r2(der.x + der.w - w)} 0) rotate(90)">${cuadrille(0, 0, der.h, bh, 2, "#1c1c1c", "#f7c518")}</g>`;
        c += cuadrille(izq.x, 0, izq.w, bh, 2, "#1c1c1c", "#f7c518");
      } else {
        c += cuadrille(0, 0, m.anchoMm, bh, 2, "#1c1c1c", "#f7c518") + cuadrille(0, m.altoMm - bh, m.anchoMm, bh, 2, "#1c1c1c", "#f7c518");
      }
      const L = s * 0.36;
      if (tipo === "apertura") c += taxi(izq.x + izq.w / 2 - L / 2, izq.h - bh - s * 0.03, L, "#f7c518", "#1c1c1c", "#cfe3f0");
      if (tipo === "cierre") c += taxi(der.x + der.w / 2 - L / 2, der.h - bh - s * 0.03, L, "#f7c518", "#1c1c1c", "#cfe3f0");
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const banda = pos(s * 0.035 + 3 - 14);
      if (tipo === "interior-alt") return lado === "der" ? { exterior: pos((m.anchoMm / 2) * 0.14 + s * 0.035 + 3 - 14) } : { arriba: banda };
      if (tipo === "cierre" && lado === "der") return { arriba: banda, abajo: pos(s * 0.27 - 14) };
      return { arriba: banda, abajo: tipo === "apertura" && lado === "izq" ? pos(s * 0.27 - 14) : banda };
    }, 14),
    textos: textosCon(
      textosClasicos({ titulo: "Oswald", texto: "Work Sans", color: "#1c1c1c", acento: "#b8890a", escalaTitulo: 0.12, posicion: "arriba", ejemplos: { titulo: "Manhattan", subtitulo: "Una semana en Nueva York", fecha: "Diciembre 2026", frase: "Nos vemos, Nueva York" } }),
      { mayusculas: true, negrita: true },
    ),
  },
  {
    id: "eeuu-08-california-retro",
    tema: "eeuu",
    nombre: "California setentosa",
    descripcion: "Arcoíris setentoso, sol a rayas y olas: para el road trip por la costa.",
    papel: "#fdf1dc",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const colores = ["#e76f51", "#f4a261", "#e9c46a", "#2a9d8f"];
      let defs = "";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fdf1dc");
      if (tipo === "apertura") {
        const sol = solRetro("s", izq.x + izq.w / 2, izq.h, Math.min(izq.w * 0.42, izq.h * 0.34), "#f4a261", "#fdf1dc");
        defs += sol.defs;
        c += sol.cuerpo + olas({ x: izq.x, y: 0, w: izq.w, h: izq.h }, izq.h * 0.09, ["#2a9d8f", "#21867a"], 3);
        c += arcoiris(der.x + der.w, 0, s * 0.3, colores, 90, 180);
      } else if (tipo === "cierre") {
        c += arcoiris(der.x + der.w, der.h, s * 0.34, colores, 180, 270);
        c += arcoiris(izq.x, 0, s * 0.26, colores, 0, 90);
      } else if (tipo === "interior") {
        c += arcoiris(izq.x, izq.h, s * 0.28, colores, 270, 360) + arcoiris(der.x + der.w, 0, s * 0.28, colores, 90, 180);
      } else {
        c += olas({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, m.altoMm * 0.1, ["#e9c46a", "#2a9d8f", "#21867a"], 9);
      }
      return svg(m, c, defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      if (tipo === "interior-alt") return { abajo: pos(m.altoMm * 0.1 - 14 + 3) };
      if (tipo === "apertura") return lado === "der" ? { exterior: pos(s * 0.3 - 14 + 3) } : { abajo: m.altoMm * 0.1 };
      if (tipo === "cierre") return lado === "izq" ? { exterior: pos(s * 0.26 - 14 + 3) } : { exterior: pos(s * 0.34 - 14 + 3) };
      return { exterior: pos(s * 0.28 - 14 + 3) };
    }, 14),
    textos: textosCon(textosClasicos({ titulo: "Courgette", texto: "Nunito", color: "#9a3f2a", acento: "#2a9d8f", escalaTitulo: 0.1, posicion: "arriba", ejemplos: { titulo: "Road trip por California", subtitulo: "De San Francisco a San Diego", fecha: "Agosto 2026", frase: "Que nunca falte la buena onda" } })),
  },
  {
    id: "eeuu-09-diario-de-viaje",
    tema: "eeuu",
    nombre: "Diario de viaje",
    descripcion: "Cuaderno punteado con cintas de papel, entradas y un recorrido marcado en el mapa.",
    papel: "#f3ecdd",
    margenMm: 15,
    esquinasMm: 0.6,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const paso = s * 0.035;
      const defs = `<pattern id="pt" width="${r2(paso)}" height="${r2(paso)}" patternUnits="userSpaceOnUse"><circle cx="${r2(paso / 2)}" cy="${r2(paso / 2)}" r="${r2(paso * 0.06)}" fill="#b9ab90"/></pattern>`;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f3ecdd") + `<rect width="${r2(m.anchoMm)}" height="${r2(m.altoMm)}" fill="url(#pt)"/>`;
      c += `<line x1="${r2(izq.w)}" y1="0" x2="${r2(izq.w)}" y2="${r2(m.altoMm)}" stroke="#d8ccb3" stroke-width="0.6"/>`;
      const tl = s * 0.2;
      const ta = s * 0.05;
      c += washi(izq.x + s * 0.06, s * 0.05, tl, ta, -38, "#e3a587", "#ffffff");
      c += washi(der.x + der.w - s * 0.06, der.h - s * 0.05, tl, ta, -38, "#8fb8c9", "#ffffff");
      if (tipo !== "interior") c += washi(der.x + der.w - s * 0.06, s * 0.05, tl, ta, 38, "#e9c46a");
      // Recorrido: línea punteada que serpentea abajo, con marcadores.
      const y0 = m.altoMm - s * 0.06;
      const amp = s * 0.03;
      let d = `M ${r2(s * 0.18)} ${r2(y0)}`;
      const largo = m.anchoMm - s * 0.36;
      const tramos = Math.max(3, Math.round(largo / (s * 0.35)));
      const tramo = largo / tramos;
      for (let i = 0; i < tramos; i++) d += ` q ${r2(tramo / 2)} ${r2(i % 2 ? amp * 2 : -amp * 2)} ${r2(tramo)} 0`;
      if (tipo !== "interior-alt") {
        c += `<path d="${d}" fill="none" stroke="#c0533a" stroke-width="${r2(s * 0.004)}" stroke-dasharray="${r2(s * 0.012)} ${r2(s * 0.01)}" stroke-linecap="round"/>`;
        for (let i = 0; i <= tramos; i += tipo === "interior" ? 2 : 1) c += marcador(s * 0.18 + tramo * i, y0, s * 0.045, i === tramos ? "#c0533a" : "#2d3a4a", "#f3ecdd");
      } else {
        c += ticket(izq.x + s * 0.05, izq.h - s * 0.15, s * 0.24, s * 0.1, "#e9c46a", "#f3ecdd", "#7a5a1f");
        c += ticket(der.x + der.w - s * 0.05 - s * 0.24, s * 0.06, s * 0.24, s * 0.1, "#8fb8c9", "#f3ecdd", "#2d3a4a");
      }
      if (tipo === "apertura") c += ticket(izq.x + izq.w / 2 - s * 0.14, izq.h * 0.68, s * 0.28, s * 0.11, "#e3a587", "#f3ecdd", "#7a3a24");
      return svg(m, c, defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const cinta = pos(s * 0.12 - 15 + 2);
      if (tipo === "interior-alt") return lado === "izq" ? { arriba: cinta, abajo: pos(s * 0.17 - 15 + 2) } : { arriba: pos(s * 0.17 - 15 + 2), abajo: cinta };
      return { arriba: cinta, abajo: pos(s * 0.115 - 15 + 3) };
    }, 15),
    textos: textosCon(textosClasicos({ titulo: "Caveat", texto: "Patrick Hand", color: "#2d3a4a", acento: "#c0533a", escalaTitulo: 0.13, mayusculasSubtitulo: false, ejemplos: { titulo: "Orlando en familia", subtitulo: "Nuestro diario de viaje", fecha: "Julio 2026", frase: "Lo mejor fue viajar juntos" } })),
  },
  {
    id: "eeuu-10-parques-del-oeste",
    tema: "eeuu",
    nombre: "Parques del oeste",
    descripcion: "Afiche vintage de parques nacionales: cañones, pinos y sol de la tarde.",
    papel: "#efe4cc",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.12, 1.2);
      let defs = g.defs;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#efe4cc");
      const afiche = (pg: typeof izq, id: string) => {
        const cielo = degradado(id, pg, "#f6c88f", "#efe4cc");
        defs += cielo.defs;
        let out = cielo.cuerpo + `<circle cx="${r2(pg.x + pg.w * 0.7)}" cy="${r2(pg.h * 0.68)}" r="${r2(s * 0.09)}" fill="#f3e2b8"/>`;
        out += mesetas(pg.x, pg.x + pg.w, pg.h, pg.h * 0.3, ["#c96d3f", "#9c4a2c", "#5e3324"], 31);
        out += bosque(pg.x, pg.x + pg.w, pg.h, pg.h * 0.13, "#2f4a3a", 4);
        out += `<rect x="${r2(pg.x + s * 0.03)}" y="${r2(s * 0.03)}" width="${r2(pg.w - s * 0.06)}" height="${r2(pg.h - s * 0.06)}" fill="none" stroke="#3b2a20" stroke-width="${r2(s * 0.006)}"/>`;
        return out;
      };
      if (tipo === "apertura") {
        c += afiche(izq, "a");
        c += bosque(der.x, der.x + der.w, der.h, m.altoMm * 0.1, "#2f4a3a", 8);
      } else if (tipo === "cierre") {
        c += afiche(der, "a");
        c += bosque(izq.x, izq.x + izq.w, izq.h, m.altoMm * 0.1, "#2f4a3a", 8);
      } else if (tipo === "interior") {
        c += mesetas(0, m.anchoMm, m.altoMm, m.altoMm * 0.12, ["#d98b5f", "#9c4a2c"], 13);
      } else {
        c += bosque(0, m.anchoMm, m.altoMm, m.altoMm * 0.12, "#2f4a3a", 21);
        for (const pg of [izq, der]) c += `<rect x="${r2(pg.x + s * 0.03)}" y="${r2(s * 0.03)}" width="${r2(pg.w - s * 0.06)}" height="${r2(pg.h - s * 0.06)}" fill="none" stroke="#9c4a2c" stroke-width="${r2(s * 0.004)}"/>`;
      }
      return svg(m, c + g.cuerpo, defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const titulo = esTitulo(tipo, lado);
      if (titulo) return { abajo: m.altoMm * 0.3 };
      return { abajo: pos(m.altoMm * 0.12 - 15 + 3), arriba: tipo === "interior-alt" ? pos(s * 0.04 - 15 + 2) : 0 };
    }, 15),
    textos: textosCon(
      textosClasicos({ titulo: "Merriweather", texto: "Raleway", color: "#3b2a20", acento: "#9c4a2c", escalaTitulo: 0.07, posicion: "arriba", ejemplos: { titulo: "Parques del oeste", subtitulo: "Gran Cañón · Zion · Yosemite", fecha: "Octubre 2026", frase: "La naturaleza a lo grande" } }),
      { mayusculas: true, negrita: true },
    ),
  },
];
