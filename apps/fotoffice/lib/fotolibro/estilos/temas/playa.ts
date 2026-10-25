import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import { azar, degradado, filtroAcuarela, fondoLiso, grano, hoja, manchaAcuarela, olas, paginas, svg } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Estilos de vacaciones de playa: Costa Atlántica, Brasil, Caribe. Además de las piezas de
 * `dibujo.ts`, acá viven las propias del mar (palmeras, conchas, estrellas de mar, sombrillas,
 * tablas de surf, estampillas), todas en milímetros y con azar de semilla fija.
 */

const n = (v: number) => Math.round(v * 100) / 100;

// ─── Piezas de playa ──────────────────────────────────────────────────────────────────────────

/** Palmera en silueta: tronco curvo y hojas caídas. `inclina` va de -1 (izquierda) a 1 (derecha). */
function palmera(x: number, y: number, alto: number, inclina: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  const tx = x + inclina * alto * 0.32;
  const ty = y - alto;
  const cx = x + inclina * alto * 0.02;
  const cy = y - alto * 0.5;
  const w0 = alto * 0.032;
  const w1 = alto * 0.016;
  let out = `<path d="M ${n(x - w0)} ${n(y)} Q ${n(cx - w0 * 0.8)} ${n(cy)} ${n(tx - w1)} ${n(ty)} L ${n(tx + w1)} ${n(ty)} Q ${n(cx + w0 * 0.8)} ${n(cy)} ${n(x + w0)} ${n(y)} Z" fill="${color}"/>`;
  // Hojas: la misma forma hacia la derecha y espejada hacia la izquierda.
  const angulos = [-65, -35, -8, 22];
  for (const lado of [1, -1]) {
    for (const a of angulos) {
      const L = alto * (0.3 + rnd() * 0.12);
      const ang = a + (rnd() - 0.5) * 10;
      out += `<path d="M0 0 Q ${n(L * 0.5)} ${n(-L * 0.3)} ${n(L)} ${n(L * 0.16)} Q ${n(L * 0.5)} ${n(-L * 0.08)} 0 0 Z" fill="${color}" transform="translate(${n(tx)} ${n(ty)}) scale(${lado} 1) rotate(${n(ang)})"/>`;
    }
  }
  out += `<path d="M0 0 Q ${n(alto * 0.05)} ${n(-alto * 0.12)} ${n(alto * 0.02)} ${n(-alto * 0.24)} Q ${n(-alto * 0.02)} ${n(-alto * 0.1)} 0 0 Z" fill="${color}" transform="translate(${n(tx)} ${n(ty)})"/>`;
  for (let i = 0; i < 3; i++) out += `<circle cx="${n(tx + (i - 1) * alto * 0.028)}" cy="${n(ty + alto * 0.03)}" r="${n(alto * 0.02)}" fill="${color}"/>`;
  return out;
}

/** Concha de vieira: abanico con borde ondulado y estrías. */
function concha(x: number, y: number, r: number, color: string, linea: string, giro = 0): string {
  const pts: [number, number][] = [];
  const k = 8;
  for (let i = 0; i <= k; i++) {
    const a = ((-160 + (140 * i) / k) * Math.PI) / 180;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  let d = `M 0 0 L ${n(pts[0]![0])} ${n(pts[0]![1])}`;
  for (let i = 0; i < k; i++) {
    const a = ((-160 + (140 * (i + 0.5)) / k) * Math.PI) / 180;
    d += ` Q ${n(Math.cos(a) * r * 1.13)} ${n(Math.sin(a) * r * 1.13)} ${n(pts[i + 1]![0])} ${n(pts[i + 1]![1])}`;
  }
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"><path d="${d} Z" fill="${color}"/>`;
  out += `<path d="M ${n(-r * 0.3)} ${n(r * 0.06)} L ${n(-r * 0.14)} ${n(-r * 0.16)} L ${n(r * 0.14)} ${n(-r * 0.16)} L ${n(r * 0.3)} ${n(r * 0.06)} Z" fill="${color}"/>`;
  for (let i = 1; i < k; i++) {
    out += `<line x1="0" y1="${n(-r * 0.1)}" x2="${n(pts[i]![0] * 0.92)}" y2="${n(pts[i]![1] * 0.92)}" stroke="${linea}" stroke-width="${n(r * 0.05)}" stroke-linecap="round"/>`;
  }
  return `${out}</g>`;
}

/** Caracol cónico (turritela): espiral de anillos que se achican. */
function caracol(x: number, y: number, largo: number, color: string, linea: string, giro = 0): string {
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})">`;
  out += `<path d="M 0 ${n(-largo / 2)} L ${n(largo * 0.2)} ${n(largo * 0.4)} Q 0 ${n(largo * 0.55)} ${n(-largo * 0.2)} ${n(largo * 0.4)} Z" fill="${color}"/>`;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const yy = -largo / 2 + largo * 0.9 * t;
    const ww = largo * 0.2 * t;
    out += `<path d="M ${n(-ww)} ${n(yy)} Q 0 ${n(yy + largo * 0.06)} ${n(ww)} ${n(yy - largo * 0.02)}" stroke="${linea}" stroke-width="${n(largo * 0.03)}" fill="none" stroke-linecap="round"/>`;
  }
  return `${out}</g>`;
}

/** Estrella de mar: cinco brazos redondeados con puntitos. */
function estrellaMar(x: number, y: number, r: number, color: string, puntos: string, giro = 0): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${n(Math.cos(a) * rr)},${n(Math.sin(a) * rr)}`);
  }
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"><polygon points="${p.join(" ")}" fill="${color}" stroke="${color}" stroke-width="${n(r * 0.22)}" stroke-linejoin="round"/>`;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI / 5) * 2 * i - Math.PI / 2;
    for (const t of [0.3, 0.55, 0.78]) out += `<circle cx="${n(Math.cos(a) * r * t)}" cy="${n(Math.sin(a) * r * t)}" r="${n(r * 0.05)}" fill="${puntos}"/>`;
  }
  return `${out}</g>`;
}

