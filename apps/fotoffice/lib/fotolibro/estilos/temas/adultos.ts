import type { EstiloFotolibro, Medidas, RolTexto, TextoDelEstilo, TipoPliego, Zona } from "../tipos";
import { azar, confeti, degradado, filete, filtroAcuarela, flor, fondoLiso, grano, hoja, manchaAcuarela, paginas, rama, rosa, svg, type Rect } from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/**
 * Cumpleaños de adultos (30, 40, 50, 60…): diez estilos que van del brindis elegante al neón de
 * boliche, pasando por el art déco, los 70, el Memphis de los 90, el malbec y la pizarra de bar.
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

/** Retoca los títulos de `textosClasicos` (negrita, mayúsculas, itálica) sin reescribirlos. */
function ajustar(fn: (tipo: TipoPliego, m: Medidas) => TextoDelEstilo[], cambios: Partial<Record<RolTexto, Partial<TextoDelEstilo>>>) {
  return (tipo: TipoPliego, m: Medidas) => fn(tipo, m).map((t) => ({ ...t, ...cambios[t.rol] }));
}

// ───────────────────────── Piezas propias ─────────────────────────

/** Destello de cuatro puntas. */
function destello(x: number, y: number, r: number, color: string, opacidad = 1): string {
  return `<path d="M ${f(x)} ${f(y - r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Q ${f(x)} ${f(y)} ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x - r)} ${f(y)} Q ${f(x)} ${f(y)} ${f(x)} ${f(y - r)} Z" fill="${color}" opacity="${opacidad}"/>`;
}

/** Burbujas de champaña subiendo: más chicas y más tenues a medida que suben. */
function burbujasChampagne(x: number, base: number, alto: number, s: number, color: string, semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  const n = Math.max(10, Math.round(alto / (s * 0.03)));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const r = s * 0.016 * (1 - t * 0.6) * (0.6 + rnd() * 0.7);
    out += `<circle cx="${f(x + (rnd() - 0.5) * s * 0.045)}" cy="${f(base - t * alto - rnd() * s * 0.01)}" r="${f(r)}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="${f(Math.max(0.15, r * 0.18))}" opacity="${f(0.95 - t * 0.6)}"/>`;
  }
  return out;
}

/** Copa flauta en línea dorada, con champaña. Base del pie en (x, base). */
function copa(x: number, base: number, alto: number, giro: number, color: string): string {
  const k = alto / 100;
  return `<g transform="translate(${f(x)} ${f(base)}) rotate(${f(giro)}) scale(${f(k)})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M -10 -84 L 10 -84 C 10 -62 7 -50 0 -46 C -7 -50 -10 -62 -10 -84 Z" fill="${color}" fill-opacity="0.35" stroke="none"/>
<path d="M -12 -100 L 12 -100 C 12 -70 8 -50 0 -45 C -8 -50 -12 -70 -12 -100 Z"/>
<line x1="0" y1="-45" x2="0" y2="-3"/><ellipse cx="0" cy="-2" rx="12" ry="2.6"/>
<circle cx="-3" cy="-66" r="1.3" fill="${color}" stroke="none"/><circle cx="3" cy="-74" r="1" fill="${color}" stroke="none"/><circle cx="-1" cy="-58" r="0.9" fill="${color}" stroke="none"/></g>`;
}

/** Marco art déco: rectángulo con las esquinas en escalones. */
function marcoDeco(r: Rect, sep: number, paso: number, color: string, grosor: number): string {
  const x0 = r.x + sep;
  const y0 = r.y + sep;
  const x1 = r.x + r.w - sep;
  const y1 = r.y + r.h - sep;
  const p = paso;
  const d = `M ${f(x0 + 2 * p)} ${f(y0)} L ${f(x1 - 2 * p)} ${f(y0)} L ${f(x1 - 2 * p)} ${f(y0 + p)} L ${f(x1 - p)} ${f(y0 + p)} L ${f(x1 - p)} ${f(y0 + 2 * p)} L ${f(x1)} ${f(y0 + 2 * p)} L ${f(x1)} ${f(y1 - 2 * p)} L ${f(x1 - p)} ${f(y1 - 2 * p)} L ${f(x1 - p)} ${f(y1 - p)} L ${f(x1 - 2 * p)} ${f(y1 - p)} L ${f(x1 - 2 * p)} ${f(y1)} L ${f(x0 + 2 * p)} ${f(y1)} L ${f(x0 + 2 * p)} ${f(y1 - p)} L ${f(x0 + p)} ${f(y1 - p)} L ${f(x0 + p)} ${f(y1 - 2 * p)} L ${f(x0)} ${f(y1 - 2 * p)} L ${f(x0)} ${f(y0 + 2 * p)} L ${f(x0 + p)} ${f(y0 + 2 * p)} L ${f(x0 + p)} ${f(y0 + p)} L ${f(x0 + 2 * p)} ${f(y0 + p)} Z`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f(grosor)}"/>`;
}

/** Abanico art déco en una esquina: arcos concéntricos y rayos. `desde` es el ángulo del primer borde. */
function abanicoDeco(cx: number, cy: number, r: number, desde: number, color: string, grosor: number): string {
  const rad = (g: number) => (g * Math.PI) / 180;
  let out = "";
  for (const k of [1, 0.72, 0.44]) {
    const rr = r * k;
    out += `<path d="M ${f(cx + Math.cos(rad(desde)) * rr)} ${f(cy + Math.sin(rad(desde)) * rr)} A ${f(rr)} ${f(rr)} 0 0 1 ${f(cx + Math.cos(rad(desde + 90)) * rr)} ${f(cy + Math.sin(rad(desde + 90)) * rr)}" fill="none" stroke="${color}" stroke-width="${f(grosor)}"/>`;
  }
  for (let i = 0; i <= 6; i++) {
    const a = rad(desde + i * 15);
    out += `<line x1="${f(cx + Math.cos(a) * r * 0.2)}" y1="${f(cy + Math.sin(a) * r * 0.2)}" x2="${f(cx + Math.cos(a) * r * (i % 2 ? 0.72 : 1))}" y2="${f(cy + Math.sin(a) * r * (i % 2 ? 0.72 : 1))}" stroke="${color}" stroke-width="${f(grosor * 0.7)}"/>`;
  }
  return out + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.12)}" fill="${color}"/>`;
}

/** Sol art déco: medio círculo de rayos alternados, apoyado en una línea. */
function solDeco(cx: number, cy: number, r: number, color: string, grosor: number): string {
  let out = `<line x1="${f(cx - r * 1.15)}" y1="${f(cy)}" x2="${f(cx + r * 1.15)}" y2="${f(cy)}" stroke="${color}" stroke-width="${f(grosor)}"/>`;
  const n = 19;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    const l = i % 2 ? 0.7 : 1;
    out += `<line x1="${f(cx + Math.cos(a) * r * 0.3)}" y1="${f(cy + Math.sin(a) * r * 0.3)}" x2="${f(cx + Math.cos(a) * r * l)}" y2="${f(cy + Math.sin(a) * r * l)}" stroke="${color}" stroke-width="${f(grosor * 0.8)}"/>`;
  }
  return out + `<path d="M ${f(cx - r * 0.24)} ${f(cy)} A ${f(r * 0.24)} ${f(r * 0.24)} 0 0 1 ${f(cx + r * 0.24)} ${f(cy)} Z" fill="${color}"/>`;
}

