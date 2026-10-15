import { ALTO, ANCHO, PLIEGUE } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Egresados · Minimal a sangre: tres fotos que ocupan las caras enteras. La grupal en la tapa (con
 * el título debajo), la individual en toda la contratapa y la foto con los amigos en toda la
 * mitad izquierda del interior; a la derecha, el listado con mucho aire.
 */

const TINTA = "#1d1d1f";
const GRIS = "#77777c";
const ARENA = "#f4f1eb";
const IZQ_TAPA = PLIEGUE + 220;
const IZQ_INT = PLIEGUE + 220;

export const egresadosMinimalASangre: Modelo = {
  slug: "egresados-minimal-a-sangre",
  serie: "variadas",
  nombre: "Librito Egresados · Minimal a sangre",
  descripcion:
    "Librito 30×20 cm para egresados, minimalista, con fotos a sangre: la grupal en la tapa, la individual en toda la contratapa y la foto con los amigos en media página del interior. Listado del curso con mucho aire. Tres fotos.",
  categoria: "Egresados",
  filtros: { estilo: "Minimalista", orientacion: "vertical", evento: "Egreso", etiquetas: ["foto a sangre", "amigos", "minimalista"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${ARENA}"/>
       <line x1="${IZQ_TAPA}" y1="2000" x2="${IZQ_TAPA + 200}" y2="2000" stroke="${TINTA}" stroke-width="4"/>
       ${grano("g", 0.035)}`,
      filtroGrano("g", 0.9),
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${ARENA}"/>
       <line x1="${IZQ_INT}" y1="560" x2="${IZQ_INT + 200}" y2="560" stroke="${TINTA}" stroke-width="4"/>
       ${grano("g", 0.035)}`,
      filtroGrano("g", 0.9),
    ),

  armar: (a) => {
    // Contratapa: la individual a sangre, con el nombre en una etiqueta
    a.foto(0, "individual", { x: 0, y: 0, w: PLIEGUE, h: ALTO });
    a.forma(0, "etiqueta", "Etiqueta del nombre", { x: 170, y: 1950, w: 1150, h: 230 }, { relleno: ARENA, opacidad: 0.94 });
    a.variable(0, "alumno", "Nombre del alumno", { x: 230, y: 1990, w: 1050, h: 150 }, "student.fullName", "Nombre del alumno", {
      familia: "Raleway", tam: 84, color: TINTA, alinear: "LEFT",
    });

    // Tapa: la grupal arriba, a sangre, y el título con mucho aire
    a.foto(0, "grupal", { x: PLIEGUE, y: 0, w: PLIEGUE, h: 1420 });
    a.texto(0, "titulo", "Título", { x: IZQ_TAPA, y: 1540, w: 1300, h: 170 }, "Egresados", {
      familia: "Raleway", tam: 140, color: TINTA, alinear: "LEFT",
    });
    a.texto(0, "anio", "Año", { x: IZQ_TAPA, y: 1720, w: 1300, h: 220 }, "2026", {
      familia: "Raleway", tam: 190, color: TINTA, peso: 700, alinear: "LEFT",
    });
    a.variable(0, "colegio", "Nombre del colegio", { x: IZQ_TAPA, y: 2040, w: 1300, h: 190 }, "school.name", "Nombre del colegio", {
      familia: "Lora", tam: 62, color: GRIS, italica: true, alinear: "LEFT", interlineado: 1.2,
    });

    // Interior izquierda: los amigos a sangre
    a.foto(1, "amigos", { x: 0, y: 0, w: PLIEGUE, h: ALTO });

    // Interior derecha: el listado
    a.texto(1, "titulo_listado", "Título del listado", { x: IZQ_INT, y: 330, w: 1300, h: 170 }, "Compañeros", {
      familia: "Lora", tam: 110, color: TINTA, italica: true, alinear: "LEFT",
    });
    a.listado(1, { x: IZQ_INT, y: 680, w: PLIEGUE - 220 - 200, h: 1300 }, { familia: "Raleway", tam: 56, color: TINTA, alinear: "LEFT", interlineado: 1.55 }, 2);
    a.variable(1, "curso_colegio", "Curso y colegio", { x: IZQ_INT, y: 2050, w: 1300, h: 150 }, "course.withSchool", "Curso - Colegio", {
      familia: "Lora", tam: 54, color: GRIS, italica: true, alinear: "LEFT", interlineado: 1.2,
    });
  },
};