/** Sol con rayos triangulares. */
function sol(x: number, y: number, r: number, color: string, rayos = 12, opacidad = 1): string {
  let out = `<g transform="translate(${n(x)} ${n(y)})" opacity="${opacidad}" fill="${color}"><circle r="${n(r)}"/>`;
  for (let i = 0; i < rayos; i++) {
    const a = (360 / rayos) * i;
    out += `<path d="M ${n(-r * 0.14)} ${n(-r * 1.2)} L 0 ${n(-r * 1.6)} L ${n(r * 0.14)} ${n(-r * 1.2)} Z" transform="rotate(${n(a)})"/>`;
  }
  return `${out}</g>`;
}

/** Sombrilla vista desde arriba (como desde un dron), con su sombra. */
function sombrillaArriba(x: number, y: number, r: number, c1: string, c2: string, giro = 0): string {
  let out = `<ellipse cx="${n(x + r * 0.25)}" cy="${n(y + r * 0.2)}" rx="${n(r)}" ry="${n(r * 0.92)}" fill="#000000" opacity="0.08"/>`;
  out += `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})">`;
  const k = 8;
  for (let i = 0; i < k; i++) {
    const a1 = (2 * Math.PI * i) / k;
    const a2 = (2 * Math.PI * (i + 1)) / k;
    out += `<path d="M 0 0 L ${n(Math.cos(a1) * r)} ${n(Math.sin(a1) * r)} A ${n(r)} ${n(r)} 0 0 1 ${n(Math.cos(a2) * r)} ${n(Math.sin(a2) * r)} Z" fill="${i % 2 ? c2 : c1}"/>`;
  }
  return `${out}<circle r="${n(r * 0.1)}" fill="#ffffff"/></g>`;
}

/** Toalla rayada, vista desde arriba. */
function toalla(x: number, y: number, w: number, h: number, color: string, raya: string, giro = 0): string {
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"><rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="${n(w * 0.04)}" fill="${color}"/>`;
  for (let i = 1; i < 5; i += 2) out += `<rect x="${n(-w / 2)}" y="${n(-h / 2 + (h * i) / 5)}" width="${n(w)}" height="${n(h / 5)}" fill="${raya}"/>`;
  return `${out}</g>`;
}

/** Tabla de surf parada, con su línea central y una franja. */
function tabla(x: number, y: number, largo: number, ancho: number, color: string, franja: string, giro = 0): string {
  const L = largo / 2;
  const a = ancho / 2;
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})">`;
  out += `<path d="M 0 ${n(-L)} C ${n(a * 1.1)} ${n(-L * 0.55)} ${n(a)} ${n(L * 0.55)} 0 ${n(L)} C ${n(-a)} ${n(L * 0.55)} ${n(-a * 1.1)} ${n(-L * 0.55)} 0 ${n(-L)} Z" fill="${color}"/>`;
  out += `<rect x="${n(-a)}" y="${n(-L * 0.18)}" width="${n(ancho)}" height="${n(L * 0.12)}" fill="${franja}"/>`;
  out += `<rect x="${n(-a)}" y="${n(L * 0.0)}" width="${n(ancho)}" height="${n(L * 0.04)}" fill="${franja}"/>`;
  out += `<line x1="0" y1="${n(-L * 0.92)}" x2="0" y2="${n(L * 0.92)}" stroke="#000000" stroke-opacity="0.18" stroke-width="${n(ancho * 0.03)}"/>`;
  return `${out}</g>`;
}

/** Gaviota en dos trazos. */
const gaviota = (x: number, y: number, t: number, color: string) =>
  `<path d="M ${n(x - t)} ${n(y)} q ${n(t * 0.5)} ${n(-t * 0.55)} ${n(t)} 0 q ${n(t * 0.5)} ${n(-t * 0.55)} ${n(t)} 0" stroke="${color}" stroke-width="${n(t * 0.12)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Ancla clásica de marinero. */
function ancla(x: number, y: number, t: number, color: string): string {
  const g = n(t * 0.09);
  return `<g transform="translate(${n(x)} ${n(y)})" stroke="${color}" stroke-width="${g}" fill="none" stroke-linecap="round"><circle cy="${n(-t * 0.42)}" r="${n(t * 0.09)}"/><line y1="${n(-t * 0.33)}" y2="${n(t * 0.45)}"/><line x1="${n(-t * 0.22)}" y1="${n(-t * 0.18)}" x2="${n(t * 0.22)}" y2="${n(-t * 0.18)}"/><path d="M ${n(-t * 0.38)} ${n(t * 0.12)} Q ${n(-t * 0.32)} ${n(t * 0.45)} 0 ${n(t * 0.47)} Q ${n(t * 0.32)} ${n(t * 0.45)} ${n(t * 0.38)} ${n(t * 0.12)}"/></g>`;
}

/** Salvavidas a rayas. */
function salvavidas(x: number, y: number, r: number, c1: string, c2: string, borde = "#1d3557"): string {
  const g = r * 0.38;
  const rm = r - g / 2;
  let out = `<g transform="translate(${n(x)} ${n(y)})"><circle r="${n(rm)}" fill="none" stroke="${c1}" stroke-width="${n(g)}"/>`;
  for (let i = 0; i < 4; i++) {
    out += `<circle r="${n(rm)}" fill="none" stroke="${c2}" stroke-width="${n(g)}" stroke-dasharray="${n((Math.PI * rm) / 4)} ${n((Math.PI * rm * 7) / 4)}" transform="rotate(${i * 90 + 22})"/>`;
  }
  return `${out}<circle r="${n(r)}" fill="none" stroke="${borde}" stroke-width="${n(r * 0.05)}"/><circle r="${n(r - g)}" fill="none" stroke="${borde}" stroke-width="${n(r * 0.05)}"/></g>`;
}

/** Hoja tropical grande (tipo costilla de Adán) con nervio central y cortes. */
function hojaTropical(x: number, y: number, largo: number, angulo: number, color: string, nervio: string): string {
  const a = largo * 0.36;
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angulo)})"><path d="M0 0 C ${n(largo * 0.15)} ${n(-a * 1.2)} ${n(largo * 0.8)} ${n(-a)} ${n(largo)} 0 C ${n(largo * 0.8)} ${n(a)} ${n(largo * 0.15)} ${n(a * 1.2)} 0 0 Z" fill="${color}"/>`;
  out += `<path d="M0 0 Q ${n(largo * 0.5)} ${n(-largo * 0.02)} ${n(largo * 0.96)} 0" stroke="${nervio}" stroke-width="${n(largo * 0.012)}" fill="none"/>`;
  for (let i = 1; i <= 5; i++) {
    const t = 0.15 + i * 0.13;
    for (const s of [1, -1]) {
      out += `<path d="M ${n(largo * t)} ${n(s * a * 0.15)} L ${n(largo * (t + 0.09))} ${n(s * a * 0.95)}" stroke="${nervio}" stroke-width="${n(largo * 0.022)}" stroke-linecap="round"/>`;
    }
  }
  return `${out}</g>`;
}