/** Filtro de resplandor para los tubos de neón. */
const filtroNeon = (id: string, desvio: number) =>
  `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(desvio)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

/** Un tubo de neón: el trazo de color con resplandor y el alma blanca encima. */
function neon(d: string, color: string, g: number, filtro: string): string {
  return `<path d="${d}" stroke="${color}" stroke-width="${f(g)}" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#${filtro})"/><path d="${d}" stroke="#ffffff" stroke-opacity="0.75" stroke-width="${f(g * 0.35)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const rectRedondo = (x: number, y: number, w: number, h: number, r: number) =>
  `M ${f(x + r)} ${f(y)} L ${f(x + w - r)} ${f(y)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} L ${f(x + w)} ${f(y + h - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} L ${f(x + r)} ${f(y + h)} A ${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} L ${f(x)} ${f(y + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`;

const estrellaD = (x: number, y: number, r: number, giro = 0) => {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2 + (giro * Math.PI) / 180;
    d += `${i ? " L" : "M"} ${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`;
  }
  return `${d} Z`;
};

const rayoD = (x: number, y: number, t: number) =>
  `M ${f(x + t * 0.2)} ${f(y - t)} L ${f(x - t * 0.35)} ${f(y + t * 0.1)} L ${f(x + t * 0.05)} ${f(y + t * 0.1)} L ${f(x - t * 0.2)} ${f(y + t)} L ${f(x + t * 0.4)} ${f(y - t * 0.15)} L ${f(x)} ${f(y - t * 0.15)} Z`;

const zigzagD = (x1: number, x2: number, y: number, alto: number, paso: number) => {
  let d = `M ${f(x1)} ${f(y)}`;
  let i = 0;
  for (let x = x1 + paso / 2; x <= x2; x += paso / 2, i++) d += ` L ${f(x)} ${f(i % 2 ? y : y - alto)}`;
  return d;
};

const ondaD = (x1: number, x2: number, y: number, alto: number, largo: number) => {
  let d = `M ${f(x1)} ${f(y)}`;
  for (let x = x1; x < x2 - 0.01; x += largo) d += ` q ${f(largo / 4)} ${f(-alto)} ${f(largo / 2)} 0 t ${f(largo / 2)} 0`;
  return d;
};

/** Ladrillos apenas marcados, para la pared del neón. */
function ladrillos(m: Medidas, alto: number, color: string, opacidad: number): string {
  let d = "";
  let fila = 0;
  for (let y = 0; y < m.altoMm; y += alto, fila++) {
    d += `M 0 ${f(y)} H ${f(m.anchoMm)} `;
    for (let x = fila % 2 ? alto : 0; x < m.anchoMm; x += alto * 2) d += `M ${f(x)} ${f(y)} V ${f(Math.min(y + alto, m.altoMm))} `;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="0.3" opacity="${opacidad}"/>`;
}

/** Rayas onduladas paralelas, bien setentosas. Si `vertical`, corren de arriba abajo pegadas a x0. */
function ondasGroovy(desde: number, hasta: number, borde: number, haciaAdentro: 1 | -1, grosor: number, colores: string[], largo: number, vertical = false): string {
  return colores
    .map((c, i) => {
      const pos = borde + haciaAdentro * grosor * (i + 0.5);
      const amp = grosor * 0.9;
      let d = "";
      const n = Math.ceil((hasta - desde) / largo) + 1;
      for (let k = 0; k <= n * 8; k++) {
        const t = desde - largo + (k / 8) * largo;
        const o = pos + Math.sin(((t - desde) / largo) * Math.PI * 2) * amp;
        d += `${k ? " L" : "M"} ${vertical ? `${f(o)} ${f(t)}` : `${f(t)} ${f(o)}`}`;
      }
      return `<path d="${d}" stroke="${c}" stroke-width="${f(grosor * 1.05)}" fill="none"/>`;
    })
    .join("");
}

/** Sol setentoso: medios círculos concéntricos colgando de una línea. */
function solGroovy(cx: number, cy: number, r: number, colores: string[], abajo = true): string {
  return colores
    .map((c, i) => {
      const rr = r * (1 - i / colores.length);
      return `<path d="M ${f(cx - rr)} ${f(cy)} A ${f(rr)} ${f(rr)} 0 0 ${abajo ? 0 : 1} ${f(cx + rr)} ${f(cy)} Z" fill="${c}"/>`;
    })
    .join("");
}

/** Figuras Memphis al azar dentro de un área (una por celda, para que no se amontonen). */
function memphis(area: Rect, s: number, colores: string[], semilla: number): string {
  const rnd = azar(semilla);
  const celda = s * 0.075;
  const cols = Math.max(1, Math.floor(area.w / celda));
  const filas = Math.max(1, Math.floor(area.h / celda));
  const cw = area.w / cols;
  const ch = area.h / filas;
  let out = "";
  for (let fi = 0; fi < filas; fi++) {
    for (let co = 0; co < cols; co++) {
      if (rnd() < 0.35) continue;
      const x = area.x + (co + 0.5) * cw + (rnd() - 0.5) * cw * 0.3;
      const y = area.y + (fi + 0.5) * ch + (rnd() - 0.5) * ch * 0.3;
      const t = Math.min(cw, ch) * (0.28 + rnd() * 0.12);
      const c = colores[Math.floor(rnd() * colores.length)]!;
      const g = s * 0.005;
      const giro = rnd() * 360;
      const tipo = Math.floor(rnd() * 7);
      if (tipo === 0) out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(t * 0.6)}" fill="${c}"/>`;
      else if (tipo === 1) out += `<path d="M ${f(x)} ${f(y - t)} L ${f(x + t * 0.9)} ${f(y + t * 0.6)} L ${f(x - t * 0.9)} ${f(y + t * 0.6)} Z" fill="none" stroke="${c}" stroke-width="${f(g)}" stroke-linejoin="round" transform="rotate(${f(giro)} ${f(x)} ${f(y)})"/>`;
      else if (tipo === 2) out += `<path d="${zigzagD(x - t * 1.2, x + t * 1.2, y + t * 0.3, t * 0.6, t * 0.6)}" fill="none" stroke="${c}" stroke-width="${f(g)}" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${f(giro)} ${f(x)} ${f(y)})"/>`;
      else if (tipo === 3) {
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out += `<circle cx="${f(x - t * 0.6 + a * t * 0.6)}" cy="${f(y - t * 0.6 + b * t * 0.6)}" r="${f(t * 0.1)}" fill="${c}"/>`;
      } else if (tipo === 4) out += `<path d="M ${f(x - t * 0.7)} ${f(y)} A ${f(t * 0.7)} ${f(t * 0.7)} 0 0 1 ${f(x + t * 0.7)} ${f(y)} Z" fill="${c}" transform="rotate(${f(giro)} ${f(x)} ${f(y)})"/>`;
      else if (tipo === 5) out += `<path d="M ${f(x - t * 0.6)} ${f(y)} L ${f(x + t * 0.6)} ${f(y)} M ${f(x)} ${f(y - t * 0.6)} L ${f(x)} ${f(y + t * 0.6)}" stroke="${c}" stroke-width="${f(g * 1.4)}" stroke-linecap="round" transform="rotate(${f(giro)} ${f(x)} ${f(y)})"/>`;
      else out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(t * 0.5)}" fill="none" stroke="${c}" stroke-width="${f(g)}"/>`;
    }
  }
  return out;
}

