import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import {
  azar,
  confeti,
  degradado,
  estrellas,
  filete,
  filtroAcuarela,
  filtroMarmol,
  flor,
  fondoLiso,
  globo,
  grano,
  hoja,
  manchaAcuarela,
  paginas,
  rama,
  svg,
  type Rect,
} from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos para fiestas de 15 años.
 *
 * Las piezas que no están en `dibujo.ts` (brillos, perlas, tiara, mariposas, neón, hojas
 * tropicales, hexágonos, formas pop, encaje, luna y planeta) viven acá abajo, con la misma regla:
 * SVG en milímetros y azar de semilla fija.
 */

const f = (n: number) => Math.round(n * 100) / 100;
const todo = (m: Medidas): Rect => ({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm });
/** El lado corto de una página: la vara para medir los adornos en cualquier formato. */
const corto = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);

/** Zona clásica (lugar del título) más lo que reserva cada estilo según el pliego y la página. */
const zonaCon =
  (extra: (s: number, tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>) =>
  (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> =>
    zonaClasica(extra(corto(m), tipo, lado, m))(tipo, lado, m);

const ejemplos = { titulo: "Valentina", subtitulo: "Mis XV", fecha: "18 · 04 · 2026", frase: "Una noche para recordar" };

// ---------- Piezas propias ----------

/** Destello de cuatro puntas con lados curvos. */
function brillo(x: number, y: number, r: number, color: string, opacidad = 1, giro = 0): string {
  const k = r * 0.12;
  const d = `M 0 ${f(-r)} C ${f(k)} ${f(-k)} ${f(k)} ${f(-k)} ${f(r)} 0 C ${f(k)} ${f(k)} ${f(k)} ${f(k)} 0 ${f(r)} C ${f(-k)} ${f(k)} ${f(-k)} ${f(k)} ${f(-r)} 0 C ${f(-k)} ${f(-k)} ${f(-k)} ${f(-k)} 0 ${f(-r)} Z`;
  return `<path d="${d}" fill="${color}" opacity="${f(opacidad)}" transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

/** Destellos y puntitos al azar dentro de un área. */
function brillos(area: Rect, colores: string[], cantidad: number, semilla: number, tam: number): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < cantidad; i++) {
    const c = colores[Math.floor(rnd() * colores.length)]!;
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    out += rnd() > 0.45 ? brillo(x, y, tam * (0.35 + rnd() * 0.9), c, 0.65 + rnd() * 0.35, rnd() * 20) : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(tam * 0.1 * (0.6 + rnd()))}" fill="${c}" opacity="${f(0.5 + rnd() * 0.5)}"/>`;
  }
  return out;
}

/** Hilo de perlas colgando entre dos puntos (necesita el degradado `perla`). */
function collarPerlas(x1: number, y1: number, x2: number, y2: number, caida: number, r: number): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + 2 * caida;
  const largo = Math.hypot(x2 - x1, y2 - y1) + caida * 1.3;
  const n = Math.max(4, Math.round(largo / (r * 2.15)));
  let out = "";
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#perla)" stroke="#b9969f" stroke-width="${f(r * 0.08)}"/>`;
  }
  return out;
}

const defsPerla = `<radialGradient id="perla" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#f1e2e5"/><stop offset="1" stop-color="#a98a93"/></radialGradient>`;

/** Tiara: cinco puntas con perlas, apoyada en una base curva. */
function tiara(cx: number, base: number, ancho: number, alto: number, oro: string, grosor: number): string {
  const w = ancho / 2;
  const p = (a: number, b: number) => `${f(cx + a * w)} ${f(base - b * alto)}`;
  const d = `M ${p(-1, 0.1)} Q ${p(-0.95, 0.45)} ${p(-0.7, 0.55)} Q ${p(-0.55, 0.45)} ${p(-0.4, 0.75)} Q ${p(-0.25, 0.5)} ${p(0, 1)} Q ${p(0.25, 0.5)} ${p(0.4, 0.75)} Q ${p(0.55, 0.45)} ${p(0.7, 0.55)} Q ${p(0.95, 0.45)} ${p(1, 0.1)} Q ${p(0, -0.12)} ${p(-1, 0.1)} Z`;
  let out = `<path d="${d}" fill="none" stroke="${oro}" stroke-width="${f(grosor)}" stroke-linejoin="round"/>`;
  out += `<path d="M ${p(-0.85, 0.2)} Q ${p(0, 0.02)} ${p(0.85, 0.2)}" fill="none" stroke="${oro}" stroke-width="${f(grosor * 0.6)}"/>`;
  for (const [a, b, r] of [
    [-0.7, 0.55, 0.06],
    [-0.4, 0.75, 0.07],
    [0, 1, 0.09],
    [0.4, 0.75, 0.07],
    [0.7, 0.55, 0.06],
  ] as const) {
    out += `<circle cx="${f(cx + a * w)}" cy="${f(base - b * alto - alto * r)}" r="${f(alto * r)}" fill="url(#perla)" stroke="${oro}" stroke-width="${f(grosor * 0.4)}"/>`;
  }
  out += `<path d="M ${p(-0.06, 0.5)} L ${p(0, 0.62)} L ${p(0.06, 0.5)} L ${p(0, 0.38)} Z" fill="${oro}"/>`;
  return out;
}

