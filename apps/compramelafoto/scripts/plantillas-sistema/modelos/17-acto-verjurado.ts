import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, filtroNube, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cajaDeMitad, marcoGuilloche, rect, selloLacre, separador, verjurado } from "./formales-comun";

/**
 * Actos · Diploma en papel verjurado: papel marfil con corondeles, marco de guilloche como el de
 * un diploma, el logo del colegio arriba y un sello de lacre al pie de la tapa.
 */

const MARFIL = "#f6f0e0";
const AZUL_TINTA = "#2c3a55";
const GUILLOCHE = "#5f6f88";
const LACRE = "#8f1d22";
const SEPIA = "#5a4a36";

const FOTO_IND = centrado(CENTRO_IZQ, 380, 900, 1200);
const FOTO_GRU = centrado(CENTRO_DER, 560, 1220, 813);

const DEFS = `${filtroNube("n", 71, 80)}${filtroGrano("g", 0.8, 3, 19)}`;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${MARFIL}"/>
    <g filter="url(#n)" opacity="0.15"><rect x="250" y="250" width="${ANCHO - 500}" height="${ALTO - 500}" fill="#d8c79e"/></g>
    ${verjurado("#7a6a4a")}${grano("g", 0.07)}`;
}

function marco(mitad: 0 | 1) {
  const r = cajaDeMitad(mitad, 150);
  return marcoGuilloche(r, 54, GUILLOCHE) + rect(agrandar(r, -50), AZUL_TINTA, 3) + rect(agrandar(r, 44), AZUL_TINTA, 2);
}

export const actoVerjurado: Modelo = {
  slug: "acto-verjurado",
  nombre: "Librito Actos · Diploma en papel verjurado",
  descripcion:
    "Librito 30×20 cm (2 páginas) para actos y fin de curso, con aire de diploma: papel marfil verjurado, marco de guilloche, logo del colegio arriba y sello de lacre al pie de la tapa. Interior con fotos con doble filete. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Formal", evento: "Acto de fin de curso", etiquetas: ["diploma", "papel verjurado", "guilloche", "sello", "logo"] },

  fondoExterior: () =>
    svg(
      `${papel()}${marco(0)}${marco(1)}
       ${separador(CENTRO_DER, 1240, 540, AZUL_TINTA)}${separador(CENTRO_IZQ, 540, 580, AZUL_TINTA)}
       ${selloLacre(CENTRO_DER, 1960, 105, LACRE, 5)}`,
      DEFS,
    ),

  fondoInterior: () => svg(`${papel()}${marco(0)}${marco(1)}${separador(CENTRO_DER, 1530, 520, AZUL_TINTA)}`, DEFS),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 310, 1150, 210), "Compañeros", {
      familia: "Alex Brush", tam: 160, color: AZUL_TINTA,
    });
    a.listado(0, { x: 370, y: 640, w: PLIEGUE - 740, h: 1360 }, { familia: "Libre Baskerville", tam: 46, color: AZUL_TINTA, interlineado: 1.5 });

    // Tapa
    a.logo(0, "logo", centrado(CENTRO_DER, 330, 520, 440));
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 800, 1150, 220), "Recuerdo escolar", {
      familia: "Alex Brush", tam: 165, color: AZUL_TINTA,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 1040, 900, 120), "Ciclo lectivo 2026", {
      familia: "Libre Baskerville", tam: 58, color: SEPIA, italica: true,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1320, 1100, 260), "school.name", "Nombre del colegio", {
      familia: "Libre Baskerville", tam: 68, color: AZUL_TINTA, mayus: "uppercase", interlineado: 1.3, peso: 700,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1620, 1100, 110), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 56, color: SEPIA,
    });

    // Interior izquierda
    a.forma(1, "filete_ext_individual", "Filete exterior individual", agrandar(FOTO_IND, 36), { relleno: "transparent", borde: AZUL_TINTA, grosor: 3 });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 14), { relleno: "#ffffff", borde: AZUL_TINTA, grosor: 6 });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1650, 1150, 220), "student.fullName", "Nombre del alumno", {
      familia: "Alex Brush", tam: 140, color: AZUL_TINTA,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1880, 1100, 90), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 44, color: SEPIA, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 330, 1100, 150), "Nuestro curso", {
      familia: "Libre Baskerville", tam: 78, color: AZUL_TINTA, mayus: "uppercase",
    });
    a.forma(1, "filete_ext_grupal", "Filete exterior grupal", agrandar(FOTO_GRU, 36), { relleno: "transparent", borde: AZUL_TINTA, grosor: 3 });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 14), { relleno: "#ffffff", borde: AZUL_TINTA, grosor: 6 });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1580, 1100, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Libre Baskerville", tam: 52, color: AZUL_TINTA, interlineado: 1.35,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1830, 1100, 150), "Para recordar siempre", {
      familia: "Alex Brush", tam: 104, color: SEPIA,
    });
  },
};
