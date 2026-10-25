import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "../tipos";
import {
  azar,
  degradado,
  espejar,
  esquineros,
  estrella,
  filete,
  filtroAcuarela,
  flor,
  fondoLiso,
  grano,
  manchaAcuarela,
  paginas,
  rama,
  svg,
  type Rect,
} from "../dibujo";
import { textosClasicos, zonaClasica } from "../textos";

/*
 * Estilos para libros de familia: la sesión en el parque, el álbum del año, los abuelos, la
 * Navidad. Las piezas que no están en `dibujo.ts` (árboles, barriletes, cintas, vichy, arcos
 * setentosos…) están acá abajo, también en milímetros y con azar de semilla fija.
 */

const n = (x: number) => Math.round(x * 100) / 100;
/** El lado chico de una página: la vara para medir todos los adornos. */
const ladoChico = (m: Medidas) => Math.min(m.anchoMm / 2, m.altoMm);
const esTitulo = (t: TipoPliego) => t === "apertura" || t === "cierre";

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

/** Un corazón relleno, centrado en (x, y). */
function corazon(x: number, y: number, t: number, color: string, giro = 0, opacidad = 1): string {
  const p = (a: number) => n(a * t);
  return `<path d="M0 ${p(0.35)} C ${p(-0.12)} ${p(0.25)} ${p(-0.5)} ${p(0.02)} ${p(-0.5)} ${p(-0.2)} C ${p(-0.5)} ${p(-0.45)} ${p(-0.15)} ${p(-0.52)} 0 ${p(-0.26)} C ${p(0.15)} ${p(-0.52)} ${p(0.5)} ${p(-0.45)} ${p(0.5)} ${p(-0.2)} C ${p(0.5)} ${p(0.02)} ${p(0.12)} ${p(0.25)} 0 ${p(0.35)} Z" fill="${color}" opacity="${opacidad}" transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"/>`;
}

/** Corazón dibujado a mano: sólo el trazo. */
function corazonTrazo(x: number, y: number, t: number, color: string, grosor: number, giro = 0): string {
  return corazon(x, y, t, "none", giro).replace('fill="none"', `fill="none" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round"`);
}

/** Árbol de plaza: tronco y copa redonda en tres bollos. */
function arbolRedondo(x: number, base: number, alto: number, copa: string, copa2: string, tronco: string): string {
  const a = alto;
  return (
    `<path d="M ${n(x - a * 0.04)} ${n(base)} L ${n(x - a * 0.025)} ${n(base - a * 0.55)} L ${n(x + a * 0.025)} ${n(base - a * 0.55)} L ${n(x + a * 0.04)} ${n(base)} Z" fill="${tronco}"/>` +
    `<circle cx="${n(x - a * 0.14)}" cy="${n(base - a * 0.58)}" r="${n(a * 0.2)}" fill="${copa2}"/>` +
    `<circle cx="${n(x + a * 0.15)}" cy="${n(base - a * 0.6)}" r="${n(a * 0.19)}" fill="${copa2}"/>` +
    `<circle cx="${n(x)}" cy="${n(base - a * 0.74)}" r="${n(a * 0.26)}" fill="${copa}"/>`
  );
}

/** Una nube de dibujo animado, con base plana. */
function nube(x: number, y: number, ancho: number, color: string, opacidad = 1): string {
  const w = ancho;
  return `<g opacity="${opacidad}" fill="${color}"><rect x="${n(x - w / 2)}" y="${n(y - w * 0.12)}" width="${n(w)}" height="${n(w * 0.12)}" rx="${n(w * 0.06)}"/><circle cx="${n(x - w * 0.2)}" cy="${n(y - w * 0.12)}" r="${n(w * 0.16)}"/><circle cx="${n(x + w * 0.08)}" cy="${n(y - w * 0.18)}" r="${n(w * 0.22)}"/><circle cx="${n(x + w * 0.3)}" cy="${n(y - w * 0.1)}" r="${n(w * 0.12)}"/></g>`;
}

/** Sol con rayitos. */
function sol(cx: number, cy: number, r: number, color: string, rayos = 12): string {
  let out = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${color}"/>`;
  for (let i = 0; i < rayos; i++) {
    const a = (i * 2 * Math.PI) / rayos;
    out += `<line x1="${n(cx + Math.cos(a) * r * 1.3)}" y1="${n(cy + Math.sin(a) * r * 1.3)}" x2="${n(cx + Math.cos(a) * r * 1.65)}" y2="${n(cy + Math.sin(a) * r * 1.65)}" stroke="${color}" stroke-width="${n(r * 0.12)}" stroke-linecap="round"/>`;
  }
  return out;
}

/** Barrilete de cuatro colores con su cola de moños. */
function barrilete(x: number, y: number, t: number, colores: [string, string, string, string], hilo: string, giro = 0): string {
  const w = t * 0.5;
  const h = t * 0.7;
  const cy = -h * 0.3;
  let out = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})">`;
  out += `<path d="M0 ${n(-h * 0.5)} L ${n(w)} ${n(cy)} L 0 0 Z" fill="${colores[0]}"/>`;
  out += `<path d="M0 ${n(-h * 0.5)} L ${n(-w)} ${n(cy)} L 0 0 Z" fill="${colores[1]}"/>`;
  out += `<path d="M ${n(-w)} ${n(cy)} L 0 ${n(h * 0.5)} L 0 0 Z" fill="${colores[2]}"/>`;
  out += `<path d="M ${n(w)} ${n(cy)} L 0 ${n(h * 0.5)} L 0 0 Z" fill="${colores[3]}"/>`;
  out += `<path d="M 0 ${n(h * 0.5)} q ${n(t * 0.15)} ${n(t * 0.25)} 0 ${n(t * 0.5)} t 0 ${n(t * 0.5)}" stroke="${hilo}" stroke-width="${n(t * 0.015)}" fill="none"/>`;
  for (let i = 1; i <= 3; i++) {
    const by = h * 0.5 + t * 0.25 * i;
    out += `<path d="M ${n(-t * 0.06)} ${n(by - t * 0.04)} L ${n(t * 0.06)} ${n(by + t * 0.04)} L ${n(t * 0.06)} ${n(by - t * 0.04)} L ${n(-t * 0.06)} ${n(by + t * 0.04)} Z" fill="${colores[i % 4]}"/>`;
  }
  return `${out}</g>`;
}

