/**
 * Piezas de dibujo para los fondos de los estilos de fotolibro: acuarela, ramas, flores, filetes,
 * confeti, montañas, olas… Todo en SVG con medidas en milímetros, y con azar de semilla fija: un
 * estilo dibuja siempre lo mismo, en pantalla y al imprimir.
 *
 * Ninguna pieza escribe texto: los títulos son bloques de texto del diseño, editables.
 */
import type { Medidas } from "./tipos";

export type Rect = { x: number; y: number; w: number; h: number };
export type Lado = "izq" | "der";

/** Azar reproducible (mulberry32). */
export function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 100) / 100;

/** El SVG completo de un pliego. `defs` va una sola vez. */
export function svg(m: Medidas, cuerpo: string, defs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(m.anchoMm)} ${f(m.altoMm)}" width="${f(m.anchoMm)}mm" height="${f(m.altoMm)}mm" preserveAspectRatio="none"><defs>${defs}</defs>${cuerpo}</svg>`;
}

/** Las dos páginas del pliego. */
export function paginas(m: Medidas): { izq: Rect; der: Rect } {
  const w = m.anchoMm / 2;
  return { izq: { x: 0, y: 0, w, h: m.altoMm }, der: { x: w, y: 0, w, h: m.altoMm } };
}

export const fondoLiso = (r: Rect, color: string) =>
  `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="${color}"/>`;

/** Degradado vertical u horizontal sobre un rectángulo. */
export function degradado(id: string, r: Rect, desde: string, hasta: string, vertical = true): { defs: string; cuerpo: string } {
  return {
    defs: `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${desde}"/><stop offset="1" stop-color="${hasta}"/></linearGradient>`,
    cuerpo: `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="url(#${id})"/>`,
  };
}

/** Grano de papel: ruido muy suave encima de todo. */
export function grano(id: string, m: Medidas, opacidad = 0.08, escala = 0.9): { defs: string; cuerpo: string } {
  return {
    defs: `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${escala}" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="${opacidad}"/></feComponentTransfer></filter>`,
    cuerpo: `<rect width="${f(m.anchoMm)}" height="${f(m.altoMm)}" filter="url(#${id})"/>`,
  };
}

/** Filtro de borde irregular para manchas de acuarela. */
export const filtroAcuarela = (id: string, semilla = 3) =>
  `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${semilla}" result="r"/><feDisplacementMap in="SourceGraphic" in2="r" scale="14" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.2"/></filter>`;

/** Una mancha de acuarela: varias capas translúcidas con el borde comido. */
export function manchaAcuarela(cx: number, cy: number, r: number, color: string, filtro: string, semilla: number, capas = 3): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < capas; i++) {
    const rx = r * (0.7 + rnd() * 0.5);
    const ry = r * (0.55 + rnd() * 0.45);
    const dx = (rnd() - 0.5) * r * 0.6;
    const dy = (rnd() - 0.5) * r * 0.6;
    out += `<ellipse cx="${f(cx + dx)}" cy="${f(cy + dy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${color}" opacity="${f(0.18 + rnd() * 0.14)}" filter="url(#${filtro})" transform="rotate(${f(rnd() * 180)} ${f(cx + dx)} ${f(cy + dy)})"/>`;
  }
  return out;
}

/** Una hoja: dos curvas de Bézier entre la base y la punta. */
export function hoja(x: number, y: number, largo: number, angulo: number, color: string, ancho = 0.42, opacidad = 1): string {
  const a = largo * ancho;
  return `<path d="M0 0 C ${f(largo * 0.3)} ${f(-a)} ${f(largo * 0.75)} ${f(-a * 0.7)} ${f(largo)} 0 C ${f(largo * 0.75)} ${f(a * 0.7)} ${f(largo * 0.3)} ${f(a)} 0 0 Z" fill="${color}" opacity="${opacidad}" transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})"/>`;
}

