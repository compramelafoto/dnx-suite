import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import {
  azar,
  degradado,
  estrella,
  estrellas,
  filete,
  filtroAcuarela,
  flor,
  fondoLiso,
  grano,
  lunares,
  manchaAcuarela,
  pampa,
  paginas,
  type Rect,
  svg,
} from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/*
 * Piezas propias de bebés y embarazo: nubes, lunas, animalitos hechos con círculos, huellitas,
 * globos aerostáticos, móviles, banderines, arcoíris boho, ropita de tendedero… Todo en SVG con
 * medidas en milímetros y azar de semilla fija. Las usa también `embarazo.ts`.
 */

const f = (n: number) => Math.round(n * 100) / 100;
const total = (m: Medidas): Rect => ({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm });
const esFuerte = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";

/** Una nube esponjosa. (x, y) es el centro de la base. Mide `ancho` y alto ≈ ancho × 0,46. */
export function nube(x: number, y: number, ancho: number, color: string, opacidad = 1): string {
  const h = ancho * 0.34;
  return (
    `<g fill="${color}" opacity="${opacidad}">` +
    `<rect x="${f(x - ancho * 0.46)}" y="${f(y - h * 0.62)}" width="${f(ancho * 0.92)}" height="${f(h * 0.62)}" rx="${f(h * 0.31)}"/>` +
    `<circle cx="${f(x - ancho * 0.22)}" cy="${f(y - h * 0.6)}" r="${f(h * 0.42)}"/>` +
    `<circle cx="${f(x + ancho * 0.04)}" cy="${f(y - h * 0.78)}" r="${f(h * 0.58)}"/>` +
    `<circle cx="${f(x + ancho * 0.27)}" cy="${f(y - h * 0.55)}" r="${f(h * 0.4)}"/></g>`
  );
}

/** Un colchón de nubes a lo largo del borde de abajo de un rectángulo. `alto` es lo que sube. */
export function bancoDeNubes(r: Rect, alto: number, color: string, semilla: number, opacidad = 1): string {
  const rnd = azar(semilla);
  const base = r.y + r.h;
  let out = `<g fill="${color}" opacity="${opacidad}"><rect x="${f(r.x)}" y="${f(base - alto * 0.4)}" width="${f(r.w)}" height="${f(alto * 0.4)}"/>`;
  for (let x = r.x - alto * 0.3; x < r.x + r.w + alto * 0.5; x += alto * (0.75 + rnd() * 0.4)) {
    const rr = alto * (0.38 + rnd() * 0.22);
    out += `<circle cx="${f(x)}" cy="${f(base - alto * 0.4 + rr * 0.15)}" r="${f(rr)}"/>`;
  }
  return `${out}</g>`;
}

/** Luna creciente. */
export function luna(cx: number, cy: number, r: number, color: string, giro = 0, opacidad = 1): string {
  return `<path d="M 0 ${f(-r)} A ${f(r)} ${f(r)} 0 1 0 0 ${f(r)} A ${f(r * 0.55)} ${f(r)} 0 0 1 0 ${f(-r)} Z" fill="${color}" opacity="${opacidad}" transform="translate(${f(cx)} ${f(cy)}) rotate(${f(giro)})"/>`;
}

/** Luna llena con cráteres suaves. */
export function lunaLlena(cx: number, cy: number, r: number, color: string, sombra: string): string {
  return (
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${color}"/>` +
    `<circle cx="${f(cx - r * 0.3)}" cy="${f(cy - r * 0.25)}" r="${f(r * 0.2)}" fill="${sombra}" opacity="0.35"/>` +
    `<circle cx="${f(cx + r * 0.35)}" cy="${f(cy + r * 0.1)}" r="${f(r * 0.13)}" fill="${sombra}" opacity="0.3"/>` +
    `<circle cx="${f(cx - r * 0.05)}" cy="${f(cy + r * 0.45)}" r="${f(r * 0.1)}" fill="${sombra}" opacity="0.3"/>` +
    `<circle cx="${f(cx + r * 0.2)}" cy="${f(cy - r * 0.5)}" r="${f(r * 0.07)}" fill="${sombra}" opacity="0.28"/>`
  );
}

type Animalito = { pelo: string; oscuro: string; claro: string; mejillas?: string };

/** Osito de círculos: cabeza, orejas, hocico. Ocupa ±1,05r a lo ancho y de −1,05r a r a lo alto. */
export function osito(cx: number, cy: number, r: number, c: Animalito): string {
  let o = `<g transform="translate(${f(cx)} ${f(cy)})">`;
  for (const s of [-1, 1]) {
    o += `<circle cx="${f(s * r * 0.7)}" cy="${f(-r * 0.7)}" r="${f(r * 0.34)}" fill="${c.pelo}"/><circle cx="${f(s * r * 0.7)}" cy="${f(-r * 0.7)}" r="${f(r * 0.18)}" fill="${c.claro}"/>`;
  }
  o += `<circle r="${f(r)}" fill="${c.pelo}"/>`;
  o += `<ellipse cy="${f(r * 0.32)}" rx="${f(r * 0.4)}" ry="${f(r * 0.3)}" fill="${c.claro}"/>`;
  o += `<ellipse cy="${f(r * 0.2)}" rx="${f(r * 0.13)}" ry="${f(r * 0.09)}" fill="${c.oscuro}"/>`;
  o += `<path d="M ${f(-r * 0.11)} ${f(r * 0.37)} Q 0 ${f(r * 0.47)} ${f(r * 0.11)} ${f(r * 0.37)}" stroke="${c.oscuro}" stroke-width="${f(r * 0.035)}" fill="none" stroke-linecap="round"/>`;
  return o + ojosYMejillas(r, -0.08, c) + "</g>";
}

