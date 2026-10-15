import { caras, panelDeFondo } from "../apaisado";
import { ALTO, ANCHO, agrandar } from "../lienzo";
import { azar, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Primaria · Exploradores (apaisado): papel kraft con mapa, brújula y caminos punteados. La tapa
 * es la foto grupal; adentro, la foto individual con su «bitácora» y la foto con los amigos.
 */

const TINTA = "#3b2a1a";
const VERDE = "#2f6b4f";
const NARANJA = "#d9822b";
const KRAFT = "#e8d2ad";

const T_FOTO = { x: 330, y: 400, w: 1700, h: 1000 };
const I_IND = { x: 170, y: 190, w: 900, h: 1230 };
const I_AMI = { x: 280, y: 2010, w: 1800, h: 1110 };

function camino(puntosXY: Array<[number, number]>, color = TINTA) {
  const d = puntosXY.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  return `<path d="${d}" stroke="${color}" stroke-width="10" stroke-dasharray="26 22" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>`;
}

function brujula(cx: number, cy: number, r: number) {
  return `<g opacity="0.85"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${TINTA}" stroke-width="8"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.82}" fill="none" stroke="${TINTA}" stroke-width="3"/>
    <polygon points="${cx},${cy - r * 0.75} ${cx + r * 0.16},${cy} ${cx},${cy + r * 0.75} ${cx - r * 0.16},${cy}" fill="${NARANJA}"/>
    <polygon points="${cx - r * 0.75},${cy} ${cx},${cy - r * 0.16} ${cx + r * 0.75},${cy} ${cx},${cy + r * 0.16}" fill="${VERDE}" opacity="0.8"/>
    <text x="${cx}" y="${cy - r - 20}" font-family="Georgia, serif" font-size="${r * 0.35}" fill="${TINTA}" text-anchor="middle">N</text></g>`;
}

function islas(semilla: number, zona: { x: number; y: number; w: number; h: number }, n: number) {
  const a = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) {
    const cx = a.entre(zona.x, zona.x + zona.w);
    const cy = a.entre(zona.y, zona.y + zona.h);
    const r = a.entre(60, 140);
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.4}" ry="${r}" fill="${VERDE}" opacity="0.13"/>`;
  }
  return out;
}

const papel = () => `<rect width="${ANCHO}" height="${ALTO}" fill="${KRAFT}"/>`;
const defs = () => filtroGrano("g", 0.75, 3, 9);

export const primariaApaisadoExplorador: Modelo = {
  slug: "primaria-apaisado-explorador",
  serie: "variadas",
  nombre: "Librito Primaria · Exploradores apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado) para primaria: papel kraft con mapa, brújula y caminos punteados. La tapa es la foto grupal; adentro, la foto individual con su «bitácora» y la foto con los amigos. Listado en la contratapa.",
  categoria: "Primaria",
  filtros: { estilo: "Informal", orientacion: "horizontal", etiquetas: ["mapa", "amigos", "apaisado", "kraft"] },

  fondoExterior: () => {
    const tapa = panelDeFondo("tapa");
    const contra = panelDeFondo("contratapa");
    const m = agrandar(T_FOTO, 30);
    return svg(
      `${papel()}
       ${tapa.svg(`${islas(3, { x: 0, y: 0, w: 2362, h: 1771 }, 9)}${camino([[120, 1650], [500, 1560], [700, 1700], [1100, 1600]])}
         ${brujula(2180, 1560, 110)}
         <rect x="${m.x + 14}" y="${m.y + 18}" width="${m.w}" height="${m.h}" fill="#000" opacity="0.15"/>
         <rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="#fbf4e6"/>`)}
       ${contra.svg(`${islas(8, { x: 0, y: 0, w: 2362, h: 1771 }, 7)}${camino([[150, 1700], [600, 1690], [1000, 1720], [1500, 1690], [2200, 1710]])}
         <rect x="160" y="420" width="2042" height="1230" rx="24" fill="#fbf4e6" opacity="0.9"/>`)}
       ${grano("g", 0.09)}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    const mi = agrandar(I_IND, 26);
    const ma = agrandar(I_AMI, 30);
    return svg(
      `${papel()}
       ${i.svg(`${islas(21, { x: 0, y: 0, w: 2362, h: 3543 }, 14)}
         <rect x="${mi.x}" y="${mi.y}" width="${mi.w}" height="${mi.h}" fill="#fbf4e6"/>
         ${camino([[1180, 1250], [1500, 1350], [1800, 1250], [2150, 1380]])}
         ${brujula(2050, 380, 120)}
         <rect x="${ma.x + 14}" y="${ma.y + 18}" width="${ma.w}" height="${ma.h}" fill="#000" opacity="0.15"/>
         <rect x="${ma.x}" y="${ma.y}" width="${ma.w}" height="${ma.h}" fill="#fbf4e6"/>`)}
       ${grano("g", 0.09)}`,
      defs(),
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);

    // Tapa
    tapa.texto("titulo", "Título", { x: 160, y: 150, w: 2040, h: 230 }, "Exploradores 2026", {
      familia: "Amatic SC", tam: 200, color: TINTA, peso: 700,
    });
    tapa.foto("grupal", T_FOTO);
    tapa.variable("curso_colegio", "Grado y escuela", { x: 250, y: 1470, w: 1700, h: 200 }, "course.withSchool", "Grado - Escuela", {
      familia: "Amatic SC", tam: 100, color: VERDE, peso: 700, interlineado: 1.0,
    });

    // Contratapa
    contratapa.texto("titulo_listado", "Título del listado", { x: 160, y: 190, w: 2040, h: 210 }, "La tripulación", {
      familia: "Amatic SC", tam: 170, color: NARANJA, peso: 700,
    });
    contratapa.listado({ x: 240, y: 480, w: 1880, h: 1120 }, { familia: "Patrick Hand", tam: 68, color: TINTA, interlineado: 1.3 }, 3);

    // Interior arriba: la bitácora
    interior.foto("individual", I_IND);
    interior.texto("etiqueta", "Etiqueta", { x: 1170, y: 560, w: 1020, h: 130 }, "Bitácora de", {
      familia: "Amatic SC", tam: 110, color: NARANJA, peso: 700, alinear: "LEFT",
    });
    interior.variable("alumno", "Nombre del alumno", { x: 1170, y: 700, w: 1020, h: 330 }, "student.fullName", "Nombre del alumno", {
      familia: "Amatic SC", tam: 170, color: TINTA, peso: 700, alinear: "LEFT", interlineado: 0.95,
    });
    interior.variable("curso", "Grado", { x: 1170, y: 1050, w: 1020, h: 130 }, "course.displayName", "Grado", {
      familia: "Patrick Hand", tam: 72, color: VERDE, alinear: "LEFT",
    });

    // Interior abajo: los amigos
    interior.foto("amigos", I_AMI);
    interior.texto("titulo_amigos", "Título foto con amigos", { x: 160, y: 3190, w: 2040, h: 200 }, "Compañeros de aventura", {
      familia: "Amatic SC", tam: 150, color: TINTA, peso: 700,
    });
  },
};
