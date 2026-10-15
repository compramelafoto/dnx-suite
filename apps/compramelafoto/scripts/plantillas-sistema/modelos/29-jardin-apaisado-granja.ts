import { caras, panelDeFondo } from "../apaisado";
import { conejo, gato, nube, oso, pollito } from "../animalitos";
import { ALTO, ANCHO, agrandar } from "../lienzo";
import { corazon, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Jardín · Granja (apaisado), sin listado: lomas verdes, sol y animalitos. Tapa con la foto
 * individual; contratapa con la foto con la seño («¡Gracias, seño!»); adentro, la grupal arriba y
 * la foto con los mejores amigos abajo. Cuatro fotos.
 */

const TINTA = "#3a3350";
const VERDE = "#7cc36a";
const VERDE_OSC = "#5aa64c";
const CIELO = "#e3f4ff";
const ROSA = "#ff7aa2";

const T_IND = { x: 170, y: 300, w: 950, h: 1180 };
const C_MAE = { x: 470, y: 260, w: 1420, h: 1060 };
const I_GRU = { x: 230, y: 300, w: 1900, h: 1150 };
const I_AMI = { x: 160, y: 1990, w: 1320, h: 1140 };

const lomas = (y: number, w: number) =>
  `<path d="M 0 ${y} C ${w * 0.25} ${y - 160}, ${w * 0.5} ${y + 40}, ${w * 0.75} ${y - 110} S ${w} ${y - 60}, ${w} ${y - 60} V ${y + 900} H 0 Z" fill="${VERDE}"/>
   <path d="M 0 ${y + 90} C ${w * 0.3} ${y - 10}, ${w * 0.6} ${y + 170}, ${w} ${y + 40} V ${y + 900} H 0 Z" fill="${VERDE_OSC}"/>`;

const sol = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd34d"/>` +
  Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return `<line x1="${cx + Math.cos(a) * r * 1.25}" y1="${cy + Math.sin(a) * r * 1.25}" x2="${cx + Math.cos(a) * r * 1.6}" y2="${cy + Math.sin(a) * r * 1.6}" stroke="#ffd34d" stroke-width="${r * 0.14}" stroke-linecap="round"/>`;
  }).join("");

const marco = (r: { x: number; y: number; w: number; h: number }, color = "#ffffff") => {
  const k = agrandar(r, 30);
  return `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="60" fill="${color}"/>`;
};

const defs = () => filtroGrano("g", 0.85);

export const jardinApaisadoGranja: Modelo = {
  slug: "jardin-apaisado-granja",
  serie: "variadas",
  nombre: "Librito Jardín · Granja apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado) para jardín, sin listado: lomas verdes, sol y animalitos. Foto individual en la tapa, foto con la seño en la contratapa y, adentro, la grupal y la foto con los mejores amigos. Cuatro fotos.",
  categoria: "Jardín",
  filtros: { estilo: "Divertido", orientacion: "horizontal", etiquetas: ["maestra", "amigos", "sin listado", "animalitos", "apaisado"] },

  fondoExterior: () => {
    const tapa = panelDeFondo("tapa");
    const contra = panelDeFondo("contratapa");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CIELO}"/>
       ${tapa.svg(`${lomas(1520, 2362)}${sol(2180, 230, 80)}${nube(1300, 180, 300, 110)}
         ${marco(T_IND)}${oso(1450, 1620, 90)}${conejo(1800, 1630, 80)}${pollito(2120, 1650, 60)}`)}
       ${contra.svg(`<rect x="0" y="1720" width="2362" height="60" fill="${VERDE}"/>${nube(150, 160, 260, 100)}${nube(1950, 150, 300, 110)}
         ${marco(C_MAE, "#ffe3ec")}${gato(250, 1250, 80)}${pollito(2120, 1250, 60)}`)}
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    const corazones = [[1700, 2150], [1900, 2350], [2100, 2120], [1650, 3000]]
      .map(([x, y]) => `<path d="${corazon(x!, y!, 90)}" fill="${ROSA}" opacity="0.8"/>`)
      .join("");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CIELO}"/>
       ${i.svg(`${nube(120, 120, 280, 100)}${sol(2200, 160, 70)}${marco(I_GRU)}
         <rect x="0" y="1771" width="2362" height="1772" fill="#fff6e8"/>
         ${lomas(3300, 2362)}${marco(I_AMI, "#ffe3ec")}${corazones}${oso(2050, 3320, 80)}${conejo(1700, 3330, 70)}`)}
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);

    // Tapa
    tapa.foto("individual", T_IND, { radio: 40 });
    tapa.texto("titulo", "Título", { x: 1230, y: 330, w: 1000, h: 240 }, "Mi año", { familia: "Pacifico", tam: 170, color: TINTA });
    tapa.texto("subtitulo", "Subtítulo", { x: 1230, y: 560, w: 1000, h: 190 }, "en el jardín", { familia: "Pacifico", tam: 120, color: ROSA });
    tapa.variable("nombre", "Nombre del alumno", { x: 1230, y: 820, w: 1000, h: 160 }, "student.firstName", "Nombre", {
      familia: "Quicksand", tam: 110, color: TINTA, peso: 700,
    });
    tapa.variable("curso", "Sala", { x: 1230, y: 990, w: 1000, h: 120 }, "course.displayName", "Sala", { familia: "Quicksand", tam: 68, color: TINTA });
    tapa.variable("colegio", "Nombre del jardín", { x: 1230, y: 1110, w: 1000, h: 200 }, "school.name", "Nombre del jardín", {
      familia: "Quicksand", tam: 64, color: TINTA, peso: 700, interlineado: 1.1,
    });

    // Contratapa: la seño
    contratapa.foto("maestra", C_MAE, { radio: 40 });
    contratapa.texto("titulo_maestra", "Título foto con la maestra", { x: 160, y: 1370, w: 2040, h: 200 }, "¡Gracias, seño!", {
      familia: "Pacifico", tam: 140, color: ROSA,
    });
    contratapa.texto("frase_maestra", "Frase", { x: 160, y: 1570, w: 2040, h: 120 }, "Por cuidarnos y enseñarnos con tanto amor", {
      familia: "Quicksand", tam: 64, color: TINTA, peso: 700,
    });

    // Interior arriba: la grupal
    interior.texto("titulo_grupal", "Título foto grupal", { x: 160, y: 110, w: 2040, h: 170 }, "Mis compañeros", {
      familia: "Pacifico", tam: 120, color: TINTA,
    });
    interior.foto("grupal", I_GRU, { radio: 40 });
    interior.variable("curso_colegio", "Sala y jardín", { x: 160, y: 1490, w: 2040, h: 130 }, "course.withSchool", "Sala - Jardín", {
      familia: "Quicksand", tam: 64, color: TINTA, peso: 700,
    });

    // Interior abajo: los mejores amigos
    interior.foto("amigos", I_AMI, { radio: 40 });
    interior.texto("titulo_amigos", "Título foto con amigos", { x: 1540, y: 2420, w: 680, h: 520 }, "Mis mejores amigos", {
      familia: "Pacifico", tam: 120, color: TINTA, interlineado: 1.25,
    });
  },
};