/** Una rama con hojas a los dos lados, siguiendo una curva suave. */
export function rama(x: number, y: number, largo: number, angulo: number, color: string, semilla: number, opciones: { hojas?: number; tamHoja?: number; anchoHoja?: number; tallo?: string; redondas?: boolean } = {}): string {
  const rnd = azar(semilla);
  const n = opciones.hojas ?? 9;
  const tam = opciones.tamHoja ?? largo * 0.22;
  const curva = largo * 0.12 * (rnd() > 0.5 ? 1 : -1);
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})">`;
  out += `<path d="M0 0 Q ${f(largo / 2)} ${f(curva)} ${f(largo)} 0" stroke="${opciones.tallo ?? color}" stroke-width="${f(Math.max(0.25, largo * 0.012))}" fill="none" stroke-linecap="round"/>`;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const px = largo * t;
    const py = 2 * (1 - t) * t * curva;
    const lado = i % 2 === 0 ? 1 : -1;
    const ang = lado * (40 + rnd() * 25);
    const s = tam * (1 - t * 0.45);
    out += opciones.redondas
      ? `<ellipse cx="${f(px + lado * s * 0.15)}" cy="${f(py + lado * s * 0.45)}" rx="${f(s * 0.42)}" ry="${f(s * 0.36)}" fill="${color}" opacity="${f(0.75 + rnd() * 0.25)}"/>`
      : hoja(px, py, s, ang, color, opciones.anchoHoja ?? 0.38, 0.8 + rnd() * 0.2);
  }
  out += hoja(largo, 0, tam * 0.55, 0, color, opciones.anchoHoja ?? 0.38);
  return `${out}</g>`;
}

/** Una flor simple de pétalos redondos con centro. */
export function flor(x: number, y: number, r: number, color: string, centro: string, petalos = 6, giro = 0, opacidad = 1): string {
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})" opacity="${opacidad}">`;
  for (let i = 0; i < petalos; i++) {
    const a = (i * 360) / petalos;
    out += `<ellipse cx="0" cy="${f(-r * 0.55)}" rx="${f(r * 0.38)}" ry="${f(r * 0.6)}" fill="${color}" transform="rotate(${f(a)})"/>`;
  }
  return `${out}<circle r="${f(r * 0.28)}" fill="${centro}"/></g>`;
}

/** Una rosa estilizada: espirales de círculos superpuestos. */
export function rosa(x: number, y: number, r: number, color: string, sombra: string, giro = 0): string {
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})">`;
  out += `<circle r="${f(r)}" fill="${color}"/>`;
  for (let i = 0; i < 5; i++) {
    const rr = r * (0.85 - i * 0.15);
    out += `<path d="M ${f(-rr)} 0 A ${f(rr)} ${f(rr)} 0 0 1 ${f(rr * 0.7)} ${f(-rr * 0.6)}" stroke="${sombra}" stroke-width="${f(r * 0.07)}" fill="none" stroke-linecap="round" transform="rotate(${i * 70})"/>`;
  }
  return `${out}</g>`;
}

/** Un ramo de esquina: ramas en abanico, con flores opcionales. `esquina` dice hacia dónde abre. */
export function ramoEsquina(
  esquina: "si" | "sd" | "ii" | "id",
  x: number,
  y: number,
  tam: number,
  colores: { hoja: string; hoja2?: string; flor?: string; centro?: string },
  semilla: number,
  opciones: { flores?: number; redondas?: boolean } = {},
): string {
  const rnd = azar(semilla);
  const base = { si: 20, sd: 160, ii: -20, id: -160 }[esquina];
  const abre = { si: 1, sd: -1, ii: -1, id: 1 }[esquina];
  let out = "";
  for (let i = 0; i < 5; i++) {
    const ang = base + abre * (i * 14 - 10) + (rnd() - 0.5) * 8;
    out += rama(x, y, tam * (0.65 + rnd() * 0.45), ang, i % 2 && colores.hoja2 ? colores.hoja2 : colores.hoja, semilla + i * 13, {
      hojas: 7 + Math.floor(rnd() * 4),
      redondas: opciones.redondas,
    });
  }
  const flores = opciones.flores ?? 0;
  for (let i = 0; i < flores && colores.flor; i++) {
    const ang = ((base + abre * (i * 22)) * Math.PI) / 180;
    const d = tam * (0.15 + rnd() * 0.25);
    out += flor(x + Math.cos(ang) * d, y + Math.sin(ang) * d, tam * (0.09 + rnd() * 0.05), colores.flor, colores.centro ?? "#f5d76e", 6, rnd() * 60);
  }
  return out;
}

/** Marco de filete fino a una distancia del borde de la página. */
export function filete(r: Rect, separacion: number, color: string, grosor = 0.35, radio = 0): string {
  return `<rect x="${f(r.x + separacion)}" y="${f(r.y + separacion)}" width="${f(r.w - 2 * separacion)}" height="${f(r.h - 2 * separacion)}" rx="${f(radio)}" fill="none" stroke="${color}" stroke-width="${f(grosor)}"/>`;
}

