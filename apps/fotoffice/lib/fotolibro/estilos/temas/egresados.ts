import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import { azar, confeti, copo, degradado, esquineros, estrella, filete, fondoLiso, grano, hoja, paginas, svg, type Rect } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/*
 * Estilos para libros de egresados: la promo, la fiesta, el viaje a Bariloche, los buzos y el
 * acto de colación. Las piezas que no están en `dibujo.ts` (birretes, tiza, neón, serpentinas,
 * montañas nevadas, curvas de nivel…) están acá abajo, en milímetros y con azar de semilla fija.
 */

const n = (x: number) => Math.round(x * 100) / 100;
/** El lado chico de una página: la vara para medir todos los adornos. */
const ladoChico = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);
const esTitulo = (t: TipoPliego) => t === "apertura" || t === "cierre";
/** ¿Es la página que lleva el título (izquierda de la apertura, derecha del cierre)? */
const paginaDeTitulo = (t: TipoPliego, lado: "izq" | "der") => (t === "apertura" && lado === "izq") || (t === "cierre" && lado === "der");

/** Como `zonaClasica`, pero lo que se reserva va en proporción al lado chico de la página. */
function zonaRel(k: Partial<Zona>, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> => {
    const s = ladoChico(m);
    const extra: Partial<Zona> = {};
    for (const clave of ["arriba", "abajo", "exterior", "interior"] as const) {
      const v = k[clave];
      if (v !== undefined) extra[clave] = n(v * s);
    }
    return zonaClasica(extra, posicion)(tipo, lado, m);
  };
}

// ---------- Piezas propias ----------

/** Birrete genérico (el gorro de egresado): el tablero visto en perspectiva, la copa y la borla. */
function birrete(x: number, y: number, t: number, color: string, sombra: string, borla: string, giro = 0): string {
  const p = (a: number) => n(a * t);
  return (
    `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})">` +
    `<path d="M ${p(-0.3)} ${p(0.05)} L ${p(-0.28)} ${p(0.34)} Q 0 ${p(0.46)} ${p(0.28)} ${p(0.34)} L ${p(0.3)} ${p(0.05)} Z" fill="${sombra}"/>` +
    `<path d="M 0 ${p(-0.26)} L ${p(0.52)} 0 L 0 ${p(0.26)} L ${p(-0.52)} 0 Z" fill="${color}"/>` +
    `<path d="M 0 0 L ${p(0.4)} ${p(0.06)} L ${p(0.4)} ${p(0.38)}" stroke="${borla}" stroke-width="${p(0.025)}" fill="none" stroke-linecap="round"/>` +
    `<path d="M ${p(0.37)} ${p(0.36)} L ${p(0.43)} ${p(0.36)} L ${p(0.45)} ${p(0.5)} L ${p(0.35)} ${p(0.5)} Z" fill="${borla}"/>` +
    `<circle r="${p(0.035)}" fill="${borla}"/></g>`
  );
}

/** Birrete dibujado con tiza: sólo el contorno. */
function birreteTrazo(x: number, y: number, t: number, color: string, grosor: number, giro = 0): string {
  const p = (a: number) => n(a * t);
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})" fill="none" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round" stroke-linecap="round"><path d="M 0 ${p(-0.26)} L ${p(0.52)} 0 L 0 ${p(0.26)} L ${p(-0.52)} 0 Z"/><path d="M ${p(-0.3)} ${p(0.12)} L ${p(-0.28)} ${p(0.34)} Q 0 ${p(0.46)} ${p(0.28)} ${p(0.34)} L ${p(0.3)} ${p(0.12)}"/><path d="M 0 0 L ${p(0.4)} ${p(0.06)} L ${p(0.4)} ${p(0.42)}"/></g>`;
}

/** Estrellita de cinco puntas, sólo el trazo. */
function estrellaTrazo(x: number, y: number, r: number, color: string, grosor: number, giro = 0): string {
  return estrella(x, y, r, "none", giro).replace('fill="none"', `fill="none" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round"`);
}

/** Espiral de garabato. */
function espiral(x: number, y: number, r: number, color: string, grosor: number): string {
  let d = "";
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 6;
    const rr = (r * i) / 60;
    d += `${i ? " L" : "M"} ${n(x + Math.cos(a) * rr)} ${n(y + Math.sin(a) * rr)}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${n(grosor)}" fill="none" stroke-linecap="round"/>`;
}

/** Flecha curva de garabato. */
function flecha(x: number, y: number, largo: number, giro: number, color: string, grosor: number): string {
  const L = largo;
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})" stroke="${color}" stroke-width="${n(grosor)}" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M 0 0 Q ${n(L * 0.5)} ${n(-L * 0.35)} ${n(L)} 0"/><path d="M ${n(L * 0.82)} ${n(-L * 0.14)} L ${n(L)} 0 L ${n(L * 0.8)} ${n(L * 0.08)}"/></g>`;
}

/** Signos sueltos (+, ×, =) como los que quedan en un pizarrón. */
function signo(x: number, y: number, t: number, cual: "+" | "x" | "=", color: string, grosor: number): string {
  const h = t / 2;
  const l = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${n(x + x1)}" y1="${n(y + y1)}" x2="${n(x + x2)}" y2="${n(y + y2)}" stroke="${color}" stroke-width="${n(grosor)}" stroke-linecap="round"/>`;
  if (cual === "+") return l(-h, 0, h, 0) + l(0, -h, 0, h);
  if (cual === "x") return l(-h, -h, h, h) + l(-h, h, h, -h);
  return l(-h, -h * 0.35, h, -h * 0.35) + l(-h, h * 0.35, h, h * 0.35);
}

/** Corazón de birome, sólo el trazo. */
function corazonTrazo(x: number, y: number, t: number, color: string, grosor: number, giro = 0): string {
  const p = (a: number) => n(a * t);
  return `<path d="M0 ${p(0.35)} C ${p(-0.12)} ${p(0.25)} ${p(-0.5)} ${p(0.02)} ${p(-0.5)} ${p(-0.2)} C ${p(-0.5)} ${p(-0.45)} ${p(-0.15)} ${p(-0.52)} 0 ${p(-0.26)} C ${p(0.15)} ${p(-0.52)} ${p(0.5)} ${p(-0.45)} ${p(0.5)} ${p(-0.2)} C ${p(0.5)} ${p(0.02)} ${p(0.12)} ${p(0.25)} 0 ${p(0.35)} Z" fill="none" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round" transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"/>`;
}

