import { ALTO, ANCHO, PLIEGUE, agrandar } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { defsLino, lino } from "./formales-comun";

/**
 * Institucional · Banda bordó: papel blanco de lino con una banda vertical bordó con dos líneas
 * doradas en el borde de afuera (como la cinta de un libro de actas), el logo del colegio arriba y
 * los textos alineados a la izquierda. Sobrio y moderno.
 */

const BLANCO = "#fbfaf6";
const BORDO = "#6b1a28";
const ORO = "#c09a55";
const TINTA = "#2a2326";
const GRIS = "#625a5c";

/** Ancho de la banda desde el corte. */
const BANDA = 250;
/** Columna de textos de la tapa: entre el pliegue (+10 mm y aire) y la banda. */
const COL_TAPA = { x: PLIEGUE + 260, w: ANCHO - BANDA - 160 - (PLIEGUE + 260) };
/** Columna del listado en la contratapa (la banda está a la izquierda). */
const COL_LISTA = { x: BANDA + 170, w: PLIEGUE - 260 - (BANDA + 170) };

const FOTO_IND = { x: BANDA + 170, y: 330, w: 1060, h: 1400 };
const FOTO_GRU = { x: PLIEGUE + 230, y: 330, w: 1200, h: 800 };

const DEFS = `${defsLino("l", 31)}${filtroGrano("g", 0.85, 2, 31)}`;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${BLANCO}"/>${lino("l", 0.07)}${grano("g", 0.03)}`;
}

/** Banda bordó con dos filetes dorados; `lado` = "izq" (contra el corte izquierdo) o "der". */
function banda(lado: "izq" | "der") {
  const x = lado === "izq" ? 0 : ANCHO - BANDA;
  const f1 = lado === "izq" ? BANDA - 46 : ANCHO - BANDA + 34;
  const f2 = lado === "izq" ? BANDA - 70 : ANCHO - BANDA + 58;
  return `<rect x="${x}" y="0" width="${BANDA}" height="${ALTO}" fill="${BORDO}"/>
    <rect x="${f1}" y="0" width="12" height="${ALTO}" fill="${ORO}"/><rect x="${f2}" y="0" width="5" height="${ALTO}" fill="${ORO}"/>`;
}

export const institucionalBanda: Modelo = {
  slug: "institucional-banda",
  nombre: "Librito Institucional · Banda bordó",
  descripcion:
    "Librito 30×20 cm (2 páginas) institucional y sobrio: papel blanco de lino con banda bordó y filetes dorados en los bordes, logo del colegio arriba y textos alineados a la izquierda. Interior con fotos grandes con filete bordó. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Moderno", etiquetas: ["bordó", "banda", "lino", "institucional", "logo"] },

  fondoExterior: () =>
    svg(
      `${papel()}${banda("izq")}${banda("der")}
       <rect x="${COL_TAPA.x}" y="1235" width="420" height="10" fill="${BORDO}"/>
       <rect x="${COL_LISTA.x}" y="505" width="320" height="8" fill="${BORDO}"/>`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}${banda("izq")}${banda("der")}
       <rect x="${FOTO_GRU.x}" y="${FOTO_GRU.y + FOTO_GRU.h + 150}" width="420" height="8" fill="${BORDO}"/>`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", { x: COL_LISTA.x, y: 300, w: COL_LISTA.w, h: 180 }, "Compañeros", {
      familia: "Source Serif 4", tam: 120, color: BORDO, italica: true, alinear: "LEFT",
    });
    a.listado(0, { x: COL_LISTA.x, y: 620, w: COL_LISTA.w, h: 1440 }, { familia: "Source Serif 4", tam: 48, color: TINTA, interlineado: 1.5, alinear: "LEFT" });

    // Tapa
    a.logo(0, "logo", { x: COL_TAPA.x, y: 300, w: 460, h: 460 });
    a.texto(0, "frase", "Frase de tapa", { x: COL_TAPA.x, y: 860, w: COL_TAPA.w, h: 150 }, "Recuerdo escolar", {
      familia: "Source Serif 4", tam: 100, color: BORDO, italica: true, alinear: "LEFT",
    });
    a.texto(0, "anio", "Año", { x: COL_TAPA.x, y: 1010, w: COL_TAPA.w, h: 200 }, "2026", {
      familia: "Montserrat", tam: 160, color: BORDO, peso: 700, alinear: "LEFT",
    });
    a.variable(0, "colegio", "Nombre del colegio", { x: COL_TAPA.x, y: 1320, w: COL_TAPA.w, h: 280 }, "school.name", "Nombre del colegio", {
      familia: "Source Serif 4", tam: 76, color: TINTA, mayus: "uppercase", interlineado: 1.2, peso: 700, alinear: "LEFT",
    });
    a.variable(0, "curso", "Curso", { x: COL_TAPA.x, y: 1640, w: COL_TAPA.w, h: 110 }, "course.displayName", "Curso", {
      familia: "Montserrat", tam: 54, color: GRIS, alinear: "LEFT",
    });

    // Interior izquierda: foto grande y nombre a la izquierda
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 12), { relleno: BORDO });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", { x: FOTO_IND.x, y: 1800, w: COL_LISTA.w, h: 180 }, "student.fullName", "Nombre del alumno", {
      familia: "Source Serif 4", tam: 110, color: BORDO, italica: true, alinear: "LEFT",
    });
    a.variable(1, "curso", "Curso", { x: FOTO_IND.x, y: 1990, w: COL_LISTA.w, h: 90 }, "course.displayName", "Curso", {
      familia: "Montserrat", tam: 46, color: GRIS, alinear: "LEFT",
    });

    // Interior derecha
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 12), { relleno: BORDO });
    a.foto(1, "grupal", FOTO_GRU);
    a.texto(1, "titulo_grupal", "Título foto grupal", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 230, w: FOTO_GRU.w, h: 150 }, "Nuestro curso", {
      familia: "Source Serif 4", tam: 96, color: BORDO, italica: true, alinear: "LEFT",
    });
    a.variable(1, "curso_colegio", "Curso y colegio", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 400, w: FOTO_GRU.w, h: 220 }, "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 54, color: TINTA, interlineado: 1.35, alinear: "LEFT",
    });
    a.texto(1, "frase_interior", "Frase interior", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 650, w: FOTO_GRU.w, h: 100 }, "Ciclo lectivo 2026", {
      familia: "Montserrat", tam: 46, color: GRIS, mayus: "uppercase", alinear: "LEFT",
    });
  },
};