/** Esquinero clásico: dos trazos en L con una voluta. */
export function esquineros(r: Rect, separacion: number, tam: number, color: string, grosor = 0.4): string {
  const pts: [number, number, number, number][] = [
    [r.x + separacion, r.y + separacion, 1, 1],
    [r.x + r.w - separacion, r.y + separacion, -1, 1],
    [r.x + separacion, r.y + r.h - separacion, 1, -1],
    [r.x + r.w - separacion, r.y + r.h - separacion, -1, -1],
  ];
  return pts
    .map(
      ([x, y, sx, sy]) =>
        `<path d="M ${f(x)} ${f(y + sy * tam)} L ${f(x)} ${f(y)} L ${f(x + sx * tam)} ${f(y)} M ${f(x + sx * tam * 0.25)} ${f(y + sy * tam * 0.25)} q ${f(sx * tam * 0.25)} ${f(-sy * tam * 0.12)} ${f(sx * tam * 0.18)} ${f(sy * tam * 0.18)} q ${f(-sx * tam * 0.06)} ${f(sy * tam * 0.18)} ${f(sx * tam * 0.2)} ${f(sy * tam * 0.12)}" fill="none" stroke="${color}" stroke-width="${f(grosor)}" stroke-linecap="round"/>`,
    )
    .join("");
}

/** Confeti: papelitos y puntos al azar dentro de un área. */
export function confeti(area: Rect, colores: string[], cantidad: number, semilla: number, tam = 2.2): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < cantidad; i++) {
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    const c = colores[Math.floor(rnd() * colores.length)]!;
    const s = tam * (0.5 + rnd());
    out +=
      rnd() > 0.45
        ? `<rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s * 0.45)}" fill="${c}" transform="rotate(${f(rnd() * 180)} ${f(x)} ${f(y)})"/>`
        : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.35)}" fill="${c}"/>`;
  }
  return out;
}

/** Un globo con su hilo. */
export function globo(x: number, y: number, r: number, color: string, hilo = "#9ca3af", largoHilo = 3.5): string {
  return `<g transform="translate(${f(x)} ${f(y)})"><path d="M0 ${f(r * 1.15)} q ${f(-r * 0.4)} ${f(r * largoHilo * 0.3)} 0 ${f(r * largoHilo * 0.6)} t 0 ${f(r * largoHilo * 0.4)}" stroke="${hilo}" stroke-width="${f(r * 0.04)}" fill="none"/><ellipse rx="${f(r * 0.86)}" ry="${f(r)}" fill="${color}"/><ellipse cx="${f(-r * 0.3)}" cy="${f(-r * 0.35)}" rx="${f(r * 0.18)}" ry="${f(r * 0.28)}" fill="#ffffff" opacity="0.35" transform="rotate(-25 ${f(-r * 0.3)} ${f(-r * 0.35)})"/><path d="M ${f(-r * 0.12)} ${f(r * 0.98)} L ${f(r * 0.12)} ${f(r * 0.98)} L 0 ${f(r * 1.15)} Z" fill="${color}"/></g>`;
}

/** Estrella de cinco puntas. */
export function estrella(x: number, y: number, r: number, color: string, giro = 0, opacidad = 1): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`);
  }
  return `<polygon points="${p.join(" ")}" fill="${color}" opacity="${opacidad}" transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"/>`;
}

/** Cielo estrellado: puntos y estrellitas al azar. */
export function estrellas(area: Rect, color: string, cantidad: number, semilla: number, tam = 1.2): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < cantidad; i++) {
    const x = area.x + rnd() * area.w;
    const y = area.y + rnd() * area.h;
    out += rnd() > 0.8 ? estrella(x, y, tam * (0.8 + rnd()), color, rnd() * 72, 0.9) : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(tam * 0.18 * (0.5 + rnd()))}" fill="${color}" opacity="${f(0.4 + rnd() * 0.6)}"/>`;
  }
  return out;
}

/** Cordillera: capas de montañas recortadas desde abajo. */
export function montanas(r: Rect, alturaMax: number, colores: string[], semilla: number, picos = 5): string {
  const rnd = azar(semilla);
  let out = "";
  colores.forEach((c, capa) => {
    const alto = alturaMax * (1 - capa * 0.22);
    const base = r.y + r.h;
    let d = `M ${f(r.x)} ${f(base)}`;
    const n = picos + capa;
    for (let i = 0; i <= n; i++) {
      const x = r.x + (r.w * i) / n;
      const y = base - alto * (i % 2 === 0 ? 0.35 + rnd() * 0.2 : 0.75 + rnd() * 0.25);
      d += ` L ${f(x)} ${f(y)}`;
    }
    out += `<path d="${d} L ${f(r.x + r.w)} ${f(base)} Z" fill="${c}"/>`;
  });
  return out;
}