/** Serpentina: una cinta que va enrulándose a lo largo de una dirección. */
function serpentina(x: number, y: number, largo: number, giro: number, color: string, grosor: number, semilla: number): string {
  const rnd = azar(semilla);
  const vueltas = 2 + Math.floor(rnd() * 2);
  const r = largo * (0.07 + rnd() * 0.02);
  let d = "";
  for (let i = 0; i <= 140; i++) {
    const t = i / 140;
    const a = t * vueltas * 2 * Math.PI;
    const px = t * largo + r * Math.sin(a);
    const py = r * (1 - Math.cos(a)) * 0.7 + Math.sin(t * Math.PI) * largo * 0.08;
    d += `${i ? " L" : "M"} ${n(px)} ${n(py)}`;
  }
  return `<path d="${d}" transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})" stroke="${color}" stroke-width="${n(grosor)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Cordón de montañas nevadas dentro de una página, desde abajo. */
function montanasNevadas(r: Rect, alto: number, capas: { roca: string; nieve: string }[], semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  capas.forEach((c, i) => {
    const h = alto * (1 - i * 0.25);
    const base = r.y + r.h;
    const picos = 2 + i + Math.floor(rnd() * 2);
    const paso = r.w / picos;
    for (let k = 0; k < picos; k++) {
      const cx = r.x + paso * (k + 0.2 + rnd() * 0.6);
      const ph = h * (0.65 + rnd() * 0.35);
      const ancho = paso * (0.9 + rnd() * 0.6);
      const izq = Math.max(r.x, cx - ancho);
      const der = Math.min(r.x + r.w, cx + ancho);
      out += `<path d="M ${n(izq)} ${n(base)} L ${n(cx)} ${n(base - ph)} L ${n(der)} ${n(base)} Z" fill="${c.roca}"/>`;
      // La nieve: el tercio de arriba, con el borde de abajo en zigzag.
      const f = 0.32;
      const yN = base - ph * (1 - f);
      const xa = cx - (cx - izq) * f;
      const xb = cx + (der - cx) * f;
      const dz = (xb - xa) / 4;
      out += `<path d="M ${n(cx)} ${n(base - ph)} L ${n(xb)} ${n(yN)} L ${n(xb - dz)} ${n(yN - ph * 0.04)} L ${n(xb - 2 * dz)} ${n(yN + ph * 0.03)} L ${n(xa + dz)} ${n(yN - ph * 0.05)} L ${n(xa)} ${n(yN)} Z" fill="${c.nieve}"/>`;
    }
  });
  return out;
}

/** Pino de tres pisos. */
function pino(x: number, base: number, alto: number, color: string, tronco: string): string {
  const a = alto;
  let out = `<rect x="${n(x - a * 0.035)}" y="${n(base - a * 0.14)}" width="${n(a * 0.07)}" height="${n(a * 0.14)}" fill="${tronco}"/>`;
  for (let i = 0; i < 3; i++) {
    const yb = base - a * (0.1 + i * 0.26);
    const w = a * (0.36 - i * 0.08);
    out += `<path d="M ${n(x - w)} ${n(yb)} L ${n(x)} ${n(yb - a * 0.42)} L ${n(x + w)} ${n(yb)} Z" fill="${color}"/>`;
  }
  return out;
}

/** Filtro de neón: el trazo con un halo difuso alrededor. */
const filtroNeon = (id: string, desenfoque: number) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(desenfoque)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

/** Filtro de tiza: bordes rotos y un poco de polvo. */
const filtroTiza = (id: string) =>
  `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="5" result="r"/><feDisplacementMap in="SourceGraphic" in2="r" scale="0.9" xChannelSelector="R" yChannelSelector="G" result="d"/><feComposite in="d" in2="r" operator="in" result="c"/><feMerge><feMergeNode in="d"/><feMergeNode in="c"/></feMerge></filter>`;

/** Zigzag de trazo. */
function zigzag(x: number, y: number, largo: number, alto: number, picos: number, giro: number, color: string, grosor: number): string {
  let d = `M 0 0`;
  for (let i = 1; i <= picos * 2; i++) d += ` L ${n((largo * i) / (picos * 2))} ${n(i % 2 ? -alto : 0)}`;
  return `<path d="${d}" transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})" stroke="${color}" stroke-width="${n(grosor)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Garabato ondulado (squiggle). */
function onda(x: number, y: number, largo: number, alto: number, ondas: number, giro: number, color: string, grosor: number): string {
  const paso = largo / ondas;
  let d = `M 0 0`;
  for (let i = 0; i < ondas; i++) d += ` q ${n(paso / 4)} ${n(i % 2 ? alto : -alto)} ${n(paso / 2)} 0 t ${n(paso / 2)} 0`;
  return `<path d="${d}" transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})" stroke="${color}" stroke-width="${n(grosor)}" fill="none" stroke-linecap="round"/>`;
}

/** Triángulo de trazo. */
function triangulo(x: number, y: number, r: number, giro: number, color: string, grosor: number, relleno = "none"): string {
  const pts = [0, 1, 2].map((i) => {
    const a = ((giro + i * 120 - 90) * Math.PI) / 180;
    return `${n(x + Math.cos(a) * r)},${n(y + Math.sin(a) * r)}`;
  });
  return `<polygon points="${pts.join(" ")}" fill="${relleno}" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round"/>`;
}

/** Grilla de puntitos dentro de un área. */
function grillaPuntos(x: number, y: number, cols: number, filas: number, paso: number, r: number, color: string): string {
  let out = "";
  for (let i = 0; i < cols; i++) for (let j = 0; j < filas; j++) out += `<circle cx="${n(x + i * paso)}" cy="${n(y + j * paso)}" r="${n(r)}" fill="${color}"/>`;
  return out;
}

/** Corona de laurel abierta arriba, con una estrella al centro. */
function laurel(cx: number, cy: number, r: number, color: string): string {
  let out = "";
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      // De abajo (90°) hacia arriba, por cada costado; las hojas siguen la curva, una afuera y otra adentro.
      const grados = 90 + lado * (12 + i * 16);
      const a = (grados * Math.PI) / 180;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      const rumbo = grados + lado * 90;
      const largo = r * (0.46 - i * 0.025);
      out += hoja(px, py, largo, rumbo - 32, color, 0.4);
      out += hoja(px, py, largo * 0.9, rumbo + 32, color, 0.4, 0.85);
    }
  }
  out += `<path d="M ${n(cx - r * 0.25)} ${n(cy + r * 1.02)} Q ${n(cx)} ${n(cy + r * 0.92)} ${n(cx + r * 0.25)} ${n(cy + r * 1.02)}" stroke="${color}" stroke-width="${n(r * 0.03)}" fill="none"/>`;
  return out + estrella(cx, cy, r * 0.32, color);
}

/** Curvas de nivel de mapa topográfico alrededor de un punto. */
function curvasDeNivel(cx: number, cy: number, rMax: number, cantidad: number, color: string, semilla: number, grosor = 0.3): string {
  const rnd = azar(semilla);
  const f1 = rnd() * 6;
  const f2 = rnd() * 6;
  let out = "";
  for (let k = 1; k <= cantidad; k++) {
    const rk = (rMax * k) / cantidad;
    let d = "";
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const rr = rk * (1 + 0.16 * Math.sin(3 * a + f1) + 0.08 * Math.sin(5 * a + f2 + k * 0.3));
      d += `${i ? " L" : "M"} ${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`;
    }
    out += `<path d="${d} Z" stroke="${color}" stroke-width="${n(grosor)}" fill="none"/>`;
  }
  return out;
}