/** Grilla de puntos (para el estilo editorial). */
function grillaPuntos(x: number, y: number, cols: number, filas: number, paso: number, r: number, color: string): string {
  let out = "";
  for (let i = 0; i < cols; i++) for (let j = 0; j < filas; j++) out += `<circle cx="${f(x + i * paso)}" cy="${f(y + j * paso)}" r="${f(r)}" fill="${color}"/>`;
  return out;
}

/** Hoja de parra: cinco lóbulos y nervaduras. */
function hojaDeParra(x: number, y: number, r: number, giro: number, color: string, nervio: string): string {
  const p: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const rr = r * (0.72 + 0.28 * Math.cos(5 * (a - Math.PI / 2))) * (Math.abs(Math.sin((a - Math.PI / 2) / 2)) < 0.12 ? 0.6 : 1);
    p.push(`${f(Math.cos(a) * rr)},${f(Math.sin(a) * rr)}`);
  }
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(giro)})"><polygon points="${p.join(" ")}" fill="${color}"/>`;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + Math.PI + ((i - 2) * Math.PI * 2) / 5;
    out += `<line x1="0" y1="${f(r * 0.5)}" x2="${f(Math.cos(a) * r * 0.75)}" y2="${f(Math.sin(a) * r * 0.75)}" stroke="${nervio}" stroke-width="${f(r * 0.04)}"/>`;
  }
  return `${out}</g>`;
}

/** Racimo de uvas: filas de granos que se achican hacia abajo, con un brillo en cada uno. */
function racimoUvas(x: number, y: number, r: number, color: string, brillo: string, tallo: string): string {
  let out = `<path d="M ${f(x)} ${f(y - r * 1.4)} q ${f(r * 0.3)} ${f(-r)} ${f(r * 1.2)} ${f(-r * 1.3)}" stroke="${tallo}" stroke-width="${f(r * 0.25)}" fill="none" stroke-linecap="round"/>`;
  const filas = [4, 3, 3, 2, 1];
  filas.forEach((n, fi) => {
    for (let i = 0; i < n; i++) {
      const cx = x + (i - (n - 1) / 2) * r * 1.7;
      const cy = y - r * 0.8 + fi * r * 1.5;
      out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${color}"/><circle cx="${f(cx - r * 0.3)}" cy="${f(cy - r * 0.3)}" r="${f(r * 0.25)}" fill="${brillo}" opacity="0.6"/>`;
    }
  });
  return out;
}

/** Zarcillo de vid: un rulito en espiral. */
function zarcillo(x: number, y: number, r: number, color: string, g: number): string {
  let d = "";
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI * 3.5;
    const rr = r * (1 - i / 34);
    d += `${i ? " L" : "M"} ${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${f(g)}" fill="none" stroke-linecap="round"/>`;
}

/** Una parra que corre por el borde de arriba desde una esquina, con hojas y un racimo colgando. */
function parra(x: number, ancho: number, s: number, hacia: 1 | -1, semilla: number): string {
  const rnd = azar(semilla);
  const tallo = "#8a6a3b";
  const y = s * 0.035;
  const x2 = x + hacia * ancho;
  let out = `<path d="M ${f(x)} ${f(y * 0.4)} Q ${f(x + hacia * ancho * 0.5)} ${f(y * 2.2)} ${f(x2)} ${f(y)}" stroke="${tallo}" stroke-width="${f(s * 0.006)}" fill="none" stroke-linecap="round"/>`;
  const hojas = 4;
  for (let i = 0; i < hojas; i++) {
    const t = (i + 0.6) / hojas;
    const hx = x + hacia * ancho * t;
    const hy = y * (0.4 + 3.6 * t * (1 - t)) + s * (i % 2 ? 0.035 : 0.01);
    out += hojaDeParra(hx, hy, s * (0.052 + rnd() * 0.012), 180 + (rnd() - 0.5) * 50, i % 2 ? "#7d8a52" : "#5f6e3c", "#3f4a26");
  }
  out += zarcillo(x + hacia * ancho * 0.35, y * 2.1, s * 0.012, tallo, s * 0.003) + zarcillo(x + hacia * ancho * 0.9, y * 1.5, s * 0.01, tallo, s * 0.003);
  out += racimoUvas(x + hacia * ancho * 0.55, s * 0.095, s * 0.014, "#3b0d1e", "#c77d9a", tallo);
  return out;
}

/** Ramo tropical de esquina: hojas de palmera largas, una hoja ancha y una flor de hibisco. */
function ramoTropical(x: number, y: number, s: number, sx: 1 | -1, sy: 1 | -1, semilla: number): string {
  const ang = (a: number) => {
    // Convierte un ángulo "abriendo desde la esquina" al cuadrante que corresponde.
    const rad = (a * Math.PI) / 180;
    return (Math.atan2(Math.sin(rad) * sy, Math.cos(rad) * sx) * 180) / Math.PI;
  };
  const verdes = ["#1f4d3a", "#2d6a4f", "#40916c", "#245c45"];
  let out = "";
  const frondas: [number, number][] = [[4, 0.3], [24, 0.2], [66, 0.2], [86, 0.3]];
  frondas.forEach(([a, l], i) => {
    out += rama(x, y, s * l, ang(a), verdes[i % verdes.length]!, semilla + i * 5, { hojas: 16, tamHoja: s * l * 0.34, anchoHoja: 0.16 });
  });
  out += hoja(x, y, s * 0.17, ang(45), "#2d6a4f", 0.62);
  out += `<path d="M ${f(x)} ${f(y)} l ${f(Math.cos((ang(45) * Math.PI) / 180) * s * 0.16)} ${f(Math.sin((ang(45) * Math.PI) / 180) * s * 0.16)}" stroke="#a7c4a0" stroke-width="${f(s * 0.003)}"/>`;
  const fx = x + sx * s * 0.075;
  const fy = y + sy * s * 0.065;
  out += flor(fx, fy, s * 0.05, "#e76f51", "#ffd166", 5, 15) + `<circle cx="${f(fx)}" cy="${f(fy)}" r="${f(s * 0.008)}" fill="#9d0208"/>`;
  out += flor(x + sx * s * 0.15, y + sy * s * 0.03, s * 0.028, "#f4a261", "#ffd166", 5, 40);
  return out;
}

/** Salpicado de pintura dorada: gotitas de distintos tamaños alrededor de un punto. */
function salpicado(x: number, y: number, radio: number, color: string, semilla: number, n = 18): string {
  const rnd = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = radio * Math.sqrt(rnd());
    out += `<circle cx="${f(x + Math.cos(a) * d)}" cy="${f(y + Math.sin(a) * d)}" r="${f(radio * (0.012 + rnd() * 0.045))}" fill="${color}" opacity="${f(0.6 + rnd() * 0.4)}"/>`;
  }
  return out;
}

