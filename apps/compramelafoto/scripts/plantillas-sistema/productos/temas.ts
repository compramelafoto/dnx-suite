/**
 * Temas visuales de los productos: el papel, los adornos del borde, el marco de las fotos, los
 * colores y las tipografías. Un mismo tema sirve para un diploma, un calendario o un señalador:
 * los adornos se dibujan a la medida de la hoja (`u` = el lado corto comparado con un A4).
 *
 * Los adornos van en el borde: el centro de la hoja queda libre para los textos y las fotos, que
 * son bloques editables.
 */
import type { Estilo, Rect } from "../lienzo";
import { nube, oso, conejo, gato, pollito } from "../animalitos";
import { azar, confeti, estrella, filtroAcuarela, filtroCrayon, filtroGrano, onda, puntos } from "../texturas";
import {
  birrete,
  cielo,
  cohete,
  cruz,
  filigranas,
  flor,
  globo,
  guarda,
  hoja as hojita,
  lapiz,
  laureles,
  llama,
  marcoDoble,
  medalla,
  paloma,
  planeta,
  rayos,
  sello,
} from "./adornos";
import type { Hoja } from "./hoja";

export type FormaDeFoto = "rect" | "circle";

export type Tema = {
  clave: string;
  /** El papel y los adornos, sin el `<svg>` de afuera. */
  fondo: (h: Hoja) => string;
  defs?: (h: Hoja) => string;
  /** Lo que va detrás de una foto (marco, sombra). */
  marcoFoto: (r: Rect, forma: FormaDeFoto, h: Hoja) => string;
  /** Un adorno debajo del nombre (opcional). */
  lineaNombre?: (x0: number, x1: number, y: number, h: Hoja) => string;
  tinta: string;
  acento: string;
  /** Color de los domingos en los calendarios. */
  domingo: string;
  /** Tipografías medidas para un A4 (lado corto 2480 px); el diseño las escala con la hoja. */
  fuentes: { titulo: Estilo; nombre: Estilo; cuerpo: Estilo; chico: Estilo };
  /** Hasta dónde llegan los adornos del borde, en mm desde el corte (a A4). */
  margenMm: number;
  /** Las fotos en círculo quedan mejor en este tema. */
  fotoRedonda?: boolean;
};

const f = (n: number) => n.toFixed(1);
/** Escala de los adornos: 1 en un A4. */
export const escala = (h: Hoja) => Math.min(h.w, h.h) / 2480;

const papel = (h: Hoja, color: string) => `<rect width="${h.w}" height="${h.h}" fill="${color}"/>`;

/** Marco blanco con sombra suave, como una foto pegada. */
function marcoBlanco(r: Rect, forma: FormaDeFoto, h: Hoja, borde = "#ffffff", sombra = 0.18): string {
  const u = escala(h);
  const d = 22 * u;
  if (forma === "circle") {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rr = Math.min(r.w, r.h) / 2;
    return `<circle cx="${f(cx + 8 * u)}" cy="${f(cy + 14 * u)}" r="${f(rr + d)}" fill="#000" opacity="${sombra}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr + d)}" fill="${borde}"/>`;
  }
  return `<rect x="${f(r.x - d + 8 * u)}" y="${f(r.y - d + 14 * u)}" width="${f(r.w + 2 * d)}" height="${f(r.h + 2 * d)}" fill="#000" opacity="${sombra}"/><rect x="${f(r.x - d)}" y="${f(r.y - d)}" width="${f(r.w + 2 * d)}" height="${f(r.h + 2 * d)}" fill="${borde}"/>`;
}

/** Marco fino de color (dorado, plateado) con un filete adentro. */
function marcoFilete(r: Rect, forma: FormaDeFoto, h: Hoja, color: string, interior: string): string {
  const u = escala(h);
  if (forma === "circle") {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rr = Math.min(r.w, r.h) / 2;
    return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr + 34 * u)}" fill="${color}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr + 20 * u)}" fill="${interior}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr + 10 * u)}" fill="${color}"/>`;
  }
  const a = (d: number) => `x="${f(r.x - d)}" y="${f(r.y - d)}" width="${f(r.w + 2 * d)}" height="${f(r.h + 2 * d)}"`;
  return `<rect ${a(34 * u)} fill="${color}"/><rect ${a(20 * u)} fill="${interior}"/><rect ${a(10 * u)} fill="${color}"/>`;
}

const lineaSimple = (color: string, grosor = 5) => (x0: number, x1: number, y: number, h: Hoja) =>
  `<line x1="${f(x0)}" y1="${f(y)}" x2="${f(x1)}" y2="${f(y)}" stroke="${color}" stroke-width="${f(grosor * escala(h))}" stroke-linecap="round"/>`;

const lineaConRombo = (color: string) => (x0: number, x1: number, y: number, h: Hoja) => {
  const u = escala(h);
  const cx = (x0 + x1) / 2;
  const r = 16 * u;
  return `<line x1="${f(x0)}" y1="${f(y)}" x2="${f(cx - r * 2)}" y2="${f(y)}" stroke="${color}" stroke-width="${f(4 * u)}"/>
    <line x1="${f(cx + r * 2)}" y1="${f(y)}" x2="${f(x1)}" y2="${f(y)}" stroke="${color}" stroke-width="${f(4 * u)}"/>
    <polygon points="${f(cx)},${f(y - r)} ${f(cx + r)},${f(y)} ${f(cx)},${f(y + r)} ${f(cx - r)},${f(y)}" fill="${color}"/>`;
};

const lineaOndulada = (color: string) => (x0: number, x1: number, y: number, h: Hoja) =>
  `<path d="${onda(x0, x1, y, 16 * escala(h), 90 * escala(h))}" fill="none" stroke="${color}" stroke-width="${f(7 * escala(h))}" stroke-linecap="round"/>`;

/* ----------------------------------------------- Jardín ---------------------------------------------- */