/** Rosa de los vientos. */
function rosaDeLosVientos(cx: number, cy: number, r: number, color: string, claro: string): string {
  let out = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.78)}" fill="none" stroke="${color}" stroke-width="${n(r * 0.02)}"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.7)}" fill="none" stroke="${color}" stroke-width="${n(r * 0.01)}"/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const largo = i % 2 === 0 ? r : r * 0.55;
    const ancho = r * (i % 2 === 0 ? 0.13 : 0.09);
    const px = cx + Math.cos(a) * largo;
    const py = cy + Math.sin(a) * largo;
    const qx = Math.cos(a + Math.PI / 2) * ancho;
    const qy = Math.sin(a + Math.PI / 2) * ancho;
    out += `<path d="M ${n(cx + qx)} ${n(cy + qy)} L ${n(px)} ${n(py)} L ${n(cx)} ${n(cy)} Z" fill="${color}"/><path d="M ${n(cx - qx)} ${n(cy - qy)} L ${n(px)} ${n(py)} L ${n(cx)} ${n(cy)} Z" fill="${claro}"/>`;
  }
  return out + `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.06)}" fill="${color}"/>`;
}

/** Sello de pasaporte: doble círculo, un anillo punteado y una estrellita. */
function sello(cx: number, cy: number, r: number, color: string, giro = 0): string {
  return `<g transform="rotate(${n(giro)} ${n(cx)} ${n(cy)})" opacity="0.75"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${color}" stroke-width="${n(r * 0.06)}"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.8)}" fill="none" stroke="${color}" stroke-width="${n(r * 0.03)}" stroke-dasharray="${n(r * 0.08)} ${n(r * 0.06)}"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.6)}" fill="none" stroke="${color}" stroke-width="${n(r * 0.04)}"/>${estrella(cx, cy, r * 0.3, color)}<line x1="${n(cx - r * 1.3)}" y1="${n(cy - r * 0.15)}" x2="${n(cx + r * 1.3)}" y2="${n(cy - r * 0.15)}" stroke="${color}" stroke-width="${n(r * 0.03)}"/><line x1="${n(cx - r * 1.3)}" y1="${n(cy + r * 0.15)}" x2="${n(cx + r * 1.3)}" y2="${n(cy + r * 0.15)}" stroke="${color}" stroke-width="${n(r * 0.03)}"/></g>`;
}

/** Avioncito de silueta simple, apuntando hacia la derecha. */
function avion(x: number, y: number, t: number, giro: number, color: string): string {
  const p = (a: number) => n(a * t);
  return `<path d="M ${p(-0.5)} ${p(-0.04)} L ${p(0.38)} ${p(-0.04)} Q ${p(0.5)} 0 ${p(0.38)} ${p(0.04)} L ${p(-0.5)} ${p(0.04)} Z M ${p(0.05)} ${p(-0.04)} L ${p(-0.12)} ${p(-0.42)} L ${p(-0.02)} ${p(-0.42)} L ${p(0.2)} ${p(-0.04)} Z M ${p(0.05)} ${p(0.04)} L ${p(-0.12)} ${p(0.42)} L ${p(-0.02)} ${p(0.42)} L ${p(0.2)} ${p(0.04)} Z M ${p(-0.42)} ${p(-0.04)} L ${p(-0.5)} ${p(-0.18)} L ${p(-0.43)} ${p(-0.18)} L ${p(-0.34)} ${p(-0.04)} Z M ${p(-0.42)} ${p(0.04)} L ${p(-0.5)} ${p(0.18)} L ${p(-0.43)} ${p(0.18)} L ${p(-0.34)} ${p(0.04)} Z" fill="${color}" transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"/>`;
}

/** Puño de buzo: franja acanalada con dos rayas arriba. */
function punoDeBuzo(x: number, y: number, ancho: number, s: number, base: string, oscuro: string, raya: string, papel: string): string {
  const alto = s * 0.06;
  let out = `<rect x="${n(x)}" y="${n(y - alto)}" width="${n(ancho)}" height="${n(alto)}" fill="${base}"/>`;
  const paso = s * 0.012;
  for (let xx = x + paso / 2; xx < x + ancho; xx += paso) out += `<line x1="${n(xx)}" y1="${n(y - alto)}" x2="${n(xx)}" y2="${n(y)}" stroke="${oscuro}" stroke-width="${n(paso * 0.3)}"/>`;
  const y1 = y - alto - s * 0.01;
  out += `<rect x="${n(x)}" y="${n(y1 - s * 0.014)}" width="${n(ancho)}" height="${n(s * 0.014)}" fill="${raya}"/>`;
  out += `<rect x="${n(x)}" y="${n(y1 - s * 0.034)}" width="${n(ancho)}" height="${n(s * 0.01)}" fill="${base}"/>`;
  return out + `<rect x="${n(x)}" y="${n(y1)}" width="${n(ancho)}" height="${n(s * 0.0)}" fill="${papel}"/>`;
}

/** Rayas de manga deportiva, verticales, contra el borde de afuera de una página. */
function rayasDeManga(p: Rect, haciaAfuera: "izq" | "der", s: number, base: string, raya: string): string {
  const anchos = [s * 0.02, s * 0.014, s * 0.02];
  const colores = [base, raya, base];
  let out = "";
  let off = s * 0.03;
  anchos.forEach((w, i) => {
    const x = haciaAfuera === "izq" ? p.x + off : p.x + p.w - off - w;
    out += `<rect x="${n(x)}" y="0" width="${n(w)}" height="${n(p.h)}" fill="${colores[i]}"/>`;
    off += w + s * 0.01;
  });
  return out;
}

/** Grupo de figuras Memphis para una esquina. `dx`/`dy` dicen hacia dónde crece (1 o -1). */
function memphis(x: number, y: number, dx: 1 | -1, dy: 1 | -1, s: number, semilla: number, grande: boolean): string {
  const k = grande ? 1 : 0.75;
  const rnd = azar(semilla);
  const g = s * 0.006 + 0.3;
  const P = (a: number, b: number) => [x + dx * a * s * k, y + dy * b * s * k] as const;
  let out = "";
  const [c1x, c1y] = P(0.07, 0.08);
  out += `<circle cx="${n(c1x)}" cy="${n(c1y)}" r="${n(s * 0.055 * k)}" fill="#ffbf1f"/>`;
  const [gx, gy] = P(0.02, 0.17);
  out += grillaPuntos(Math.min(gx, gx + dx * s * 0.08 * k), Math.min(gy, gy + dy * s * 0.06 * k), 5, 4, s * 0.018 * k, s * 0.004, "#2ec4b6");
  const [tx, ty] = P(0.17, 0.05);
  out += triangulo(tx, ty, s * 0.035 * k, rnd() * 60, "#2b2b2b", g);
  const [ox, oy] = P(0.12, 0.14);
  out += onda(ox, oy, s * 0.14 * k, s * 0.018 * k, 4, dx === 1 ? 20 : 160, "#ff6fa5", g * 2.2);
  const [zx, zy] = P(0.25, 0.03);
  out += zigzag(zx, zy, s * 0.09 * k, s * 0.02 * k, 4, dx === 1 ? 35 : 145, "#6c4ab6", g * 1.8);
  const [hx, hy] = P(0.05, 0.27);
  out += `<path d="M ${n(hx - s * 0.03 * k)} ${n(hy)} A ${n(s * 0.03 * k)} ${n(s * 0.03 * k)} 0 0 1 ${n(hx + s * 0.03 * k)} ${n(hy)} Z" fill="#ff6fa5" transform="rotate(${n(dy === 1 ? 30 : 210)} ${n(hx)} ${n(hy)})"/>`;
  const [px, py] = P(0.3, 0.1);
  out += `<circle cx="${n(px)}" cy="${n(py)}" r="${n(s * 0.012 * k)}" fill="none" stroke="#2b2b2b" stroke-width="${n(g)}"/>`;
  out += signoMas(...P(0.21, 0.19), s * 0.02 * k, "#2b2b2b", g * 1.4);
  return out;
}
const signoMas = (x: number, y: number, t: number, color: string, grosor: number) => signo(x, y, t, "+", color, grosor);