/** Pájaro en vuelo: dos arquitos. */
function pajaro(x: number, y: number, t: number, color: string): string {
  return `<path d="M ${n(x - t)} ${n(y)} q ${n(t * 0.5)} ${n(-t * 0.55)} ${n(t)} 0 q ${n(t * 0.5)} ${n(-t * 0.55)} ${n(t)} 0" stroke="${color}" stroke-width="${n(t * 0.12)}" fill="none" stroke-linecap="round"/>`;
}

/** Cinta washi: una tira translúcida con las puntas cortadas en zigzag y rayitas. */
function cintaWashi(x: number, y: number, largo: number, ancho: number, giro: number, color: string, raya: string): string {
  const L = largo / 2;
  const A = ancho / 2;
  const d = ancho / 6;
  let p = `M ${n(-L)} ${n(-A)} L ${n(L)} ${n(-A)}`;
  for (let i = 0; i < 6; i++) p += ` L ${n(L + (i % 2 === 0 ? -d : 0))} ${n(-A + (i + 1) * (ancho / 6))}`;
  p += ` L ${n(-L)} ${n(A)}`;
  for (let i = 0; i < 6; i++) p += ` L ${n(-L + (i % 2 === 0 ? d : 0))} ${n(A - (i + 1) * (ancho / 6))}`;
  let rayas = "";
  for (let xx = -L + ancho * 0.4; xx < L - ancho * 0.3; xx += ancho * 0.45) {
    rayas += `<line x1="${n(xx)}" y1="${n(-A)}" x2="${n(xx + ancho * 0.3)}" y2="${n(A)}" stroke="${raya}" stroke-width="${n(ancho * 0.12)}" opacity="0.55"/>`;
  }
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(giro)})"><path d="${p} Z" fill="${color}" opacity="0.82"/>${rayas}</g>`;
}

/** Guirnalda de banderines colgando entre dos puntos. */
function banderines(x1: number, y1: number, x2: number, y2: number, cantidad: number, colores: string[], tam: number, hilo: string): string {
  const cx = (x1 + x2) / 2;
  const cy = Math.max(y1, y2) + tam * 0.9;
  let out = `<path d="M ${n(x1)} ${n(y1)} Q ${n(cx)} ${n(cy)} ${n(x2)} ${n(y2)}" stroke="${hilo}" stroke-width="${n(tam * 0.04)}" fill="none"/>`;
  for (let i = 0; i < cantidad; i++) {
    const t = (i + 0.5) / cantidad;
    const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    out += `<path d="M ${n(px - tam * 0.38)} ${n(py)} L ${n(px + tam * 0.38)} ${n(py)} L ${n(px)} ${n(py + tam)} Z" fill="${colores[i % colores.length]}"/>`;
  }
  return out;
}

/** Arcos concéntricos setentosos desde un punto (en general una esquina del pliego). */
function arcosRetro(cx: number, cy: number, radio: number, colores: string[]): string {
  return colores
    .map((c, i) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radio * (1 - i / colores.length))}" fill="${c}"/>`)
    .join("");
}

/** Árbol de familia: tronco que sube por el borde y ramas con hojas que se abren por arriba. */
function arbolFamilia(p: Rect, s: number, hoja: string, hoja2: string, tronco: string, semilla: number): string {
  const rnd = azar(semilla);
  const x = p.x + s * 0.06;
  const alto = p.h * 0.97;
  const yTop = p.h - alto;
  let out = `<path d="M ${n(x - s * 0.028)} ${n(p.h)} C ${n(x - s * 0.01)} ${n(p.h - alto * 0.4)} ${n(x - s * 0.02)} ${n(yTop + alto * 0.3)} ${n(x + s * 0.01)} ${n(yTop)} L ${n(x + s * 0.016)} ${n(yTop + s * 0.01)} C ${n(x + s * 0.008)} ${n(yTop + alto * 0.35)} ${n(x + s * 0.02)} ${n(p.h - alto * 0.4)} ${n(x + s * 0.03)} ${n(p.h)} Z" fill="${tronco}"/>`;
  const ramas = 7;
  for (let i = 0; i < ramas; i++) {
    const t = i / (ramas - 1);
    const y0 = yTop + p.h * (0.01 + t * 0.17);
    const largo = s * (0.3 - t * 0.14) * (0.85 + rnd() * 0.3);
    const ang = -6 + t * 18 + (rnd() - 0.5) * 6;
    out += rama(x, y0, largo, ang, i % 2 ? hoja2 : hoja, semilla + i * 7, { hojas: 10, tallo: tronco, tamHoja: s * 0.05 });
  }
  // Un par de ramitas hacia afuera, para que el árbol no quede de un solo lado.
  out += rama(x, yTop + p.h * 0.05, s * 0.1, -120, hoja2, semilla + 99, { hojas: 6, tallo: tronco, tamHoja: s * 0.04 });
  out += rama(x, yTop + p.h * 0.15, s * 0.08, -150, hoja, semilla + 77, { hojas: 5, tallo: tronco, tamHoja: s * 0.04 });
  return out;
}

/** Defs de un vichy (mantel de picnic) en milímetros. */
const patronVichy = (id: string, paso: number, color: string) =>
  `<pattern id="${id}" width="${n(paso)}" height="${n(paso)}" patternUnits="userSpaceOnUse"><rect width="${n(paso)}" height="${n(paso)}" fill="#ffffff"/><rect width="${n(paso)}" height="${n(paso / 2)}" fill="${color}" opacity="0.45"/><rect width="${n(paso / 2)}" height="${n(paso)}" fill="${color}" opacity="0.45"/></pattern>`;