/** Hibisco: cinco pétalos anchos con pistilo. */
function hibisco(x: number, y: number, r: number, color: string, centro: string, giro = 0): string {
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})">`;
  for (let i = 0; i < 5; i++) {
    out += `<path d="M0 0 C ${n(-r * 0.7)} ${n(-r * 0.4)} ${n(-r * 0.5)} ${n(-r * 1.05)} 0 ${n(-r)} C ${n(r * 0.5)} ${n(-r * 1.05)} ${n(r * 0.7)} ${n(-r * 0.4)} 0 0 Z" fill="${color}" transform="rotate(${i * 72})"/>`;
  }
  out += `<line x1="0" y1="0" x2="${n(r * 0.55)}" y2="${n(-r * 0.55)}" stroke="${centro}" stroke-width="${n(r * 0.07)}" stroke-linecap="round"/><circle cx="${n(r * 0.58)}" cy="${n(-r * 0.58)}" r="${n(r * 0.08)}" fill="${centro}"/><circle r="${n(r * 0.16)}" fill="${centro}" opacity="0.6"/>`;
  return `${out}</g>`;
}

/** Estampilla con borde picado y un paisaje de mar adentro. */
function estampilla(x: number, y: number, w: number, h: number, papel: string, cielo: string, mar: string, solColor: string, giro = 0): string {
  const r = Math.min(w, h) * 0.045;
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"><rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" fill="#fffdf7"/>`;
  const iw = w * 0.8;
  const ih = h * 0.8;
  out += `<rect x="${n(-iw / 2)}" y="${n(-ih / 2)}" width="${n(iw)}" height="${n(ih)}" fill="${cielo}"/>`;
  out += `<circle cx="${n(iw * 0.15)}" cy="${n(-ih * 0.05)}" r="${n(iw * 0.18)}" fill="${solColor}"/>`;
  out += `<path d="M ${n(-iw / 2)} ${n(ih * 0.12)} q ${n(iw / 8)} ${n(-ih * 0.06)} ${n(iw / 4)} 0 t ${n(iw / 4)} 0 t ${n(iw / 4)} 0 t ${n(iw / 4)} 0 L ${n(iw / 2)} ${n(ih / 2)} L ${n(-iw / 2)} ${n(ih / 2)} Z" fill="${mar}"/>`;
  out += palmera(-iw * 0.28, ih * 0.22, ih * 0.55, 0.3, "#2f3e46", 4);
  // Picado del borde: círculos del color del papel.
  const nx = Math.max(4, Math.round(w / (r * 3)));
  const ny = Math.max(4, Math.round(h / (r * 3)));
  for (let i = 0; i <= nx; i++) {
    const px = -w / 2 + (w * i) / nx;
    out += `<circle cx="${n(px)}" cy="${n(-h / 2)}" r="${n(r)}" fill="${papel}"/><circle cx="${n(px)}" cy="${n(h / 2)}" r="${n(r)}" fill="${papel}"/>`;
  }
  for (let i = 0; i <= ny; i++) {
    const py = -h / 2 + (h * i) / ny;
    out += `<circle cx="${n(-w / 2)}" cy="${n(py)}" r="${n(r)}" fill="${papel}"/><circle cx="${n(w / 2)}" cy="${n(py)}" r="${n(r)}" fill="${papel}"/>`;
  }
  return `${out}</g>`;
}

/** Matasellos: doble círculo y líneas onduladas. */
function matasellos(x: number, y: number, r: number, color: string): string {
  let out = `<g transform="translate(${n(x)} ${n(y)})" stroke="${color}" fill="none" stroke-width="${n(r * 0.05)}" opacity="0.7"><circle r="${n(r)}"/><circle r="${n(r * 0.8)}"/>`;
  for (let i = 0; i < 4; i++) {
    const yy = -r * 0.45 + i * r * 0.3;
    out += `<path d="M ${n(r * 1.1)} ${n(yy)} q ${n(r * 0.35)} ${n(-r * 0.15)} ${n(r * 0.7)} 0 t ${n(r * 0.7)} 0 t ${n(r * 0.7)} 0 t ${n(r * 0.7)} 0"/>`;
  }
  return `${out}</g>`;
}

/** Ola en rulo, al estilo de grabado: una curva que se enrosca y espuma en líneas. */
function rulo(x: number, y: number, t: number, color: string, espuma: string): string {
  return `<g transform="translate(${n(x)} ${n(y)})"><path d="M 0 0 C ${n(t * 0.2)} ${n(-t * 0.9)} ${n(t * 1.1)} ${n(-t * 1.05)} ${n(t * 1.15)} ${n(-t * 0.45)} C ${n(t * 1.15)} ${n(-t * 0.15)} ${n(t * 0.85)} ${n(-t * 0.05)} ${n(t * 0.75)} ${n(-t * 0.32)} C ${n(t * 0.95)} ${n(-t * 0.35)} ${n(t * 0.95)} ${n(-t * 0.7)} ${n(t * 0.65)} ${n(-t * 0.7)} C ${n(t * 0.3)} ${n(-t * 0.7)} ${n(t * 0.3)} ${n(-t * 0.1)} ${n(t * 0.9)} 0 Z" fill="${color}"/><path d="M ${n(t * 0.35)} ${n(-t * 0.62)} Q ${n(t * 0.6)} ${n(-t * 0.95)} ${n(t * 0.98)} ${n(-t * 0.72)}" stroke="${espuma}" stroke-width="${n(t * 0.05)}" fill="none" stroke-linecap="round"/></g>`;
}

// ─── Ayudas ───────────────────────────────────────────────────────────────────────────────────

const esTitulo = (tipo: TipoPliego, lado: "izq" | "der") => (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");
const fuerte = (tipo: TipoPliego) => tipo === "apertura" || tipo === "cierre";

/** Suma la zona del título a la que reserve el estilo para sus adornos. */
function conTitulo(extra: (tipo: TipoPliego, lado: "izq" | "der", m: Medidas) => Partial<Zona>, posicion: "centro" | "arriba" = "centro") {
  return (tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Partial<Zona> => zonaClasica(extra(tipo, lado, m), posicion)(tipo, lado, m);
}

/** Lo que hay que sumar al margen para que la foto empiece `libre` mm después de un adorno de `tam` mm. */
const despeje = (tam: number, margen: number, libre = 4) => Math.max(0, tam + libre - margen);

const ejemplos = (titulo: string, subtitulo: string, fecha: string, frase: string) => ({ titulo, subtitulo, fecha, frase });

// ─── Estilos ──────────────────────────────────────────────────────────────────────────────────

export const PLAYA: EstiloFotolibro[] = [
  {
    id: "playa-01-acuarela-turquesa",
    tema: "playa",
    nombre: "Acuarela turquesa",
    descripcion: "Manchas de agua turquesa y arena, con conchas y estrellas de mar pintadas a mano.",
    papel: "#fdfbf6",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const k = fuerte(tipo) ? 1.3 : 1;
      const g = grano("g", m, 0.05);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fdfbf6");
      c += manchaAcuarela(izq.x + s * 0.02, s * 0.02, s * 0.2 * k, "#5ec4c0", "a", 4);
      c += manchaAcuarela(izq.x + s * 0.12, s * 0.0, s * 0.12 * k, "#e9d3a8", "a", 8, 2);
      c += manchaAcuarela(der.x + der.w - s * 0.02, der.h - s * 0.02, s * 0.2 * k, "#5ec4c0", "a", 9);
      c += manchaAcuarela(der.x + der.w - s * 0.14, der.h, s * 0.12 * k, "#e9d3a8", "a", 13, 2);
      c += estrellaMar(der.x + der.w - s * 0.09 * k, der.h - s * 0.1 * k, s * 0.05 * k, "#f08a5d", "#fde2cf", 14);
      c += concha(der.x + der.w - s * 0.2 * k, der.h - s * 0.05 * k, s * 0.035 * k, "#f5cfa8", "#d99b6c", 12);
      if (tipo !== "interior") c += concha(izq.x + s * 0.08 * k, s * 0.09 * k, s * 0.04 * k, "#f5cfa8", "#d99b6c", 160);
      if (tipo === "interior-alt") c += manchaAcuarela(der.x + der.w - s * 0.02, s * 0.02, s * 0.1, "#9fdcd6", "a", 21, 2);
      return svg(m, c + g.cuerpo, filtroAcuarela("a") + g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const k = fuerte(tipo) ? 1.3 : 1;
      return lado === "izq" ? { arriba: despeje(s * 0.17 * k, 14), exterior: 2 } : { abajo: despeje(s * 0.17 * k, 14), exterior: 2 };
    }),
    textos: textosClasicos({ titulo: "Satisfy", texto: "Quicksand", color: "#1f6f6b", acento: "#3fa7a1", ejemplos: ejemplos("Verano en Cariló", "Vacaciones en familia", "Enero 2026", "Volveremos al mar") }),
  },
  {
    id: "playa-02-marinero",
    tema: "playa",
    nombre: "Marinero",
    descripcion: "Rayas azul marino y blancas en los bordes, con ancla y salvavidas: clásico de la costa.",
    papel: "#fbfaf7",
    margenMm: 12,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const banda = s * 0.085;
      const paso = banda * 0.32;
      const defs = `<pattern id="rm" patternUnits="userSpaceOnUse" width="${n(banda)}" height="${n(paso * 2)}"><rect width="${n(banda)}" height="${n(paso * 2)}" fill="#ffffff"/><rect width="${n(banda)}" height="${n(paso)}" fill="#1d3557"/></pattern>`;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbfaf7");
      c += `<rect x="0" y="0" width="${n(banda)}" height="${n(m.altoMm)}" fill="url(#rm)"/>`;
      c += `<rect x="${n(m.anchoMm - banda)}" y="0" width="${n(banda)}" height="${n(m.altoMm)}" fill="url(#rm)"/>`;
      c += `<line x1="${n(banda + 1.2)}" y1="0" x2="${n(banda + 1.2)}" y2="${n(m.altoMm)}" stroke="#e63946" stroke-width="0.8"/>`;
      c += `<line x1="${n(m.anchoMm - banda - 1.2)}" y1="0" x2="${n(m.anchoMm - banda - 1.2)}" y2="${n(m.altoMm)}" stroke="#e63946" stroke-width="0.8"/>`;
      if (tipo === "apertura") {
        c += ancla(izq.x + izq.w / 2, izq.h * 0.18, s * 0.13, "#1d3557");
      }
      if (tipo === "interior-alt" || tipo === "cierre") {
        c += salvavidas(der.x + der.w - banda - s * 0.1, der.h - s * 0.1, s * 0.065, "#ffffff", "#e63946");
      }
      if (tipo === "interior") {
        // Una cuerda fina que cruza el pliego abajo.
        c += `<path d="M ${n(banda + 3)} ${n(m.altoMm - s * 0.04)} L ${n(m.anchoMm - banda - 3)} ${n(m.altoMm - s * 0.04)}" stroke="#c9a66b" stroke-width="${n(s * 0.008)}" stroke-dasharray="${n(s * 0.012)} ${n(s * 0.006)}"/>`;
      }
      return svg(m, c, defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const z: Partial<Zona> = { exterior: despeje(s * 0.085 + 1.6, 12) };
      if ((tipo === "interior-alt" || tipo === "cierre") && lado === "der") z.abajo = despeje(s * 0.165, 12);
      if (tipo === "interior") z.abajo = despeje(s * 0.045, 12, 3);
      return z;
    }),
    textos: textosClasicos({
      titulo: "Bebas Neue",
      texto: "Montserrat",
      color: "#1d3557",
      acento: "#e63946",
      escalaTitulo: 0.12,
      ejemplos: ejemplos("Mar del Plata", "Temporada de verano", "Febrero 2026", "Siempre hay un mar para volver"),
    }),
  },
  {
    id: "playa-03-palmeras-atardecer",
    tema: "playa",
    nombre: "Palmeras al atardecer",
    descripcion: "Cielo de atardecer caribeño y siluetas de palmeras en los bordes.",
    papel: "#fbd3a8",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const cielo = degradado("c", total, "#fde6c4", "#f6a38e");
      let c = cielo.cuerpo;
      const silueta = "#5b2a4a";
      const alto = m.altoMm * (fuerte(tipo) ? 0.78 : 0.62);
      if (tipo === "apertura") c += `<circle cx="${n(izq.x + izq.w / 2)}" cy="${n(izq.h * 0.15)}" r="${n(s * 0.07)}" fill="#fff3d6" opacity="0.85"/>`;
      // En la página del título las palmeras bajan, para no meterse con el texto.
      const altoIzq = tipo === "apertura" ? m.altoMm * 0.5 : alto;
      const altoDer = tipo === "cierre" ? m.altoMm * 0.55 : alto * 0.92;
      c += palmera(izq.x + s * 0.07, m.altoMm + 1, altoIzq, -0.35, silueta, 3);
      if (tipo !== "interior-alt") c += palmera(izq.x + s * 0.02, m.altoMm + 1, altoIzq * 0.7, 0.2, silueta, 7);
      c += palmera(der.x + der.w - s * 0.07, m.altoMm + 1, altoDer, 0.35, silueta, 11);
      if (tipo === "interior-alt") {
        c += gaviota(der.x + der.w * 0.62, der.h * 0.07, s * 0.025, silueta) + gaviota(der.x + der.w * 0.7, der.h * 0.05, s * 0.018, silueta);
      }
      c += `<rect x="0" y="${n(m.altoMm - s * 0.012)}" width="${n(m.anchoMm)}" height="${n(s * 0.012)}" fill="${silueta}"/>`;
      return svg(m, c, cielo.defs);
    },
    zona: conTitulo((tipo, _lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const alto = m.altoMm * (fuerte(tipo) ? 0.78 : 0.62);
      return { exterior: despeje(Math.min(s * 0.07 + alto * 0.3, s * 0.32), 13, 2), abajo: 2 };
    }),
    textos: textosClasicos({ titulo: "Dancing Script", texto: "Lato", color: "#5b2a4a", acento: "#8a3f5f", escalaTitulo: 0.12, ejemplos: ejemplos("Punta Cana", "Nuestro viaje al Caribe", "Marzo 2026", "Donde el sol se despide") }),
  },
  {
    id: "playa-04-sol-retro",
    tema: "playa",
    nombre: "Sol retro",
    descripcion: "Arcoíris de los setenta en mostaza, coral y verde agua: vacaciones con onda vintage.",
    papel: "#f8eedc",
    margenMm: 12,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const colores = ["#e76f51", "#f4a261", "#e9c46a", "#2a9d8f"];
      const R = s * (fuerte(tipo) ? 0.3 : 0.24);
      const arcos = (cx: number, cy: number, giro: number) => {
        let out = "";
        colores.forEach((col, i) => {
          const r = R * (1 - i * 0.22);
          out += `<path d="M ${n(r)} 0 A ${n(r)} ${n(r)} 0 0 1 0 ${n(r)} L 0 0 Z" fill="${col}" transform="translate(${n(cx)} ${n(cy)}) rotate(${giro})"/>`;
        });
        return out + `<path d="M ${n(R * 0.25)} 0 A ${n(R * 0.25)} ${n(R * 0.25)} 0 0 1 0 ${n(R * 0.25)} L 0 0 Z" fill="#f8eedc" transform="translate(${n(cx)} ${n(cy)}) rotate(${giro})"/>`;
      };
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f8eedc");
      c += arcos(izq.x, 0, 0);
      c += arcos(der.x + der.w, der.h, 180);
      if (tipo === "apertura") {
        // Sol a rayas que se esconde, sobre el título.
        const cx = izq.x + izq.w / 2;
        const cy = izq.h * 0.27;
        const r = s * 0.09;
        c += `<clipPath id="sr"><rect x="${n(cx - r)}" y="${n(cy - r)}" width="${n(2 * r)}" height="${n(r)}"/></clipPath><g clip-path="url(#sr)"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#e76f51"/>`;
        for (let i = 1; i < 4; i++) c += `<rect x="${n(cx - r)}" y="${n(cy - r * 0.12 * i * 1.6)}" width="${n(2 * r)}" height="${n(r * 0.05 * i)}" fill="#f8eedc"/>`;
        c += "</g>";
      }
      if (tipo === "interior-alt") c += `<circle cx="${n(izq.x + izq.w - s * 0.05)}" cy="${n(izq.h - s * 0.05)}" r="${n(s * 0.018)}" fill="#e9c46a"/><circle cx="${n(der.x + s * 0.05)}" cy="${n(s * 0.05)}" r="${n(s * 0.018)}" fill="#2a9d8f"/>`;
      return svg(m, c);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const R = s * (fuerte(tipo) ? 0.3 : 0.24);
      // El arcoíris de la izquierda va arriba (ahí ya está el título en la apertura); el de la derecha, abajo.
      return lado === "izq" ? { arriba: despeje(R * 0.62, 12), exterior: despeje(R * 0.62, 12) * 0.5 } : { abajo: despeje(R * 0.62, 12), exterior: despeje(R * 0.62, 12) * 0.5 };
    }),
    textos: textosClasicos({ titulo: "Pacifico", texto: "Rubik", color: "#264653", acento: "#e76f51", escalaTitulo: 0.1, ejemplos: ejemplos("Florianópolis 2026", "Verano entre amigos", "Enero 2026", "Good vibes, mucho sol") }),
  },
  {
    id: "playa-05-conchas-arena",
    tema: "playa",
    nombre: "Conchas en la arena",
    descripcion: "Papel color arena con conchas, caracoles y estrellas de mar sobre la orilla.",
    papel: "#f2e4c9",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.14, 1.2);
      const alto = s * (fuerte(tipo) ? 0.16 : 0.13);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f2e4c9");
      // Orilla mojada: una franja más oscura con una línea de espuma.
      const orilla = (p: typeof izq, sem: number) => {
        const rnd = azar(sem);
        let d = `M ${n(p.x)} ${n(p.h - alto)}`;
        const k = 6;
        for (let i = 1; i <= k; i++) d += ` Q ${n(p.x + (p.w * (i - 0.5)) / k)} ${n(p.h - alto - alto * (0.08 + rnd() * 0.18))} ${n(p.x + (p.w * i) / k)} ${n(p.h - alto + (rnd() - 0.5) * alto * 0.1)}`;
        return `<path d="${d} L ${n(p.x + p.w)} ${n(p.h)} L ${n(p.x)} ${n(p.h)} Z" fill="#e6d2ab"/><path d="${d}" stroke="#ffffff" stroke-width="${n(s * 0.006)}" fill="none" opacity="0.9"/>`;
      };
      c += orilla(izq, 2) + orilla(der, 5);
      const rnd = azar(tipo === "interior-alt" ? 31 : 17);
      for (const p of [izq, der]) {
        const piezas = Math.max(3, Math.round(p.w / (s * 0.17)));
        for (let i = 0; i < piezas; i++) {
          const x = p.x + (p.w * (i + 0.5)) / piezas + (rnd() - 0.5) * s * 0.04;
          const y = p.h - alto * (0.35 + rnd() * 0.25);
          const t = alto * (0.24 + rnd() * 0.1);
          const q = (i + (p === der ? 1 : 0)) % 3;
          c +=
            q === 0
              ? concha(x, y + t * 0.4, t, "#f6c9a5", "#d58f63", (rnd() - 0.5) * 50)
              : q === 1
                ? estrellaMar(x, y, t * 0.8, "#e9845d", "#fbd8c3", rnd() * 72)
                : caracol(x, y, t * 1.4, "#fff3e2", "#c9a57f", 40 + rnd() * 80);
        }
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const alto = s * (fuerte(tipo) ? 0.16 : 0.13);
      return { abajo: esTitulo(tipo, lado) ? Math.min(despeje(alto * 1.08, 14, 2), m.altoMm * 0.09) : despeje(alto * 1.08, 14, 2) };
    }),
    textos: textosClasicos({ titulo: "Kalam", texto: "Nunito", color: "#8a5a3c", acento: "#c07a52", escalaTitulo: 0.11, ejemplos: ejemplos("Las Grutas", "Vacaciones en familia", "Enero 2026", "Pies en la arena, corazón contento") }),
  },
  {
    id: "playa-06-surf-vintage",
    tema: "playa",
    nombre: "Surf vintage",
    descripcion: "Tablas de surf en verde agua, mostaza y óxido, con olas en rulo de grabado.",
    papel: "#f3ead6",
    margenMm: 12,
    esquinasMm: 1.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const g = grano("g", m, 0.1);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f3ead6");
      const L = m.altoMm * (fuerte(tipo) ? 0.62 : 0.5);
      const a = L * 0.2;
      const tablas = (x0: number, dir: number) =>
        tabla(x0 + dir * a * 0.62, m.altoMm - L * 0.5 - s * 0.02, L, a, "#1b7f79", "#f3ead6", dir * -4) +
        tabla(x0 + dir * a * 1.55, m.altoMm - L * 0.42 - s * 0.02, L * 0.84, a * 0.92, "#e9b44c", "#c8553d", dir * 3) +
        (fuerte(tipo) ? tabla(x0 + dir * a * 2.4, m.altoMm - L * 0.36 - s * 0.02, L * 0.72, a * 0.85, "#c8553d", "#f3ead6", dir * 7) : "");
      if (tipo !== "apertura") c += tablas(izq.x + s * 0.015, 1);
      c += tablas(der.x + der.w - s * 0.015, -1);
      if (tipo === "apertura") {
        c += rulo(izq.x + izq.w / 2 - s * 0.1, izq.h * 0.25, s * 0.17, "#1b7f79", "#f3ead6");
      }
      // Olas finas en la base de todo el pliego.
      c += olas({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, s * 0.03, ["#8cc7bf", "#1b7f79"], 8);
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const L = m.altoMm * (fuerte(tipo) ? 0.62 : 0.5);
      const ancho = L * 0.2 * (fuerte(tipo) ? 2.9 : 2.05) + s * 0.015;
      const tieneTablas = !(tipo === "apertura" && lado === "izq");
      return { exterior: tieneTablas ? despeje(ancho, 12, 3) : 0, abajo: despeje(s * 0.03, 12, 2) };
    }),
    textos: textosClasicos({ titulo: "Permanent Marker", texto: "Work Sans", color: "#1b4f4c", acento: "#c8553d", escalaTitulo: 0.1, ejemplos: ejemplos("Chapadmalal", "Buscando la ola", "Verano 2026", "Una ola más y nos vamos") }),
  },
  {
    id: "playa-07-horizonte-minimal",
    tema: "playa",
    nombre: "Horizonte minimal",
    descripcion: "Blanco limpio, una línea de horizonte y un sol coral: que manden las fotos.",
    papel: "#fcfbf8",
    margenMm: 17,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fcfbf8");
      const yh = m.altoMm - 17 * 0.5;
      if (tipo === "apertura") {
        c += `<circle cx="${n(izq.x + izq.w / 2)}" cy="${n(izq.h * 0.42)}" r="${n(Math.min(izq.w * 0.36, izq.h * 0.3))}" fill="#fde3d4"/>`;
        c += `<line x1="${n(izq.x + izq.w * 0.18)}" y1="${n(izq.h * 0.42 + Math.min(izq.w * 0.36, izq.h * 0.3))}" x2="${n(izq.x + izq.w * 0.82)}" y2="${n(izq.h * 0.42 + Math.min(izq.w * 0.36, izq.h * 0.3))}" stroke="#7aa6b8" stroke-width="0.35"/>`;
      }
      if (tipo === "interior") c += `<line x1="${n(izq.x + 17)}" y1="${n(yh)}" x2="${n(der.x + der.w - 17)}" y2="${n(yh)}" stroke="#7aa6b8" stroke-width="0.3"/>`;
      if (tipo === "interior-alt" || tipo === "cierre") {
        c += `<line x1="${n(der.x + 17)}" y1="${n(yh)}" x2="${n(der.x + der.w - 17)}" y2="${n(yh)}" stroke="#7aa6b8" stroke-width="0.3"/>`;
        c += `<circle cx="${n(der.x + der.w - 17 - s * 0.03)}" cy="${n(yh - s * 0.022)}" r="${n(s * 0.016)}" fill="#ee8a6b"/>`;
      }
      if (tipo === "cierre") c += `<line x1="${n(izq.x + 17)}" y1="${n(yh)}" x2="${n(izq.x + izq.w - 17)}" y2="${n(yh)}" stroke="#7aa6b8" stroke-width="0.3"/>`;
      return svg(m, c);
    },
    zona: zonaClasica({ abajo: 1 }),
    textos: textosClasicos({ titulo: "Playfair Display", texto: "Montserrat", color: "#33546a", acento: "#ee8a6b", escalaTitulo: 0.09, ejemplos: ejemplos("José Ignacio", "Días de mar", "Enero 2026", "El mar, siempre") }),
  },
  {
    id: "playa-08-tropical-brasil",
    tema: "playa",
    nombre: "Tropical Brasil",
    descripcion: "Hojas tropicales grandes en verdes intensos y flores de hibisco, a puro color.",
    papel: "#fffdf4",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const k = fuerte(tipo) ? 1 : 0.78;
      const L = s * 0.44 * k;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fffdf4");
      const ramo = (x: number, y: number, base: number, dir: number, sem: number) => {
        const rnd = azar(sem);
        const verdes = ["#0b6e4f", "#1a936f", "#2bb673", "#08a045"];
        let out = "";
        for (let i = 0; i < 4; i++) {
          out += hojaTropical(x, y, L * (0.75 + rnd() * 0.35), base + dir * (i * 24 - 8), verdes[i % verdes.length]!, "#fffdf4");
        }
        return out;
      };
      c += ramo(izq.x - s * 0.02, -s * 0.02, 10, 1, 3);
      c += hibisco(izq.x + L * 0.42, L * 0.36, s * 0.05 * k, "#f9a620", "#c1121f", 15);
      c += ramo(der.x + der.w + s * 0.02, der.h + s * 0.02, 190, 1, 9);
      c += hibisco(der.x + der.w - L * 0.42, der.h - L * 0.36, s * 0.05 * k, "#ef476f", "#ffd166", 40);
      if (tipo === "interior-alt") c += hibisco(der.x + der.w - s * 0.06, s * 0.06, s * 0.035, "#f9a620", "#c1121f", 70) + hojaTropical(der.x + der.w + s * 0.01, -s * 0.01, s * 0.16, 130, "#1a936f", "#fffdf4");
      return svg(m, c);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const k = fuerte(tipo) ? 1 : 0.78;
      const t = despeje(s * 0.4 * k, 13, 0);
      const z: Partial<Zona> = lado === "izq" ? { arriba: t * 0.7, exterior: t * 0.55 } : { abajo: t * 0.7, exterior: t * 0.55 };
      if (tipo === "interior-alt" && lado === "der") z.arriba = despeje(s * 0.11, 13);
      return z;
    }),
    textos: textosClasicos({ titulo: "Anton", texto: "Poppins", color: "#0b6e4f", acento: "#ef476f", escalaTitulo: 0.12, ejemplos: ejemplos("Florianópolis", "Verano en Brasil", "Febrero 2026", "Saudade de vos, mar") }),
  },
  {
    id: "playa-09-sombrillas-costa",
    tema: "playa",
    nombre: "Sombrillas de la costa",
    descripcion: "La playa vista desde arriba: sombrillas de colores y toallas a rayas en la arena.",
    papel: "#ffffff",
    margenMm: 12,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const alto = s * 0.15;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#ffffff");
      // Arena, toallas abajo y sombrillas arriba de todo.
      const franja = (x: number, w: number, sem: number) => {
        const rnd = azar(sem);
        let arena = `<rect x="${n(x)}" y="0" width="${n(w)}" height="${n(alto)}" fill="#f3e2bd"/>`;
        const ondas = Array.from({ length: Math.ceil(w / (s * 0.08)) }, () => `q ${n(s * 0.02)} ${n(s * 0.012)} ${n(s * 0.04)} 0 t ${n(s * 0.04)} 0`).join(" ");
        arena += `<clipPath id="fr${sem}"><rect x="${n(x)}" y="0" width="${n(w)}" height="${n(alto * 2)}"/></clipPath><path d="M ${n(x)} ${n(alto)} ${ondas}" stroke="#bfe3e8" stroke-width="${n(s * 0.01)}" fill="none" clip-path="url(#fr${sem})"/>`;
        const paleta: [string, string][] = [
          ["#ef476f", "#ffffff"],
          ["#118ab2", "#ffffff"],
          ["#ffd166", "#ef8354"],
          ["#06d6a0", "#ffffff"],
          ["#f78c6b", "#ffd166"],
        ];
        let toallas = "";
        let sombrillas = "";
        const cant = Math.max(3, Math.round(w / (s * 0.13)));
        for (let i = 0; i < cant; i++) {
          const cx = x + (w * (i + 0.5)) / cant + (rnd() - 0.5) * s * 0.03;
          const cy = alto * (0.38 + rnd() * 0.2);
          if (rnd() > 0.45) toallas += toalla(cx + s * 0.035, cy + alto * 0.12, s * 0.03, s * 0.055, "#ffffff", paleta[i % 5]![0], 15 + rnd() * 20);
          const [a, b] = paleta[(i + sem) % 5]!;
          sombrillas += sombrillaArriba(cx, cy, alto * (0.24 + rnd() * 0.06), a, b, rnd() * 45);
        }
        return arena + toallas + sombrillas;
      };
      if (tipo === "cierre") {
        c += franja(izq.x, izq.w, 3);
        c += `<rect x="${n(der.x)}" y="${n(der.h - s * 0.012)}" width="${n(der.w)}" height="${n(s * 0.012)}" fill="#f3e2bd"/>`;
      } else c += franja(0, m.anchoMm, tipo === "interior-alt" ? 7 : 3);
      return svg(m, c);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      if (tipo === "cierre" && lado === "der") return {};
      return { arriba: despeje(s * 0.155, 12, 4) };
    }),
    textos: textosClasicos({ titulo: "Courgette", texto: "Open Sans", color: "#0f5e73", acento: "#ef476f", escalaTitulo: 0.1, ejemplos: ejemplos("Pinamar 2026", "Quince días de playa", "Enero 2026", "Hasta el próximo verano") }),
  },
  {
    id: "playa-10-postal-de-viaje",
    tema: "playa",
    nombre: "Postal de viaje",
    descripcion: "Borde de correo aéreo, estampilla con palmera y matasellos: como una postal desde la playa.",
    papel: "#fbf5e9",
    margenMm: 13,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = Math.min(izq.w, izq.h);
      const b = s * 0.028;
      const p = b * 1.6;
      const defs = `<pattern id="ca" patternUnits="userSpaceOnUse" width="${n(p * 3)}" height="${n(p * 3)}" patternTransform="rotate(45)"><rect width="${n(p * 3)}" height="${n(p * 3)}" fill="#fbf5e9"/><rect width="${n(p)}" height="${n(p * 3)}" fill="#d64545"/><rect x="${n(p * 1.5)}" width="${n(p)}" height="${n(p * 3)}" fill="#2b59a8"/></pattern>`;
      const g = grano("g", m, 0.06);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbf5e9");
      for (const pg of [izq, der]) {
        c += `<path d="M ${n(pg.x)} 0 h ${n(pg.w)} v ${n(pg.h)} h ${n(-pg.w)} Z M ${n(pg.x + b)} ${n(b)} v ${n(pg.h - 2 * b)} h ${n(pg.w - 2 * b)} v ${n(-(pg.h - 2 * b))} Z" fill="url(#ca)" fill-rule="evenodd"/>`;
      }
      const sw = s * 0.13;
      const sh = s * 0.16;
      if (tipo === "apertura") {
        c += estampilla(izq.x + izq.w - b - sw * 0.75, b + sh * 0.7, sw, sh, "#fbf5e9", "#bfe6ef", "#3a8fb7", "#f6b04a", 4);
        c += matasellos(izq.x + izq.w - b - sw * 1.9, b + sh * 0.85, sh * 0.32, "#5a4a3a");
      }
      if (tipo === "interior-alt" || tipo === "cierre") {
        c += estampilla(der.x + der.w - b - sw * 0.75, der.h - b - sh * 0.7, sw, sh, "#fbf5e9", "#fde2c8", "#2a9d8f", "#e76f51", -3);
      }
      if (tipo === "interior") {
        c += matasellos(izq.x + b + sh * 0.5, izq.h - b - sh * 0.45, sh * 0.26, "#5a4a3a");
      }
      return svg(m, c + g.cuerpo, defs + g.defs);
    },
    zona: conTitulo((tipo, lado, m) => {
      const s = Math.min(m.anchoMm / 2, m.altoMm);
      const b = s * 0.028;
      const z: Partial<Zona> = { arriba: despeje(b, 13), abajo: despeje(b, 13), exterior: despeje(b, 13), interior: despeje(b, 13) };
      if ((tipo === "interior-alt" || tipo === "cierre") && lado === "der") z.exterior = despeje(b + s * 0.13 * 1.25, 13, 3);
      if (tipo === "interior" && lado === "izq") z.abajo = despeje(b + s * 0.16 * 0.75, 13, 3);
      return z;
    }),
    textos: textosClasicos({ titulo: "Caveat", texto: "Patrick Hand", color: "#2b3a55", acento: "#d64545", escalaTitulo: 0.1, ejemplos: ejemplos("Desde Búzios", "Postales de vacaciones", "Enero 2026", "Ojalá estuvieras acá") }),
  },
];