/** Conejito: orejas largas y cabeza apenas ovalada. Las orejas suben hasta −1,9r. */
export function conejo(cx: number, cy: number, r: number, c: Animalito): string {
  let o = `<g transform="translate(${f(cx)} ${f(cy)})">`;
  for (const s of [-1, 1]) {
    const t = `rotate(${s * 12} ${f(s * r * 0.38)} ${f(-r * 1.2)})`;
    o += `<ellipse cx="${f(s * r * 0.38)}" cy="${f(-r * 1.2)}" rx="${f(r * 0.25)}" ry="${f(r * 0.68)}" fill="${c.pelo}" transform="${t}"/>`;
    o += `<ellipse cx="${f(s * r * 0.38)}" cy="${f(-r * 1.15)}" rx="${f(r * 0.12)}" ry="${f(r * 0.48)}" fill="${c.claro}" transform="${t}"/>`;
  }
  o += `<ellipse rx="${f(r)}" ry="${f(r * 0.92)}" fill="${c.pelo}"/>`;
  o += `<ellipse cy="${f(r * 0.2)}" rx="${f(r * 0.1)}" ry="${f(r * 0.07)}" fill="${c.oscuro}"/>`;
  o += `<path d="M 0 ${f(r * 0.26)} L 0 ${f(r * 0.36)} M ${f(-r * 0.12)} ${f(r * 0.4)} Q ${f(-r * 0.06)} ${f(r * 0.46)} 0 ${f(r * 0.36)} Q ${f(r * 0.06)} ${f(r * 0.46)} ${f(r * 0.12)} ${f(r * 0.4)}" stroke="${c.oscuro}" stroke-width="${f(r * 0.035)}" fill="none" stroke-linecap="round"/>`;
  return o + ojosYMejillas(r, -0.05, c) + "</g>";
}

/** Elefantito: orejas grandes a los costados y trompa en curva. Ocupa ±1,52r y de −r a 1,2r. */
export function elefante(cx: number, cy: number, r: number, c: Animalito & { oreja?: string }): string {
  let o = `<g transform="translate(${f(cx)} ${f(cy)})">`;
  for (const s of [-1, 1]) {
    o += `<circle cx="${f(s * r * 0.92)}" cy="${f(-r * 0.05)}" r="${f(r * 0.6)}" fill="${c.oreja ?? c.pelo}"/><circle cx="${f(s * r * 0.98)}" cy="${f(-r * 0.02)}" r="${f(r * 0.38)}" fill="${c.claro}"/>`;
  }
  o += `<circle r="${f(r)}" fill="${c.pelo}"/>`;
  o += `<path d="M ${f(-r * 0.1)} ${f(r * 0.3)} C ${f(-r * 0.12)} ${f(r * 1.0)} ${f(r * 0.28)} ${f(r * 1.12)} ${f(r * 0.52)} ${f(r * 0.9)}" stroke="${c.pelo}" stroke-width="${f(r * 0.3)}" fill="none" stroke-linecap="round"/>`;
  return o + ojosYMejillas(r, -0.18, c) + "</g>";
}

function ojosYMejillas(r: number, altura: number, c: Animalito): string {
  let o = "";
  for (const s of [-1, 1]) {
    o += `<circle cx="${f(s * r * 0.36)}" cy="${f(r * altura)}" r="${f(r * 0.075)}" fill="${c.oscuro}"/>`;
    if (c.mejillas) o += `<circle cx="${f(s * r * 0.6)}" cy="${f(r * (altura + 0.3))}" r="${f(r * 0.12)}" fill="${c.mejillas}" opacity="0.6"/>`;
  }
  return o;
}

/** Una huellita de pie de bebé, de alto ≈ t, con los dedos hacia arriba (antes de girar). */
export function huella(x: number, y: number, t: number, color: string, giro = 0, espejo = false, opacidad = 1): string {
  const dedos: [number, number, number][] = [
    [-0.17, -0.39, 0.09],
    [-0.01, -0.44, 0.07],
    [0.12, -0.41, 0.06],
    [0.22, -0.34, 0.05],
    [0.29, -0.25, 0.043],
  ];
  let o = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)}) scale(${espejo ? -1 : 1} 1)" fill="${color}" opacity="${opacidad}">`;
  o += `<ellipse cx="${f(t * 0.02)}" cy="${f(t * 0.04)}" rx="${f(t * 0.27)}" ry="${f(t * 0.32)}"/><ellipse cx="${f(-t * 0.03)}" cy="${f(t * 0.34)}" rx="${f(t * 0.2)}" ry="${f(t * 0.22)}"/>`;
  for (const [dx, dy, dr] of dedos) o += `<circle cx="${f(dx * t)}" cy="${f(dy * t)}" r="${f(dr * t)}"/>`;
  return `${o}</g>`;
}

/** Un par de huellitas, izquierda y derecha. */
export function parDeHuellas(x: number, y: number, t: number, color: string, giro = 0, opacidad = 1): string {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})">${huella(-t * 0.24, t * 0.12, t, color, -6, true, opacidad)}${huella(t * 0.24, -t * 0.12, t, color, 6, false, opacidad)}</g>`;
}

/** Un caminito de huellitas que va de (x0, y0) a (x1, y1). */
export function caminoDeHuellas(x0: number, y0: number, x1: number, y1: number, pasos: number, t: number, color: string, opacidad = 1): string {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const giro = (ang * 180) / Math.PI + 90;
  let o = "";
  for (let i = 0; i < pasos; i++) {
    const k = pasos === 1 ? 0 : i / (pasos - 1);
    const lado = i % 2 === 0 ? -1 : 1;
    const px = x0 + (x1 - x0) * k - Math.sin(ang) * lado * t * 0.26;
    const py = y0 + (y1 - y0) * k + Math.cos(ang) * lado * t * 0.26;
    o += huella(px, py, t, color, giro, lado < 0, opacidad);
  }
  return o;
}