// ---------- Los estilos ----------

export const EGRESADOS: EstiloFotolibro[] = [
  {
    id: "egresados-01-pizarron",
    tema: "egresados",
    nombre: "Pizarrón",
    descripcion: "Pizarrón verde con marco de madera y garabatos de tiza: birretes, estrellas y flechas.",
    papel: "#2a3b33",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("p", total, "#2e4037", "#26352e");
      const g = grano("g", m, 0.12, 1.3);
      const tiza = "#f1f0e6";
      const t = s * 0.005 + 0.3;
      // Manchas de borrador: nubes blancas apenas visibles.
      let c = fondo.cuerpo;
      const rnd = azar(7);
      for (let i = 0; i < 6; i++) {
        c += `<ellipse cx="${n(rnd() * m.anchoMm)}" cy="${n(rnd() * m.altoMm)}" rx="${n(s * (0.2 + rnd() * 0.2))}" ry="${n(s * (0.06 + rnd() * 0.05))}" fill="#ffffff" opacity="0.035" filter="url(#borr)" transform="rotate(${n(rnd() * 30 - 15)})"/>`;
      }
      let d = "";
      if (tipo === "apertura") {
        d += birreteTrazo(izq.x + izq.w / 2, izq.h * 0.18, s * 0.13, tiza, t, -8);
        d += estrellaTrazo(izq.x + izq.w / 2 - s * 0.14, izq.h * 0.15, s * 0.022, tiza, t, 10) + estrellaTrazo(izq.x + izq.w / 2 + s * 0.15, izq.h * 0.21, s * 0.016, tiza, t, -12);
        d += signo(der.x + der.w - s * 0.09, s * 0.09, s * 0.03, "+", tiza, t) + signo(der.x + der.w - s * 0.14, s * 0.12, s * 0.02, "x", tiza, t);
        d += espiral(izq.x + s * 0.1, izq.h - s * 0.1, s * 0.035, tiza, t);
      } else if (tipo === "interior") {
        d += estrellaTrazo(izq.x + s * 0.09, s * 0.09, s * 0.035, tiza, t, 8) + signo(izq.x + s * 0.16, s * 0.07, s * 0.03, "+", tiza, t);
        d += flecha(der.x + der.w - s * 0.2, der.h - s * 0.07, s * 0.12, -8, tiza, t);
      } else if (tipo === "interior-alt") {
        d += birreteTrazo(izq.x + s * 0.12, izq.h - s * 0.1, s * 0.11, tiza, t, 12);
        d += signo(der.x + der.w - s * 0.09, s * 0.09, s * 0.035, "=", tiza, t) + estrellaTrazo(der.x + der.w - s * 0.16, s * 0.07, s * 0.025, tiza, t);
      } else {
        d += espiral(der.x + der.w - s * 0.1, der.h - s * 0.1, s * 0.035, tiza, t);
        d += estrellaTrazo(izq.x + s * 0.08, s * 0.08, s * 0.022, tiza, t, -10) + estrellaTrazo(izq.x + s * 0.13, s * 0.11, s * 0.014, tiza, t, 20);
        // Subrayado de la frase.
        d += `<path d="M ${n(der.x + der.w * 0.25)} ${n(der.h * 0.25)} Q ${n(der.x + der.w * 0.5)} ${n(der.h * 0.24)} ${n(der.x + der.w * 0.75)} ${n(der.h * 0.255)}" stroke="${tiza}" stroke-width="${n(t * 1.3)}" fill="none" stroke-linecap="round"/>`;
      }
      c += `<g filter="url(#tz)" opacity="0.88">${d}</g>`;
      // El marco de madera alrededor de todo el pizarrón.
      const mw = s * 0.035;
      c += `<rect x="${n(mw / 2)}" y="${n(mw / 2)}" width="${n(m.anchoMm - mw)}" height="${n(m.altoMm - mw)}" fill="none" stroke="#8a5a34" stroke-width="${n(mw)}"/>`;
      c += `<rect x="${n(mw)}" y="${n(mw)}" width="${n(m.anchoMm - 2 * mw)}" height="${n(m.altoMm - 2 * mw)}" fill="none" stroke="#5e3b20" stroke-width="${n(mw * 0.15)}"/>`;
      c += `<rect x="${n(mw * 0.3)}" y="${n(mw * 0.3)}" width="${n(m.anchoMm - mw * 0.6)}" height="${n(m.altoMm - mw * 0.6)}" fill="none" stroke="#a87346" stroke-width="${n(mw * 0.12)}"/>`;
      return svg(m, c + g.cuerpo, fondo.defs + g.defs + filtroTiza("tz") + `<filter id="borr"><feGaussianBlur stdDeviation="${n(s * 0.02)}"/></filter>`);
    },
    zona: zonaRel({ arriba: 0.08, abajo: 0.08, exterior: 0.04 }),
    textos: textosClasicos({
      titulo: "Architects Daughter",
      texto: "Patrick Hand",
      color: "#f1f0e6",
      acento: "#f3d36b",
      escalaTitulo: 0.11,
      ejemplos: { titulo: "Promo 2026", subtitulo: "Colegio San Martín · 5.° año", fecha: "Diciembre 2026", frase: "Lo que aprendimos juntos no se borra" },
    }),
  },
  {
    id: "egresados-02-birretes-al-aire",
    tema: "egresados",
    nombre: "Birretes al aire",
    descripcion: "Azul noche con birretes dorados volando y papelitos. El clásico de la colación.",
    papel: "#14213d",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("az", total, "#172a4f", "#0f1a33");
      const oro = "#d9b45a";
      const sombra = "#a8843a";
      const borla = "#f1e2b8";
      let c = fondo.cuerpo;
      const grupo = (x: number, y: number, dx: 1 | -1, dy: 1 | -1, k: number, sem: number) => {
        const rnd = azar(sem);
        let o = confeti({ x: dx === 1 ? x : x - s * 0.3 * k, y: dy === 1 ? y : y - s * 0.22 * k, w: s * 0.3 * k, h: s * 0.22 * k }, [oro, "#f1e2b8", "#ffffff"], Math.round(18 * k), sem, s * 0.012);
        o += birrete(x + dx * s * 0.11 * k, y + dy * s * 0.09 * k, s * 0.17 * k, oro, sombra, borla, -18 + rnd() * 36);
        o += birrete(x + dx * s * 0.27 * k, y + dy * s * 0.06 * k, s * 0.1 * k, oro, sombra, borla, 10 + rnd() * 30);
        o += birrete(x + dx * s * 0.05 * k, y + dy * s * 0.22 * k, s * 0.08 * k, oro, sombra, borla, -30 + rnd() * 20);
        return o;
      };
      if (tipo === "apertura") {
        c += grupo(izq.x, 0, 1, 1, 1, 3) + grupo(der.x + der.w, 0, -1, 1, 1, 5);
        c += `<line x1="${n(izq.x + izq.w * 0.3)}" y1="${n(izq.h * 0.25)}" x2="${n(izq.x + izq.w * 0.7)}" y2="${n(izq.h * 0.25)}" stroke="${oro}" stroke-width="0.4"/>`;
      } else if (tipo === "cierre") {
        c += grupo(izq.x, izq.h, 1, -1, 1, 7) + grupo(der.x + der.w, der.h, -1, -1, 1, 9);
      } else if (tipo === "interior") {
        c += grupo(izq.x, 0, 1, 1, 0.7, 11) + grupo(der.x + der.w, der.h, -1, -1, 0.7, 13);
      } else {
        c += grupo(izq.x, izq.h, 1, -1, 0.7, 15) + grupo(der.x + der.w, 0, -1, 1, 0.7, 17);
      }
      return svg(m, c, fondo.defs);
    },
    zona: (tipo, lado, m) => {
      const z = zonaRel({ arriba: 0.13, abajo: 0.13, exterior: 0.06 })(tipo, lado, m);
      return paginaDeTitulo(tipo, lado) ? { ...z, abajo: n(ladoChico(m) * 0.05) } : z;
    },
    textos: textosClasicos({
      titulo: "Playfair Display",
      texto: "Montserrat",
      color: "#e6c878",
      acento: "#f1e6c8",
      escalaTitulo: 0.09,
      ejemplos: { titulo: "Egresados 2026", subtitulo: "Instituto Belgrano", fecha: "Acto de colación · 04 · 12 · 2026", frase: "Lo mejor está por venir" },
    }),
  },
  {
    id: "egresados-03-bariloche",
    tema: "egresados",
    nombre: "Bariloche",
    descripcion: "Cerros nevados, pinos y copos en celeste y azul. Para el viaje de egresados.",
    papel: "#eaf3fa",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const cielo = degradado("ci", total, "#cfe3f1", "#f4f9fc");
      let c = cielo.cuerpo;
      const capas = [
        { roca: "#9fb8d0", nieve: "#ffffff" },
        { roca: "#5f7fa3", nieve: "#eef4fa" },
        { roca: "#2f4b6e", nieve: "#e3ecf5" },
      ];
      for (const lado of ["izq", "der"] as const) {
        const p = lado === "izq" ? izq : der;
        const alto = altoCerros(tipo, lado, m);
        c += montanasNevadas(p, alto, capas, lado === "izq" ? 3 : 8);
        // Pinos al frente, en el borde de afuera.
        const xs = lado === "izq" ? [p.x + s * 0.04, p.x + s * 0.09, p.x + s * 0.13] : [p.x + p.w - s * 0.04, p.x + p.w - s * 0.09, p.x + p.w - s * 0.13];
        xs.forEach((x, i) => (c += pino(x, p.h, alto * (0.75 - i * 0.15), "#1f3b2d", "#4a3524")));
      }
      // Copos en la franja de arriba.
      const rnd = azar(21);
      const copos = Math.round((tipo === "apertura" || tipo === "cierre" ? 26 : 14) * (m.anchoMm / 600));
      for (let i = 0; i < copos; i++) {
        const x = rnd() * m.anchoMm;
        const y = s * (0.02 + rnd() * 0.07);
        c += copo(x, y, s * (0.008 + rnd() * 0.01), "#7d9cc0", 0.3, 0.8);
      }
      return svg(m, c, cielo.defs);
    },
    zona: (tipo, lado, m) => ({ ...zonaRel({ arriba: 0.07 })(tipo, lado, m), abajo: n(Math.max(0, altoCerros(tipo, lado, m) - 14 + 3)) }),
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Bebas Neue",
        texto: "Montserrat",
        color: "#1d3557",
        acento: "#457b9d",
        escalaTitulo: 0.16,
        ejemplos: { titulo: "Bariloche 2026", subtitulo: "Viaje de egresados", fecha: "Promo 2026 · Septiembre", frase: "Lo que pasa en Bariloche queda en este libro" },
      })(tipo, m).map((t) => (t.rol === "frase" ? { ...t, puntos: t.puntos * 0.55 } : t)),
  },
  {
    id: "egresados-04-buzo-de-promo",
    tema: "egresados",
    nombre: "Buzo de promo",
    descripcion: "Bordó y dorado como el buzo de la promo: puños acanalados, rayas de manga y estrellas.",
    papel: "#f2ebdc",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const bordo = "#6d1a26";
      const oscuro = "#541320";
      const oro = "#d9a441";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f2ebdc");
      if (tipo === "apertura") {
        c += fondoLiso(izq, bordo);
        for (let i = 0; i < 5; i++) c += estrella(izq.x + izq.w / 2 + (i - 2) * s * 0.05, izq.h * 0.2, s * (i === 2 ? 0.022 : 0.015), oro);
        c += punoDeBuzo(izq.x, izq.h, izq.w, s, oscuro, "#3f0e18", oro, bordo);
        c += rayasDeManga(der, "der", s, bordo, oro);
      } else if (tipo === "interior") {
        c += punoDeBuzo(0, m.altoMm, m.anchoMm, s, bordo, oscuro, oro, "#f2ebdc");
      } else if (tipo === "interior-alt") {
        c += rayasDeManga(izq, "izq", s, bordo, oro) + rayasDeManga(der, "der", s, bordo, oro);
      } else {
        c += punoDeBuzo(0, m.altoMm, m.anchoMm, s, bordo, oscuro, oro, "#f2ebdc");
        for (let i = 0; i < 3; i++) c += estrella(der.x + der.w / 2 + (i - 1) * s * 0.05, der.h * 0.07, s * 0.016, oro);
      }
      return svg(m, c);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const base = zonaRel({})(tipo, lado, m);
      const conPuno = tipo === "interior" || tipo === "cierre" || (tipo === "apertura" && lado === "izq");
      const conManga = tipo === "interior-alt" || (tipo === "apertura" && lado === "der");
      return { ...base, abajo: conPuno ? n(s * 0.1) : n(s * 0.02), exterior: conManga ? n(s * 0.1) : 0, arriba: base.arriba ?? n(s * 0.02) };
    },
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Anton",
        texto: "Oswald",
        color: tipo === "apertura" ? "#f2ebdc" : "#6d1a26",
        acento: "#d9a441",
        escalaTitulo: 0.13,
        ejemplos: { titulo: "Promo 26", subtitulo: "Los últimos del cole", fecha: "Escuela Técnica N.° 5", frase: "Para siempre promo 26" },
      })(tipo, m),
  },
  {
    id: "egresados-05-neon",
    tema: "egresados",
    nombre: "Neón de fiesta",
    descripcion: "Fondo negro con trazos de neón fucsia, celeste y amarillo. Para la fiesta de egresados.",
    papel: "#0c0b16",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("ng", total, "#14112a", "#0a0912");
      const g = s * 0.006 + 0.35;
      const rosa = "#ff3fbf";
      const cian = "#2de2ff";
      const amarillo = "#f9f871";
      const grupo = (x: number, y: number, dx: 1 | -1, dy: 1 | -1, k: number, giro: number) => {
        let o = zigzag(x + dx * s * 0.05 * k, y + dy * s * 0.07 * k, s * 0.2 * k, s * 0.03 * k, 4, dx === 1 ? giro : 180 - giro, rosa, g * 1.4);
        o += `<circle cx="${n(x + dx * s * 0.2 * k)}" cy="${n(y + dy * s * 0.15 * k)}" r="${n(s * 0.04 * k)}" fill="none" stroke="${cian}" stroke-width="${n(g * 1.3)}"/>`;
        o += triangulo(x + dx * s * 0.08 * k, y + dy * s * 0.19 * k, s * 0.035 * k, giro * 2, amarillo, g * 1.2);
        o += signo(x + dx * s * 0.3 * k, y + dy * s * 0.06 * k, s * 0.025 * k, "+", amarillo, g);
        o += signo(x + dx * s * 0.14 * k, y + dy * s * 0.28 * k, s * 0.018 * k, "x", cian, g);
        return o;
      };
      let d = "";
      if (tipo === "apertura") {
        d += grupo(izq.x, 0, 1, 1, 1, 12) + grupo(der.x + der.w, der.h, -1, -1, 1, 8);
        d += `<line x1="${n(izq.x + izq.w * 0.32)}" y1="${n(izq.h * 0.26)}" x2="${n(izq.x + izq.w * 0.68)}" y2="${n(izq.h * 0.26)}" stroke="${cian}" stroke-width="${n(g)}" stroke-linecap="round"/>`;
      } else if (tipo === "cierre") {
        d += grupo(izq.x, izq.h, 1, -1, 1, 15) + grupo(der.x + der.w, der.h, -1, -1, 1, 5);
      } else if (tipo === "interior") {
        d += grupo(izq.x, 0, 1, 1, 0.7, 10) + grupo(der.x + der.w, der.h, -1, -1, 0.7, 20);
      } else {
        d += grupo(izq.x, izq.h, 1, -1, 0.7, 25) + grupo(der.x + der.w, 0, -1, 1, 0.7, 6);
      }
      return svg(m, fondo.cuerpo + `<g filter="url(#neon)">${d}</g>`, fondo.defs + filtroNeon("neon", s * 0.006 + 0.3));
    },
    zona: (tipo, lado, m) => {
      const z = zonaRel({ arriba: 0.13, abajo: 0.13, exterior: 0.08 })(tipo, lado, m);
      return paginaDeTitulo(tipo, lado) ? { ...z, abajo: n(ladoChico(m) * 0.06) } : z;
    },
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Pacifico",
        texto: "Poppins",
        color: "#ff5ec8",
        acento: "#2de2ff",
        escalaTitulo: 0.11,
        ejemplos: { titulo: "La Fiesta", subtitulo: "Egresados 2026", fecha: "Sábado 12 · 12 · 2026", frase: "Que la música no pare" },
      })(tipo, m).map((t) => (t.rol === "fecha" ? { ...t, color: "#f9f871" } : t)),
  },
  {
    id: "egresados-06-brindis-dorado",
    tema: "egresados",
    nombre: "Brindis dorado",
    descripcion: "Serpentinas doradas y negras con papelitos sobre crema. Elegante y festivo para la fiesta.",
    papel: "#fbf7ef",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const oro = "#c9a04a";
      const negro = "#1d1d1d";
      const rubor = "#e8c4b8";
      const g = grano("g", m, 0.04);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbf7ef");
      const esquina = (x: number, y: number, dx: 1 | -1, dy: 1 | -1, k: number, sem: number) => {
        const giroBase = dx === 1 ? (dy === 1 ? 30 : -30) : dy === 1 ? 150 : -150;
        let o = serpentina(x, y, s * 0.48 * k, giroBase - 12, oro, s * 0.006 + 0.3, sem);
        o += serpentina(x, y, s * 0.38 * k, giroBase + 14, negro, s * 0.004 + 0.25, sem + 1);
        o += serpentina(x, y, s * 0.33 * k, giroBase + 2, rubor, s * 0.005 + 0.3, sem + 2);
        const area = { x: dx === 1 ? x : x - s * 0.32 * k, y: dy === 1 ? y : y - s * 0.24 * k, w: s * 0.32 * k, h: s * 0.24 * k };
        const rnd = azar(sem + 5);
        for (let i = 0; i < Math.round(16 * k); i++) {
          o += `<circle cx="${n(area.x + rnd() * area.w)}" cy="${n(area.y + rnd() * area.h)}" r="${n(s * (0.004 + rnd() * 0.008))}" fill="${rnd() > 0.3 ? oro : negro}" opacity="${n(0.6 + rnd() * 0.4)}"/>`;
        }
        return o;
      };
      if (tipo === "apertura") c += esquina(izq.x, 0, 1, 1, 1, 3) + esquina(der.x + der.w, der.h, -1, -1, 1, 7);
      else if (tipo === "cierre") c += esquina(izq.x, izq.h, 1, -1, 1, 11) + esquina(der.x + der.w, der.h, -1, -1, 1, 13);
      else if (tipo === "interior") c += esquina(der.x + der.w, 0, -1, 1, 0.7, 17);
      else c += esquina(izq.x, izq.h, 1, -1, 0.7, 19);
      c += `<line x1="${n(izq.x + s * 0.05)}" y1="${n(izq.h - s * 0.035)}" x2="${n(der.x + der.w - s * 0.05)}" y2="${n(izq.h - s * 0.035)}" stroke="${oro}" stroke-width="0.25" opacity="${tipo === "interior" ? 0.8 : 0}"/>`;
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: (tipo, lado, m) => {
      const z = zonaRel({ arriba: 0.12, abajo: 0.12, exterior: 0.06 })(tipo, lado, m);
      return paginaDeTitulo(tipo, lado) ? { ...z, abajo: n(ladoChico(m) * 0.05) } : z;
    },
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Parisienne",
        texto: "Oswald",
        color: "#1d1d1d",
        acento: "#b08a3a",
        escalaTitulo: 0.12,
        ejemplos: { titulo: "Fiesta de egresados", subtitulo: "Promo 2026", fecha: "Viernes 11 · 12 · 2026", frase: "Brindamos por lo que viene" },
      })(tipo, m),
  },
  {
    id: "egresados-07-hoja-de-carpeta",
    tema: "egresados",
    nombre: "Hoja de carpeta",
    descripcion: "Hoja rayada con margen rojo, agujeritos y dibujos de birome. Todo el año escolar en un libro.",
    papel: "#fdfdfb",
    margenMm: 12,
    esquinasMm: 0,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const paso = Math.max(5, s * 0.028);
      const tinta = "#1f3c88";
      const t = s * 0.004 + 0.3;
      const defs = `<pattern id="ren" width="10" height="${n(paso)}" patternUnits="userSpaceOnUse" y="${n(s * 0.1)}"><line x1="0" y1="${n(paso - 0.15)}" x2="10" y2="${n(paso - 0.15)}" stroke="#a9c6e8" stroke-width="0.25"/></pattern>`;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fdfdfb");
      c += `<rect x="0" y="${n(s * 0.1)}" width="${n(m.anchoMm)}" height="${n(m.altoMm - s * 0.1)}" fill="url(#ren)"/>`;
      // Margen rojo (doble) y agujeritos de carpeta, del lado de afuera de cada página.
      const mx = margenCarpeta(m);
      for (const [x, haciaAfuera] of [
        [izq.x + mx, -1],
        [der.x + der.w - mx, 1],
      ] as const) {
        c += `<line x1="${n(x)}" y1="0" x2="${n(x)}" y2="${n(m.altoMm)}" stroke="#e06666" stroke-width="0.35"/><line x1="${n(x - haciaAfuera * 1.2)}" y1="0" x2="${n(x - haciaAfuera * 1.2)}" y2="${n(m.altoMm)}" stroke="#e06666" stroke-width="0.2"/>`;
        const ax = x + haciaAfuera * mx * 0.55;
        for (const fy of [0.2, 0.5, 0.8]) c += `<circle cx="${n(ax)}" cy="${n(m.altoMm * fy)}" r="${n(s * 0.016)}" fill="#e4e4e0"/><circle cx="${n(ax)}" cy="${n(m.altoMm * fy + s * 0.003)}" r="${n(s * 0.014)}" fill="#d0d0ca"/>`;
      }
      // Dibujitos de birome en el margen.
      const colX = izq.x + mx * 0.5;
      const colXd = der.x + der.w - mx * 0.5;
      if (tipo === "apertura") {
        c += estrellaTrazo(colX, m.altoMm * 0.1, mx * 0.28, tinta, t, 8) + corazonTrazo(colX, m.altoMm * 0.9, mx * 0.4, tinta, t, -10);
        c += espiral(colXd, m.altoMm * 0.35, mx * 0.22, tinta, t);
        c += `<path d="M ${n(izq.x + izq.w * 0.3)} ${n(izq.h * 0.26)} q ${n(izq.w * 0.2)} ${n(-s * 0.02)} ${n(izq.w * 0.4)} 0" stroke="${tinta}" stroke-width="${n(t * 1.2)}" fill="none" stroke-linecap="round"/>`;
      } else if (tipo === "interior") {
        c += corazonTrazo(colX, m.altoMm * 0.35, mx * 0.35, tinta, t, 8) + estrellaTrazo(colXd, m.altoMm * 0.65, mx * 0.25, tinta, t);
      } else if (tipo === "interior-alt") {
        // Un papelito autoadhesivo amarillo en la esquina.
        const pw = s * 0.13;
        const px = der.x + der.w - mx - s * 0.02 - pw;
        c += `<g transform="rotate(4 ${n(px + pw / 2)} ${n(s * 0.08)})"><rect x="${n(px + s * 0.004)}" y="${n(s * 0.025)}" width="${n(pw)}" height="${n(pw)}" fill="#000000" opacity="0.08"/><rect x="${n(px)}" y="${n(s * 0.02)}" width="${n(pw)}" height="${n(pw)}" fill="#fff27a"/><rect x="${n(px)}" y="${n(s * 0.02)}" width="${n(pw)}" height="${n(pw * 0.14)}" fill="#f6e35a"/></g>`;
        c += flecha(colX, m.altoMm * 0.6, mx * 0.6, -70, tinta, t);
      } else {
        c += estrellaTrazo(colXd, m.altoMm * 0.65, mx * 0.28, tinta, t, 8) + corazonTrazo(colX, m.altoMm * 0.35, mx * 0.4, tinta, t);
      }
      return svg(m, c, defs);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const z = zonaRel({ arriba: 0.05, abajo: 0.03 })(tipo, lado, m);
      const conPapelito = tipo === "interior-alt" && lado === "der";
      return { ...z, exterior: n(Math.max(0, margenCarpeta(m) + 3 - 12)), arriba: conPapelito ? n(s * 0.17) : z.arriba };
    },
    textos: (tipo, m) => {
      // Corridos hacia adentro, para que no pisen el margen rojo.
      const mx = margenCarpeta(m);
      return textosClasicos({
        titulo: "Indie Flower",
        texto: "Patrick Hand",
        color: "#1f3c88",
        acento: "#c0392b",
        escalaTitulo: 0.11,
        ejemplos: { titulo: "6.° B · Promo 2026", subtitulo: "Nuestro último año", fecha: "Marzo a diciembre 2026", frase: "Gracias por estos años, compañeros" },
      })(tipo, m).map((t) => {
        const w = m.anchoMm / 2;
        const enIzq = t.x < w;
        const x0 = enIzq ? Math.max(t.x, mx + 4) : t.x;
        const x1 = enIzq ? t.x + t.w : Math.min(t.x + t.w, m.anchoMm - mx - 4);
        return { ...t, x: x0, w: x1 - x0 };
      });
    },
  },
  {
    id: "egresados-08-memphis",
    tema: "egresados",
    nombre: "Memphis noventoso",
    descripcion: "Figuras geométricas, ondas y zigzags en rosa, turquesa y amarillo. Joven y descontracturado.",
    papel: "#fff6e9",
    margenMm: 14,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fff6e9");
      const k = esTitulo(tipo);
      if (tipo === "interior-alt") {
        c += memphis(izq.x + s * 0.02, izq.h - s * 0.02, 1, -1, s, 3, false) + memphis(der.x + der.w - s * 0.02, s * 0.02, -1, 1, s, 5, false);
      } else {
        c += memphis(izq.x + s * 0.02, s * 0.02, 1, 1, s, 7, k) + memphis(der.x + der.w - s * 0.02, der.h - s * 0.02, -1, -1, s, 9, k);
      }
      if (tipo === "apertura") c += onda(izq.x + izq.w / 2 - s * 0.1, izq.h * 0.25, s * 0.2, s * 0.012, 5, 0, "#2ec4b6", s * 0.008 + 0.3);
      return svg(m, c);
    },
    zona: (tipo, lado, m) => {
      const z = zonaRel({ arriba: 0.1, abajo: 0.1, exterior: 0.08 })(tipo, lado, m);
      return paginaDeTitulo(tipo, lado) ? { ...z, abajo: n(ladoChico(m) * 0.05) } : z;
    },
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Rubik",
        texto: "Poppins",
        color: "#2b2b2b",
        acento: "#e0457f",
        escalaTitulo: 0.12,
        ejemplos: { titulo: "Promo 2026", subtitulo: "Los mejores años", fecha: "5.° año · Turno mañana", frase: "Nos vemos en la próxima juntada" },
      })(tipo, m).map((t) => (t.rol === "titulo" || t.rol === "frase" ? { ...t, negrita: true } : t)),
  },
  {
    id: "egresados-09-bordo-academico",
    tema: "egresados",
    nombre: "Bordó académico",
    descripcion: "Bordó profundo con doble filete dorado y corona de laurel. Formal, para el acto de colación.",
    papel: "#5e1622",
    margenMm: 17,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("bo", total, "#6a1a28", "#4d111b");
      const g = grano("g", m, 0.07);
      const oro = "#d8b86a";
      let c = fondo.cuerpo;
      for (const p of [izq, der]) c += filete(p, s * 0.04, oro, 0.5) + filete(p, s * 0.05, oro, 0.2);
      if (tipo === "apertura") {
        c += laurel(izq.x + izq.w / 2, izq.h * 0.17, Math.min(izq.w, izq.h) * 0.075, oro);
      } else if (tipo === "cierre") {
        c += laurel(der.x + der.w / 2, der.h - s * 0.12, s * 0.05, oro);
        c += esquineros(izq, s * 0.065, s * 0.06, oro, 0.35);
      } else if (tipo === "interior") {
        for (const p of [izq, der]) c += esquineros(p, s * 0.065, s * 0.06, oro, 0.35);
      } else {
        c += estrella(izq.x + izq.w / 2, izq.h - s * 0.045, s * 0.012, oro) + estrella(der.x + der.w / 2, der.h - s * 0.045, s * 0.012, oro);
      }
      return svg(m, c + g.cuerpo, fondo.defs + g.defs);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const z = zonaRel({ arriba: 0.05, abajo: 0.05, exterior: 0.03, interior: 0.02 })(tipo, lado, m);
      if (tipo === "cierre" && lado === "der") return { ...z, abajo: n(s * 0.16) };
      return z;
    },
    textos: textosClasicos({
      titulo: "Playfair Display",
      texto: "Lora",
      color: "#e2c47c",
      acento: "#f1e4c4",
      escalaTitulo: 0.085,
      ejemplos: { titulo: "Promoción 2026", subtitulo: "Colegio Nacional", fecha: "Acto de colación · 04 · 12 · 2026", frase: "El final de una etapa, el comienzo de todo" },
    }),
  },
  {
    id: "egresados-10-bitacora-de-viaje",
    tema: "egresados",
    nombre: "Bitácora de viaje",
    descripcion: "Papel de mapa con curvas de nivel, rosa de los vientos, sellos y la ruta punteada del viaje.",
    papel: "#efe6d2",
    margenMm: 15,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const g = grano("g", m, 0.1, 1.1);
      const tinta = "#2d4a5a";
      const rojo = "#b5523b";
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#efe6d2");
      const k = esTitulo(tipo) ? 1 : 0.75;
      const alt = tipo === "interior-alt";
      // Curvas de nivel centradas en dos esquinas de afuera.
      const a = alt ? { x: izq.x, y: izq.h } : { x: izq.x, y: 0 };
      const b = alt ? { x: der.x + der.w, y: 0 } : { x: der.x + der.w, y: der.h };
      c += `<g opacity="0.7">${curvasDeNivel(a.x, a.y, s * 0.3 * k, 7, "#9a8458", 3, s * 0.002 + 0.25)}${curvasDeNivel(b.x, b.y, s * 0.3 * k, 7, "#9a8458", 9, s * 0.002 + 0.25)}</g>`;
      const ruta = (x1: number, y1: number, x2: number, y2: number, cx: number, cy: number) =>
        `<path d="M ${n(x1)} ${n(y1)} Q ${n(cx)} ${n(cy)} ${n(x2)} ${n(y2)}" stroke="${rojo}" stroke-width="${n(s * 0.003 + 0.3)}" fill="none" stroke-dasharray="${n(s * 0.012)} ${n(s * 0.01)}" stroke-linecap="round"/>`;
      const pin = (x: number, y: number) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 0.012)}" fill="${rojo}"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 0.005)}" fill="#efe6d2"/>`;
      if (tipo === "apertura") {
        c += rosaDeLosVientos(izq.x + s * 0.13, izq.h - s * 0.13, s * 0.09, tinta, "#b8a888");
        c += ruta(izq.x + izq.w * 0.2, izq.h * 0.2, izq.x + izq.w * 0.8, izq.h * 0.14, izq.x + izq.w * 0.5, izq.h * 0.02);
        c += pin(izq.x + izq.w * 0.2, izq.h * 0.2) + avion(izq.x + izq.w * 0.8 + s * 0.03, izq.h * 0.14 - s * 0.01, s * 0.06, -15, tinta);
        c += sello(der.x + der.w - s * 0.1, s * 0.1, s * 0.05, rojo, -15);
      } else if (tipo === "cierre") {
        c += rosaDeLosVientos(der.x + der.w - s * 0.13, der.h - s * 0.13, s * 0.09, tinta, "#b8a888");
        c += sello(izq.x + s * 0.1, s * 0.1, s * 0.05, tinta, 12);
      } else if (tipo === "interior") {
        c += sello(der.x + der.w - s * 0.09, s * 0.09, s * 0.04, rojo, 10);
        c += ruta(izq.x + s * 0.03, izq.h - s * 0.04, izq.x + s * 0.2, izq.h - s * 0.03, izq.x + s * 0.12, izq.h - s * 0.1) + pin(izq.x + s * 0.2, izq.h - s * 0.03);
      } else {
        c += avion(der.x + der.w - s * 0.1, der.h - s * 0.07, s * 0.06, -20, tinta);
        c += ruta(der.x + der.w - s * 0.35, der.h - s * 0.03, der.x + der.w - s * 0.14, der.h - s * 0.06, der.x + der.w - s * 0.25, der.h - s * 0.01);
        c += sello(izq.x + s * 0.09, s * 0.09, s * 0.04, tinta, -8);
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const z = zonaRel({ arriba: 0.1, abajo: 0.08, exterior: 0.04 })(tipo, lado, m);
      if (tipo === "apertura" && lado === "izq") return { ...z, abajo: n(s * 0.05), exterior: n(s * 0.18) };
      if (tipo === "cierre" && lado === "der") return { ...z, abajo: n(s * 0.18) };
      return z;
    },
    textos: textosClasicos({
      titulo: "Shadows Into Light",
      texto: "Work Sans",
      color: "#2d4a5a",
      acento: "#b5523b",
      escalaTitulo: 0.12,
      ejemplos: { titulo: "Diario de viaje", subtitulo: "Egresados 2026", fecha: "Bariloche · Septiembre 2026", frase: "Volvimos con mil historias" },
    }),
  },
];

/** Lo que suben los cerros de Bariloche en cada página: menos en la del título. */
function altoCerros(tipo: TipoPliego, lado: "izq" | "der", m: Medidas): number {
  const s = ladoChico(m);
  if (paginaDeTitulo(tipo, lado)) return s * 0.17;
  return s * (esTitulo(tipo) ? 0.3 : 0.26);
}

/** Dónde va el margen rojo de la hoja de carpeta, medido desde el borde de afuera. */
const margenCarpeta = (m: Medidas) => ladoChico(m) * 0.12;