/** Una franja de vichy con el borde de festones (puntillas) hacia adentro de la página. */
function franjaVichy(x: number, y: number, ancho: number, alto: number, hacia: "abajo" | "arriba", patron: string): string {
  const cant = Math.max(4, Math.round(ancho / (alto * 0.55)));
  const r = ancho / cant / 2;
  if (hacia === "abajo") {
    let d = `M ${n(x)} ${n(y)} L ${n(x + ancho)} ${n(y)} L ${n(x + ancho)} ${n(y + alto)}`;
    for (let i = 0; i < cant; i++) d += ` A ${n(r)} ${n(r)} 0 0 1 ${n(x + ancho - (i + 1) * 2 * r)} ${n(y + alto)}`;
    return `<path d="${d} Z" fill="url(#${patron})"/>`;
  }
  let d = `M ${n(x)} ${n(y + alto)} L ${n(x + ancho)} ${n(y + alto)} L ${n(x + ancho)} ${n(y)}`;
  for (let i = 0; i < cant; i++) d += ` A ${n(r)} ${n(r)} 0 0 0 ${n(x + ancho - (i + 1) * 2 * r)} ${n(y)}`;
  return `<path d="${d} Z" fill="url(#${patron})"/>`;
}

/** Lomas suaves de punta a punta del pliego, desde abajo. */
function lomas(m: Medidas, alto: number, color: string, semilla: number, ondas = 3): string {
  const rnd = azar(semilla);
  const base = m.altoMm;
  const paso = m.anchoMm / ondas;
  let d = `M 0 ${n(base - alto * (0.5 + rnd() * 0.3))}`;
  for (let i = 0; i < ondas; i++) {
    const x2 = (i + 1) * paso;
    const y2 = base - alto * (0.45 + rnd() * 0.4);
    d += ` S ${n(x2 - paso * 0.5)} ${n(base - alto * (0.9 + rnd() * 0.1))} ${n(x2)} ${n(y2)}`;
  }
  return `<path d="${d} L ${n(m.anchoMm)} ${n(base)} L 0 ${n(base)} Z" fill="${color}"/>`;
}

/** Lo que suben las lomas de la hora dorada: más en la apertura y el cierre. */
const altoLomas = (tipo: TipoPliego, m: Medidas) => ladoChico(m) * (esTitulo(tipo) ? 0.17 : 0.16);

/** Una rama de pino: tallo con agujas finitas. */
const ramaPino = (x: number, y: number, largo: number, ang: number, color: string, semilla: number, tallo: string) =>
  rama(x, y, largo, ang, color, semilla, { hojas: 22, tamHoja: largo * 0.16, anchoHoja: 0.12, tallo });

/** Racimo de bolitas rojas (acebo / muérdago). */
function bayas(x: number, y: number, r: number, color: string, brillo: string): string {
  const pos = [
    [0, 0],
    [r * 1.7, r * 0.5],
    [r * 0.6, r * 1.7],
  ];
  return pos
    .map(([dx, dy]) => `<circle cx="${n(x + dx!)}" cy="${n(y + dy!)}" r="${n(r)}" fill="${color}"/><circle cx="${n(x + dx! - r * 0.3)}" cy="${n(y + dy! - r * 0.3)}" r="${n(r * 0.28)}" fill="${brillo}" opacity="0.7"/>`)
    .join("");
}

/** Estrellita de dibujo a mano (cinco puntas, sólo trazo). */
function estrellaTrazo(x: number, y: number, r: number, color: string, grosor: number, giro = 0): string {
  return estrella(x, y, r, "none", giro).replace('fill="none"', `fill="none" stroke="${color}" stroke-width="${n(grosor)}" stroke-linejoin="round"`);
}

// ---------- Los estilos ----------