/** Filtro de tiza: borde comido y un poco de transparencia. */
const filtroTiza = (id: string) =>
  `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="9" result="r"/><feDisplacementMap in="SourceGraphic" in2="r" scale="0.8" xChannelSelector="R" yChannelSelector="G" result="d"/><feComponentTransfer in="d"><feFuncA type="table" tableValues="0 0.55 0.9"/></feComponentTransfer></filter>`;

/** Banderines dibujados con tiza: sólo el contorno y un rayado adentro. */
function banderinesTiza(x1: number, x2: number, y: number, comba: number, alto: number, color: string, g: number): string {
  const n = Math.max(5, Math.round((x2 - x1) / (alto * 1.1)));
  const cx = (x1 + x2) / 2;
  const cy = y + comba * 2;
  let out = `<path d="M ${f(x1)} ${f(y)} Q ${f(cx)} ${f(cy)} ${f(x2)} ${f(y)}" stroke="${color}" stroke-width="${f(g)}" fill="none"/>`;
  const a = ((x2 - x1) / n) * 0.8;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * y;
    const ang = (Math.atan2(2 * (1 - t) * (cy - y) + 2 * t * (y - cy), x2 - x1) * 180) / Math.PI;
    out += `<g transform="translate(${f(px)} ${f(py)}) rotate(${f(ang)})"><path d="M ${f(-a / 2)} 0 L ${f(a / 2)} 0 L 0 ${f(alto)} Z" stroke="${color}" stroke-width="${f(g)}" fill="none" stroke-linejoin="round"/>${i % 2 ? `<path d="M ${f(-a * 0.25)} ${f(alto * 0.12)} L ${f(a * 0.05)} ${f(alto * 0.55)} M ${f(a * 0.05)} ${f(alto * 0.12)} L ${f(a * 0.2)} ${f(alto * 0.3)}" stroke="${color}" stroke-width="${f(g * 0.6)}"/>` : ""}</g>`;
  }
  return out;
}

// ───────────────────────── Los estilos ─────────────────────────