const arcoiris: Tema = {
  clave: "arcoiris",
  tinta: "#3d3a5c",
  acento: "#ef6f6c",
  domingo: "#ef6f6c",
  margenMm: 30,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Pacifico", tam: 190, color: "#ef6f6c" },
    nombre: { familia: "Quicksand", tam: 150, color: "#3d3a5c", peso: 700 },
    cuerpo: { familia: "Quicksand", tam: 66, color: "#3d3a5c", peso: 500 },
    chico: { familia: "Quicksand", tam: 46, color: "#6b6890", peso: 600 },
  },
  defs: () => filtroAcuarela("acu", 5) + filtroGrano("g", 0.8, 2, 3),
  fondo: (h) => {
    const u = escala(h);
    const colores = ["#ef6f6c", "#f7b267", "#f4e285", "#8cd790", "#77c5e8", "#a594f9"];
    const arco = (cx: number, cy: number, r0: number) =>
      colores
        .map((c, i) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r0 - i * 34 * u)}" fill="none" stroke="${c}" stroke-width="${f(30 * u)}" opacity="0.85"/>`)
        .join("");
    return `${papel(h, "#fffaf2")}
      <g filter="url(#acu)">${arco(0, h.h, 520 * u)}${arco(h.w, 0, 520 * u)}</g>
      ${nube(h.w - 760 * u, h.h - 330 * u, 520 * u, 210 * u, "#ffffff")}${nube(140 * u, 120 * u, 420 * u, 170 * u, "#ffffff")}
      ${cielo({ x: 0, y: 0, w: h.w, h: h.h }, 26, ["#f7b267", "#f4e285", "#a594f9"], 11, [14 * u, 30 * u], [{ x: h.w * 0.1, y: h.h * 0.1, w: h.w * 0.8, h: h.h * 0.8 }])}
      ${h.grano("g", 0.06)}`;
  },
  marcoFoto: (r, forma, h) => marcoBlanco(r, forma, h, "#ffffff", 0.14),
  lineaNombre: lineaOndulada("#f7b267"),
};