export const FAMILIA: EstiloFotolibro[] = [
  {
    id: "familia-01-acuarela-calida",
    tema: "familia",
    nombre: "Acuarela cálida",
    descripcion: "Manchas de acuarela durazno, celeste y manteca, con corazoncitos. Ideal para el álbum del año.",
    papel: "#fdf8f3",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const g = grano("g", m, 0.05);
      const k = esTitulo(tipo) ? 1.7 : 1.3;
      const alt = tipo === "interior-alt";
      // Las esquinas pintadas: arriba-izquierda y abajo-derecha, o al revés en el interior alternativo.
      const a = alt ? { x: izq.x, y: izq.h } : { x: izq.x, y: 0 };
      const b = alt ? { x: der.x + der.w, y: 0 } : { x: der.x + der.w, y: der.h };
      const sy = (y: number) => (y === 0 ? 1 : -1);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fdf8f3");
      c += manchaAcuarela(a.x + s * 0.04, a.y + sy(a.y) * s * 0.04, s * 0.2 * k, "#f4a988", "a", 4);
      c += manchaAcuarela(a.x + s * 0.2 * k, a.y + sy(a.y) * s * 0.02, s * 0.1 * k, "#9cc3d5", "a", 8, 2);
      c += manchaAcuarela(b.x - s * 0.04, b.y + sy(b.y) * s * 0.04, s * 0.2 * k, "#f2d27c", "a", 11);
      c += manchaAcuarela(b.x - s * 0.03, b.y + sy(b.y) * s * 0.2 * k, s * 0.1 * k, "#f4a988", "a", 14, 2);
      c += corazon(a.x + s * 0.2 * k, a.y + sy(a.y) * s * 0.12 * k, s * 0.03, "#e98a6b", -12, 0.8);
      c += corazon(a.x + s * 0.27 * k, a.y + sy(a.y) * s * 0.06, s * 0.018, "#7fb0c9", 15, 0.8);
      c += corazon(b.x - s * 0.18 * k, b.y + sy(b.y) * s * 0.1 * k, s * 0.025, "#e98a6b", 10, 0.8);
      if (tipo === "apertura") c += corazon(izq.x + izq.w / 2, izq.h * 0.24, s * 0.035, "#f4a988", 0, 0.85);
      return svg(m, c + g.cuerpo, filtroAcuarela("a", 5) + g.defs);
    },
    zona: zonaRel({ arriba: 0.07, abajo: 0.07, exterior: 0.03 }),
    textos: textosClasicos({
      titulo: "Dancing Script",
      texto: "Nunito",
      color: "#7a4a3a",
      acento: "#c9775a",
      ejemplos: { titulo: "Familia Rodríguez", subtitulo: "Nuestro año", fecha: "2026", frase: "Lo mejor de la vida es estar juntos" },
    }),
  },
  {
    id: "familia-02-domingo-en-el-parque",
    tema: "familia",
    nombre: "Domingo en el parque",
    descripcion: "Ilustración alegre: pasto, árboles de plaza, nubes y un barrilete. Para sesiones al aire libre.",
    papel: "#fbf9f1",
    margenMm: 14,
    esquinasMm: 2,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const pasto = s * 0.07;
      const base = m.altoMm - pasto * 0.55;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fbf9f1");
      // El pasto: una franja con matas redondeadas arriba.
      const matas = Math.max(6, Math.round(m.anchoMm / (s * 0.08)));
      const r = m.anchoMm / matas / 2;
      let d = `M 0 ${n(m.altoMm)} L 0 ${n(m.altoMm - pasto * 0.7)}`;
      for (let i = 0; i < matas; i++) d += ` A ${n(r)} ${n(r * 0.6)} 0 0 1 ${n((i + 1) * 2 * r)} ${n(m.altoMm - pasto * 0.7)}`;
      c += `<path d="${d} L ${n(m.anchoMm)} ${n(m.altoMm)} Z" fill="#a8cf7f"/>`;
      c += `<rect x="0" y="${n(m.altoMm - pasto * 0.45)}" width="${n(m.anchoMm)}" height="${n(pasto * 0.45)}" fill="#86b85e"/>`;
      // Árboles en los bordes de afuera.
      const altoArbol = s * (esTitulo(tipo) ? 0.34 : 0.26);
      if (tipo !== "interior-alt") {
        c += arbolRedondo(izq.x + s * 0.09, base, altoArbol, "#5f9e47", "#7cb35d", "#8d6e4f");
        c += arbolRedondo(der.x + der.w - s * 0.08, base, altoArbol * 0.8, "#7cb35d", "#5f9e47", "#8d6e4f");
      } else {
        c += arbolRedondo(der.x + der.w - s * 0.09, base, altoArbol, "#5f9e47", "#7cb35d", "#8d6e4f");
        c += flor(izq.x + s * 0.06, base - s * 0.01, s * 0.018, "#f28f8f", "#f6c344", 5);
        c += flor(izq.x + s * 0.11, base + s * 0.005, s * 0.014, "#ffffff", "#f6c344", 5);
      }
      if (tipo === "apertura") {
        c += sol(izq.x + izq.w - s * 0.12, s * 0.11, s * 0.045, "#f6c344");
        c += barrilete(izq.x + s * 0.18, s * 0.1, s * 0.13, ["#e85d5d", "#f6c344", "#4fa3d9", "#7cc47f"], "#8a8a8a", -14);
        c += nube(der.x + der.w - s * 0.16, s * 0.09, s * 0.16, "#dcebf5");
      } else if (tipo === "cierre") {
        c += sol(der.x + der.w - s * 0.1, s * 0.09, s * 0.04, "#f6c344");
        c += nube(izq.x + s * 0.15, s * 0.08, s * 0.14, "#dcebf5");
      } else if (tipo === "interior-alt") {
        c += nube(izq.x + s * 0.13, s * 0.07, s * 0.12, "#dcebf5");
        c += pajaro(der.x + der.w * 0.5, s * 0.05, s * 0.012, "#6b7b8c") + pajaro(der.x + der.w * 0.5 + s * 0.035, s * 0.065, s * 0.009, "#6b7b8c");
      }
      return svg(m, c);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const z = zonaRel({ abajo: 0.06 })(tipo, lado, m);
      const conArbol = tipo === "interior-alt" ? lado === "der" : true;
      return { ...z, exterior: conArbol ? n(s * 0.16) : n(s * 0.03), arriba: z.arriba ?? n(s * (tipo === "interior-alt" ? 0.07 : 0.02)) };
    },
    textos: textosClasicos({
      titulo: "Kalam",
      texto: "Quicksand",
      color: "#3d5a3a",
      acento: "#5f9e47",
      ejemplos: { titulo: "Familia Gómez", subtitulo: "Un domingo en el parque", fecha: "Abril 2026", frase: "Los mejores planes son los más simples" },
    }),
  },
  {
    id: "familia-03-navidad-en-familia",
    tema: "familia",
    nombre: "Navidad en familia",
    descripcion: "Verde pino, ramas de abeto, bayas rojas y estrellas doradas. Para la cena del 24 y los regalos.",
    papel: "#1f3b2d",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const fondo = degradado("v", total, "#1d3a2b", "#16301f");
      const g = grano("g", m, 0.06);
      const k = esTitulo(tipo) ? 1 : 0.75;
      const esquina = (x: number, y: number, dir: 1 | -1, sy: 1 | -1, sem: number) => {
        const base = dir === 1 ? (sy === 1 ? 20 : -20) : sy === 1 ? 160 : -160;
        let o = "";
        for (let i = 0; i < 4; i++) {
          const ang = base + dir * sy * (i * 16 - 12);
          o += ramaPino(x, y, s * (0.24 + (i % 2) * 0.08) * k, ang, i % 2 ? "#4b7d55" : "#2f5e3f", sem + i * 5, "#5a3d27");
        }
        o += bayas(x + dir * s * 0.05 * k, y + sy * s * 0.05 * k, s * 0.012, "#c0392b", "#ffffff");
        o += bayas(x + dir * s * 0.11 * k, y + sy * s * 0.02 * k, s * 0.01, "#c0392b", "#ffffff");
        o += estrella(x + dir * s * 0.17 * k, y + sy * s * 0.12 * k, s * 0.018, "#e3c27a", 10);
        return o;
      };
      let c = fondo.cuerpo;
      c += estrellas(total, s, tipo === "apertura" || tipo === "cierre" ? 60 : 26, 41);
      if (tipo === "interior-alt") {
        c += esquina(izq.x, izq.h, 1, -1, 3) + esquina(der.x + der.w, der.h, -1, -1, 9);
      } else {
        c += esquina(izq.x, 0, 1, 1, 3) + esquina(der.x + der.w, 0, -1, 1, 9);
        if (tipo !== "interior") c += esquina(izq.x, izq.h, 1, -1, 13) + esquina(der.x + der.w, der.h, -1, -1, 17);
      }
      return svg(m, c + g.cuerpo, fondo.defs + g.defs);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const arriba = tipo === "interior-alt" ? 0.02 : 0.1;
      const abajo = tipo === "interior" ? 0.02 : 0.1;
      return { ...zonaRel({ arriba, abajo: tipo === "interior" ? abajo : (lado === "izq" && tipo === "apertura") || (lado === "der" && tipo === "cierre") ? 0.07 : abajo, exterior: 0.06 })(tipo, lado, m), interior: n(s * 0.01) };
    },
    textos: textosClasicos({
      titulo: "Great Vibes",
      texto: "Lora",
      color: "#e3c27a",
      acento: "#f3ead8",
      ejemplos: { titulo: "Navidad en familia", subtitulo: "Los Fernández", fecha: "24 · 12 · 2026", frase: "Que nunca falte un lugar más en la mesa" },
    }),
  },
  {
    id: "familia-04-recuerdos-de-los-abuelos",
    tema: "familia",
    nombre: "Recuerdos de los abuelos",
    descripcion: "Papel envejecido color sepia, doble filete y esquineros, como el álbum de la abuela.",
    papel: "#efe2c8",
    margenMm: 18,
    esquinasMm: 0,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const g = grano("g", m, 0.14, 1.2);
      // Viñeta: cada página más oscura en los bordes, como papel que vio pasar los años.
      const defs = `<radialGradient id="vin" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#efe2c8"/><stop offset="1" stop-color="#d4bc90"/></radialGradient>`;
      let c = `<rect x="${n(izq.x)}" y="0" width="${n(izq.w)}" height="${n(izq.h)}" fill="url(#vin)"/><rect x="${n(der.x)}" y="0" width="${n(der.w)}" height="${n(der.h)}" fill="url(#vin)"/>`;
      for (const p of [izq, der]) {
        c += filete(p, s * 0.04, "#7a5a36", 0.5) + filete(p, s * 0.052, "#7a5a36", 0.22);
        c += esquineros(p, s * 0.066, s * 0.07, "#7a5a36", 0.4);
      }
      // Un adorno chiquito de flor con hojas, centrado abajo de la página del título.
      const adorno = (cx: number, cy: number) =>
        rama(cx - s * 0.015, cy, s * 0.09, 180, "#8a6a42", 4, { hojas: 6, tamHoja: s * 0.02 }) +
        rama(cx + s * 0.015, cy, s * 0.09, 0, "#8a6a42", 5, { hojas: 6, tamHoja: s * 0.02 }) +
        flor(cx, cy, s * 0.016, "#a8774a", "#5a3e22", 6);
      if (tipo === "apertura") c += adorno(izq.x + izq.w / 2, izq.h * 0.25);
      if (tipo === "cierre") c += adorno(der.x + der.w / 2, der.h * 0.1);
      if (tipo === "interior-alt") c += adorno(der.x + der.w / 2, der.h - s * 0.045);
      return svg(m, c + g.cuerpo, defs + g.defs);
    },
    zona: (tipo, lado, m) => {
      const z = zonaRel({ arriba: 0.04, abajo: 0.05, exterior: 0.03, interior: 0.02 })(tipo, lado, m);
      if (tipo === "cierre" && lado === "der") return { ...z, arriba: m.altoMm * 0.32 };
      return z;
    },
    textos: (tipo, m) =>
      textosClasicos({
        titulo: "Homemade Apple",
        texto: "Libre Baskerville",
        color: "#5a3e22",
        acento: "#7a5a36",
        escalaTitulo: 0.085,
        ejemplos: { titulo: "Los abuelos", subtitulo: "Elsa y Roberto", fecha: "50 años juntos", frase: "Todo lo que somos empezó con ellos" },
      })(tipo, m).map((t) => (t.rol === "frase" ? { ...t, y: m.altoMm * 0.14 } : t)),
  },
  {
    id: "familia-05-nordico",
    tema: "familia",
    nombre: "Nórdico",
    descripcion: "Geometría escandinava: círculos mostaza y rosa viejo, líneas finas y mucho blanco.",
    papel: "#f3efe9",
    margenMm: 14,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f3efe9");
      const linea = (x1: number, y1: number, x2: number, y2: number) =>
        `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#2f2f2f" stroke-width="0.35"/>`;
      if (tipo === "apertura") {
        c += `<circle cx="${n(izq.x + izq.w * 0.5)}" cy="${n(izq.h * 0.42)}" r="${n(Math.min(izq.w, izq.h) * 0.33)}" fill="#ecd6c6"/>`;
        c += `<circle cx="${n(izq.x)}" cy="${n(izq.h)}" r="${n(s * 0.2)}" fill="#e0b04a"/>`;
        c += `<circle cx="${n(der.x + der.w)}" cy="0" r="${n(s * 0.12)}" fill="#3a3a3a"/>`;
      } else if (tipo === "interior") {
        c += `<circle cx="${n(izq.x)}" cy="0" r="${n(s * 0.13)}" fill="#e0b04a"/>`;
        c += `<path d="M ${n(der.x + der.w)} ${n(der.h - s * 0.16)} A ${n(s * 0.16)} ${n(s * 0.16)} 0 0 0 ${n(der.x + der.w - s * 0.16)} ${n(der.h)} L ${n(der.x + der.w)} ${n(der.h)} Z" fill="#e8b9a8"/>`;
      } else if (tipo === "interior-alt") {
        c += `<circle cx="${n(izq.x)}" cy="${n(izq.h)}" r="${n(s * 0.13)}" fill="#e8b9a8"/>`;
        c += `<circle cx="${n(der.x + der.w)}" cy="0" r="${n(s * 0.09)}" fill="#3a3a3a"/>`;
        c += `<circle cx="${n(der.x + der.w - s * 0.09)}" cy="${n(s * 0.12)}" r="${n(s * 0.025)}" fill="#e0b04a"/>`;
      } else {
        c += `<circle cx="${n(der.x + der.w * 0.5)}" cy="${n(der.h * 0.04)}" r="${n(s * 0.2)}" fill="#ecd6c6"/>`;
        c += `<circle cx="${n(izq.x)}" cy="${n(izq.h)}" r="${n(s * 0.12)}" fill="#e0b04a"/>`;
      }
      // Las líneas finas que dan el aire "de revista".
      c += linea(izq.x + s * 0.05, izq.h - s * 0.035, izq.x + izq.w * 0.45, izq.h - s * 0.035);
      c += linea(der.x + der.w * 0.55, s * 0.035, der.x + der.w - s * 0.05, s * 0.035);
      return svg(m, c);
    },
    zona: zonaRel({ arriba: 0.07, abajo: 0.07, exterior: 0.04 }),
    textos: textosClasicos({
      titulo: "Montserrat",
      texto: "DM Sans",
      color: "#2f2f2f",
      acento: "#a8752a",
      escalaTitulo: 0.075,
      ejemplos: { titulo: "Familia Pereyra", subtitulo: "Sesión de fotos", fecha: "Otoño 2026", frase: "Hogar es donde estamos todos" },
    }),
  },
  {
    id: "familia-06-scrapbook-kraft",
    tema: "familia",
    nombre: "Scrapbook kraft",
    descripcion: "Papel madera, cintas washi, banderines y dibujitos a mano. Tiene onda de cuaderno de recuerdos.",
    papel: "#cfb48c",
    margenMm: 16,
    esquinasMm: 1,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const fondo = degradado("k", { x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#d6bd96", "#c9ac82");
      const g = grano("g", m, 0.18, 1.2);
      const tinta = "#4a3424";
      const t = s * 0.005 + 0.3;
      let c = fondo.cuerpo;
      const colores = ["#e98a6b", "#f2d27c", "#8fb9a8", "#f3efe4"];
      if (tipo === "apertura") {
        c += banderines(izq.x + s * 0.05, s * 0.04, izq.x + izq.w - s * 0.05, s * 0.04, 9, colores, s * 0.07, tinta);
        c += cintaWashi(der.x + der.w - s * 0.06, s * 0.06, s * 0.3, s * 0.075, 40, "#8fb9a8", "#ffffff");
        c += cintaWashi(der.x + s * 0.06, der.h - s * 0.06, s * 0.3, s * 0.075, 40, "#e98a6b", "#ffffff");
        c += corazonTrazo(izq.x + izq.w / 2, izq.h * 0.22, s * 0.07, tinta, t);
      } else if (tipo === "cierre") {
        c += banderines(der.x + s * 0.05, s * 0.04, der.x + der.w - s * 0.05, s * 0.04, 9, colores, s * 0.07, tinta);
        c += cintaWashi(izq.x + s * 0.06, s * 0.06, s * 0.3, s * 0.075, -40, "#f2d27c", "#ffffff");
        c += cintaWashi(izq.x + izq.w - s * 0.06, izq.h - s * 0.06, s * 0.3, s * 0.075, -40, "#8fb9a8", "#ffffff");
      } else if (tipo === "interior") {
        c += cintaWashi(izq.x + s * 0.06, s * 0.06, s * 0.3, s * 0.075, -40, "#e98a6b", "#ffffff");
        c += cintaWashi(der.x + der.w - s * 0.06, der.h - s * 0.06, s * 0.3, s * 0.075, -40, "#f2d27c", "#ffffff");
        c += estrellaTrazo(izq.x + s * 0.05, izq.h - s * 0.05, s * 0.045, tinta, t, 8);
        c += corazonTrazo(der.x + der.w - s * 0.05, s * 0.05, s * 0.06, tinta, t, 10);
      } else {
        c += cintaWashi(izq.x + s * 0.06, izq.h - s * 0.06, s * 0.3, s * 0.075, 40, "#8fb9a8", "#ffffff");
        c += cintaWashi(der.x + der.w - s * 0.06, s * 0.06, s * 0.3, s * 0.075, 40, "#e98a6b", "#ffffff");
        c += estrellaTrazo(izq.x + s * 0.05, s * 0.05, s * 0.04, tinta, t, -8) + estrellaTrazo(izq.x + s * 0.12, s * 0.035, s * 0.025, tinta, t, 20);
        c += corazonTrazo(der.x + s * 0.06, der.h - s * 0.05, s * 0.055, tinta, t, -10);
      }
      return svg(m, c + g.cuerpo, fondo.defs + g.defs);
    },
    zona: zonaRel({ arriba: 0.07, abajo: 0.07, exterior: 0.04 }),
    textos: textosClasicos({
      titulo: "Caveat",
      texto: "Patrick Hand",
      color: "#3b2a1a",
      acento: "#7a4a2f",
      escalaTitulo: 0.12,
      ejemplos: { titulo: "Los Martínez", subtitulo: "Momentos de familia", fecha: "2026", frase: "Juntos es nuestro lugar favorito" },
    }),
  },
  {
    id: "familia-07-retro-setentas",
    tema: "familia",
    nombre: "Retro setentas",
    descripcion: "Arcos concéntricos en terracota, mostaza y marrón, con letra redondita. Cálido y con mucha onda.",
    papel: "#f6ead7",
    margenMm: 14,
    esquinasMm: 3,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const colores = ["#7a3b1f", "#c4683f", "#e0a43b", "#f0cf8a", "#f6ead7"];
      const k = esTitulo(tipo) ? 0.32 : 0.22;
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f6ead7");
      if (tipo === "interior-alt") {
        c += arcosRetro(izq.x, izq.h, s * k, colores) + arcosRetro(der.x + der.w, 0, s * k, colores);
      } else {
        c += arcosRetro(izq.x, 0, s * k, colores) + arcosRetro(der.x + der.w, der.h, s * k, colores);
      }
      if (tipo === "apertura") {
        // Un sol a medio salir debajo del título.
        c += `<path d="M ${n(izq.x + izq.w / 2 - s * 0.1)} ${n(izq.h * 0.25)} A ${n(s * 0.1)} ${n(s * 0.1)} 0 0 1 ${n(izq.x + izq.w / 2 + s * 0.1)} ${n(izq.h * 0.25)} Z" fill="#e0a43b"/>`;
        c += `<rect x="${n(izq.x + izq.w / 2 - s * 0.14)}" y="${n(izq.h * 0.25)}" width="${n(s * 0.28)}" height="${n(s * 0.008)}" fill="#7a3b1f"/>`;
      }
      return svg(m, c);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const k = esTitulo(tipo) ? 0.2 : 0.14;
      return { ...zonaRel({ arriba: 0.04, abajo: 0.04 })(tipo, lado, m), exterior: n(s * k) };
    },
    textos: textosClasicos({
      titulo: "Pacifico",
      texto: "Rubik",
      color: "#7a3b1f",
      acento: "#c4683f",
      escalaTitulo: 0.085,
      ejemplos: { titulo: "Familia Sosa", subtitulo: "Así somos", fecha: "Verano 2026", frase: "Nuestra familia, nuestra tribu" },
    }),
  },
  {
    id: "familia-08-arbol-de-familia",
    tema: "familia",
    nombre: "Árbol de familia",
    descripcion: "Un árbol que crece por el borde y abre sus ramas sobre el título. Para libros de generaciones.",
    papel: "#f7f4ec",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const g = grano("g", m, 0.05);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#f7f4ec");
      if (tipo === "apertura") {
        c += arbolFamilia(izq, s, "#6f8a4e", "#9db27a", "#7a5c3e", 11);
        c += pajaro(der.x + der.w - s * 0.12, s * 0.06, s * 0.014, "#7a5c3e") + pajaro(der.x + der.w - s * 0.08, s * 0.08, s * 0.01, "#7a5c3e");
      } else if (tipo === "cierre") {
        c += espejar(der, arbolFamilia(der, s, "#6f8a4e", "#9db27a", "#7a5c3e", 23));
      } else {
        const arriba = tipo === "interior";
        const y = arriba ? s * 0.03 : m.altoMm - s * 0.03;
        c += rama(izq.x + s * 0.02, y, s * 0.24, arriba ? 18 : -18, "#6f8a4e", 5, { hojas: 9, tallo: "#7a5c3e" });
        c += rama(der.x + der.w - s * 0.02, arriba ? m.altoMm - s * 0.03 : s * 0.03, s * 0.24, arriba ? -162 : 162, "#9db27a", 8, { hojas: 9, tallo: "#7a5c3e" });
      }
      return svg(m, c + g.cuerpo, g.defs);
    },
    zona: (tipo, lado, m) => {
      const s = ladoChico(m);
      const z = zonaRel({ arriba: 0.08, abajo: 0.08 })(tipo, lado, m);
      const conArbol = (tipo === "apertura" && lado === "izq") || (tipo === "cierre" && lado === "der");
      if (tipo === "cierre" && lado === "der") return { ...z, exterior: n(s * 0.1), arriba: m.altoMm * 0.38 };
      return conArbol ? { ...z, exterior: n(s * 0.1) } : z;
    },
    textos: (tipo, m) => {
      const base = textosClasicos({
        titulo: "Playfair Display",
        texto: "Raleway",
        color: "#3f4a30",
        acento: "#6f8a4e",
        escalaTitulo: 0.085,
        ejemplos: { titulo: "Nuestras raíces", subtitulo: "Familia Acosta", fecha: "Desde 1958", frase: "Una familia es un árbol que no deja de crecer" },
      })(tipo, m);
      // Los títulos se corren un poco hacia adentro, para dejarle lugar al tronco.
      const w = m.anchoMm / 2;
      return base.map((t) =>
        t.rol === "frase"
          ? { ...t, x: w + w * 0.06, w: w * 0.8, y: m.altoMm * 0.25, italica: true }
          : { ...t, x: t.x + w * 0.06, italica: t.rol === "titulo" },
      );
    },
  },
  {
    id: "familia-09-picnic-vichy",
    tema: "familia",
    nombre: "Picnic vichy",
    descripcion: "Mantel cuadrillé rojo con puntilla y margaritas. Para pícnics, quintas y sobremesas largas.",
    papel: "#fffdf8",
    margenMm: 14,
    esquinasMm: 1.5,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const banda = s * (esTitulo(tipo) ? 0.09 : 0.075);
      let c = fondoLiso({ x: 0, y: 0, w: m.anchoMm, h: m.altoMm }, "#fffdf8");
      const margaritas = (x: number, y: number, sem: number) => {
        const rnd = azar(sem);
        let o = "";
        for (let i = 0; i < 3; i++) o += flor(x + i * s * 0.05 * (rnd() > 0.5 ? 1 : -1), y + (rnd() - 0.5) * s * 0.02, s * (0.024 + rnd() * 0.01), "#ffffff", "#f2c14e", 8, rnd() * 40);
        return o;
      };
      if (tipo === "interior") {
        c += franjaVichy(0, 0, m.anchoMm, banda, "abajo", "vi");
        c += margaritas(izq.x + s * 0.06, banda * 0.5, 3) + margaritas(der.x + der.w - s * 0.08, banda * 0.5, 7);
      } else if (tipo === "interior-alt") {
        c += franjaVichy(0, m.altoMm - banda, m.anchoMm, banda, "arriba", "vi");
        c += margaritas(der.x + der.w - s * 0.08, m.altoMm - banda * 0.5, 9);
      } else {
        c += franjaVichy(0, 0, m.anchoMm, banda, "abajo", "vi") + franjaVichy(0, m.altoMm - banda, m.anchoMm, banda, "arriba", "vi");
        c += margaritas(izq.x + s * 0.06, banda * 0.5, 3) + margaritas(der.x + der.w - s * 0.08, m.altoMm - banda * 0.5, 5);
        if (tipo === "apertura") c += margaritas(izq.x + izq.w / 2 - s * 0.035, izq.h * 0.24, 11);
      }
      return svg(m, c, patronVichy("vi", s * 0.05, "#c8423b"));
    },
    zona: (tipo, lado, m) => {
      const conArriba = tipo !== "interior-alt";
      const conAbajo = tipo !== "interior";
      return zonaRel({ arriba: conArriba ? 0.08 : 0.01, abajo: conAbajo ? 0.08 : 0.01 })(tipo, lado, m);
    },
    textos: textosClasicos({
      titulo: "Courgette",
      texto: "Nunito",
      color: "#b23a3a",
      acento: "#6b4a3a",
      escalaTitulo: 0.085,
      ejemplos: { titulo: "Picnic en familia", subtitulo: "Familia López", fecha: "Primavera 2026", frase: "Sobremesa, sol y nosotros" },
    }),
  },
  {
    id: "familia-10-hora-dorada",
    tema: "familia",
    nombre: "Hora dorada",
    descripcion: "Cielo de atardecer en durazno y lila, sol bajo y lomas suaves. Para sesiones en el campo.",
    papel: "#fbe9dc",
    margenMm: 15,
    fondo: (tipo, m) => {
      const { izq, der } = paginas(m);
      const s = ladoChico(m);
      const total = { x: 0, y: 0, w: m.anchoMm, h: m.altoMm };
      const cielo = degradado("c", total, "#fde7d3", "#f6cdb6");
      const alto = altoLomas(tipo, m);
      const solX = tipo === "interior-alt" ? izq.x + s * 0.16 : der.x + der.w - s * 0.18;
      let c = cielo.cuerpo;
      c += `<circle cx="${n(solX)}" cy="${n(m.altoMm - alto * 0.7)}" r="${n(s * 0.24)}" fill="url(#halo)"/>`;
      c += `<circle cx="${n(solX)}" cy="${n(m.altoMm - alto * 0.7)}" r="${n(s * 0.075)}" fill="#f7b267"/>`;
      c += lomas(m, alto, "#e3a99c", 3, 4);
      c += lomas(m, alto * 0.7, "#c98a8f", 8, 3);
      c += lomas(m, alto * 0.4, "#9c6b7a", 13, 5);
      if (esTitulo(tipo)) {
        const p = tipo === "apertura" ? der : izq;
        c += pajaro(p.x + p.w * 0.7, s * 0.07, s * 0.014, "#8a5a6a") + pajaro(p.x + p.w * 0.7 + s * 0.04, s * 0.09, s * 0.01, "#8a5a6a") + pajaro(p.x + p.w * 0.7 - s * 0.035, s * 0.1, s * 0.008, "#8a5a6a");
      }
      const defs = `<radialGradient id="halo"><stop offset="0" stop-color="#fbd38d" stop-opacity="0.9"/><stop offset="1" stop-color="#fbd38d" stop-opacity="0"/></radialGradient>`;
      return svg(m, c, cielo.defs + defs);
    },
    zona: (tipo, lado, m) => {
      // Lo que suben las lomas por encima del margen, más un respiro.
      const abajo = Math.max(0, altoLomas(tipo, m) - 15 + 3);
      return { ...zonaRel({ arriba: 0.02 })(tipo, lado, m), abajo: n(abajo) };
    },
    textos: textosClasicos({
      titulo: "Sacramento",
      texto: "Raleway",
      color: "#6b3a4a",
      acento: "#9c5a5a",
      escalaTitulo: 0.12,
      ejemplos: { titulo: "Familia Herrera", subtitulo: "Atardecer en el campo", fecha: "Marzo 2026", frase: "Gracias por cada atardecer juntos" },
    }),
  },
];

/** Cielo con estrellitas doradas y algún copito, para la Navidad (pocas, sin tapar nada). */
function estrellas(total: Rect, s: number, cantidad: number, semilla: number): string {
  const rnd = azar(semilla);
  let out = "";
  const cant = Math.round((cantidad * total.w) / 600);
  for (let i = 0; i < cant; i++) {
    const x = total.x + rnd() * total.w;
    const y = total.y + rnd() * total.h;
    out += rnd() > 0.75 ? estrella(x, y, s * 0.007 * (0.8 + rnd()), "#e3c27a", rnd() * 72, 0.85) : `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 0.0025 * (0.6 + rnd()))}" fill="#f3ead8" opacity="${n(0.35 + rnd() * 0.4)}"/>`;
  }
  return out;
}