export const ADULTOS: EstiloFotolibro[] = [
  {
    id: "adultos-01-brindis-dorado",
    tema: "adultos",
    nombre: "Brindis dorado",
    descripcion: "Grafito profundo, copas que brindan, burbujas y filete doble en oro: elegante y festivo.",
    papel: "#221f1d",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const oro = "#d4af37";
      const fondo = degradado("gr", { x: 0, y: 0, w: W, h: H }, "#2a2623", "#191716");
      let c = fondo.cuerpo;
      for (const p of [izq, der]) c += filete(p, s * 0.035, oro, 0.45) + filete(p, s * 0.045, oro, 0.2);
      const columna = (x: number, sem: number) => burbujasChampagne(x, H - s * 0.07, H * 0.55, s, "#f1d68a", sem);
      if (tipo === "apertura") {
        const cx = izq.w / 2;
        const alto = Math.min(H * 0.2, s * 0.24);
        c += copa(cx - alto * 0.2, H * 0.27, alto, 14, oro) + copa(cx + alto * 0.2, H * 0.27, alto, -14, oro);
        c += destello(cx, H * 0.27 - alto * 1.02, alto * 0.08, "#f1d68a") + destello(cx - alto * 0.14, H * 0.27 - alto * 1.12, alto * 0.04, "#f1d68a") + destello(cx + alto * 0.15, H * 0.27 - alto * 1.1, alto * 0.05, "#f1d68a");
        c += columna(der.x + der.w - s * 0.08, 3);
      }
      if (tipo === "interior" || tipo === "cierre") c += columna(izq.x + s * 0.08, 4) + columna(der.x + der.w - s * 0.08, 5);
      if (tipo === "interior-alt") {
        c += columna(izq.x + s * 0.08, 6);
        c += confeti({ x: der.x + s * 0.08, y: s * 0.055, w: der.w - s * 0.16, h: s * 0.04 }, [oro, "#f1d68a", "#a8862a"], Math.round(der.w / (s * 0.025)), 7, s * 0.01);
      }
      if (tipo === "cierre") c += confeti({ x: izq.x + s * 0.08, y: s * 0.055, w: izq.w - s * 0.16, h: s * 0.04 }, [oro, "#f1d68a", "#a8862a"], Math.round(izq.w / (s * 0.025)), 8, s * 0.01);
      return svg(m, c, fondo.defs);
    },
    zona: zonaS((s, tipo, l) => {
      const burbujas = tipo === "interior" || tipo === "cierre" || (tipo === "apertura" && l === "der") || (tipo === "interior-alt" && l === "izq");
      const confetiArriba = (tipo === "interior-alt" && l === "der") || (tipo === "cierre" && l === "izq");
      return { arriba: s * (confetiArriba ? 0.06 : 0.02), abajo: s * 0.02, exterior: s * (burbujas ? 0.07 : 0.02) };
    }),
    textos: textosClasicos({
      titulo: "Great Vibes",
      texto: "Montserrat",
      color: "#e6c66e",
      acento: "#f1e6c8",
      escalaTitulo: 0.12,
      ejemplos: { titulo: "Martín cumple 40", subtitulo: "Brindemos", fecha: "14 · 03 · 2026", frase: "Por muchos años más" },
    }),
  },
  {
    id: "adultos-02-art-deco",
    tema: "adultos",
    nombre: "Art déco",
    descripcion: "Azul noche y oro con marcos escalonados, abanicos y sol de rayos: una fiesta de los años 20.",
    papel: "#0f1c2e",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const oro = "#c9a45c";
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#0f1c2e");
      const sep = s * 0.035;
      const g = Math.max(0.35, s * 0.0025);
      for (const p of [izq, der]) {
        c += marcoDeco(p, sep, s * 0.015, oro, g) + filete(p, sep + s * 0.045, oro, g * 0.5);
      }
      const esquinas = (p: Rect, cuales: ("si" | "sd" | "ii" | "id")[]) => {
        const r = s * 0.09;
        const k = sep + s * 0.045;
        let o = "";
        for (const q of cuales) {
          const x = q === "si" || q === "ii" ? p.x + k : p.x + p.w - k;
          const y = q === "si" || q === "sd" ? k : H - k;
          const desde = { si: 0, sd: 90, id: 180, ii: 270 }[q];
          o += abanicoDeco(x, y, r, desde, oro, g * 0.8);
        }
        return o;
      };
      if (tipo === "apertura") {
        c += solDeco(izq.w / 2, H * 0.26, Math.min(s * 0.13, H * 0.15), oro, g);
        c += esquinas(der, ["sd", "id"]) + esquinas(izq, ["ii"]);
      }
      if (tipo === "interior") c += esquinas(izq, ["si", "ii"]) + esquinas(der, ["sd", "id"]);
      if (tipo === "interior-alt") {
        // Bandas de rayitas finas arriba y abajo, con un rombo al centro de cada página.
        for (const p of [izq, der]) {
          const x1 = p.x + sep + s * 0.07;
          const x2 = p.x + p.w - sep - s * 0.07;
          let d = "";
          for (let x = x1; x <= x2; x += s * 0.012) d += `M ${f(x)} ${f(sep + s * 0.06)} V ${f(sep + s * 0.085)} M ${f(x)} ${f(H - sep - s * 0.06)} V ${f(H - sep - s * 0.085)} `;
          c += `<path d="${d}" stroke="${oro}" stroke-width="${f(g * 0.5)}" opacity="0.8"/>`;
          const cx = p.x + p.w / 2;
          for (const y of [sep + s * 0.0725, H - sep - s * 0.0725]) c += `<path d="M ${f(cx)} ${f(y - s * 0.02)} L ${f(cx + s * 0.02)} ${f(y)} L ${f(cx)} ${f(y + s * 0.02)} L ${f(cx - s * 0.02)} ${f(y)} Z" fill="#0f1c2e" stroke="${oro}" stroke-width="${f(g)}"/>`;
        }
      }
      if (tipo === "cierre") c += esquinas(izq, ["si", "ii"]) + esquinas(der, ["id"]);
      return svg(m, c);
    },
    zona: zonaS((s, tipo) => (tipo === "interior-alt" ? { arriba: s * 0.08, abajo: s * 0.08, exterior: s * 0.05, interior: s * 0.03 } : { arriba: s * 0.07, abajo: s * 0.07, exterior: s * 0.05, interior: s * 0.03 })),
    textos: ajustar(
      textosClasicos({
        titulo: "Oswald",
        texto: "Raleway",
        color: "#d9b56c",
        acento: "#e8dcc0",
        escalaTitulo: 0.1,
        ejemplos: { titulo: "Los 50 de Claudia", subtitulo: "Una noche de gala", fecha: "21 · 11 · 2026", frase: "Que la fiesta no termine nunca" },
      }),
      { titulo: { mayusculas: true } },
    ),
  },
  {
    id: "adultos-03-neon",
    tema: "adultos",
    nombre: "Neón de boliche",
    descripcion: "Pared oscura con tubos de neón rosa, celeste y amarillo: para cumples que terminan a la madrugada.",
    papel: "#140630",
    margenMm: 16,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const rosa = "#ff2a8a";
      const celeste = "#22e4f0";
      const amarillo = "#f9f871";
      const fondo = degradado("pared", { x: 0, y: 0, w: W, h: H }, "#1d0b40", "#0e0424");
      let c = fondo.cuerpo + ladrillos(m, s * 0.045, "#ffffff", 0.05);
      const g = Math.max(0.6, s * 0.006);
      const marco = (p: Rect, color: string) => neon(rectRedondo(p.x + s * 0.04, s * 0.04, p.w - s * 0.08, H - s * 0.08, s * 0.03), color, g, "n");
      if (tipo === "apertura") {
        c += neon(rectRedondo(izq.w * 0.07, H * 0.23, izq.w * 0.86, H * 0.41, s * 0.03), rosa, g, "n");
        c += neon(estrellaD(izq.w * 0.15, H * 0.12, s * 0.03, 8), amarillo, g * 0.8, "n") + neon(estrellaD(izq.w * 0.85, H * 0.12, s * 0.022, -8), celeste, g * 0.8, "n");
        c += marco(der, celeste);
      }
      if (tipo === "interior") c += marco(izq, celeste) + marco(der, rosa);
      if (tipo === "interior-alt") {
        c += neon(zigzagD(izq.x + s * 0.06, der.x + der.w - s * 0.06, s * 0.08, s * 0.03, s * 0.06), rosa, g, "n");
        c += neon(ondaD(izq.x + s * 0.06, der.x + der.w - s * 0.06, H - s * 0.06, s * 0.03, s * 0.12), celeste, g, "n");
        c += neon(rayoD(izq.x + s * 0.05, H * 0.5, s * 0.035), amarillo, g * 0.8, "n") + neon(rayoD(der.x + der.w - s * 0.05, H * 0.5, s * 0.035), amarillo, g * 0.8, "n");
      }
      if (tipo === "cierre") {
        c += marco(izq, rosa);
        c += neon(estrellaD(der.x + der.w - s * 0.09, H - s * 0.1, s * 0.035, 10), amarillo, g * 0.8, "n") + neon(estrellaD(der.x + der.w - s * 0.17, H - s * 0.07, s * 0.02, -8), celeste, g * 0.8, "n");
        c += neon(`M ${f(der.x + der.w * 0.3)} ${f(H * 0.27)} L ${f(der.x + der.w * 0.7)} ${f(H * 0.27)}`, celeste, g, "n");
      }
      return svg(m, c, fondo.defs + filtroNeon("n", Math.max(0.6, s * 0.006)));
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "interior-alt") return { arriba: s * 0.08, abajo: s * 0.06, exterior: s * 0.06 };
      if (tipo === "cierre" && l === "der") return { abajo: s * 0.12, exterior: s * 0.04 };
      return { arriba: s * 0.04, abajo: s * 0.04, exterior: s * 0.04, interior: s * 0.04 };
    }),
    textos: textosClasicos({
      titulo: "Pacifico",
      texto: "Poppins",
      color: "#ff4fa3",
      acento: "#7df9ff",
      escalaTitulo: 0.1,
      ejemplos: { titulo: "Lau 30", subtitulo: "La noche es nuestra", fecha: "08 · 08 · 2026", frase: "Que nadie apague la luz" },
    }),
  },
  {
    id: "adultos-04-setentas",
    tema: "adultos",
    nombre: "Setentas groovy",
    descripcion: "Rayas onduladas en naranja, mostaza y marrón, sol de los 70 y margaritas: retro con onda.",
    papel: "#f5e6c8",
    margenMm: 14,
    esquinasMm: 4,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const colores = ["#6f3b1e", "#d9622b", "#e7a531", "#f2c48d"];
      const g = grano("g", m, 0.07);
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#f5e6c8");
      const grosor = s * 0.024;
      const margarita = (x: number, y: number, r: number, giro: number) => flor(x, y, r, "#fffaf0", "#e7a531", 8, giro);
      if (tipo === "apertura") {
        c += solGroovy(izq.w / 2, 0, Math.min(H * 0.22, izq.w * 0.4), colores, true);
        c += ondasGroovy(der.x, der.x + der.w, H - s * 0.015, -1, grosor, colores, s * 0.22);
        c += margarita(der.x + der.w - s * 0.1, H - s * 0.17, s * 0.035, 10) + margarita(der.x + der.w - s * 0.18, H - s * 0.155, s * 0.022, 30);
      }
      if (tipo === "interior" || tipo === "cierre") {
        c += ondasGroovy(0, W, H - s * 0.015, -1, grosor, colores, s * 0.22);
        if (tipo === "cierre") c += margarita(izq.x + s * 0.1, H - s * 0.17, s * 0.035, 10) + margarita(izq.x + s * 0.18, H - s * 0.155, s * 0.022, 30);
        else c += margarita(der.x + der.w - s * 0.1, H - s * 0.17, s * 0.03, 20);
      }
      if (tipo === "interior-alt") {
        c += ondasGroovy(0, H, s * 0.015, 1, grosor, colores, s * 0.22, true) + ondasGroovy(0, H, W - s * 0.015, -1, grosor, colores, s * 0.22, true);
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "interior-alt") return { exterior: s * 0.12 };
      if (tipo === "apertura") return l === "der" ? { abajo: s * 0.15 } : {};
      const flores = (tipo === "cierre" && l === "izq") || (tipo === "interior" && l === "der");
      return { abajo: s * (flores ? 0.2 : 0.12) };
    }),
    textos: ajustar(
      textosClasicos({
        titulo: "Rubik",
        texto: "Work Sans",
        color: "#6f3b1e",
        acento: "#d9622b",
        escalaTitulo: 0.11,
        ejemplos: { titulo: "Gabi cumple 50", subtitulo: "Fiesta retro", fecha: "03 · 07 · 2026", frase: "Paz, amor y torta" },
      }),
      { titulo: { negrita: true } },
    ),
  },
  {
    id: "adultos-05-editorial",
    tema: "adultos",
    nombre: "Editorial blanco y negro",
    descripcion: "Blanco roto, filetes negros, grilla de puntos y un toque coral: sobrio, de revista.",
    papel: "#f7f6f2",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const negro = "#151515";
      const coral = "#c8553d";
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#f7f6f2");
      const g = Math.max(0.3, s * 0.002);
      for (const p of [izq, der]) {
        c += `<line x1="${f(p.x + s * 0.05)}" y1="${f(s * 0.045)}" x2="${f(p.x + p.w - s * 0.05)}" y2="${f(s * 0.045)}" stroke="${negro}" stroke-width="${f(g)}"/>`;
        c += `<line x1="${f(p.x + s * 0.05)}" y1="${f(H - s * 0.045)}" x2="${f(p.x + p.w - s * 0.05)}" y2="${f(H - s * 0.045)}" stroke="${negro}" stroke-width="${f(g)}"/>`;
      }
      // El cuadradito coral en la esquina de abajo, de cada lado de afuera.
      c += fondoLiso({ x: izq.x + s * 0.05, y: H - s * 0.045 - s * 0.018, w: s * 0.018, h: s * 0.018 }, coral) + fondoLiso({ x: der.x + der.w - s * 0.068, y: H - s * 0.045 - s * 0.018, w: s * 0.018, h: s * 0.018 }, coral);
      if (tipo === "apertura") {
        c += fondoLiso({ x: 0, y: 0, w: s * 0.06, h: H }, negro);
        c += `<line x1="${f(izq.w * 0.4)}" y1="${f(H * 0.27)}" x2="${f(izq.w * 0.6)}" y2="${f(H * 0.27)}" stroke="${coral}" stroke-width="${f(g * 3)}"/>`;
        c += grillaPuntos(der.x + der.w - s * 0.2, s * 0.08, 7, 3, s * 0.022, s * 0.004, negro);
      }
      if (tipo === "interior-alt") {
        c += `<circle cx="${f(izq.x)}" cy="${f(H)}" r="${f(s * 0.2)}" fill="none" stroke="${negro}" stroke-width="${f(g)}"/><circle cx="${f(izq.x)}" cy="${f(H)}" r="${f(s * 0.16)}" fill="${coral}" opacity="0.9"/>`;
        c += grillaPuntos(der.x + der.w - s * 0.2, s * 0.08, 7, 3, s * 0.022, s * 0.004, negro);
      }
      if (tipo === "interior") c += fondoLiso({ x: W - s * 0.025, y: 0, w: s * 0.025, h: H }, negro);
      if (tipo === "cierre") {
        c += fondoLiso({ x: W - s * 0.06, y: 0, w: s * 0.06, h: H }, negro);
        c += grillaPuntos(izq.x + s * 0.08, H - s * 0.14, 7, 3, s * 0.022, s * 0.004, negro);
        c += `<line x1="${f(der.x + der.w * 0.4)}" y1="${f(H * 0.26)}" x2="${f(der.x + der.w * 0.6)}" y2="${f(H * 0.26)}" stroke="${coral}" stroke-width="${f(g * 3)}"/>`;
      }
      return svg(m, c);
    },
    zona: zonaS((s, tipo, l) => {
      const base = { arriba: s * 0.03, abajo: s * 0.03 };
      if (tipo === "apertura") return l === "izq" ? { ...base, exterior: s * 0.04 } : { ...base, arriba: s * 0.1 };
      if (tipo === "interior-alt") return l === "izq" ? { ...base, abajo: s * 0.1, exterior: s * 0.1 } : { ...base, arriba: s * 0.1 };
      if (tipo === "cierre") return l === "izq" ? { ...base, abajo: s * 0.13 } : { ...base, exterior: s * 0.04 };
      return base;
    }),
    textos: textosClasicos({
      titulo: "Bebas Neue",
      texto: "Inter",
      color: "#151515",
      acento: "#c8553d",
      escalaTitulo: 0.15,
      ejemplos: { titulo: "Nico 30", subtitulo: "Tres décadas", fecha: "17 · 01 · 2026", frase: "Lo mejor está por venir" },
    }),
  },
  {
    id: "adultos-06-tropical",
    tema: "adultos",
    nombre: "Tropical",
    descripcion: "Hojas de palmera verde profundo e hibiscos coral sobre arena: fiesta de verano.",
    papel: "#f3eee4",
    margenMm: 14,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#f3eee4");
      const g = grano("g", m, 0.05);
      const k = tipo === "apertura" || tipo === "cierre" ? 1.1 : 1;
      const sk = s * k;
      if (tipo === "apertura") c += ramoTropical(izq.x, 0, sk, 1, 1, 3) + ramoTropical(der.x + der.w, H, sk, -1, -1, 7);
      if (tipo === "interior") c += ramoTropical(izq.x, 0, sk, 1, 1, 11) + ramoTropical(der.x + der.w, H, sk, -1, -1, 13);
      if (tipo === "interior-alt") c += ramoTropical(izq.x, H, sk, 1, -1, 17) + ramoTropical(der.x + der.w, 0, sk, -1, 1, 19);
      if (tipo === "cierre") c += ramoTropical(izq.x, H, sk, 1, -1, 23) + ramoTropical(der.x + der.w, H, sk, -1, -1, 29);
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: zonaS((s, tipo, l) => {
      const z = { arriba: 0, abajo: 0, exterior: s * 0.13 };
      const v = s * 0.13;
      if (tipo === "apertura") return l === "izq" ? { exterior: s * 0.1 } : { ...z, abajo: v };
      if (tipo === "interior") return l === "izq" ? { ...z, arriba: v } : { ...z, abajo: v };
      if (tipo === "interior-alt") return l === "izq" ? { ...z, abajo: v } : { ...z, arriba: v };
      return { ...z, abajo: v };
    }),
    textos: textosClasicos({
      titulo: "Satisfy",
      texto: "Raleway",
      color: "#1f4d3a",
      acento: "#c0573d",
      escalaTitulo: 0.12,
      ejemplos: { titulo: "Los 40 de Flor", subtitulo: "Fiesta tropical", fecha: "15 · 01 · 2026", frase: "Que el verano dure para siempre" },
    }),
  },
  {
    id: "adultos-07-memphis",
    tema: "adultos",
    nombre: "Memphis noventoso",
    descripcion: "Triángulos, zigzags, lunares y círculos en colores vivos: el estilo de los 90, divertido.",
    papel: "#fff8ef",
    margenMm: 14,
    esquinasMm: 0,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const colores = ["#ff6b6b", "#4ecdc4", "#ffd23f", "#1a1a2e", "#a29bfe"];
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#fff8ef");
      const banda = s * 0.09;
      const arriba = (p: Rect, sem: number) => memphis({ x: p.x + s * 0.02, y: s * 0.015, w: p.w - s * 0.04, h: banda }, s, colores, sem);
      const abajo = (p: Rect, sem: number) => memphis({ x: p.x + s * 0.02, y: H - s * 0.015 - banda, w: p.w - s * 0.04, h: banda }, s, colores, sem);
      if (tipo === "apertura") {
        c += `<circle cx="${f(izq.w * 0.3)}" cy="${f(H * 0.37)}" r="${f(Math.min(H * 0.13, s * 0.16))}" fill="#ffd23f" opacity="0.55"/>`;
        c += `<path d="${zigzagD(izq.w * 0.62, izq.w * 0.86, H * 0.25, s * 0.02, s * 0.04)}" fill="none" stroke="#4ecdc4" stroke-width="${f(s * 0.006)}" stroke-linejoin="round"/>`;
        c += arriba(izq, 1) + arriba(der, 2) + abajo(der, 3);
      }
      if (tipo === "interior") c += arriba(izq, 4) + abajo(der, 5);
      if (tipo === "interior-alt") {
        c += memphis({ x: s * 0.015, y: s * 0.02, w: banda, h: H - s * 0.04 }, s, colores, 6);
        c += memphis({ x: W - s * 0.015 - banda, y: s * 0.02, w: banda, h: H - s * 0.04 }, s, colores, 7);
      }
      if (tipo === "cierre") c += abajo(izq, 8) + arriba(izq, 9) + abajo(der, 10);
      return svg(m, c);
    },
    zona: zonaS((s, tipo, l) => {
      const v = s * 0.07;
      if (tipo === "apertura") return l === "der" ? { arriba: v, abajo: v } : {};
      if (tipo === "interior") return l === "izq" ? { arriba: v } : { abajo: v };
      if (tipo === "interior-alt") return { exterior: v };
      return l === "izq" ? { arriba: v, abajo: v } : { abajo: v };
    }),
    textos: ajustar(
      textosClasicos({
        titulo: "Poppins",
        texto: "Poppins",
        color: "#1a1a2e",
        acento: "#ff6b6b",
        escalaTitulo: 0.11,
        ejemplos: { titulo: "Sofi cumple 35", subtitulo: "Fiesta noventosa", fecha: "26 · 09 · 2026", frase: "¡Qué noche, amigos!" },
      }),
      { titulo: { negrita: true } },
    ),
  },
  {
    id: "adultos-08-malbec",
    tema: "adultos",
    nombre: "Malbec",
    descripcion: "Bordó profundo con parras, racimos de uva y filete dorado: para brindar con un buen tinto.",
    papel: "#4a0f1f",
    margenMm: 16,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const fondo = degradado("vino", { x: 0, y: 0, w: W, h: H }, "#5a1426", "#360916");
      const g = grano("g", m, 0.1);
      let c = fondo.cuerpo;
      for (const p of [izq, der]) c += filete(p, s * 0.03, "#c8a165", 0.35);
      const ancho = (p: Rect) => Math.min(p.w * 0.55, s * 0.5);
      if (tipo === "apertura") c += parra(izq.x, ancho(izq), s, 1, 3) + parra(der.x + der.w, ancho(der), s, -1, 5);
      if (tipo === "interior") c += parra(izq.x, ancho(izq), s, 1, 7);
      if (tipo === "interior-alt") c += parra(der.x + der.w, ancho(der), s, -1, 9);
      if (tipo === "cierre") c += parra(izq.x, ancho(izq), s, 1, 11);
      return svg(m, c + g.cuerpo, fondo.defs + g.defs);
    },
    zona: zonaS((s, tipo, l) => {
      const conParra = (tipo === "apertura") || (tipo === "interior" && l === "izq") || (tipo === "interior-alt" && l === "der") || (tipo === "cierre" && l === "izq");
      return { arriba: s * (conParra ? 0.14 : 0.02), abajo: s * 0.02, exterior: s * 0.02 };
    }),
    textos: ajustar(
      textosClasicos({
        titulo: "Playfair Display",
        texto: "Lora",
        color: "#ecd7a8",
        acento: "#c8a165",
        escalaTitulo: 0.1,
        ejemplos: { titulo: "Roberto · 60", subtitulo: "Sesenta cosechas", fecha: "10 · 04 · 2026", frase: "Salud por los que vinieron" },
      }),
      { titulo: { italica: true } },
    ),
  },
  {
    id: "adultos-09-acuarela-y-oro",
    tema: "adultos",
    nombre: "Acuarela y oro",
    descripcion: "Manchas de acuarela rosa y durazno, rosas y salpicado dorado: delicado, ideal para los 50 o 60.",
    papel: "#fffaf6",
    margenMm: 16,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const g = grano("g", m, 0.04);
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#fffaf6");
      const oro = "#c9a14a";
      const ramito = (x: number, y: number, sx: 1 | -1, sy: 1 | -1, k: number, sem: number) => {
        let o = manchaAcuarela(x + sx * s * 0.08 * k, y + sy * s * 0.07 * k, s * 0.2 * k, "#e8a6a1", "a", sem) + manchaAcuarela(x + sx * s * 0.17 * k, y + sy * s * 0.03 * k, s * 0.12 * k, "#f4c095", "a", sem + 1, 2);
        const base = sx === 1 ? (sy === 1 ? 20 : -20) : sy === 1 ? 160 : -160;
        o += rama(x, y, s * 0.24 * k, base, "#9aab88", sem + 2) + rama(x, y, s * 0.2 * k, base + sx * sy * 45, "#b7c4a4", sem + 3);
        o += rosa(x + sx * s * 0.07 * k, y + sy * s * 0.065 * k, s * 0.04 * k, "#e7a0a5", "#c9737c", 20) + rosa(x + sx * s * 0.13 * k, y + sy * s * 0.035 * k, s * 0.028 * k, "#f6c9b0", "#dd9b7f", 80);
        o += flor(x + sx * s * 0.04 * k, y + sy * s * 0.13 * k, s * 0.02 * k, "#fbe0d8", oro, 5, 20);
        o += salpicado(x + sx * s * 0.12 * k, y + sy * s * 0.1 * k, s * 0.1 * k, oro, sem + 4);
        return o;
      };
      if (tipo === "apertura") c += ramito(izq.x, 0, 1, 1, 1.1, 3) + ramito(der.x + der.w, H, -1, -1, 1, 7);
      if (tipo === "interior") c += ramito(izq.x, 0, 1, 1, 0.85, 11) + ramito(der.x + der.w, H, -1, -1, 0.85, 13);
      if (tipo === "interior-alt") {
        c += manchaAcuarela(der.x + der.w, H * 0.3, s * 0.14, "#f4c095", "a", 17, 2) + manchaAcuarela(der.x + der.w, H * 0.7, s * 0.14, "#e8a6a1", "a", 19, 2);
        c += salpicado(der.x + der.w - s * 0.06, H * 0.5, s * 0.08, oro, 21, 14) + salpicado(izq.x + s * 0.07, s * 0.07, s * 0.06, oro, 23, 10);
      }
      if (tipo === "cierre") c += ramito(izq.x, H, 1, -1, 1, 29) + ramito(der.x + der.w, H, -1, -1, 0.8, 31);
      return svg(m, c + g.cuerpo, filtroAcuarela("a") + g.defs);
    },
    zona: zonaS((s, tipo, l) => {
      const z = s * 0.12;
      if (tipo === "apertura") return l === "der" ? { abajo: z, exterior: s * 0.1 } : {};
      if (tipo === "interior") return l === "izq" ? { arriba: z * 0.85, exterior: s * 0.08 } : { abajo: z * 0.85, exterior: s * 0.08 };
      if (tipo === "interior-alt") return l === "der" ? { exterior: s * 0.11 } : { arriba: s * 0.04 };
      return { abajo: z, exterior: s * 0.08 };
    }),
    textos: textosClasicos({
      titulo: "Alex Brush",
      texto: "Crimson Text",
      color: "#9c4f5a",
      acento: "#a88452",
      escalaTitulo: 0.13,
      ejemplos: { titulo: "Los 60 de Marta", subtitulo: "Una vida para celebrar", fecha: "02 · 05 · 2026", frase: "Gracias por estar en mi historia" },
    }),
  },
  {
    id: "adultos-10-pizarra",
    tema: "adultos",
    nombre: "Pizarra de bar",
    descripcion: "Pizarrón verde con marco de madera, banderines, estrellas y laureles dibujados con tiza.",
    papel: "#2f3b35",
    margenMm: 16,
    esquinasMm: 0,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = lado(m);
      const W = m.anchoMm;
      const H = m.altoMm;
      const tiza = "#f4f1e6";
      const amarillo = "#f3d27a";
      const g = grano("g", m, 0.22, 1.2);
      let c = fondoLiso({ x: 0, y: 0, w: W, h: H }, "#2f3b35");
      // Borrones de tiza mal borrada.
      const rnd = azar(5);
      for (let i = 0; i < 6; i++) c += `<ellipse cx="${f(rnd() * W)}" cy="${f(rnd() * H)}" rx="${f(s * (0.2 + rnd() * 0.2))}" ry="${f(s * (0.06 + rnd() * 0.06))}" fill="#ffffff" opacity="0.035" transform="rotate(${f(rnd() * 30 - 15)} ${f(W / 2)} ${f(H / 2)})"/>`;
      const gt = Math.max(0.5, s * 0.005);
      let d = "";
      if (tipo === "apertura") {
        d += banderinesTiza(izq.x + s * 0.06, izq.x + izq.w - s * 0.06, s * 0.05, s * 0.025, s * 0.05, tiza, gt);
        d += banderinesTiza(der.x + s * 0.06, der.x + der.w - s * 0.06, s * 0.05, s * 0.025, s * 0.05, tiza, gt);
        // Dos ramitas de laurel debajo del subtítulo.
        d += rama(izq.w / 2 - s * 0.02, H * 0.6, s * 0.12, 185, tiza, 3, { hojas: 8 }) + rama(izq.w / 2 + s * 0.02, H * 0.6, s * 0.12, -5, tiza, 4, { hojas: 8 });
      }
      if (tipo === "interior") {
        d += banderinesTiza(izq.x + s * 0.06, izq.x + izq.w - s * 0.06, s * 0.05, s * 0.025, s * 0.05, tiza, gt);
        d += banderinesTiza(der.x + s * 0.06, der.x + der.w - s * 0.06, s * 0.05, s * 0.025, s * 0.05, tiza, gt);
      }
      if (tipo === "interior-alt") {
        d += `<path d="${estrellaD(izq.x + s * 0.1, H - s * 0.1, s * 0.03, 8)}" stroke="${amarillo}" stroke-width="${f(gt)}" fill="none" stroke-linejoin="round"/>`;
        d += `<path d="${estrellaD(izq.x + s * 0.17, H - s * 0.07, s * 0.018, -10)}" stroke="${tiza}" stroke-width="${f(gt)}" fill="none" stroke-linejoin="round"/>`;
        d += `<path d="M ${f(der.x + der.w - s * 0.25)} ${f(H - s * 0.07)} q ${f(s * 0.08)} ${f(-s * 0.05)} ${f(s * 0.15)} ${f(-s * 0.01)} m ${f(-s * 0.025)} ${f(-s * 0.02)} l ${f(s * 0.025)} ${f(s * 0.02)} l ${f(-s * 0.03)} ${f(s * 0.012)}" stroke="${tiza}" stroke-width="${f(gt)}" fill="none" stroke-linecap="round"/>`;
        d += `<path d="${estrellaD(der.x + der.w - s * 0.06, H - s * 0.1, s * 0.022, 4)}" stroke="${amarillo}" stroke-width="${f(gt)}" fill="none" stroke-linejoin="round"/>`;
      }
      if (tipo === "cierre") {
        d += rama(izq.x + izq.w / 2 - s * 0.01, H - s * 0.05, s * 0.13, 200, tiza, 7, { hojas: 8 }) + rama(izq.x + izq.w / 2 + s * 0.01, H - s * 0.05, s * 0.13, -20, tiza, 8, { hojas: 8 });
        d += `<path d="${estrellaD(der.x + der.w - s * 0.1, H - s * 0.09, s * 0.03, 8)}" stroke="${amarillo}" stroke-width="${f(gt)}" fill="none" stroke-linejoin="round"/>`;
        d += `<path d="${estrellaD(der.x + der.w - s * 0.17, H - s * 0.06, s * 0.018, -10)}" stroke="${tiza}" stroke-width="${f(gt)}" fill="none" stroke-linejoin="round"/>`;
      }
      c += `<g filter="url(#tz)">${d}</g>`;
      // El marco de madera alrededor de todo el pliego.
      const mm = s * 0.022;
      c += `<rect x="${f(mm / 2)}" y="${f(mm / 2)}" width="${f(W - mm)}" height="${f(H - mm)}" fill="none" stroke="#8b5a2b" stroke-width="${f(mm)}"/><rect x="${f(mm)}" y="${f(mm)}" width="${f(W - 2 * mm)}" height="${f(H - 2 * mm)}" fill="none" stroke="#5c3a1a" stroke-width="${f(mm * 0.15)}"/>`;
      return svg(m, c + g.cuerpo, filtroTiza("tz") + g.defs);
    },
    zona: zonaS((s, tipo, l) => {
      if (tipo === "apertura") return l === "der" ? { arriba: s * 0.08 } : {};
      if (tipo === "interior") return { arriba: s * 0.08 };
      if (tipo === "interior-alt") return { abajo: s * 0.08 };
      return { abajo: s * 0.08 };
    }),
    textos: ajustar(
      textosClasicos({
        titulo: "Amatic SC",
        texto: "Caveat",
        color: "#f8f4e3",
        acento: "#f3d27a",
        escalaTitulo: 0.14,
        ejemplos: { titulo: "Pablo cumple 45", subtitulo: "Picada y amigos", fecha: "19 · 06 · 2026", frase: "Salud por los amigos" },
      }),
      { titulo: { negrita: true } },
    ),
  },
];