/** Globo aerostático con gajos y canasta. Ocupa de −r a 1,36r a lo alto. */
export function globoAerostatico(cx: number, cy: number, r: number, c: { a: string; b: string; canasta?: string; cuerda?: string }): string {
  const d = `M ${f(-r * 0.32)} ${f(r * 0.88)} C ${f(-r * 1.05)} ${f(r * 0.3)} ${f(-r)} ${f(-r)} 0 ${f(-r)} C ${f(r)} ${f(-r)} ${f(r * 1.05)} ${f(r * 0.3)} ${f(r * 0.32)} ${f(r * 0.88)} Z`;
  const cuerda = c.cuerda ?? "#9b8b7a";
  return (
    `<g transform="translate(${f(cx)} ${f(cy)})"><path d="${d}" fill="${c.a}"/><path d="${d}" fill="${c.b}" transform="scale(0.62 1)"/><path d="${d}" fill="${c.a}" transform="scale(0.22 1)"/>` +
    `<path d="M ${f(-r * 0.3)} ${f(r * 0.9)} L ${f(-r * 0.17)} ${f(r * 1.11)} M ${f(r * 0.3)} ${f(r * 0.9)} L ${f(r * 0.17)} ${f(r * 1.11)}" stroke="${cuerda}" stroke-width="${f(r * 0.03)}"/>` +
    `<rect x="${f(-r * 0.19)}" y="${f(r * 1.1)}" width="${f(r * 0.38)}" height="${f(r * 0.26)}" rx="${f(r * 0.05)}" fill="${c.canasta ?? "#b08a63"}"/></g>`
  );
}

/** Corazón. */
export function corazon(x: number, y: number, r: number, color: string, giro = 0, opacidad = 1): string {
  return `<path d="M 0 ${f(r * 0.85)} C ${f(-r * 1.25)} ${f(r * 0.05)} ${f(-r * 0.65)} ${f(-r * 0.95)} 0 ${f(-r * 0.38)} C ${f(r * 0.65)} ${f(-r * 0.95)} ${f(r * 1.25)} ${f(r * 0.05)} 0 ${f(r * 0.85)} Z" fill="${color}" opacity="${opacidad}" transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

/** Móvil de cuna: un gancho en el techo, una varilla curva y piezas colgando. */
export function movil(cx: number, yTecho: number, ancho: number, caida: number, piezas: ((x: number, y: number, s: number) => string)[], hilo: string, semilla: number): string {
  const rnd = azar(semilla);
  const yB = yTecho + caida * 0.3;
  const curva = ancho * 0.1;
  const g = Math.max(0.2, ancho * 0.004);
  let o = `<g stroke="${hilo}" stroke-width="${f(g)}" fill="none" stroke-linecap="round">`;
  o += `<line x1="${f(cx)}" y1="${f(yTecho)}" x2="${f(cx)}" y2="${f(yTecho + caida * 0.1)}"/>`;
  o += `<line x1="${f(cx)}" y1="${f(yTecho + caida * 0.1)}" x2="${f(cx - ancho / 2)}" y2="${f(yB)}"/><line x1="${f(cx)}" y1="${f(yTecho + caida * 0.1)}" x2="${f(cx + ancho / 2)}" y2="${f(yB)}"/>`;
  o += `<path d="M ${f(cx - ancho / 2)} ${f(yB)} Q ${f(cx)} ${f(yB - curva * 2)} ${f(cx + ancho / 2)} ${f(yB)}" stroke-width="${f(g * 2.2)}"/>`;
  let colgantes = "";
  const n = piezas.length;
  piezas.forEach((p, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = cx - ancho / 2 + ancho * t;
    const y = yB - 2 * t * (1 - t) * curva * 2;
    const largo = caida * (0.3 + (i % 2 ? 0.28 : 0.08) + rnd() * 0.12);
    o += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y + largo)}"/>`;
    colgantes += p(x, y + largo, ancho * 0.12);
  });
  return `${o}</g>${colgantes}`;
}

/** Banderines colgados de un hilo con comba. */
export function banderines(x0: number, y0: number, x1: number, y1: number, comba: number, n: number, colores: string[], tam: number, hilo: string): string {
  const qx = (x0 + x1) / 2;
  const qy = (y0 + y1) / 2 + comba * 2;
  const p = (t: number) => ({ x: (1 - t) ** 2 * x0 + 2 * t * (1 - t) * qx + t * t * x1, y: (1 - t) ** 2 * y0 + 2 * t * (1 - t) * qy + t * t * y1 });
  let o = `<path d="M ${f(x0)} ${f(y0)} Q ${f(qx)} ${f(qy)} ${f(x1)} ${f(y1)}" stroke="${hilo}" stroke-width="${f(Math.max(0.2, tam * 0.03))}" fill="none"/>`;
  for (let i = 0; i < n; i++) {
    const a = p((i + 0.1) / n);
    const b = p((i + 0.9) / n);
    const c = p((i + 0.5) / n);
    o += `<polygon points="${f(a.x)},${f(a.y)} ${f(b.x)},${f(b.y)} ${f(c.x)},${f(c.y + tam)}" fill="${colores[i % colores.length]}"/>`;
  }
  return o;
}

/** Arcoíris boho: medialunas de colores lisos, con la base en `base`. */
export function arcoiris(cx: number, base: number, r: number, colores: string[], grosor: number, opacidad = 1): string {
  return colores
    .map((c, i) => {
      const ri = r - grosor / 2 - i * grosor;
      if (ri <= 0) return "";
      return `<path d="M ${f(cx - ri)} ${f(base)} A ${f(ri)} ${f(ri)} 0 0 1 ${f(cx + ri)} ${f(base)}" stroke="${c}" stroke-width="${f(grosor * 0.9)}" fill="none" opacity="${opacidad}"/>`;
    })
    .join("");
}

/** Sol con rayos cortos. */
export function sol(cx: number, cy: number, r: number, color: string, rayos = 12, largo = 0.45, opacidad = 1): string {
  let o = `<g opacity="${opacidad}"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${color}"/>`;
  for (let i = 0; i < rayos; i++) {
    const a = (i / rayos) * Math.PI * 2;
    o += `<line x1="${f(cx + Math.cos(a) * r * 1.22)}" y1="${f(cy + Math.sin(a) * r * 1.22)}" x2="${f(cx + Math.cos(a) * r * (1.22 + largo))}" y2="${f(cy + Math.sin(a) * r * (1.22 + largo))}" stroke="${color}" stroke-width="${f(r * 0.1)}" stroke-linecap="round"/>`;
  }
  return `${o}</g>`;
}