/** Una mariposa vista de arriba. */
function mariposa(x: number, y: number, t: number, alaArriba: string, alaAbajo: string, giro: number, cuerpo = "#4a3a5e"): string {
  const ala = (s: 1 | -1) =>
    `<path d="M0 0 C ${f(s * t * 0.2)} ${f(-t * 0.95)} ${f(s * t * 1.15)} ${f(-t * 0.95)} ${f(s * t * 0.98)} ${f(-t * 0.25)} C ${f(s * t * 0.88)} 0 ${f(s * t * 0.3)} ${f(t * 0.02)} 0 0 Z" fill="${alaArriba}"/>` +
    `<path d="M0 0 C ${f(s * t * 0.7)} ${f(t * 0.08)} ${f(s * t * 0.82)} ${f(t * 0.7)} ${f(s * t * 0.36)} ${f(t * 0.76)} C ${f(s * t * 0.1)} ${f(t * 0.76)} 0 ${f(t * 0.3)} 0 0 Z" fill="${alaAbajo}"/>` +
    `<circle cx="${f(s * t * 0.62)}" cy="${f(-t * 0.45)}" r="${f(t * 0.09)}" fill="#ffffff" opacity="0.7"/><circle cx="${f(s * t * 0.36)}" cy="${f(t * 0.42)}" r="${f(t * 0.06)}" fill="#ffffff" opacity="0.6"/>`;
  return (
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})">${ala(-1)}${ala(1)}` +
    `<ellipse cx="0" cy="${f(t * 0.1)}" rx="${f(t * 0.07)}" ry="${f(t * 0.45)}" fill="${cuerpo}"/>` +
    `<path d="M0 ${f(-t * 0.3)} q ${f(-t * 0.1)} ${f(-t * 0.3)} ${f(-t * 0.28)} ${f(-t * 0.42)} M0 ${f(-t * 0.3)} q ${f(t * 0.1)} ${f(-t * 0.3)} ${f(t * 0.28)} ${f(-t * 0.42)}" stroke="${cuerpo}" stroke-width="${f(t * 0.035)}" fill="none" stroke-linecap="round"/></g>`
  );
}

/** Trayecto de vuelo punteado entre dos puntos. */
const vuelo = (x1: number, y1: number, x2: number, y2: number, curva: number, color: string, grosor: number) =>
  `<path d="M ${f(x1)} ${f(y1)} Q ${f((x1 + x2) / 2)} ${f((y1 + y2) / 2 + curva)} ${f(x2)} ${f(y2)}" fill="none" stroke="${color}" stroke-width="${f(grosor)}" stroke-dasharray="${f(grosor * 0.1)} ${f(grosor * 4)}" stroke-linecap="round"/>`;

/** Resplandor de neón: el trazo desenfocado debajo del trazo nítido. */
const filtroNeon = (id: string, desenfoque: number) =>
  `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(desenfoque)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

const neon = (d: string, color: string, grosor: number) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(grosor)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon)"/>`;

/** Hoja tropical grande con nervaduras. */
function hojaTropical(x: number, y: number, largo: number, angulo: number, color: string, vena: string): string {
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})">${hoja(0, 0, largo, 0, color, 0.5)}`;
  out += `<line x1="0" y1="0" x2="${f(largo * 0.95)}" y2="0" stroke="${vena}" stroke-width="${f(largo * 0.012)}"/>`;
  for (let i = 1; i <= 5; i++) {
    const t = i / 6.5;
    const ab = largo * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.75;
    out += `<path d="M ${f(largo * t)} 0 q ${f(largo * 0.05)} ${f(-ab * 0.6)} ${f(largo * 0.12)} ${f(-ab)} M ${f(largo * t)} 0 q ${f(largo * 0.05)} ${f(ab * 0.6)} ${f(largo * 0.12)} ${f(ab)}" stroke="${vena}" stroke-width="${f(largo * 0.008)}" fill="none"/>`;
  }
  return `${out}</g>`;
}

/** Hibisco: cinco pétalos grandes con estambre. */
function hibisco(x: number, y: number, r: number, color: string, centro: string, giro: number): string {
  return (
    flor(x, y, r, color, centro, 5, giro) +
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro + 30)})"><line x1="0" y1="0" x2="${f(r * 0.85)}" y2="0" stroke="#f6d365" stroke-width="${f(r * 0.06)}"/><circle cx="${f(r * 0.85)}" cy="0" r="${f(r * 0.08)}" fill="#f6d365"/></g>`
  );
}

/** Hexágono de contorno. */
function hexagono(cx: number, cy: number, r: number, trazo: string, grosor: number, giro = 0, relleno = "none", opacidad = 1): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 + giro) * Math.PI) / 180;
    p.push(`${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}`);
  }
  return `<polygon points="${p.join(" ")}" fill="${relleno}" stroke="${trazo}" stroke-width="${f(grosor)}" opacity="${f(opacidad)}"/>`;
}

/** Formas pop (estilo Memphis) repartidas en una franja. */
function formasPop(area: Rect, colores: string[], cantidad: number, semilla: number, tam: number): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < cantidad; i++) {
    const c = colores[i % colores.length]!;
    const x = area.x + ((i + 0.2 + rnd() * 0.6) / cantidad) * area.w;
    const y = area.y + tam * 0.6 + rnd() * Math.max(0, area.h - tam * 1.2);
    const s = tam * (0.6 + rnd() * 0.5);
    const g = rnd() * 360;
    const k = i % 5;
    if (k === 0) {
      let d = `M ${f(-s)} 0`;
      for (let j = 0; j < 4; j++) d += ` l ${f(s * 0.5)} ${f(j % 2 ? s * 0.4 : -s * 0.4)}`;
      out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(tam * 0.12)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f(x)} ${f(y)}) rotate(${f(g)})"/>`;
    } else if (k === 1) {
      out += `<path d="M 0 ${f(-s * 0.55)} L ${f(s * 0.5)} ${f(s * 0.35)} L ${f(-s * 0.5)} ${f(s * 0.35)} Z" fill="${c}" transform="translate(${f(x)} ${f(y)}) rotate(${f(g)})"/>`;
    } else if (k === 2) {
      out += `<path d="M ${f(-s)} 0 q ${f(s * 0.25)} ${f(-s * 0.5)} ${f(s * 0.5)} 0 t ${f(s * 0.5)} 0 t ${f(s * 0.5)} 0 t ${f(s * 0.5)} 0" fill="none" stroke="${c}" stroke-width="${f(tam * 0.12)}" stroke-linecap="round" transform="translate(${f(x)} ${f(y)}) rotate(${f(g)})"/>`;
    } else if (k === 3) {
      out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.42)}" fill="none" stroke="${c}" stroke-width="${f(tam * 0.12)}"/>`;
    } else {
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out += `<circle cx="${f(x + (a - 1) * s * 0.35)}" cy="${f(y + (b - 1) * s * 0.35)}" r="${f(s * 0.07)}" fill="${c}"/>`;
    }
  }
  return out;
}

