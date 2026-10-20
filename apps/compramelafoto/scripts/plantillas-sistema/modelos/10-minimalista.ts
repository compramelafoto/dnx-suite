import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Minimalista · Blanco: mucho aire, una línea fina, un punto de color y tipografía liviana. */

const TINTA = "#222222";
const GRIS = "#7a7a7a";
const SALVIA = "#9aae8c";
const IZQ_TAPA = PLIEGUE + 240;

const FOTO_IND: Rect = centrado(CENTRO_IZQ, 230, 1180, 1530);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 230, 1400, 933);

function hoja() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#fbfaf7"/>${grano("g", 0.035)}`;
}

export const minimalista: Modelo = {
  slug: "minimalista",
  nombre: "Librito Minimalista · Blanco",
  descripcion:
    "Librito 30×20 cm (2 páginas) minimalista: fondo blanco, mucho aire, una línea fina y un punto de color, tipografía liviana. Sirve para cualquier nivel. Fotos grandes en el interior; listado del curso en la contratapa.",
  categoria: "Formal",

  fondoExterior: () =>
    svg(
      `${hoja()}
       <circle cx="${ANCHO - 330}" cy="360" r="70" fill="${SALVIA}"/>
       <line x1="${IZQ_TAPA}" y1="1440" x2="${IZQ_TAPA + 260}" y2="1440" stroke="${TINTA}" stroke-width="4"/>
       <line x1="260" y1="560" x2="520" y2="560" stroke="${TINTA}" stroke-width="4"/>`,
      filtroGrano("g", 0.9),
    ),

  fondoInterior: () =>
    svg(
      `${hoja()}
       <line x1="${FOTO_GRU.x}" y1="${FOTO_GRU.y + FOTO_GRU.h + 110}" x2="${FOTO_GRU.x + 260}" y2="${FOTO_GRU.y + FOTO_GRU.h + 110}" stroke="${TINTA}" stroke-width="4"/>
       <circle cx="${FOTO_GRU.x + FOTO_GRU.w - 30}" cy="${ALTO - 300}" r="40" fill="${SALVIA}"/>`,
      filtroGrano("g", 0.9),
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", { x: 260, y: 380, w: 1200, h: 150 }, "Compañeros", {
      familia: "Lora", tam: 100, color: TINTA, italica: true, alinear: "LEFT",
    });
    a.listado(0, { x: 260, y: 680, w: PLIEGUE - 520, h: 1420 }, { familia: "Raleway", tam: 56, color: GRIS, alinear: "LEFT", interlineado: 1.5 });

    // Tapa
    a.texto(0, "etiqueta", "Etiqueta", { x: IZQ_TAPA, y: 1240, w: 1200, h: 120 }, "Recuerdo 2026", {
      familia: "Raleway", tam: 62, color: GRIS, alinear: "LEFT", mayus: "uppercase",
    });
    a.variable(0, "colegio", "Nombre del colegio", { x: IZQ_TAPA, y: 1510, w: 1250, h: 330 }, "school.name", "Nombre del colegio", {
      familia: "Raleway", tam: 125, color: TINTA, alinear: "LEFT", interlineado: 1.12,
    });
    a.variable(0, "curso", "Curso", { x: IZQ_TAPA, y: 1870, w: 1250, h: 130 }, "course.displayName", "Curso", {
      familia: "Lora", tam: 76, color: GRIS, italica: true, alinear: "LEFT",
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", { x: FOTO_IND.x, y: FOTO_IND.y + FOTO_IND.h + 70, w: FOTO_IND.w, h: 150 }, "student.fullName", "Nombre del alumno", {
      familia: "Raleway", tam: 96, color: TINTA, alinear: "LEFT",
    });
    a.variable(1, "curso", "Curso", { x: FOTO_IND.x, y: FOTO_IND.y + FOTO_IND.h + 220, w: FOTO_IND.w, h: 100 }, "course.displayName", "Curso", {
      familia: "Lora", tam: 60, color: GRIS, italica: true, alinear: "LEFT",
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 180, w: FOTO_GRU.w, h: 220 }, "course.withSchool", "Curso - Colegio", {
      familia: "Raleway", tam: 72, color: TINTA, alinear: "LEFT", interlineado: 1.25,
    });
    a.texto(1, "frase_interior", "Frase interior", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 440, w: 1200, h: 200 }, "Lo simple también se recuerda para siempre.", {
      familia: "Lora", tam: 66, color: GRIS, italica: true, alinear: "LEFT",
    });
  },
};