/** Un enterito (body) de bebé colgado desde (x, y), de alto s. */
export function enterito(x: number, y: number, s: number, color: string, detalle: string): string {
  const p = (a: number, b: number) => `${f(x + a * s)} ${f(y + b * s)}`;
  return (
    `<path d="M ${p(-0.16, 0)} Q ${p(0, 0.12)} ${p(0.16, 0)} L ${p(0.4, 0.08)} L ${p(0.5, 0.3)} L ${p(0.3, 0.37)} L ${p(0.28, 0.76)} Q ${p(0.26, 0.93)} ${p(0.1, 1)} L ${p(-0.1, 1)} Q ${p(-0.26, 0.93)} ${p(-0.28, 0.76)} L ${p(-0.3, 0.37)} L ${p(-0.5, 0.3)} L ${p(-0.4, 0.08)} Z" fill="${color}"/>` +
    `<path d="M ${p(-0.16, 0)} Q ${p(0, 0.12)} ${p(0.16, 0)}" stroke="${detalle}" stroke-width="${f(s * 0.035)}" fill="none"/>` +
    `<circle cx="${f(x - s * 0.06)}" cy="${f(y + s * 0.93)}" r="${f(s * 0.025)}" fill="${detalle}"/><circle cx="${f(x + s * 0.06)}" cy="${f(y + s * 0.93)}" r="${f(s * 0.025)}" fill="${detalle}"/>` +
    `<rect x="${f(x - s * 0.03)}" y="${f(y - s * 0.07)}" width="${f(s * 0.06)}" height="${f(s * 0.15)}" rx="${f(s * 0.01)}" fill="#c9a77c"/>`
  );
}

/** Una medita de bebé colgada desde (x, y), de alto s. */
export function medita(x: number, y: number, s: number, color: string, detalle: string): string {
  const p = (a: number, b: number) => `${f(x + a * s)} ${f(y + b * s)}`;
  return (
    `<path d="M ${p(-0.13, 0)} L ${p(0.13, 0)} L ${p(0.13, 0.55)} Q ${p(0.13, 0.63)} ${p(0.23, 0.68)} L ${p(0.4, 0.76)} Q ${p(0.52, 0.84)} ${p(0.43, 0.96)} Q ${p(0.36, 1.03)} ${p(0.24, 0.98)} L ${p(-0.04, 0.88)} Q ${p(-0.15, 0.83)} ${p(-0.14, 0.7)} Z" fill="${color}"/>` +
    `<rect x="${f(x - s * 0.13)}" y="${f(y)}" width="${f(s * 0.26)}" height="${f(s * 0.14)}" fill="${detalle}"/>` +
    `<rect x="${f(x - s * 0.03)}" y="${f(y - s * 0.07)}" width="${f(s * 0.06)}" height="${f(s * 0.15)}" rx="${f(s * 0.01)}" fill="#c9a77c"/>`
  );
}

/** Un tendedero con ropita: el hilo con comba y las prendas colgando. */
export function tendedero(x0: number, x1: number, y: number, comba: number, prendas: { tipo: "body" | "media"; color: string; detalle: string }[], s: number, hilo: string): string {
  const qx = (x0 + x1) / 2;
  const qy = y + comba * 2;
  let o = `<path d="M ${f(x0)} ${f(y)} Q ${f(qx)} ${f(qy)} ${f(x1)} ${f(y)}" stroke="${hilo}" stroke-width="${f(Math.max(0.25, s * 0.02))}" fill="none"/>`;
  prendas.forEach((p, i) => {
    const t = (i + 1) / (prendas.length + 1);
    const x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * qx + t * t * x1;
    const yy = (1 - t) ** 2 * y + 2 * t * (1 - t) * qy + t * t * y;
    o += p.tipo === "body" ? enterito(x, yy, s, p.color, p.detalle) : medita(x, yy, s * 0.7, p.color, p.detalle);
  });
  return o;
}

/**
 * La zona de siempre (título en la apertura, frase en el cierre) más lo que reserva cada estilo
 * por página, para que los adornos queden en los bordes y nunca debajo de las fotos.
 */