/** Puntilla de encaje sobre el borde superior (arriba = true) o inferior de una página. */
function puntilla(p: Rect, alto: number, arriba: boolean, papel: string, hilo: string, acento: string): string {
  const n = Math.max(6, Math.round(p.w / (alto * 0.9)));
  const paso = p.w / n;
  const r = paso / 2;
  const y0 = arriba ? p.y : p.y + p.h;
  const s = arriba ? 1 : -1;
  const yb = y0 + s * alto;
  let d = `M ${f(p.x)} ${f(y0)} L ${f(p.x)} ${f(yb)}`;
  for (let i = 0; i < n; i++) d += ` A ${f(r)} ${f(r * 0.8)} 0 0 ${arriba ? 0 : 1} ${f(p.x + (i + 1) * paso)} ${f(yb)}`;
  d += ` L ${f(p.x + p.w)} ${f(y0)} Z`;
  let out = `<path d="${d}" fill="${papel}" stroke="${hilo}" stroke-width="${f(alto * 0.025)}"/>`;
  for (let i = 0; i < n; i++) {
    const cx = p.x + (i + 0.5) * paso;
    out += `<circle cx="${f(cx)}" cy="${f(yb + s * r * 0.35)}" r="${f(r * 0.18)}" fill="none" stroke="${hilo}" stroke-width="${f(alto * 0.02)}"/>`;
    out += `<circle cx="${f(cx)}" cy="${f(y0 + s * alto * 0.5)}" r="${f(alto * 0.09)}" fill="none" stroke="${hilo}" stroke-width="${f(alto * 0.02)}"/>`;
    out += `<circle cx="${f(cx + paso / 2)}" cy="${f(y0 + s * alto * 0.5)}" r="${f(alto * 0.04)}" fill="${hilo}" opacity="0.6"/>`;
  }
  out += `<line x1="${f(p.x)}" y1="${f(y0 + s * alto * 0.2)}" x2="${f(p.x + p.w)}" y2="${f(y0 + s * alto * 0.2)}" stroke="${acento}" stroke-width="${f(alto * 0.08)}"/>`;
  return out;
}

/** Medallón de encaje: anillos de puntitos alrededor de un centro. */
function medallonEncaje(cx: number, cy: number, r: number, hilo: string): string {
  let out = `<g opacity="0.85">`;
  for (const [k, n] of [
    [1, 48],
    [0.86, 36],
    [0.72, 28],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out += `<circle cx="${f(cx + Math.cos(a) * r * k)}" cy="${f(cy + Math.sin(a) * r * k)}" r="${f(r * (k === 1 ? 0.035 : 0.018))}" fill="none" stroke="${hilo}" stroke-width="${f(r * 0.01)}"/>`;
    }
  }
  out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.93)}" fill="none" stroke="${hilo}" stroke-width="${f(r * 0.005)}"/>`;
  return `${out}</g>`;
}

/** Luna creciente. */
function luna(x: number, y: number, r: number, color: string, giro = -20): string {
  return `<path d="M 0 ${f(-r)} A ${f(r)} ${f(r)} 0 1 0 0 ${f(r)} A ${f(r * 1.3)} ${f(r * 1.3)} 0 0 1 0 ${f(-r)} Z" fill="${color}" transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

/** Planeta con anillo. */
function planeta(x: number, y: number, r: number, color: string, anillo: string): string {
  return (
    `<g transform="translate(${f(x)} ${f(y)}) rotate(-18)">` +
    `<path d="M ${f(-r * 1.8)} 0 A ${f(r * 1.8)} ${f(r * 0.45)} 0 0 1 ${f(r * 1.8)} 0" fill="none" stroke="${anillo}" stroke-width="${f(r * 0.12)}"/>` +
    `<circle r="${f(r)}" fill="${color}"/><path d="M ${f(-r * 0.9)} ${f(-r * 0.3)} Q 0 ${f(-r * 0.1)} ${f(r * 0.9)} ${f(-r * 0.35)}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="${f(r * 0.12)}" fill="none"/>` +
    `<path d="M ${f(-r * 1.8)} 0 A ${f(r * 1.8)} ${f(r * 0.45)} 0 0 0 ${f(r * 1.8)} 0" fill="none" stroke="${anillo}" stroke-width="${f(r * 0.12)}"/></g>`
  );
}

/** Estrella fugaz: una estela que se afina y un destello en la punta. */
function fugaz(x: number, y: number, largo: number, angulo: number, color: string): string {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})"><path d="M 0 0 L ${f(-largo)} ${f(-largo * 0.012)} L ${f(-largo)} ${f(largo * 0.012)} Z" fill="${color}" opacity="0.6"/>${brillo(0, 0, largo * 0.08, color)}</g>`;
}

// ---------- Estilos ----------