/** Olas suaves desde abajo. */
export function olas(r: Rect, alto: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  return colores
    .map((c, i) => {
      const y0 = r.y + r.h - alto * (1 - i * 0.28);
      const largo = r.w / (3 + i);
      let d = `M ${f(r.x)} ${f(y0)}`;
      for (let x = r.x; x < r.x + r.w; x += largo) {
        d += ` q ${f(largo / 4)} ${f(-alto * 0.18 * (0.7 + rnd() * 0.6))} ${f(largo / 2)} 0 t ${f(largo / 2)} 0`;
      }
      return `<path d="${d} L ${f(r.x + r.w)} ${f(r.y + r.h)} L ${f(r.x)} ${f(r.y + r.h)} Z" fill="${c}"/>`;
    })
    .join("");
}

/** Copo de nieve de seis brazos. */
export function copo(x: number, y: number, r: number, color: string, grosor = 0.3, opacidad = 1): string {
  let out = `<g transform="translate(${f(x)} ${f(y)})" stroke="${color}" stroke-width="${f(grosor)}" stroke-linecap="round" opacity="${opacidad}">`;
  for (let i = 0; i < 6; i++) {
    out += `<g transform="rotate(${i * 60})"><line x1="0" y1="0" x2="0" y2="${f(-r)}"/><line x1="0" y1="${f(-r * 0.55)}" x2="${f(r * 0.22)}" y2="${f(-r * 0.75)}"/><line x1="0" y1="${f(-r * 0.55)}" x2="${f(-r * 0.22)}" y2="${f(-r * 0.75)}"/></g>`;
  }
  return `${out}</g>`;
}

/** Vetas de mármol con turbulencia. */
export function filtroMarmol(id: string, semilla = 11): string {
  // Turbulencia estirada y recortada fuerte: deja vetas finas en vez de nubes.
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.006 0.02" numOctaves="5" seed="${semilla}"/><feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.42  0 0 0 0 0.45  0 0 0 -9 2.2"/></filter>`;
}

/** Un arco (puerta boho) desde la base de una página. */
export function arco(cx: number, base: number, ancho: number, alto: number, color: string, opacidad = 1): string {
  const r = ancho / 2;
  return `<path d="M ${f(cx - r)} ${f(base)} L ${f(cx - r)} ${f(base - alto + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(base - alto + r)} L ${f(cx + r)} ${f(base)} Z" fill="${color}" opacity="${opacidad}"/>`;
}

/** Espiga de pampa: un tallo con plumitas. */
export function pampa(x: number, y: number, largo: number, angulo: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angulo)})"><line x1="0" y1="0" x2="${f(largo)}" y2="0" stroke="${color}" stroke-width="${f(largo * 0.012)}"/>`;
  for (let i = 0; i < 26; i++) {
    const t = 0.35 + (i / 26) * 0.65;
    const lado = i % 2 ? 1 : -1;
    out += `<line x1="${f(largo * t)}" y1="0" x2="${f(largo * t + largo * 0.06)}" y2="${f(lado * largo * (0.05 + rnd() * 0.06) * (1.2 - t))}" stroke="${color}" stroke-width="${f(largo * 0.008)}" stroke-linecap="round" opacity="0.85"/>`;
  }
  return `${out}</g>`;
}

/** Espeja horizontalmente un grupo dentro de una página (para la página derecha). */
export function espejar(r: Rect, contenido: string): string {
  return `<g transform="translate(${f(2 * r.x + r.w)} 0) scale(-1 1)">${contenido}</g>`;
}

/** Puntos (lunares) en grilla. */
export function lunares(area: Rect, paso: number, radio: number, color: string, opacidad = 1): string {
  let out = "";
  let fila = 0;
  for (let y = area.y + paso / 2; y < area.y + area.h; y += paso, fila++) {
    for (let x = area.x + paso / 2 + (fila % 2 ? paso / 2 : 0); x < area.x + area.w; x += paso) {
      out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(radio)}" fill="${color}" opacity="${opacidad}"/>`;
    }
  }
  return out;
}