export function zonaCon(extra: (tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> => {
    const base = zonaClasica({}, posicion)(tipo, lado, m);
    const e = extra(tipo, lado, m);
    return base.arriba !== undefined ? { ...e, arriba: Math.max(base.arriba, e.arriba ?? 0) } : e;
  };
}

const ejemplos = { titulo: "Bienvenida, Olivia", subtitulo: "Mi primer año", fecha: "14 · 03 · 2026", frase: "Sos lo más lindo que nos pasó" };

export const BEBES: EstiloFotolibro[] = [
  {
    id: "bebes-01-nubes-de-algodon",
    tema: "bebes",
    nombre: "Nubes de algodón",
    descripcion: "Cielo celeste pastel con nubes esponjosas y estrellitas doradas.",
    papel: "#e6f2fa",
    margenMm: 15,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const cielo = degradado("c", total(m), "#d6eaf8", "#f6fbfe");
      let c = cielo.cuerpo;
      // Colchón de nubes abajo en todos menos en el interior, que lleva nubes sueltas arriba.
      if (tipo === "interior") {
        c += nube(izq.x + s * 0.13, s * 0.13, s * 0.26, "#ffffff") + nube(izq.x + s * 0.36, s * 0.08, s * 0.14, "#ffffff", 0.85);
        c += nube(der.x + der.w - s * 0.13, s * 0.12, s * 0.24, "#ffffff") + nube(der.x + der.w - s * 0.36, s * 0.07, s * 0.12, "#ffffff", 0.85);
      } else {
        c += bancoDeNubes(total(m), s * (esFuerte(tipo) ? 0.13 : 0.09), "#ffffff", tipo === "cierre" ? 9 : 4);
        c += bancoDeNubes(total(m), s * (esFuerte(tipo) ? 0.08 : 0.055), "#eef6fc", 17);
      }
      c += estrellas({ x: 0, y: s * 0.015, w: m.anchoMm, h: s * 0.07 }, "#eec26a", Math.round(m.anchoMm / (esFuerte(tipo) ? 9 : 16)), tipo === "interior-alt" ? 3 : 7, s * 0.025);
      if (tipo === "apertura") {
        c += nube(izq.x + izq.w / 2 - s * 0.04, m.altoMm * 0.25, s * 0.3, "#ffffff");
        c += estrella(izq.x + izq.w / 2 + s * 0.15, m.altoMm * 0.13, s * 0.03, "#eec26a", 12);
      }
      return svg(m, c, cielo.defs);
    },
    zona: zonaCon((tipo, _lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      return tipo === "interior" ? { arriba: s * 0.12 } : { arriba: s * 0.04, abajo: s * (esFuerte(tipo) ? 0.1 : 0.07) };
    }),
    textos: textosClasicos({ titulo: "Pacifico", texto: "Quicksand", color: "#4f7ea6", acento: "#7aa5c7", ejemplos, escalaTitulo: 0.085 }),
  },
  {
    id: "bebes-02-dulces-suenos",
    tema: "bebes",
    nombre: "Dulces sueños",
    descripcion: "Azul noche suave, luna dorada y estrellas: para el libro del recién nacido.",
    papel: "#2c3a66",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const noche = degradado("n", total(m), "#253259", "#3e4c7e");
      let c = noche.cuerpo;
      c += estrellas(total(m), "#f6e7b8", Math.round((m.anchoMm * (esFuerte(tipo) ? 0.25 : 0.12))), 21, s * 0.018);
      // Nubes translúcidas abajo, en la franja reservada.
      c += bancoDeNubes(total(m), s * 0.08, "#ffffff", 5, 0.1) + bancoDeNubes(total(m), s * 0.05, "#ffffff", 11, 0.12);
      if (tipo === "apertura") {
        c += luna(izq.x + izq.w / 2, m.altoMm * 0.16, Math.min(m.altoMm * 0.09, izq.w * 0.12), "#f3d98b", 25);
        c += estrella(izq.x + izq.w / 2 + s * 0.11, m.altoMm * 0.09, s * 0.018, "#f3d98b", 10) + estrella(izq.x + izq.w / 2 - s * 0.12, m.altoMm * 0.21, s * 0.012, "#f3d98b");
      } else if (tipo === "cierre") {
        c += luna(der.x + der.w / 2, m.altoMm * 0.065, m.altoMm * 0.04, "#f3d98b", 25);
      } else {
        // Una lunita en la esquina de afuera, dentro del margen.
        const x = tipo === "interior" ? der.x + der.w - s * 0.05 : izq.x + s * 0.05;
        c += luna(x, s * 0.05, s * 0.03, "#f3d98b", tipo === "interior" ? 25 : -25);
      }
      return svg(m, c, noche.defs);
    },
    zona: zonaCon((_t, _l, m) => ({ abajo: Math.min(m.anchoMm / 2, m.altoMm) * 0.04, arriba: 2 })),
    textos: textosClasicos({ titulo: "Great Vibes", texto: "Quicksand", color: "#f6e7b8", acento: "#c9d3f0", ejemplos: { ...ejemplos, titulo: "Dulces sueños, Benja", subtitulo: "Recién nacido" }, escalaTitulo: 0.11 }),
  },
  {
    id: "bebes-03-osito-de-miel",
    tema: "bebes",
    nombre: "Osito de miel",
    descripcion: "Crema y caramelo, un osito que se asoma y costura de peluche alrededor.",
    papel: "#fbf3e6",
    margenMm: 17,
    esquinasMm: 3,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const c0 = { pelo: "#c89260", oscuro: "#5b3a22", claro: "#f1d9b8", mejillas: "#e8a08a" };
      let c = fondoLiso(total(m), "#fbf3e6") + lunares(total(m), s * 0.07, s * 0.006, "#e8d2ae", 0.9);
      // Costura de peluche: filete punteado con esquinas redondas.
      for (const p of [izq, der]) {
        c += filete(p, s * 0.045, "#c89260", Math.max(0.35, s * 0.003), s * 0.04).replace("/>", ` stroke-dasharray="${f(s * 0.012)} ${f(s * 0.009)}"/>`);
      }
      const r = s * 0.075;
      if (tipo === "apertura") c += osito(izq.x + izq.w / 2, m.altoMm * 0.17, Math.min(m.altoMm * 0.085, izq.w * 0.1), c0);
      // El osito se asoma desde el borde de abajo, en la esquina de afuera.
      if (tipo === "interior" || tipo === "cierre") c += osito(der.x + der.w - s * 0.2, m.altoMm - r * 0.3, r, c0);
      if (tipo === "interior-alt") c += osito(izq.x + s * 0.2, m.altoMm - r * 0.3, r, c0);
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const asoma = ((tipo === "interior" || tipo === "cierre") && lado === "der") || (tipo === "interior-alt" && lado === "izq");
      return { arriba: s * 0.035, abajo: asoma ? s * 0.1 : s * 0.035, exterior: s * 0.035, interior: s * 0.02 };
    }),
    textos: textosClasicos({ titulo: "Pacifico", texto: "Nunito", color: "#8a5a32", acento: "#b98454", ejemplos: { ...ejemplos, titulo: "Hola, Felipe" }, escalaTitulo: 0.085 }),
  },
  {
    id: "bebes-04-conejito-rosa",
    tema: "bebes",
    nombre: "Conejito en flor",
    descripcion: "Rosa empolvado, tarjeta blanca de puntas redondas, florcitas y un conejito.",
    papel: "#f8e3e3",
    margenMm: 20,
    esquinasMm: 3,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const c0 = { pelo: "#ffffff", oscuro: "#7a4a55", claro: "#f4bfc6", mejillas: "#f2a5b0" };
      let c = fondoLiso(total(m), "#f8e3e3");
      const ins = s * 0.055;
      for (const p of [izq, der]) c += `<rect x="${f(p.x + ins)}" y="${f(ins)}" width="${f(p.w - 2 * ins)}" height="${f(p.h - 2 * ins)}" rx="${f(s * 0.05)}" fill="#fffafa"/>`;
      // Ramito de florcitas en dos esquinas opuestas de cada página (el borde de la tarjeta).
      const ramito = (x: number, y: number, sem: number, k: number) => {
        const rnd = azar(sem);
        let o = "";
        for (let i = 0; i < 5; i++) {
          const a = rnd() * Math.PI * 2;
          const d = s * 0.035 * k * rnd();
          o += flor(x + Math.cos(a) * d, y + Math.sin(a) * d, s * (0.016 + rnd() * 0.01) * k, i % 2 ? "#f4bfc6" : "#ffffff", "#e7a96a", 5, rnd() * 70);
        }
        return o;
      };
      const k = esFuerte(tipo) ? 2.2 : 1.7;
      c += ramito(izq.x + ins, ins, 3, k) + ramito(der.x + der.w - ins, m.altoMm - ins, 8, k);
      if (tipo !== "interior") c += ramito(der.x + der.w - ins, ins, 12, 1.3) + ramito(izq.x + ins, m.altoMm - ins, 15, 1.3);
      if (tipo === "apertura") c += conejo(izq.x + izq.w / 2, m.altoMm * 0.19, Math.min(m.altoMm * 0.065, izq.w * 0.085), c0).replace("<g ", `<g stroke="#f0c9cf" stroke-width="${f(s * 0.003)}" `);
      return svg(m, c);
    },
    zona: zonaCon(() => ({})),
    textos: textosClasicos({ titulo: "Dancing Script", texto: "Quicksand", color: "#b25f74", acento: "#c98593", ejemplos: { ...ejemplos, titulo: "Bienvenida, Emma" }, escalaTitulo: 0.1 }),
  },
  {
    id: "bebes-05-elefantito-mostaza",
    tema: "bebes",
    nombre: "Elefantito gris y mostaza",
    descripcion: "Neutro para nene o nena: gris perla, mostaza y una mantita de triángulos.",
    papel: "#f6f4ef",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      let c = fondoLiso(total(m), "#f6f4ef");
      // Mantita: franja abajo con dientes de triángulos en el borde.
      const alto = s * (esFuerte(tipo) ? 0.11 : 0.07);
      const y0 = m.altoMm - alto;
      const paso = s * 0.05;
      c += fondoLiso({ x: 0, y: y0, w: m.anchoMm, h: alto }, "#d9d8d3");
      let dientes = "";
      for (let x = 0, i = 0; x < m.anchoMm; x += paso, i++) {
        dientes += `<polygon points="${f(x)},${f(y0)} ${f(x + paso)},${f(y0)} ${f(x + paso / 2)},${f(y0 + paso * 0.6)}" fill="${i % 3 === 1 ? "#dcaa45" : "#f6f4ef"}"/>`;
      }
      c += dientes;
      if (tipo === "interior-alt" || esFuerte(tipo)) c += lunares({ x: 0, y: y0 + paso * 0.7, w: m.anchoMm, h: alto - paso * 0.7 }, s * 0.03, s * 0.004, "#ffffff", 0.9);
      // Una línea fina mostaza arriba, como ribete.
      c += `<line x1="0" y1="${f(s * 0.03)}" x2="${f(m.anchoMm)}" y2="${f(s * 0.03)}" stroke="#dcaa45" stroke-width="${f(Math.max(0.3, s * 0.004))}"/>`;
      if (tipo === "apertura") c += elefante(izq.x + izq.w / 2, m.altoMm * 0.15, Math.min(m.altoMm * 0.075, izq.w * 0.08), { pelo: "#a9aab0", oreja: "#9a9ba2", oscuro: "#4a4b52", claro: "#f2d79a", mejillas: "#e6b2a0" });
      return svg(m, c);
    },
    zona: zonaCon((tipo, _l, m) => ({ arriba: 2, abajo: Math.min(m.anchoMm / 2, m.altoMm) * (esFuerte(tipo) ? 0.09 : 0.055) })),
    textos: textosClasicos({ titulo: "Amatic SC", texto: "Nunito", color: "#55575e", acento: "#c4952f", ejemplos: { ...ejemplos, titulo: "Hola, Mundo", subtitulo: "Bauti · 3,250 kg" }, escalaTitulo: 0.13 }),
  },
  {
    id: "bebes-06-globos-aerostaticos",
    tema: "bebes",
    nombre: "Globos aerostáticos",
    descripcion: "Globos rayados en pasteles que vuelan entre nubes: el libro de su primer año.",
    papel: "#eef7f6",
    margenMm: 15,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const cielo = degradado("c", total(m), "#ddeff0", "#fdf8ef");
      let c = cielo.cuerpo;
      const coral = { a: "#f3a493", b: "#fbd3c7" };
      const menta = { a: "#8fcab4", b: "#cdeadf" };
      const sol0 = { a: "#f3cf7a", b: "#fbe8b8" };
      const lila = { a: "#b8a6dc", b: "#e1d8f2" };
      if (tipo === "apertura") {
        const h = m.altoMm;
        const r = Math.min(h * 0.085, izq.w * 0.095);
        c += nube(izq.x + izq.w * 0.3, h * 0.25, s * 0.18, "#ffffff", 0.9) + nube(izq.x + izq.w * 0.72, h * 0.12, s * 0.14, "#ffffff", 0.9);
        c += globoAerostatico(izq.x + izq.w / 2, h * 0.1, r, coral);
        c += globoAerostatico(izq.x + izq.w * 0.24, h * 0.11, r * 0.55, menta) + globoAerostatico(izq.x + izq.w * 0.77, h * 0.15, r * 0.45, sol0);
        c += globoAerostatico(der.x + der.w - s * 0.08, h * 0.2, s * 0.05, lila) + globoAerostatico(der.x + der.w - s * 0.06, h * 0.55, s * 0.032, menta);
      } else {
        // Columna de afuera con un par de globos y nubes.
        const derecha = tipo !== "interior-alt";
        const p = derecha ? der : izq;
        const x = derecha ? p.x + p.w - s * 0.08 : p.x + s * 0.08;
        const sem = tipo === "cierre" ? 5 : 2;
        c += nube(x, m.altoMm * 0.42, s * 0.12, "#ffffff", 0.9);
        c += globoAerostatico(x, m.altoMm * (tipo === "cierre" ? 0.55 : 0.18), s * 0.05, sem === 5 ? sol0 : coral);
        c += globoAerostatico(x + (derecha ? -1 : 1) * s * 0.01, m.altoMm * (tipo === "cierre" ? 0.8 : 0.6), s * 0.032, tipo === "interior-alt" ? lila : menta);
        c += nube(x, m.altoMm * 0.93, s * 0.1, "#ffffff", 0.9);
        // Nubecitas sueltas en el borde de arriba del otro lado.
        const otra = derecha ? izq : der;
        c += nube(otra.x + otra.w * (derecha ? 0.1 : 0.9), s * 0.05, s * 0.07, "#ffffff", 0.9);
      }
      return svg(m, c, cielo.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const col = (tipo === "apertura" || tipo === "interior" || tipo === "cierre") ? lado === "der" : lado === "izq";
      return col ? { exterior: s * 0.11 } : {};
    }),
    textos: textosClasicos({ titulo: "Courgette", texto: "Nunito", color: "#4b6b8a", acento: "#e0836d", ejemplos: { ...ejemplos, titulo: "Mi primer año" , subtitulo: "Valentín"}, escalaTitulo: 0.1 }),
  },
  {
    id: "bebes-07-movil-de-cuna",
    tema: "bebes",
    nombre: "Móvil de cuna",
    descripcion: "Lila muy suave con un móvil de lunas, estrellas y nubes que cuelga del techo.",
    papel: "#f3effa",
    margenMm: 15,
    esquinasMm: 4,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const hilo = "#b9add3";
      let c = fondoLiso(total(m), "#f3effa");
      const pzEstrella = (col: string) => (x: number, y: number, t: number) => estrella(x, y + t * 0.6, t * 0.6, col, 0);
      const pzLuna = (x: number, y: number, t: number) => luna(x + t * 0.15, y + t * 0.65, t * 0.6, "#f2d48a", -20);
      const pzNube = (x: number, y: number, t: number) => nube(x, y + t * 0.7, t * 1.3, "#ffffff").replace("<g ", `<g stroke="${hilo}" stroke-width="${f(t * 0.03)}" `);
      const pzCorazon = (x: number, y: number, t: number) => corazon(x, y + t * 0.5, t * 0.5, "#f1b7c3");
      if (tipo === "apertura") {
        const ancho = Math.min(izq.w * 0.6, m.altoMm * 0.7);
        c += movil(izq.x + izq.w / 2, 0, ancho, m.altoMm * 0.2, [pzEstrella("#c7b6e8"), pzNube, pzLuna, pzCorazon, pzEstrella("#a7d7c5")], hilo, 4);
      } else {
        // Colgantes sueltos en la columna de afuera.
        const derecha = tipo !== "interior-alt";
        const p = derecha ? der : izq;
        const x0 = derecha ? p.x + p.w - s * 0.1 : p.x + s * 0.04;
        const piezas = [pzEstrella("#c7b6e8"), pzLuna, pzNube, pzEstrella("#a7d7c5"), pzCorazon];
        const n = 3;
        for (let i = 0; i < n; i++) {
          const x = x0 + (i * s * 0.06) / (n - 1) + s * 0.0;
          const largo = m.altoMm * [0.22, 0.36, 0.14][i]! * (tipo === "cierre" ? 1.2 : 1);
          c += `<line x1="${f(x)}" y1="0" x2="${f(x)}" y2="${f(largo)}" stroke="${hilo}" stroke-width="${f(Math.max(0.2, s * 0.002))}"/>`;
          c += piezas[(i + (tipo === "cierre" ? 2 : derecha ? 0 : 1)) % piezas.length]!(x, largo, s * 0.06);
        }
      }
      c += lunares({ x: 0, y: m.altoMm - s * 0.035, w: m.anchoMm, h: s * 0.035 }, s * 0.035, s * 0.005, "#c7b6e8");
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const col = tipo === "apertura" ? false : tipo === "interior-alt" ? lado === "izq" : lado === "der";
      return { abajo: s * 0.02, ...(col ? { exterior: s * 0.11 } : {}) };
    }),
    textos: textosClasicos({ titulo: "Marck Script", texto: "Rubik", color: "#6a5a8c", acento: "#9b8bbf", ejemplos: { ...ejemplos, titulo: "Bienvenido, Joaquín", subtitulo: "Mes a mes" }, escalaTitulo: 0.1 }),
  },
  {
    id: "bebes-08-acuarela-huellitas",
    tema: "bebes",
    nombre: "Acuarela y huellitas",
    descripcion: "Manchas de acuarela menta y durazno con huellitas de pie, delicado y luminoso.",
    papel: "#fffdfa",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.04);
      const k = esFuerte(tipo) ? 1.25 : 0.95;
      let c = fondoLiso(total(m), "#fffdfa");
      c += manchaAcuarela(izq.x + s * 0.04, s * 0.04, s * 0.22 * k, "#a9dbc9", "a", 3, 4);
      c += manchaAcuarela(izq.x + s * 0.16, s * 0.0, s * 0.12 * k, "#f6c3a9", "a", 6, 2);
      c += manchaAcuarela(der.x + der.w - s * 0.04, der.h - s * 0.04, s * 0.22 * k, "#f6c3a9", "a", 9, 4);
      c += manchaAcuarela(der.x + der.w - s * 0.17, der.h, s * 0.12 * k, "#a9dbc9", "a", 14, 2);
      if (tipo === "interior-alt") c += manchaAcuarela(der.x + der.w, s * 0.02, s * 0.12, "#f9dcb0", "a", 18, 2);
      const t = s * 0.06;
      c += parDeHuellas(izq.x + s * 0.12, s * 0.11, t * k, "#e39d84", -30, 0.85);
      c += parDeHuellas(der.x + der.w - s * 0.12, der.h - s * 0.11, t * k, "#7fbfa8", 150, 0.85);
      if (tipo === "apertura") c += caminoDeHuellas(izq.x + izq.w * 0.3, m.altoMm * 0.24, izq.x + izq.w * 0.7, m.altoMm * 0.1, 4, Math.min(t, m.altoMm * 0.055), "#e39d84", 0.75);
      return svg(m, c + g.cuerpo, filtroAcuarela("a") + g.defs);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const k = esFuerte(tipo) ? 1.15 : 0.9;
      return lado === "izq" ? { arriba: s * 0.11 * k, exterior: s * 0.04 } : { abajo: s * 0.11 * k, exterior: s * 0.04 };
    }),
    textos: textosClasicos({ titulo: "Alex Brush", texto: "Lora", color: "#6d6070", acento: "#c58670", ejemplos: { ...ejemplos, titulo: "Pequeña Isabella" }, escalaTitulo: 0.12 }),
  },
  {
    id: "bebes-09-boho-arcoiris",
    tema: "bebes",
    nombre: "Arcoíris boho",
    descripcion: "Arcoíris en terracota, mostaza y salvia con espigas de pampa, cálido y moderno.",
    papel: "#f6eee4",
    margenMm: 16,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const colores = ["#c97a5b", "#dfab63", "#a9b59b", "#ead2b8"];
      let c = fondoLiso(total(m), "#f6eee4");
      if (tipo === "apertura") {
        const r = Math.min(izq.w * 0.24, m.altoMm * 0.2);
        c += arcoiris(izq.x + izq.w / 2, m.altoMm * 0.27, r, colores, r * 0.2);
        c += arcoiris(der.x + der.w, m.altoMm, s * 0.22, colores, s * 0.04);
      } else if (tipo === "interior") {
        c += arcoiris(der.x + der.w, m.altoMm, s * 0.2, colores, s * 0.036);
        c += pampa(izq.x + s * 0.01, m.altoMm * 0.99, s * 0.3, -65, "#c9a27c", 3);
      } else if (tipo === "interior-alt") {
        c += arcoiris(izq.x, m.altoMm, s * 0.2, [...colores].reverse(), s * 0.036);
        c += pampa(der.x + der.w - s * 0.01, m.altoMm * 0.99, s * 0.3, -115, "#c9a27c", 7);
      } else {
        c += arcoiris(izq.x, m.altoMm, s * 0.2, colores, s * 0.036);
        c += arcoiris(der.x + der.w, m.altoMm, s * 0.2, colores, s * 0.036);
      }
      // Solcito chico arriba de la esquina de afuera.
      if (tipo !== "apertura") c += sol(tipo === "interior-alt" ? izq.x + s * 0.06 : der.x + der.w - s * 0.06, s * 0.06, s * 0.016, "#dfab63", 10, 0.5);
      return svg(m, c);
    },
    zona: zonaCon((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const conArco =
        (tipo === "apertura" && lado === "der") || (tipo === "interior" && lado === "der") || (tipo === "interior-alt" && lado === "izq") || tipo === "cierre";
      const conPampa = (tipo === "interior" && lado === "izq") || (tipo === "interior-alt" && lado === "der");
      return conArco ? { exterior: s * 0.1, abajo: s * 0.05 } : conPampa ? { exterior: s * 0.08, abajo: s * 0.02 } : { arriba: s * 0.03 };
    }),
    textos: textosClasicos({ titulo: "Sacramento", texto: "Raleway", color: "#9a5a40", acento: "#a9b59b", ejemplos: { ...ejemplos, titulo: "Hola, Lorenzo" }, escalaTitulo: 0.12 }),
  },
  {
    id: "bebes-10-minimal-mes-a-mes",
    tema: "bebes",
    nombre: "Minimal mes a mes",
    descripcion: "Blanco, gris cálido y una línea de doce puntos que marca cada mes del primer año.",
    papel: "#ffffff",
    margenMm: 18,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const gris = "#b7aea4";
      let c = fondoLiso(total(m), "#ffffff");
      // Línea del tiempo de doce puntos, abajo y a lo ancho del pliego.
      const y = m.altoMm - s * 0.045;
      const x0 = izq.x + s * 0.08;
      const x1 = der.x + der.w - s * 0.08;
      c += `<line x1="${f(x0)}" y1="${f(y)}" x2="${f(x1)}" y2="${f(y)}" stroke="${gris}" stroke-width="${f(Math.max(0.25, s * 0.0025))}"/>`;
      for (let i = 0; i < 12; i++) {
        const x = x0 + ((x1 - x0) * i) / 11;
        const lleno = tipo === "cierre" || (tipo !== "apertura" && i % (tipo === "interior" ? 2 : 3) === 0);
        c += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.007)}" fill="${lleno ? "#e3a28f" : "#ffffff"}" stroke="${gris}" stroke-width="${f(Math.max(0.25, s * 0.0025))}"/>`;
      }
      if (tipo === "apertura") c += parDeHuellas(izq.x + izq.w / 2, m.altoMm * 0.17, Math.min(m.altoMm * 0.09, izq.w * 0.1), "#d9cfc4");
      else if (tipo === "cierre") c += parDeHuellas(der.x + der.w / 2, m.altoMm * 0.07, m.altoMm * 0.04, "#d9cfc4");
      else c += huella((tipo === "interior" ? der.x + der.w : izq.x + s * 0.06) - (tipo === "interior" ? s * 0.06 : 0), s * 0.06, s * 0.03, "#d9cfc4", tipo === "interior" ? 20 : -20, tipo !== "interior");
      return svg(m, c);
    },
    zona: zonaCon((_t, _l, m) => ({ abajo: Math.min(m.anchoMm / 2, m.altoMm) * 0.03 })),
    textos: textosClasicos({ titulo: "Raleway", texto: "Lato", color: "#4a4643", acento: "#c98a77", ejemplos: { ...ejemplos, titulo: "Mi primer año", subtitulo: "Olivia" }, escalaTitulo: 0.075 }),
  },
];