const animalitos: Tema = {
  clave: "animalitos",
  tinta: "#3b4a3f",
  acento: "#e07a5f",
  domingo: "#e07a5f",
  margenMm: 34,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Pacifico", tam: 180, color: "#e07a5f" },
    nombre: { familia: "Nunito", tam: 150, color: "#3b4a3f", peso: 800 },
    cuerpo: { familia: "Nunito", tam: 64, color: "#3b4a3f", peso: 600 },
    chico: { familia: "Nunito", tam: 46, color: "#6b7f70", peso: 700 },
  },
  defs: () => filtroGrano("g", 0.8, 2, 4),
  fondo: (h) => {
    const u = escala(h);
    const s = 120 * u;
    const pasto = `<path d="M 0 ${f(h.h)} L 0 ${f(h.h - 150 * u)} ${Array.from({ length: Math.ceil(h.w / (60 * u)) + 1 }, (_, i) => `L ${f(i * 60 * u + 30 * u)} ${f(h.h - (i % 2 ? 210 : 150) * u)}`).join(" ")} L ${f(h.w)} ${f(h.h - 150 * u)} L ${f(h.w)} ${f(h.h)} Z" fill="#a7d49b"/>`;
    return `${papel(h, "#f4fbf1")}
      ${puntos({ x: 40 * u, y: 40 * u, w: h.w - 80 * u, h: h.h - 300 * u }, 90 * u, 5 * u, "#cfe8c6")}
      ${pasto}
      ${oso(190 * u, h.h - 260 * u, s)}${conejo(h.w - 200 * u, h.h - 250 * u, s * 0.95)}
      ${gato(h.w - 210 * u, 230 * u, s * 0.85)}${pollito(200 * u, 220 * u, s * 0.8)}
      ${h.grano("g", 0.05)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#e07a5f", "#ffffff"),
  lineaNombre: lineaOndulada("#a7d49b"),
};

const estrellas: Tema = {
  clave: "estrellas",
  tinta: "#fdf6e3",
  acento: "#ffd166",
  domingo: "#ffd166",
  margenMm: 26,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Pacifico", tam: 180, color: "#ffd166" },
    nombre: { familia: "Quicksand", tam: 150, color: "#ffffff", peso: 700 },
    cuerpo: { familia: "Quicksand", tam: 64, color: "#e9e6ff", peso: 500 },
    chico: { familia: "Quicksand", tam: 46, color: "#c9c4f2", peso: 600 },
  },
  fondo: (h) => {
    const u = escala(h);
    const luna = `<circle cx="${f(h.w - 300 * u)}" cy="${f(280 * u)}" r="${f(150 * u)}" fill="#fff3c4"/><circle cx="${f(h.w - 240 * u)}" cy="${f(240 * u)}" r="${f(140 * u)}" fill="#2a2f6b"/>`;
    return `<defs><radialGradient id="noche" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#3a3f8f"/><stop offset="1" stop-color="#1d2155"/></radialGradient></defs>
      <rect width="${h.w}" height="${h.h}" fill="url(#noche)"/>
      ${cielo({ x: 0, y: 0, w: h.w, h: h.h }, 90, ["#ffd166", "#ffffff", "#fff3c4"], 21, [10 * u, 34 * u], [{ x: h.w * 0.16, y: h.h * 0.14, w: h.w * 0.68, h: h.h * 0.72 }])}
      ${luna}
      ${nube(-60 * u, h.h - 220 * u, 700 * u, 240 * u, "#4a4f9f", 0.9)}${nube(h.w - 640 * u, h.h - 200 * u, 700 * u, 220 * u, "#4a4f9f", 0.9)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#ffd166", "#2a2f6b"),
  lineaNombre: (x0, x1, y, h) => {
    const u = escala(h);
    const cx = (x0 + x1) / 2;
    return `<line x1="${f(x0)}" y1="${f(y)}" x2="${f(x1)}" y2="${f(y)}" stroke="#ffd166" stroke-width="${f(3 * u)}" opacity="0.7"/><polygon points="${estrella(cx, y, 26 * u)}" fill="#ffd166"/>`;
  },
};

const crayones: Tema = {
  clave: "crayones",
  tinta: "#2d3047",
  acento: "#e4572e",
  domingo: "#e4572e",
  margenMm: 24,
  fuentes: {
    titulo: { familia: "Gloria Hallelujah", tam: 170, color: "#e4572e" },
    nombre: { familia: "Patrick Hand", tam: 170, color: "#2d3047" },
    cuerpo: { familia: "Patrick Hand", tam: 74, color: "#2d3047" },
    chico: { familia: "Patrick Hand", tam: 52, color: "#55597a" },
  },
  defs: () => filtroCrayon("cr", 9, 10) + filtroGrano("g", 0.9, 2, 6),
  fondo: (h) => {
    const u = escala(h);
    const colores = ["#e4572e", "#f3a712", "#29bf12", "#00a5cf", "#9b5de5"];
    const m = 70 * u;
    const zig = (y: number, c: string, alto: number) => {
      let d = `M ${f(m)} ${f(y)}`;
      for (let x = m, i = 0; x < h.w - m; x += 50 * u, i++) d += ` L ${f(x + 25 * u)} ${f(y + (i % 2 ? -alto : alto))}`;
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(16 * u)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    };
    const vert = (x: number, c: string) => `<line x1="${f(x)}" y1="${f(m)}" x2="${f(x)}" y2="${f(h.h - m)}" stroke="${c}" stroke-width="${f(16 * u)}" stroke-linecap="round"/>`;
    return `${papel(h, "#ffffff")}
      <g filter="url(#cr)">
        ${zig(m, colores[0]!, 18 * u)}${zig(m + 46 * u, colores[1]!, 14 * u)}
        ${zig(h.h - m, colores[3]!, 18 * u)}${zig(h.h - m - 46 * u, colores[2]!, 14 * u)}
        ${vert(m, colores[4]!)}${vert(h.w - m, colores[4]!)}
      </g>
      ${h.grano("g", 0.08)}`;
  },
  marcoFoto: (r, forma, h) => {
    const u = escala(h);
    const d = 26 * u;
    return forma === "circle"
      ? `<circle cx="${f(r.x + r.w / 2)}" cy="${f(r.y + r.h / 2)}" r="${f(Math.min(r.w, r.h) / 2 + d)}" fill="none" stroke="#f3a712" stroke-width="${f(18 * u)}" filter="url(#cr)"/>`
      : `<rect x="${f(r.x - d)}" y="${f(r.y - d)}" width="${f(r.w + 2 * d)}" height="${f(r.h + 2 * d)}" fill="none" stroke="#f3a712" stroke-width="${f(18 * u)}" filter="url(#cr)"/>`;
  },
  lineaNombre: (x0, x1, y, h) => `<path d="${onda(x0, x1, y, 14 * escala(h), 80 * escala(h))}" fill="none" stroke="#00a5cf" stroke-width="${f(10 * escala(h))}" filter="url(#cr)"/>`,
};

const globos: Tema = {
  clave: "globos",
  tinta: "#34344a",
  acento: "#f25f5c",
  domingo: "#f25f5c",
  margenMm: 30,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Pacifico", tam: 180, color: "#f25f5c" },
    nombre: { familia: "Nunito", tam: 150, color: "#34344a", peso: 800 },
    cuerpo: { familia: "Nunito", tam: 64, color: "#34344a", peso: 600 },
    chico: { familia: "Nunito", tam: 46, color: "#6d6d85", peso: 700 },
  },
  defs: () => filtroGrano("g", 0.8, 2, 8),
  fondo: (h) => {
    const u = escala(h);
    const colores = ["#f25f5c", "#ffe066", "#70c1b3", "#247ba0", "#ff9ff3"];
    const ramo = (x: number, y: number, semilla: number) => {
      const a = azar(semilla);
      return [0, 1, 2]
        .map((i) => globo(x + (i - 1) * 120 * u + a.entre(-20, 20) * u, y + Math.abs(i - 1) * 90 * u, 105 * u, colores[(semilla + i) % colores.length]!))
        .join("");
    };
    return `${papel(h, "#fffdf7")}
      ${confeti({ x: 0, y: 0, w: h.w, h: h.h }, 120, colores, 13, [10 * u, 26 * u], [{ x: h.w * 0.12, y: h.h * 0.12, w: h.w * 0.76, h: h.h * 0.76 }])}
      ${ramo(230 * u, 230 * u, 1)}${ramo(h.w - 230 * u, 230 * u, 3)}
      ${h.grano("g", 0.05)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#70c1b3", "#ffffff"),
  lineaNombre: lineaSimple("#ffe066", 10),
};

const floresPastel: Tema = {
  clave: "flores-pastel",
  tinta: "#5a4a5e",
  acento: "#d88aa6",
  domingo: "#d88aa6",
  margenMm: 32,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Dancing Script", tam: 200, color: "#c26f8f", peso: 700 },
    nombre: { familia: "Quicksand", tam: 140, color: "#5a4a5e", peso: 700 },
    cuerpo: { familia: "Quicksand", tam: 64, color: "#5a4a5e", peso: 500 },
    chico: { familia: "Quicksand", tam: 46, color: "#8a7a8e", peso: 600 },
  },
  defs: () => filtroAcuarela("acu", 12) + filtroGrano("g", 0.8, 2, 9),
  fondo: (h) => {
    const u = escala(h);
    const ramito = (cx: number, cy: number, giro: number) =>
      `<g transform="rotate(${giro} ${f(cx)} ${f(cy)})">
        ${hojita(cx - 40 * u, cy + 60 * u, 150 * u, "#a8c5a0", 200)}${hojita(cx + 40 * u, cy + 60 * u, 150 * u, "#a8c5a0", -20)}
        ${flor(cx, cy, 120 * u, "#f6c1d1", "#f7d774")}${flor(cx + 150 * u, cy + 60 * u, 80 * u, "#d7c4f0", "#f7d774", 20)}${flor(cx - 140 * u, cy + 80 * u, 70 * u, "#fde2c2", "#f7d774", 40)}
      </g>`;
    return `${papel(h, "#fffafb")}
      <g filter="url(#acu)" opacity="0.5"><circle cx="0" cy="0" r="${f(420 * u)}" fill="#fbe3ea"/><circle cx="${h.w}" cy="${h.h}" r="${f(460 * u)}" fill="#e9e1f7"/></g>
      ${ramito(200 * u, 200 * u, 0)}${ramito(h.w - 220 * u, h.h - 230 * u, 180)}
      ${h.grano("g", 0.05)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#e7b6c8", "#ffffff"),
  lineaNombre: lineaConRombo("#e7b6c8"),
};

/* ---------------------------------------------- Primaria --------------------------------------------- */

const pizarron: Tema = {
  clave: "pizarron",
  tinta: "#f4f4ee",
  acento: "#ffe08a",
  domingo: "#ff9e9e",
  margenMm: 22,
  fuentes: {
    titulo: { familia: "Schoolbell", tam: 190, color: "#ffe08a" },
    nombre: { familia: "Kalam", tam: 160, color: "#ffffff", peso: 700 },
    cuerpo: { familia: "Kalam", tam: 70, color: "#eef3ea" },
    chico: { familia: "Kalam", tam: 50, color: "#cfe0cf" },
  },
  defs: () => filtroGrano("g", 0.6, 3, 10) + filtroCrayon("tiza", 4, 8),
  fondo: (h) => {
    const u = escala(h);
    const m = 70 * u;
    const manchas = azar(4);
    let tiza = "";
    for (let i = 0; i < 9; i++) {
      tiza += `<ellipse cx="${f(manchas.entre(0, h.w))}" cy="${f(manchas.entre(0, h.h))}" rx="${f(manchas.entre(200, 500) * u)}" ry="${f(manchas.entre(60, 140) * u)}" fill="#ffffff" opacity="0.035"/>`;
    }
    return `<rect width="${h.w}" height="${h.h}" fill="#8b5a2b"/>
      <rect x="${f(10 * u)}" y="${f(10 * u)}" width="${f(h.w - 20 * u)}" height="${f(h.h - 20 * u)}" fill="#a06a35"/>
      <rect x="${f(m)}" y="${f(m)}" width="${f(h.w - 2 * m)}" height="${f(h.h - 2 * m)}" fill="#2f5d4a"/>
      ${tiza}
      <g filter="url(#tiza)" opacity="0.8">
        <path d="M ${f(m + 80 * u)} ${f(m + 90 * u)} l ${f(70 * u)} ${f(-40 * u)} l ${f(30 * u)} ${f(70 * u)}" stroke="#ffffff" stroke-width="${f(8 * u)}" fill="none"/>
        <polygon points="${estrella(h.w - m - 150 * u, m + 140 * u, 60 * u)}" fill="none" stroke="#ffe08a" stroke-width="${f(8 * u)}"/>
        <circle cx="${f(m + 160 * u)}" cy="${f(h.h - m - 150 * u)}" r="${f(55 * u)}" fill="none" stroke="#9ed2ff" stroke-width="${f(8 * u)}"/>
        <path d="M ${f(h.w - m - 240 * u)} ${f(h.h - m - 120 * u)} h ${f(140 * u)} m ${f(-70 * u)} ${f(-70 * u)} v ${f(140 * u)}" stroke="#ff9e9e" stroke-width="${f(9 * u)}" fill="none"/>
      </g>
      <rect x="${f(m)}" y="${f(h.h - m - 26 * u)}" width="${f(h.w - 2 * m)}" height="${f(26 * u)}" fill="#7a4d22" opacity="0.8"/>
      ${h.grano("g", 0.09, "screen")}`;
  },
  marcoFoto: (r, forma, h) => marcoBlanco(r, forma, h, "#f4f4ee", 0.3),
  lineaNombre: (x0, x1, y, h) => `<line x1="${f(x0)}" y1="${f(y)}" x2="${f(x1)}" y2="${f(y)}" stroke="#ffffff" stroke-width="${f(7 * escala(h))}" filter="url(#tiza)" opacity="0.8"/>`,
};

const cuaderno: Tema = {
  clave: "cuaderno",
  tinta: "#1f3b70",
  acento: "#e63946",
  domingo: "#e63946",
  margenMm: 20,
  fuentes: {
    titulo: { familia: "Gloria Hallelujah", tam: 160, color: "#e63946" },
    nombre: { familia: "Patrick Hand", tam: 170, color: "#1f3b70" },
    cuerpo: { familia: "Patrick Hand", tam: 74, color: "#1f3b70" },
    chico: { familia: "Patrick Hand", tam: 52, color: "#4a5f8a" },
  },
  defs: () => filtroGrano("g", 0.9, 2, 12),
  fondo: (h) => {
    const u = escala(h);
    const paso = 78 * u;
    let lineas = "";
    for (let y = 220 * u; y < h.h - 60 * u; y += paso) lineas += `<line x1="0" y1="${f(y)}" x2="${h.w}" y2="${f(y)}" stroke="#a8c8ec" stroke-width="${f(3 * u)}"/>`;
    const margen = 300 * u;
    let agujeros = "";
    for (let y = 200 * u; y < h.h - 150 * u; y += 260 * u) agujeros += `<circle cx="${f(110 * u)}" cy="${f(y)}" r="${f(34 * u)}" fill="#e8e3d8"/>`;
    return `${papel(h, "#fdfdf8")}${lineas}
      <line x1="${f(margen)}" y1="0" x2="${f(margen)}" y2="${h.h}" stroke="#f28b8b" stroke-width="${f(5 * u)}"/>
      <line x1="${f(margen + 14 * u)}" y1="0" x2="${f(margen + 14 * u)}" y2="${h.h}" stroke="#f28b8b" stroke-width="${f(2 * u)}"/>
      ${agujeros}
      <polygon points="${estrella(h.w - 210 * u, 190 * u, 70 * u)}" fill="#ffd166"/>
      ${h.grano("g", 0.05)}`;
  },
  marcoFoto: (r, forma, h) => {
    const u = escala(h);
    const cinta = (x: number, y: number, g: number) => `<rect x="${f(x - 90 * u)}" y="${f(y - 28 * u)}" width="${f(180 * u)}" height="${f(56 * u)}" fill="#f6e7a8" opacity="0.85" transform="rotate(${g} ${f(x)} ${f(y)})"/>`;
    return marcoBlanco(r, forma, h, "#ffffff", 0.16) + (forma === "rect" ? cinta(r.x + 20 * u, r.y - 10 * u, -30) + cinta(r.x + r.w - 20 * u, r.y - 10 * u, 30) : "");
  },
  lineaNombre: (x0, x1, y, h) => `<path d="${onda(x0, x1, y, 10 * escala(h), 60 * escala(h))}" fill="none" stroke="#e63946" stroke-width="${f(6 * escala(h))}"/>`,
};

const lapices: Tema = {
  clave: "lapices",
  tinta: "#263238",
  acento: "#1e88e5",
  domingo: "#e53935",
  margenMm: 30,
  fuentes: {
    titulo: { familia: "Gloria Hallelujah", tam: 160, color: "#1e88e5" },
    nombre: { familia: "Nunito", tam: 150, color: "#263238", peso: 800 },
    cuerpo: { familia: "Nunito", tam: 64, color: "#263238", peso: 600 },
    chico: { familia: "Nunito", tam: 46, color: "#546e7a", peso: 700 },
  },
  defs: () => filtroGrano("g", 0.8, 2, 14),
  fondo: (h) => {
    const u = escala(h);
    const colores = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#ec407a"];
    const ancho = 58 * u;
    let fila = "";
    const n = Math.floor((h.w - 160 * u) / (ancho * 1.5));
    for (let i = 0; i < n; i++) {
      const x = 80 * u + i * ancho * 1.5 + ancho / 2;
      const largo = (190 + ((i * 53) % 70)) * u;
      fila += lapiz(x, 40 * u + largo, largo, ancho, colores[i % colores.length]!, -90);
      fila += lapiz(x + ancho * 0.75, h.h - 40 * u - largo + 10 * u, largo, ancho, colores[(i + 3) % colores.length]!, 90);
    }
    return `${papel(h, "#f7fbff")}${fila}${h.grano("g", 0.04)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#1e88e5", "#ffffff"),
  lineaNombre: lineaSimple("#fdd835", 12),
};

const espacio: Tema = {
  clave: "espacio",
  tinta: "#ffffff",
  acento: "#7ee0ff",
  domingo: "#ff8fab",
  margenMm: 28,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Bebas Neue", tam: 200, color: "#7ee0ff" },
    nombre: { familia: "Montserrat", tam: 140, color: "#ffffff", peso: 800 },
    cuerpo: { familia: "Montserrat", tam: 58, color: "#dfe7ff", peso: 500 },
    chico: { familia: "Montserrat", tam: 42, color: "#aab6e8", peso: 600 },
  },
  fondo: (h) => {
    const u = escala(h);
    return `<defs><linearGradient id="esp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1340"/><stop offset="1" stop-color="#2b0f4c"/></linearGradient></defs>
      <rect width="${h.w}" height="${h.h}" fill="url(#esp)"/>
      ${cielo({ x: 0, y: 0, w: h.w, h: h.h }, 140, ["#ffffff", "#7ee0ff", "#ffd6a5"], 31, [6 * u, 20 * u], [{ x: h.w * 0.15, y: h.h * 0.12, w: h.w * 0.7, h: h.h * 0.76 }])}
      ${planeta(220 * u, h.h - 240 * u, 130 * u, "#ff8fab", "#ffd6a5")}${planeta(h.w - 220 * u, 230 * u, 100 * u, "#7ee0ff")}
      ${planeta(h.w - 380 * u, h.h - 170 * u, 50 * u, "#ffd166")}
      ${cohete(250 * u, 260 * u, 110 * u, 40)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#7ee0ff", "#0b1340"),
  lineaNombre: lineaSimple("#7ee0ff", 4),
};

const honor: Tema = {
  clave: "honor",
  tinta: "#1d2a44",
  acento: "#b8892d",
  domingo: "#a33b3b",
  margenMm: 26,
  fuentes: {
    titulo: { familia: "Playfair Display", tam: 170, color: "#b8892d", peso: 700, mayus: "uppercase" },
    nombre: { familia: "Great Vibes", tam: 210, color: "#1d2a44" },
    cuerpo: { familia: "Lora", tam: 62, color: "#1d2a44", italica: true },
    chico: { familia: "Lora", tam: 44, color: "#4a5570" },
  },
  defs: () => filtroGrano("g", 0.7, 3, 15),
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#fffdf6")}
      ${marcoDoble(h.w, h.h, 60 * u, "#b8892d", 14 * u, 4 * u, 30 * u)}
      ${filigranas(h.w, h.h, 120 * u, 220 * u, "#b8892d", 6 * u)}
      ${h.grano("g", 0.05)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#b8892d", "#fffdf6"),
  lineaNombre: lineaConRombo("#b8892d"),
};

/* --------------------------------------------- Secundaria -------------------------------------------- */

const geometrico: Tema = {
  clave: "geometrico",
  tinta: "#22313f",
  acento: "#ef476f",
  domingo: "#ef476f",
  margenMm: 30,
  fuentes: {
    titulo: { familia: "Montserrat", tam: 140, color: "#118ab2", peso: 800, mayus: "uppercase" },
    nombre: { familia: "Montserrat", tam: 140, color: "#22313f", peso: 700 },
    cuerpo: { familia: "Raleway", tam: 60, color: "#22313f", peso: 500 },
    chico: { familia: "Raleway", tam: 44, color: "#5c6b7a", peso: 600 },
  },
  fondo: (h) => {
    const u = escala(h);
    const a = azar(41);
    const colores = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#073b4c"];
    let tri = "";
    const lado = 170 * u;
    const esquina = (x0: number, y0: number, sx: number, sy: number) => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4 - i; j++) {
          if (a.r() < 0.25) continue;
          const x = x0 + sx * i * lado;
          const y = y0 + sy * j * lado;
          const arriba = a.r() < 0.5;
          const pts = arriba
            ? `${f(x)},${f(y)} ${f(x + sx * lado)},${f(y)} ${f(x)},${f(y + sy * lado)}`
            : `${f(x + sx * lado)},${f(y)} ${f(x + sx * lado)},${f(y + sy * lado)} ${f(x)},${f(y + sy * lado)}`;
          tri += `<polygon points="${pts}" fill="${a.elegir(colores)}" opacity="${a.entre(0.75, 1).toFixed(2)}"/>`;
        }
      }
    };
    esquina(0, 0, 1, 1);
    esquina(h.w, h.h, -1, -1);
    return `${papel(h, "#ffffff")}${tri}`;
  },
  marcoFoto: (r, forma, h) => {
    const u = escala(h);
    return forma === "circle"
      ? `<circle cx="${f(r.x + r.w / 2 + 30 * u)}" cy="${f(r.y + r.h / 2 + 30 * u)}" r="${f(Math.min(r.w, r.h) / 2)}" fill="#ffd166"/>`
      : `<rect x="${f(r.x + 34 * u)}" y="${f(r.y + 34 * u)}" width="${f(r.w)}" height="${f(r.h)}" fill="#ffd166"/>`;
  },
  lineaNombre: lineaSimple("#06d6a0", 10),
};

const minimalAzul: Tema = {
  clave: "minimal-azul",
  tinta: "#14213d",
  acento: "#1d4ed8",
  domingo: "#1d4ed8",
  margenMm: 18,
  fuentes: {
    titulo: { familia: "Montserrat", tam: 120, color: "#1d4ed8", peso: 800, mayus: "uppercase" },
    nombre: { familia: "Montserrat", tam: 150, color: "#14213d", peso: 300 },
    cuerpo: { familia: "Montserrat", tam: 54, color: "#14213d", peso: 400 },
    chico: { familia: "Montserrat", tam: 40, color: "#5b6478", peso: 500 },
  },
  fondo: (h) => {
    const u = escala(h);
    const banda = h.apaisada ? `<rect x="0" y="0" width="${f(110 * u)}" height="${h.h}" fill="#14213d"/><rect x="${f(110 * u)}" y="0" width="${f(18 * u)}" height="${h.h}" fill="#1d4ed8"/>`
      : `<rect x="0" y="0" width="${h.w}" height="${f(110 * u)}" fill="#14213d"/><rect x="0" y="${f(110 * u)}" width="${h.w}" height="${f(18 * u)}" fill="#1d4ed8"/>`;
    return `${papel(h, "#ffffff")}${banda}`;
  },
  marcoFoto: () => "",
  lineaNombre: lineaSimple("#1d4ed8", 6),
};

const neon: Tema = {
  clave: "neon",
  tinta: "#ffffff",
  acento: "#00f5d4",
  domingo: "#f15bb5",
  margenMm: 22,
  fuentes: {
    titulo: { familia: "Bebas Neue", tam: 210, color: "#00f5d4" },
    nombre: { familia: "Montserrat", tam: 140, color: "#ffffff", peso: 800 },
    cuerpo: { familia: "Montserrat", tam: 56, color: "#e0e0f0", peso: 500 },
    chico: { familia: "Montserrat", tam: 42, color: "#a9a9c8", peso: 600 },
  },
  defs: () => `<filter id="brillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
  fondo: (h) => {
    const u = escala(h);
    const m = 70 * u;
    return `${papel(h, "#14111f")}
      ${puntos({ x: m, y: m, w: h.w - 2 * m, h: h.h - 2 * m }, 70 * u, 3 * u, "#2c2840")}
      <g filter="url(#brillo)" fill="none" stroke-width="${f(10 * u)}" stroke-linecap="round">
        <path d="M ${f(m)} ${f(m + 260 * u)} V ${f(m)} H ${f(m + 420 * u)}" stroke="#00f5d4"/>
        <path d="M ${f(h.w - m)} ${f(h.h - m - 260 * u)} V ${f(h.h - m)} H ${f(h.w - m - 420 * u)}" stroke="#f15bb5"/>
        <path d="M ${f(h.w - m - 300 * u)} ${f(m)} H ${f(h.w - m)} V ${f(m + 160 * u)}" stroke="#fee440"/>
        <path d="M ${f(m + 300 * u)} ${f(h.h - m)} H ${f(m)} V ${f(h.h - m - 160 * u)}" stroke="#9b5de5"/>
      </g>`;
  },
  marcoFoto: (r, forma, h) => {
    const u = escala(h);
    const d = 22 * u;
    return forma === "circle"
      ? `<circle cx="${f(r.x + r.w / 2)}" cy="${f(r.y + r.h / 2)}" r="${f(Math.min(r.w, r.h) / 2 + d)}" fill="none" stroke="#f15bb5" stroke-width="${f(10 * u)}" filter="url(#brillo)"/>`
      : `<rect x="${f(r.x - d)}" y="${f(r.y - d)}" width="${f(r.w + 2 * d)}" height="${f(r.h + 2 * d)}" fill="none" stroke="#f15bb5" stroke-width="${f(10 * u)}" filter="url(#brillo)"/>`;
  },
  lineaNombre: (x0, x1, y, h) => `<line x1="${f(x0)}" y1="${f(y)}" x2="${f(x1)}" y2="${f(y)}" stroke="#00f5d4" stroke-width="${f(6 * escala(h))}" filter="url(#brillo)"/>`,
};

const laurel: Tema = {
  clave: "laurel",
  tinta: "#1f2d24",
  acento: "#2f6b47",
  domingo: "#8c2f39",
  margenMm: 24,
  fuentes: {
    titulo: { familia: "Playfair Display", tam: 150, color: "#2f6b47", peso: 700, mayus: "uppercase" },
    nombre: { familia: "Playfair Display", tam: 150, color: "#1f2d24", italica: true },
    cuerpo: { familia: "Source Serif 4", tam: 60, color: "#1f2d24" },
    chico: { familia: "Source Serif 4", tam: 44, color: "#4d5d52" },
  },
  defs: () => filtroGrano("g", 0.7, 3, 16),
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#fbfaf4")}
      ${marcoDoble(h.w, h.h, 58 * u, "#2f6b47", 6 * u, 3 * u, 22 * u)}
      <g opacity="0.12">${laureles(h.cx, h.cy + 60 * u, Math.min(h.w, h.h) * 0.42, "#2f6b47")}</g>
      ${h.grano("g", 0.05)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#2f6b47", "#fbfaf4"),
  lineaNombre: lineaConRombo("#2f6b47"),
};

const deportivo: Tema = {
  clave: "deportivo",
  tinta: "#111827",
  acento: "#f97316",
  domingo: "#f97316",
  margenMm: 24,
  fuentes: {
    titulo: { familia: "Anton", tam: 190, color: "#111827", mayus: "uppercase" },
    nombre: { familia: "Oswald", tam: 150, color: "#f97316", peso: 700, mayus: "uppercase" },
    cuerpo: { familia: "Oswald", tam: 60, color: "#111827" },
    chico: { familia: "Oswald", tam: 44, color: "#4b5563" },
  },
  fondo: (h) => {
    const u = escala(h);
    let rayas = "";
    for (let i = 0; i < 6; i++) {
      // Contra el borde derecho: el centro queda para los textos.
      rayas += `<polygon points="${f(h.w - (330 - i * 70) * u)},0 ${f(h.w - (280 - i * 70) * u)},0 ${f(h.w - (480 - i * 70) * u)},${h.h} ${f(h.w - (530 - i * 70) * u)},${h.h}" fill="${i % 2 ? "#f97316" : "#111827"}" opacity="${i % 2 ? 0.9 : 0.08}"/>`;
    }
    return `${papel(h, "#f8fafc")}${rayas}
      <rect x="0" y="0" width="${h.w}" height="${f(40 * u)}" fill="#111827"/><rect x="0" y="${f(h.h - 40 * u)}" width="${h.w}" height="${f(40 * u)}" fill="#111827"/>`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#111827", "#f97316"),
  lineaNombre: lineaSimple("#111827", 10),
};

/* ---------------------------------------------- Egresados -------------------------------------------- */

const negroDorado: Tema = {
  clave: "negro-dorado",
  tinta: "#f3e9d2",
  acento: "#d4af37",
  domingo: "#d4af37",
  margenMm: 26,
  fuentes: {
    titulo: { familia: "Playfair Display", tam: 160, color: "#d4af37", peso: 700, mayus: "uppercase" },
    nombre: { familia: "Great Vibes", tam: 220, color: "#f3e9d2" },
    cuerpo: { familia: "Lora", tam: 60, color: "#e8dcc0", italica: true },
    chico: { familia: "Lora", tam: 44, color: "#b9ab8a" },
  },
  defs: () => `<linearGradient id="oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8892d"/><stop offset="0.5" stop-color="#f1d77a"/><stop offset="1" stop-color="#a07424"/></linearGradient>` + filtroGrano("g", 0.7, 3, 17),
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#141414")}
      ${marcoDoble(h.w, h.h, 60 * u, "url(#oro)", 12 * u, 3 * u, 28 * u)}
      ${filigranas(h.w, h.h, 120 * u, 230 * u, "url(#oro)", 6 * u)}
      ${h.grano("g", 0.08, "screen")}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "url(#oro)", "#141414"),
  lineaNombre: lineaConRombo("#d4af37"),
};