export const XV: EstiloFotolibro[] = [
  {
    id: "xv-01-perlas-y-rosa",
    tema: "xv",
    nombre: "Perlas y rosa",
    descripcion: "Rosa empolvado con hilos de perlas y una tiara dorada. Delicado y de princesa.",
    papel: "#fbeff1",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const fondo = degradado("r", todo(m), "#fcf2f4", "#f6e0e6");
      const r = s * 0.012;
      const oro = "#c9a45c";
      let c = fondo.cuerpo;
      const guirnalda = (p: Rect, larga: boolean) => {
        let out = collarPerlas(p.x, -r, p.x + p.w / 2, -r, s * 0.035, r) + collarPerlas(p.x + p.w / 2, -r, p.x + p.w, -r, s * 0.035, r);
        if (larga) out = collarPerlas(p.x, -r, p.x + p.w, -r, s * 0.06, r * 0.85) + out;
        return out;
      };
      if (tipo === "apertura") {
        c += guirnalda(izq, true) + guirnalda(der, false);
        c += tiara(izq.x + izq.w / 2, izq.h * 0.26, s * 0.24, s * 0.1, oro, Math.max(0.3, s * 0.004));
        c += brillos({ x: izq.x + izq.w * 0.25, y: izq.h * 0.14, w: izq.w * 0.5, h: izq.h * 0.12 }, [oro, "#ffffff"], 8, 3, s * 0.02);
      } else if (tipo === "interior") {
        c += guirnalda(izq, false) + guirnalda(der, false);
      } else if (tipo === "interior-alt") {
        c += guirnalda(der, true);
        c += brillos({ x: izq.x + s * 0.03, y: izq.h - s * 0.09, w: izq.w * 0.4, h: s * 0.07 }, [oro, "#ffffff"], 10, 7, s * 0.02);
      } else {
        c += guirnalda(izq, true) + guirnalda(der, true);
        c += tiara(der.x + der.w / 2, der.h - s * 0.08, s * 0.14, s * 0.06, oro, Math.max(0.3, s * 0.004));
      }
      return svg(m, c, fondo.defs + defsPerla);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "interior") return { arriba: s * 0.06 };
      if (tipo === "interior-alt") return lado === "der" ? { arriba: s * 0.09 } : { abajo: s * 0.06 };
      if (tipo === "cierre" && lado === "der") return { abajo: s * 0.12 };
      return { arriba: s * 0.09 };
    }),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Montserrat", color: "#a24d6c", acento: "#b8924a", ejemplos, escalaTitulo: 0.12 }),
  },
  {
    id: "xv-02-noche-de-gala",
    tema: "xv",
    nombre: "Noche de gala",
    descripcion: "Negro y dorado con destellos en las esquinas. Para una fiesta de noche, bien elegante.",
    papel: "#0f0e0c",
    margenMm: 17,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const oro = "#d4af37";
      const colores = [oro, "#f5e3a1", "#ffffff"];
      const fondo = degradado("n", todo(m), "#0b0b0b", "#221d14");
      const gr = Math.max(0.25, s * 0.0025);
      let c = fondo.cuerpo;
      for (const p of [izq, der]) c += filete(p, s * 0.035, oro, gr) + filete(p, s * 0.045, oro, gr * 0.5);
      const banda = (p: Rect, arriba: boolean, sem: number, izquierda: boolean) =>
        brillos({ x: izquierda ? p.x + s * 0.06 : p.x + p.w * 0.55, y: arriba ? s * 0.055 : p.h - s * 0.12, w: p.w * 0.4, h: s * 0.065 }, colores, 14, sem, s * 0.03);
      const alt = tipo === "interior-alt";
      c += banda(izq, !alt, 3, true) + banda(der, alt, 7, false);
      const adorno = (cx: number, cy: number, w: number) =>
        `<line x1="${f(cx - w)}" y1="${f(cy)}" x2="${f(cx - s * 0.03)}" y2="${f(cy)}" stroke="${oro}" stroke-width="${f(gr)}"/><line x1="${f(cx + s * 0.03)}" y1="${f(cy)}" x2="${f(cx + w)}" y2="${f(cy)}" stroke="${oro}" stroke-width="${f(gr)}"/>` +
        `<path d="M ${f(cx)} ${f(cy - s * 0.02)} L ${f(cx + s * 0.014)} ${f(cy)} L ${f(cx)} ${f(cy + s * 0.02)} L ${f(cx - s * 0.014)} ${f(cy)} Z" fill="${oro}"/>`;
      if (tipo === "apertura") c += adorno(izq.x + izq.w / 2, izq.h * 0.25, izq.w * 0.22) + brillo(izq.x + izq.w / 2, izq.h * 0.19, s * 0.025, "#f5e3a1");
      if (tipo === "cierre") c += adorno(der.x + der.w / 2, der.h * 0.08, der.w * 0.18);
      return svg(m, c, fondo.defs);
    },
    zona: zonaCon((s) => ({ arriba: s * 0.07, abajo: s * 0.07, exterior: s * 0.02, interior: s * 0.02 })),
    textos: textosClasicos({ titulo: "Parisienne", texto: "Raleway", color: "#e3c565", acento: "#f1e6c8", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "xv-03-mariposas",
    tema: "xv",
    nombre: "Mariposas",
    descripcion: "Mariposas lilas y rosas que vuelan por las páginas. Fresco y soñador.",
    papel: "#f7f2fc",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const t = s * 0.055;
      const camino = "#b7a2d6";
      const gr = Math.max(0.5, s * 0.006);
      const pal: [string, string][] = [
        ["#9b7fd1", "#c9b3ec"],
        ["#e79bc4", "#f4c7de"],
        ["#7d9de0", "#b9cdf3"],
      ];
      let c = fondoLiso(todo(m), "#f7f2fc");
      const m1 = (x: number, y: number, k: number, i: number, g: number) => mariposa(x, y, t * k, pal[i % 3]![0], pal[i % 3]![1], g);
      if (tipo === "apertura") {
        c += vuelo(izq.x + s * 0.02, izq.h * 0.2, izq.x + izq.w * 0.8, izq.h * 0.07, s * 0.04, camino, gr);
        c += m1(izq.x + izq.w * 0.84, izq.h * 0.075, 1.1, 0, 25) + m1(izq.x + izq.w * 0.45, izq.h * 0.15, 0.7, 1, 10) + m1(izq.x + izq.w * 0.18, izq.h * 0.19, 0.5, 2, -5);
        c += vuelo(der.x + der.w * 0.55, der.h - s * 0.03, der.x + der.w - s * 0.05, der.h - s * 0.12, s * 0.02, camino, gr);
        c += m1(der.x + der.w - s * 0.07, der.h - s * 0.1, 0.95, 1, 30) + m1(der.x + der.w * 0.68, der.h - s * 0.05, 0.6, 2, 15);
      } else if (tipo === "interior") {
        c += vuelo(der.x + der.w * 0.5, s * 0.1, der.x + der.w - s * 0.06, s * 0.06, -s * 0.03, camino, gr);
        c += m1(der.x + der.w - s * 0.06, s * 0.06, 0.9, 0, 35) + m1(der.x + der.w * 0.62, s * 0.075, 0.55, 1, 10);
      } else if (tipo === "interior-alt") {
        c += vuelo(izq.x + s * 0.04, izq.h - s * 0.04, izq.x + izq.w * 0.5, izq.h - s * 0.09, s * 0.03, camino, gr);
        c += m1(izq.x + izq.w * 0.5, izq.h - s * 0.085, 0.9, 2, 40) + m1(izq.x + izq.w * 0.2, izq.h - s * 0.05, 0.55, 0, 20);
      } else {
        c += m1(izq.x + s * 0.06, s * 0.06, 0.7, 1, -20);
        c += vuelo(der.x + der.w * 0.2, der.h - s * 0.04, der.x + der.w * 0.7, der.h - s * 0.2, -s * 0.05, camino, gr);
        c += m1(der.x + der.w * 0.72, der.h - s * 0.2, 1.2, 0, 30) + m1(der.x + der.w * 0.45, der.h - s * 0.1, 0.7, 1, 15) + m1(der.x + der.w * 0.85, der.h - s * 0.09, 0.55, 2, 45);
      }
      return svg(m, c);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "apertura") return lado === "der" ? { abajo: s * 0.1 } : {};
      if (tipo === "interior") return lado === "der" ? { arriba: s * 0.08 } : {};
      if (tipo === "interior-alt") return lado === "izq" ? { abajo: s * 0.08 } : {};
      return lado === "izq" ? { arriba: s * 0.06 } : { abajo: s * 0.22 };
    }),
    textos: textosClasicos({ titulo: "Satisfy", texto: "Nunito", color: "#6a4c93", acento: "#c06c9c", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "xv-04-neon",
    tema: "xv",
    nombre: "Neón",
    descripcion: "Fondo oscuro con líneas de neón fucsia, cian y violeta. Para una fiesta bien moderna.",
    papel: "#0d0a1e",
    margenMm: 15,
    esquinasMm: 1.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const fucsia = "#ff3ea5";
      const cian = "#2de2e6";
      const violeta = "#a26bff";
      const gr = Math.max(0.5, s * 0.0055);
      const fondo = degradado("n", todo(m), "#0d0a1e", "#1a1036");
      let c = fondo.cuerpo;
      const R = s * 0.11;
      const arcoEsq = (cx: number, cy: number, sx: 1 | -1, sy: 1 | -1, color: string) =>
        neon(`M ${f(cx + sx * R)} ${f(cy)} A ${f(R)} ${f(R)} 0 0 ${sx * sy > 0 ? 1 : 0} ${f(cx)} ${f(cy + sy * R)}`, color, gr) +
        neon(`M ${f(cx + sx * R * 0.7)} ${f(cy)} A ${f(R * 0.7)} ${f(R * 0.7)} 0 0 ${sx * sy > 0 ? 1 : 0} ${f(cx)} ${f(cy + sy * R * 0.7)}`, violeta, gr * 0.8);
      const zigzag = (x: number, y: number, w: number, color: string) => {
        let d = `M ${f(x)} ${f(y)}`;
        for (let i = 1; i <= 6; i++) d += ` L ${f(x + (w * i) / 6)} ${f(y + (i % 2 ? -1 : 1) * s * 0.012)}`;
        return neon(d, color, gr);
      };
      const triangulo = (x: number, y: number, r: number, color: string) => neon(`M ${f(x)} ${f(y - r)} L ${f(x + r * 0.87)} ${f(y + r * 0.5)} L ${f(x - r * 0.87)} ${f(y + r * 0.5)} Z`, color, gr * 0.8);
      const marco = (p: Rect, y0: number, y1: number) => {
        const x0 = p.x + p.w * 0.07;
        const x1 = p.x + p.w * 0.93;
        const rr = s * 0.03;
        return neon(`M ${f(x0 + rr)} ${f(y0)} L ${f(x1 - rr)} ${f(y0)} Q ${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + rr)} L ${f(x1)} ${f(y1 - rr)} Q ${f(x1)} ${f(y1)} ${f(x1 - rr)} ${f(y1)} L ${f(x0 + rr)} ${f(y1)} Q ${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - rr)} L ${f(x0)} ${f(y0 + rr)} Q ${f(x0)} ${f(y0)} ${f(x0 + rr)} ${f(y0)} Z`, fucsia, gr);
      };
      if (tipo === "apertura") {
        c += marco(izq, izq.h * 0.24, izq.h * 0.6) + zigzag(izq.x + s * 0.05, s * 0.06, s * 0.14, cian) + triangulo(izq.x + izq.w - s * 0.07, s * 0.07, s * 0.025, violeta);
        c += arcoEsq(der.x + der.w, der.h, -1, -1, cian) + triangulo(der.x + der.w - s * 0.2, der.h - s * 0.05, s * 0.022, fucsia);
      } else if (tipo === "interior") {
        c += arcoEsq(izq.x, 0, 1, 1, cian) + arcoEsq(der.x + der.w, der.h, -1, -1, fucsia);
      } else if (tipo === "interior-alt") {
        c += zigzag(der.x + der.w * 0.55, s * 0.06, der.w * 0.38, fucsia) + triangulo(der.x + der.w * 0.45, s * 0.06, s * 0.022, cian);
        c += arcoEsq(izq.x, izq.h, 1, -1, cian);
      } else {
        c += marco(der, der.h * 0.08, der.h * 0.29) + arcoEsq(izq.x, izq.h, 1, -1, fucsia) + zigzag(der.x + der.w * 0.3, der.h - s * 0.06, der.w * 0.4, cian);
      }
      return svg(m, c, fondo.defs + filtroNeon("neon", s * 0.006));
    },
    zona: zonaCon((s, tipo, lado) => {
      const z = s * 0.09;
      if (tipo === "apertura") return lado === "der" ? { abajo: z } : {};
      if (tipo === "interior") return lado === "izq" ? { arriba: z } : { abajo: z };
      if (tipo === "interior-alt") return lado === "der" ? { arriba: z } : { abajo: z };
      return lado === "izq" ? { abajo: z } : { abajo: z };
    }),
    textos: textosClasicos({ titulo: "Pacifico", texto: "Poppins", color: "#ff7ad1", acento: "#7ef3f5", ejemplos, escalaTitulo: 0.09 }),
  },
  {
    id: "xv-05-jardin-acuarela",
    tema: "xv",
    nombre: "Jardín en acuarela",
    descripcion: "Flores grandes pintadas en durazno y coral, con hojas verde salvia. Romántico y luminoso.",
    papel: "#fffaf5",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const fuerte = tipo === "apertura" || tipo === "cierre";
      const k = fuerte ? 1 : 0.75;
      const g = grano("g", m, 0.04);
      let c = fondoLiso(todo(m), "#fffaf5");
      const ramo = (cx: number, cy: number, sx: 1 | -1, sy: 1 | -1, sem: number) => {
        const rnd = azar(sem);
        let out = manchaAcuarela(cx + sx * s * 0.08, cy + sy * s * 0.05, s * 0.2 * k, "#f6c3ae", "a", sem, 3);
        // Ramas que corren junto al borde, para no meterse en las fotos.
        out += rama(cx + sx * s * 0.02, cy + sy * s * 0.03, s * 0.38 * k, sx > 0 ? 6 * sy : 180 - 6 * sy, "#9db59a", sem + 1, { tallo: "#7f9a7c" });
        out += rama(cx + sx * s * 0.03, cy + sy * s * 0.02, s * 0.22 * k, sy > 0 ? 90 - 18 * sx : -90 + 18 * sx, "#b7c9a8", sem + 2, { redondas: true, tallo: "#7f9a7c" });
        const flores: [number, number, number, string][] = [
          [0.07, 0.05, 0.075, "#f08f7a"],
          [0.17, 0.035, 0.055, "#f7b39d"],
          [0.03, 0.13, 0.045, "#e9a2b0"],
          [0.25, 0.02, 0.035, "#f08f7a"],
        ];
        for (const [dx, dy, r, color] of flores) {
          const x = cx + sx * s * dx * k;
          const y = cy + sy * s * dy * k;
          out += `<g filter="url(#a)" opacity="0.85">${flor(x, y, s * r * k, color, "#c96a52", 6, rnd() * 60)}</g>`;
          out += flor(x, y, s * r * k * 0.45, "#ffffff", "#d9824f", 6, rnd() * 60, 0.45);
        }
        return out;
      };
      if (tipo === "interior-alt") c += ramo(der.x + der.w, 0, -1, 1, 11) + ramo(izq.x, izq.h, 1, -1, 17);
      else c += ramo(izq.x, 0, 1, 1, 3) + ramo(der.x + der.w, der.h, -1, -1, 7);
      return svg(m, c + g.cuerpo, filtroAcuarela("a", 5) + g.defs);
    },
    zona: zonaCon((s, tipo, lado) => {
      const z = { arriba: 0, abajo: 0, exterior: s * 0.04 };
      const alt = tipo === "interior-alt";
      if ((lado === "izq") !== alt) z.arriba = s * 0.12;
      else z.abajo = s * 0.12;
      return z;
    }),
    textos: textosClasicos({ titulo: "Dancing Script", texto: "Lora", color: "#b5584a", acento: "#7f9a7c", ejemplos, escalaTitulo: 0.11 }),
  },
  {
    id: "xv-06-galaxia",
    tema: "xv",
    nombre: "Galaxia",
    descripcion: "Violeta profundo con nebulosas, estrellas, luna y planeta. Para soñar en grande.",
    papel: "#1c0f42",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const total = todo(m);
      const fondo = degradado("n", total, "#140a33", "#3b1d6e", false);
      const oro = "#f1d98a";
      let c = fondo.cuerpo;
      const nube = (x: number, y: number, r: number, id: string) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${id})"/>`;
      c += nube(izq.x + izq.w * 0.2, izq.h * 0.85, s * 0.55, "nm") + nube(der.x + der.w * 0.8, der.h * 0.15, s * 0.55, "nc");
      c += nube(izq.x + izq.w * 0.9, izq.h * 0.1, s * 0.3, "nc");
      if (tipo === "interior-alt") c += nube(m.anchoMm / 2, m.altoMm / 2, s * 0.45, "nr");
      c += estrellas(total, "#ffffff", Math.round((m.anchoMm * m.altoMm) / (s * s) * 60), 21, s * 0.012);
      c += estrellas(total, oro, Math.round((m.anchoMm * m.altoMm) / (s * s) * 8), 5, s * 0.016);
      if (tipo === "apertura") {
        c += luna(izq.x + izq.w / 2, izq.h * 0.17, s * 0.05, oro);
        c += planeta(der.x + der.w - s * 0.12, der.h - s * 0.08, s * 0.035, "#e58ac8", "#f1d98a");
      } else if (tipo === "interior") {
        c += planeta(der.x + der.w - s * 0.1, s * 0.07, s * 0.028, "#7fc8f0", "#f1d98a");
      } else if (tipo === "interior-alt") {
        c += fugaz(izq.x + izq.w * 0.45, izq.h - s * 0.07, s * 0.3, -12, "#ffffff");
      } else {
        c += luna(der.x + der.w / 2, der.h - s * 0.1, s * 0.045, oro, 200);
        c += fugaz(izq.x + izq.w * 0.5, s * 0.06, s * 0.3, 10, "#ffffff");
      }
      const nebulosa = (id: string, color: string) => `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="0.55"/><stop offset="0.5" stop-color="${color}" stop-opacity="0.22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
      const neb = nebulosa("nm", "#c04fd8") + nebulosa("nc", "#3fb6e8") + nebulosa("nr", "#e05aa0");
      return svg(m, c, fondo.defs + neb);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "apertura") return lado === "der" ? { abajo: s * 0.1 } : {};
      if (tipo === "interior") return lado === "der" ? { arriba: s * 0.08 } : {};
      if (tipo === "interior-alt") return lado === "izq" ? { abajo: s * 0.06 } : {};
      return lado === "izq" ? { arriba: s * 0.06 } : { abajo: s * 0.16 };
    }),
    textos: textosClasicos({ titulo: "Tangerine", texto: "Quicksand", color: "#f6ecff", acento: "#f1d98a", ejemplos, escalaTitulo: 0.15 }),
  },
  {
    id: "xv-07-tropical",
    tema: "xv",
    nombre: "Tropical",
    descripcion: "Hojas de selva y flores de hibisco fucsia. Alegre, para una fiesta de verano.",
    papel: "#fffdf6",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const k = tipo === "apertura" || tipo === "cierre" ? 1.25 : 1;
      let c = fondoLiso(todo(m), "#fffdf6");
      const selva = (cx: number, cy: number, sx: 1 | -1, sy: 1 | -1, sem: number) => {
        const ang = (base: number) => (sx > 0 ? base * sy : 180 - base * sy);
        let out = rama(cx, cy + sy * s * 0.02, s * 0.42 * k, ang(4), "#3f9b6e", sem, { hojas: 16, tamHoja: s * 0.07 * k, anchoHoja: 0.16, tallo: "#2f7d5b" });
        out += hojaTropical(cx, cy, s * 0.24 * k, ang(16), "#2f7d5b", "#5fae7b");
        out += hojaTropical(cx, cy, s * 0.2 * k, ang(62), "#5fae7b", "#8fcf9f");
        out += hojaTropical(cx + sx * s * 0.01, cy, s * 0.15 * k, ang(38), "#1f6b4b", "#3f9b6e");
        out += hibisco(cx + sx * s * 0.17 * k, cy + sy * s * 0.05 * k, s * 0.04 * k, "#e5446d", "#a91f48", 15);
        out += hibisco(cx + sx * s * 0.06 * k, cy + sy * s * 0.12 * k, s * 0.03 * k, "#ff7b9c", "#c2325a", 50);
        out += flor(cx + sx * s * 0.27 * k, cy + sy * s * 0.03 * k, s * 0.018 * k, "#ffb347", "#e5446d", 5, 20);
        return out;
      };
      if (tipo === "interior-alt") c += selva(der.x + der.w, 0, -1, 1, 11) + selva(izq.x, izq.h, 1, -1, 17);
      else c += selva(izq.x, 0, 1, 1, 3) + selva(der.x + der.w, der.h, -1, -1, 7);
      return svg(m, c);
    },
    zona: zonaCon((s, tipo, lado) => {
      const z = { arriba: 0, abajo: 0, exterior: s * 0.05 };
      const alt = tipo === "interior-alt";
      if ((lado === "izq") !== alt) z.arriba = s * 0.15;
      else z.abajo = s * 0.15;
      return z;
    }),
    textos: textosClasicos({ titulo: "Courgette", texto: "Nunito", color: "#1f5e45", acento: "#e5446d", ejemplos, escalaTitulo: 0.1 }),
  },
  {
    id: "xv-08-rose-gold",
    tema: "xv",
    nombre: "Rose gold geométrico",
    descripcion: "Mármol blanco con hexágonos en rose gold. Sofisticado y actual.",
    papel: "#f8f5f3",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const rg = "url(#rg)";
      const gr = Math.max(0.35, s * 0.004);
      let c = fondoLiso(todo(m), "#f8f5f3");
      c += `<rect width="${f(m.anchoMm)}" height="${f(m.altoMm)}" filter="url(#mm)" opacity="${tipo === "interior" ? 0.16 : 0.24}"/>`;
      const racimo = (cx: number, cy: number, sx: 1 | -1, sy: 1 | -1) => {
        const r = s * 0.085;
        return (
          hexagono(cx + sx * r * 0.4, cy + sy * r * 0.2, r * 1.2, rg, gr, 0) +
          hexagono(cx + sx * r * 1.9, cy + sy * r * 0.15, r * 0.7, rg, gr * 0.8, 0, "#e8b4a0", 0.35) +
          hexagono(cx + sx * r * 0.25, cy + sy * r * 1.55, r * 0.55, rg, gr * 0.8, 0) +
          hexagono(cx + sx * r * 2.9, cy + sy * r * 0.6, r * 0.32, rg, gr * 0.7, 0, "#c98f7a", 0.8)
        );
      };
      const marco = (p: Rect, cy: number, hy: number) => {
        const cx = p.x + p.w / 2;
        const W = p.w * 0.44;
        const pts = (k: number) =>
          [
            [cx - W * k, cy],
            [cx - W * k + hy * k * 0.8, cy - hy * k],
            [cx + W * k - hy * k * 0.8, cy - hy * k],
            [cx + W * k, cy],
            [cx + W * k - hy * k * 0.8, cy + hy * k],
            [cx - W * k + hy * k * 0.8, cy + hy * k],
          ]
            .map(([a, b]) => `${f(a!)},${f(b!)}`)
            .join(" ");
        return `<polygon points="${pts(1)}" fill="none" stroke="${rg}" stroke-width="${f(gr)}"/><polygon points="${pts(0.94)}" fill="none" stroke="${rg}" stroke-width="${f(gr * 0.5)}"/>`;
      };
      if (tipo === "apertura") c += marco(izq, izq.h * 0.42, izq.h * 0.17) + racimo(der.x + der.w, der.h, -1, -1);
      else if (tipo === "interior") c += racimo(izq.x, 0, 1, 1) + racimo(der.x + der.w, der.h, -1, -1);
      else if (tipo === "interior-alt") c += racimo(izq.x, izq.h, 1, -1) + racimo(der.x + der.w, 0, -1, 1);
      else c += racimo(izq.x, izq.h, 1, -1) + marco(der, der.h * 0.19, der.h * 0.1);
      const defs = `<linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b76e79"/><stop offset="0.5" stop-color="#e8b4a0"/><stop offset="1" stop-color="#c98f7a"/></linearGradient>`;
      return svg(m, c, defs + filtroMarmol("mm", 17));
    },
    zona: zonaCon((s, tipo, lado) => {
      const z = s * 0.13;
      if (tipo === "apertura") return lado === "der" ? { abajo: z } : {};
      if (tipo === "interior") return lado === "izq" ? { arriba: z } : { abajo: z };
      if (tipo === "interior-alt") return lado === "izq" ? { abajo: z } : { arriba: z };
      return lado === "izq" ? { abajo: z } : {};
    }),
    textos: textosClasicos({ titulo: "Allura", texto: "Montserrat", color: "#a8685a", acento: "#c98f7a", ejemplos, escalaTitulo: 0.12 }),
  },
  {
    id: "xv-09-pop-fiesta",
    tema: "xv",
    nombre: "Pop fiesta",
    descripcion: "Globos, confeti y formas pop en fucsia, amarillo y turquesa. Puro color.",
    papel: "#fffaf0",
    margenMm: 14,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const colores = ["#ff4f9a", "#ffc93c", "#2ec4b6", "#7b5cff"];
      let c = fondoLiso(todo(m), "#fffaf0");
      const franja = (p: Rect, arriba: boolean, sem: number) => {
        const h = s * 0.09;
        const area = { x: p.x + s * 0.03, y: arriba ? s * 0.02 : p.h - h - s * 0.02, w: p.w - s * 0.06, h };
        return formasPop(area, colores, Math.max(5, Math.round(p.w / (s * 0.1))), sem, s * 0.04) + confeti(area, colores, Math.round(p.w / (s * 0.03)), sem + 1, s * 0.012);
      };
      if (tipo === "apertura") {
        const r = s * 0.04;
        c += globo(izq.x + s * 0.09, s * 0.07, r, "#ff4f9a", "#c7c7c7", 2.6) + globo(izq.x + s * 0.17, s * 0.05, r * 0.9, "#ffc93c", "#c7c7c7", 3) + globo(izq.x + s * 0.24, s * 0.08, r * 0.8, "#2ec4b6", "#c7c7c7", 2.4);
        c += globo(izq.x + izq.w - s * 0.1, s * 0.06, r * 0.9, "#7b5cff", "#c7c7c7", 2.8) + globo(izq.x + izq.w - s * 0.18, s * 0.085, r * 0.75, "#ff4f9a", "#c7c7c7", 2.4);
        c += confeti({ x: izq.x + izq.w * 0.3, y: s * 0.02, w: izq.w * 0.4, h: izq.h * 0.18 }, colores, 22, 9, s * 0.012);
        c += franja(der, false, 13);
      } else if (tipo === "interior") {
        c += franja(izq, true, 17) + franja(der, false, 19);
      } else if (tipo === "interior-alt") {
        c += franja(izq, false, 23) + franja(der, true, 29);
      } else {
        c += franja(izq, false, 31) + franja(der, false, 37);
        c += confeti({ x: der.x + der.w * 0.15, y: s * 0.02, w: der.w * 0.7, h: der.h * 0.08 }, colores, 16, 41, s * 0.012);
      }
      return svg(m, c);
    },
    zona: zonaCon((s, tipo, lado) => {
      const z = s * 0.1;
      if (tipo === "apertura") return lado === "der" ? { abajo: z } : {};
      if (tipo === "interior") return lado === "izq" ? { arriba: z } : { abajo: z };
      if (tipo === "interior-alt") return lado === "izq" ? { abajo: z } : { arriba: z };
      return { abajo: z };
    }),
    textos: textosClasicos({ titulo: "Permanent Marker", texto: "Poppins", color: "#2b2d42", acento: "#ff4f9a", ejemplos, escalaTitulo: 0.1 }),
  },
  {
    id: "xv-10-encaje-vintage",
    tema: "xv",
    nombre: "Encaje vintage",
    descripcion: "Marfil con puntillas de encaje y cinta celeste empolvado. Romántico y clásico.",
    papel: "#f3ece0",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = corto(m);
      const g = grano("g", m, 0.06);
      const papel = "#fffdf9";
      const hilo = "#b29c78";
      const acento = "#8fadc1";
      const alto = s * 0.07;
      let c = fondoLiso(todo(m), "#f3ece0");
      for (const p of [izq, der]) {
        c += puntilla(p, alto, true, papel, hilo, acento);
        if (tipo !== "interior-alt") c += puntilla(p, alto, false, papel, hilo, acento);
      }
      if (tipo === "apertura") c += medallonEncaje(izq.x + izq.w / 2, izq.h * 0.19, Math.min(izq.w * 0.12, izq.h * 0.075), "#a88f68");
      if (tipo === "interior-alt") {
        // Un moño de cinta celeste al pie de la página derecha.
        const cx = der.x + der.w - s * 0.1;
        const cy = der.h - s * 0.06;
        const b = s * 0.03;
        c += `<g fill="none" stroke="${acento}" stroke-width="${f(s * 0.006)}" stroke-linecap="round"><path d="M ${f(cx)} ${f(cy)} C ${f(cx - b)} ${f(cy - b * 1.2)} ${f(cx - b * 1.7)} ${f(cy - b * 0.1)} ${f(cx)} ${f(cy)} C ${f(cx + b * 1.7)} ${f(cy - b * 0.1)} ${f(cx + b)} ${f(cy - b * 1.2)} ${f(cx)} ${f(cy)}"/><path d="M ${f(cx)} ${f(cy)} q ${f(-b * 0.4)} ${f(b)} ${f(-b * 0.9)} ${f(b * 1.4)} M ${f(cx)} ${f(cy)} q ${f(b * 0.4)} ${f(b)} ${f(b * 0.8)} ${f(b * 1.5)}"/></g>`;
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaCon((s, tipo, lado) => {
      if (tipo === "interior-alt") return lado === "der" ? { arriba: s * 0.07, abajo: s * 0.08 } : { arriba: s * 0.07 };
      return { arriba: s * 0.07, abajo: s * 0.07 };
    }),
    textos: textosClasicos({ titulo: "Parisienne", texto: "Libre Baskerville", color: "#5f6f7c", acento: "#8aa3b3", ejemplos, escalaTitulo: 0.11 }),
  },
];