const pergamino: Tema = {
  clave: "pergamino",
  tinta: "#2c2416",
  acento: "#9b1d20",
  domingo: "#9b1d20",
  margenMm: 28,
  fuentes: {
    titulo: { familia: "Great Vibes", tam: 230, color: "#2c2416" },
    nombre: { familia: "Playfair Display", tam: 140, color: "#2c2416", peso: 700 },
    cuerpo: { familia: "Libre Baskerville", tam: 56, color: "#2c2416", italica: true },
    chico: { familia: "Libre Baskerville", tam: 42, color: "#5a4a32" },
  },
  defs: () => filtroGrano("g", 0.7, 3, 4) + filtroAcuarela("acu", 7),
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#f3e7c9")}
      <g filter="url(#acu)" opacity="0.35"><rect x="${f(-80 * u)}" y="${f(-80 * u)}" width="${f(h.w + 160 * u)}" height="${f(160 * u)}" fill="#c9a96b"/><rect x="${f(-80 * u)}" y="${f(h.h - 80 * u)}" width="${f(h.w + 160 * u)}" height="${f(160 * u)}" fill="#c9a96b"/></g>
      ${marcoDoble(h.w, h.h, 90 * u, "#a8843a", 10 * u, 3 * u, 26 * u)}
      ${sello(h.w - 330 * u, h.h - 330 * u, 110 * u, "#9b1d20", "#c4474a")}
      ${h.grano("g", 0.12)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#a8843a", "#f3e7c9"),
  lineaNombre: lineaConRombo("#a8843a"),
};

const azulOro: Tema = {
  clave: "azul-oro",
  tinta: "#f5efe0",
  acento: "#e0b957",
  domingo: "#e0b957",
  margenMm: 26,
  fuentes: {
    titulo: { familia: "Playfair Display", tam: 150, color: "#e0b957", peso: 700, mayus: "uppercase" },
    nombre: { familia: "Alex Brush", tam: 220, color: "#ffffff" },
    cuerpo: { familia: "Lora", tam: 60, color: "#e6e9f2" },
    chico: { familia: "Lora", tam: 44, color: "#b7c0d8" },
  },
  defs: () => filtroGrano("g", 0.7, 3, 18),
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#14274e")}
      <rect x="${f(40 * u)}" y="${f(40 * u)}" width="${f(h.w - 80 * u)}" height="${f(h.h - 80 * u)}" fill="none" stroke="#e0b957" stroke-width="${f(5 * u)}"/>
      ${filigranas(h.w, h.h, 80 * u, 200 * u, "#e0b957", 5 * u)}
      ${laureles(h.cx, h.h - 150 * u, 150 * u, "#e0b957")}
      ${h.grano("g", 0.07, "screen")}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#e0b957", "#14274e"),
  lineaNombre: lineaSimple("#e0b957", 4),
};

const bordo: Tema = {
  clave: "bordo",
  tinta: "#fbeee6",
  acento: "#e6c27a",
  domingo: "#e6c27a",
  margenMm: 26,
  fuentes: {
    titulo: { familia: "Playfair Display", tam: 150, color: "#e6c27a", peso: 700, mayus: "uppercase" },
    nombre: { familia: "Parisienne", tam: 210, color: "#ffffff" },
    cuerpo: { familia: "Crimson Text", tam: 64, color: "#f3dcd2", italica: true },
    chico: { familia: "Crimson Text", tam: 46, color: "#d9b3a8" },
  },
  defs: () => filtroGrano("g", 0.5, 4, 19),
  fondo: (h) => {
    const u = escala(h);
    return `<defs><radialGradient id="cuero" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#7a1f2b"/><stop offset="1" stop-color="#4a0f18"/></radialGradient></defs>
      <rect width="${h.w}" height="${h.h}" fill="url(#cuero)"/>
      ${h.grano("g", 0.16)}
      <rect x="${f(70 * u)}" y="${f(70 * u)}" width="${f(h.w - 140 * u)}" height="${f(h.h - 140 * u)}" fill="none" stroke="#e6c27a" stroke-width="${f(4 * u)}" stroke-dasharray="${f(18 * u)} ${f(12 * u)}"/>
      ${marcoDoble(h.w, h.h, 100 * u, "#e6c27a", 8 * u, 2 * u, 18 * u)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#e6c27a", "#5a1420"),
  lineaNombre: lineaConRombo("#e6c27a"),
};

const minimalBlanco: Tema = {
  clave: "minimal-blanco",
  tinta: "#1c1c1c",
  acento: "#b08d57",
  domingo: "#b08d57",
  margenMm: 16,
  fuentes: {
    titulo: { familia: "Raleway", tam: 100, color: "#b08d57", peso: 600, mayus: "uppercase" },
    nombre: { familia: "Playfair Display", tam: 160, color: "#1c1c1c" },
    cuerpo: { familia: "Raleway", tam: 54, color: "#333333", peso: 400 },
    chico: { familia: "Raleway", tam: 40, color: "#777777", peso: 500 },
  },
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#ffffff")}<rect x="${f(70 * u)}" y="${f(70 * u)}" width="${f(h.w - 140 * u)}" height="${f(h.h - 140 * u)}" fill="none" stroke="#b08d57" stroke-width="${f(3 * u)}"/>`;
  },
  marcoFoto: () => "",
  lineaNombre: lineaSimple("#b08d57", 3),
};

const birretes: Tema = {
  clave: "birretes",
  tinta: "#ffffff",
  acento: "#ffc93c",
  domingo: "#ffc93c",
  margenMm: 28,
  fuentes: {
    titulo: { familia: "Bebas Neue", tam: 220, color: "#ffc93c" },
    nombre: { familia: "Montserrat", tam: 140, color: "#ffffff", peso: 800 },
    cuerpo: { familia: "Montserrat", tam: 56, color: "#e3e8f7", peso: 500 },
    chico: { familia: "Montserrat", tam: 42, color: "#b3bede", peso: 600 },
  },
  fondo: (h) => {
    const u = escala(h);
    const a = azar(51);
    let gorros = "";
    const lugares: Array<[number, number]> = [
      [200, 200], [h.w / u - 220, 230], [210, h.h / u - 220], [h.w / u - 230, h.h / u - 230], [h.w / (2 * u) - 700, 150], [h.w / (2 * u) + 720, h.h / u - 150],
    ];
    for (const [x, y] of lugares) gorros += birrete(x * u, y * u, a.entre(90, 140) * u, "#0d1b3d", "#ffc93c", a.entre(-25, 25));
    return `${papel(h, "#1b3a8a")}
      ${confeti({ x: 0, y: 0, w: h.w, h: h.h }, 140, ["#ffc93c", "#ffffff", "#ff6f91", "#7ee0ff"], 23, [10 * u, 24 * u], [{ x: h.w * 0.12, y: h.h * 0.1, w: h.w * 0.76, h: h.h * 0.8 }])}
      ${gorros}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#ffc93c", "#1b3a8a"),
  lineaNombre: lineaSimple("#ffc93c", 6),
};

/* --------------------------------------------- Religioso --------------------------------------------- */

const comunion: Tema = {
  clave: "comunion",
  tinta: "#3a3a52",
  acento: "#b8923a",
  domingo: "#b8923a",
  margenMm: 26,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Great Vibes", tam: 210, color: "#b8923a" },
    nombre: { familia: "Playfair Display", tam: 130, color: "#3a3a52", peso: 700 },
    cuerpo: { familia: "Lora", tam: 58, color: "#3a3a52", italica: true },
    chico: { familia: "Lora", tam: 42, color: "#6b6b85" },
  },
  defs: () => filtroGrano("g", 0.7, 3, 20),
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#fffdf8")}
      ${rayos(h.cx, 0, 0, Math.max(h.w, h.h) * 0.7, 36, "#f1e4c4", 0.45)}
      ${marcoDoble(h.w, h.h, 60 * u, "#d9c18a", 6 * u, 2 * u, 20 * u)}
      ${ramaDeOlivo(h, 0)}${ramaDeOlivo(h, 1)}
      ${cruz(h.cx, 150 * u, 110 * u, "#b8923a")}
      ${h.grano("g", 0.04)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#d9c18a", "#fffdf8"),
  lineaNombre: lineaConRombo("#d9c18a"),
};

function ramaDeOlivo(h: Hoja, lado: 0 | 1): string {
  const u = escala(h);
  const x = lado ? h.w - 130 * u : 130 * u;
  const y = h.h - 130 * u;
  let out = "";
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const px = x + (lado ? -1 : 1) * t * 520 * u;
    const py = y - t * 130 * u - Math.sin(t * Math.PI) * 60 * u;
    out += hojita(px, py, 120 * u, "#9fb38a", lado ? 200 - t * 40 + (i % 2 ? 50 : -30) : -20 + t * 40 + (i % 2 ? -50 : 30));
  }
  return out;
}

const confirmacion: Tema = {
  clave: "confirmacion",
  tinta: "#2e2a4f",
  acento: "#c0392b",
  domingo: "#c0392b",
  margenMm: 26,
  fotoRedonda: true,
  fuentes: {
    titulo: { familia: "Great Vibes", tam: 200, color: "#c0392b" },
    nombre: { familia: "Playfair Display", tam: 130, color: "#2e2a4f", peso: 700 },
    cuerpo: { familia: "Lora", tam: 58, color: "#2e2a4f", italica: true },
    chico: { familia: "Lora", tam: 42, color: "#5e5a80" },
  },
  defs: () => filtroGrano("g", 0.7, 3, 22),
  fondo: (h) => {
    const u = escala(h);
    const llamas = [0, 1, 2, 3, 4].map((i) => llama(h.w - 420 * u + i * 80 * u, 210 * u + Math.abs(i - 2) * 30 * u, 60 * u, "#e67e22", "#f9d56e")).join("");
    return `${papel(h, "#fdfbff")}
      ${rayos(260 * u, 240 * u, 60 * u, 700 * u, 24, "#efe5fb", 0.6)}
      ${paloma(290 * u, 250 * u, 160 * u, "#a99ae0")}
      ${llamas}
      ${marcoDoble(h.w, h.h, 60 * u, "#c0392b", 5 * u, 2 * u, 20 * u)}
      ${h.grano("g", 0.04)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#c0392b", "#fdfbff"),
  lineaNombre: lineaConRombo("#c0392b"),
};

/* ----------------------------------------------- Formal ---------------------------------------------- */

const certificado: Tema = {
  clave: "certificado",
  tinta: "#1b2a3a",
  acento: "#1f5f8b",
  domingo: "#a33b3b",
  margenMm: 30,
  fuentes: {
    titulo: { familia: "Playfair Display", tam: 160, color: "#1f5f8b", peso: 700, mayus: "uppercase" },
    nombre: { familia: "Great Vibes", tam: 210, color: "#1b2a3a" },
    cuerpo: { familia: "Merriweather", tam: 54, color: "#1b2a3a" },
    chico: { familia: "Merriweather", tam: 40, color: "#4a5a6a" },
  },
  defs: () => filtroGrano("g", 0.7, 3, 24),
  fondo: (h) => {
    const u = escala(h);
    return `${papel(h, "#f7f9fb")}
      ${guarda(h.w, h.h, 60 * u, 90 * u, "#1f5f8b", "#fbfcfd")}
      ${medalla(h.w - 330 * u, h.h - 380 * u, 95 * u, "#c9a13b", "#1f5f8b", "#2b7bb3")}
      ${h.grano("g", 0.04)}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#1f5f8b", "#ffffff"),
  lineaNombre: lineaConRombo("#1f5f8b"),
};

const medallaDorada: Tema = {
  clave: "medalla",
  tinta: "#2a2a2a",
  acento: "#c8962f",
  domingo: "#c0392b",
  margenMm: 26,
  fuentes: {
    titulo: { familia: "Montserrat", tam: 130, color: "#c8962f", peso: 800, mayus: "uppercase" },
    nombre: { familia: "Pacifico", tam: 160, color: "#2a2a2a" },
    cuerpo: { familia: "Nunito", tam: 62, color: "#2a2a2a", peso: 600 },
    chico: { familia: "Nunito", tam: 44, color: "#666666", peso: 700 },
  },
  fondo: (h) => {
    const u = escala(h);
    const r = 120 * u;
    return `${papel(h, "#fffdf5")}
      <rect x="0" y="0" width="${h.w}" height="${f(36 * u)}" fill="#1e88e5"/><rect x="0" y="${f(36 * u)}" width="${h.w}" height="${f(20 * u)}" fill="#ffffff"/><rect x="0" y="${f(56 * u)}" width="${h.w}" height="${f(36 * u)}" fill="#e53935"/>
      <rect x="0" y="${f(h.h - 92 * u)}" width="${h.w}" height="${f(36 * u)}" fill="#e53935"/><rect x="0" y="${f(h.h - 56 * u)}" width="${h.w}" height="${f(20 * u)}" fill="#ffffff"/><rect x="0" y="${f(h.h - 36 * u)}" width="${h.w}" height="${f(36 * u)}" fill="#1e88e5"/>
      ${medalla(h.w - 280 * u, 320 * u, r, "#e0b13e", "#1e88e5", "#e53935")}
      ${cielo({ x: 0, y: 100 * u, w: h.w, h: h.h - 200 * u }, 30, ["#e0b13e", "#ffd166"], 61, [14 * u, 30 * u], [{ x: h.w * 0.12, y: h.h * 0.12, w: h.w * 0.66, h: h.h * 0.76 }])}`;
  },
  marcoFoto: (r, forma, h) => marcoFilete(r, forma, h, "#e0b13e", "#ffffff"),
  lineaNombre: lineaSimple("#e0b13e", 10),
};

export const TEMAS = {
  arcoiris,
  animalitos,
  estrellas,
  crayones,
  globos,
  floresPastel,
  pizarron,
  cuaderno,
  lapices,
  espacio,
  honor,
  medallaDorada,
  geometrico,
  minimalAzul,
  neon,
  laurel,
  deportivo,
  negroDorado,
  pergamino,
  azulOro,
  bordo,
  minimalBlanco,
  birretes,
  comunion,
  confirmacion,
  certificado,
} satisfies Record<string, Tema>;

export type ClaveDeTema = keyof typeof TEMAS;

/** El svg completo de un fondo: el del tema y lo que agrega el diseño (marcos de fotos, líneas). */
export function fondoCon(t: Tema, h: Hoja, extra = ""): string {
  return h.svg(t.fondo(h) + extra, t.defs?.(h) ?? "");
}
