import { ALTO, ANCHO, PLIEGUE } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Secundaria · Revista: el librito es una tapa de revista. La foto individual ocupa toda la tapa
 * (a sangre) con el título grande arriba; la grupal ocupa la contratapa. Adentro, «quiénes somos»
 * (el listado) y la foto con los amigos con una cita.
 */

const NEGRO = "#111111";
const ROJO = "#e63946";
const PAPEL = "#f5f2ec";
const IZQ_TAPA = PLIEGUE + 170;
const ANCHO_TAPA = PLIEGUE - 170 - 120;

const FOTO_AMI = { x: PLIEGUE + 170, y: 170, w: PLIEGUE - 290, h: 1450 };

export const secundariaRevista: Modelo = {
  slug: "secundaria-revista",
  serie: "variadas",
  nombre: "Librito Secundaria · Revista",
  descripcion:
    "Librito 30×20 cm para secundaria con forma de revista: la foto individual a sangre en toda la tapa, con el título grande arriba, y la grupal a sangre en la contratapa. Adentro, el listado como «quiénes somos» y la foto con los amigos con una cita.",
  categoria: "Secundaria",
  filtros: { estilo: "Moderno", orientacion: "vertical", etiquetas: ["revista", "foto a sangre", "amigos"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${NEGRO}"/>
       <rect x="0" y="1290" width="${PLIEGUE}" height="14" fill="${ROJO}"/>
       ${grano("g", 0.05, "screen")}`,
      filtroGrano("g", 0.9),
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>
       <rect x="170" y="170" width="18" height="300" fill="${ROJO}"/>
       <line x1="170" y1="560" x2="${PLIEGUE - 170}" y2="560" stroke="${NEGRO}" stroke-width="6"/>
       <line x1="${FOTO_AMI.x}" y1="${FOTO_AMI.y + FOTO_AMI.h + 70}" x2="${FOTO_AMI.x + 260}" y2="${FOTO_AMI.y + FOTO_AMI.h + 70}" stroke="${ROJO}" stroke-width="10"/>
       ${grano("g", 0.04)}`,
      filtroGrano("g", 0.9),
    ),

  armar: (a) => {
    // Tapa: la individual a sangre, título arriba y titulares sobre una franja oscura
    a.foto(0, "individual", { x: PLIEGUE, y: 0, w: PLIEGUE, h: ALTO });
    a.forma(0, "sombra_titulares", "Franja de titulares", { x: PLIEGUE, y: 1650, w: PLIEGUE, h: ALTO - 1650 }, { relleno: NEGRO, opacidad: 0.6 });
    a.texto(0, "cabecera", "Cabecera", { x: IZQ_TAPA, y: 80, w: ANCHO_TAPA, h: 340 }, "ANUARIO", {
      familia: "Bebas Neue", tam: 360, color: ROJO, alinear: "LEFT",
    });
    a.texto(0, "edicion", "Edición", { x: IZQ_TAPA + 10, y: 450, w: ANCHO_TAPA, h: 90 }, "EDICIÓN ESPECIAL 2026", {
      familia: "Montserrat", tam: 58, color: "#ffffff", peso: 700, alinear: "LEFT",
    });
    a.variable(0, "alumno", "Nombre del alumno", { x: IZQ_TAPA, y: 1700, w: ANCHO_TAPA, h: 190 }, "student.fullName", "Nombre del alumno", {
      familia: "Bebas Neue", tam: 170, color: "#ffffff", alinear: "LEFT",
    });
    a.variable(0, "curso", "Curso", { x: IZQ_TAPA, y: 1900, w: ANCHO_TAPA, h: 100 }, "course.displayName", "Curso", {
      familia: "Montserrat", tam: 66, color: "#ffd5d8", peso: 700, alinear: "LEFT",
    });
    a.variable(0, "colegio", "Nombre del colegio", { x: IZQ_TAPA, y: 2010, w: ANCHO_TAPA, h: 200 }, "school.name", "Nombre del colegio", {
      familia: "Montserrat", tam: 58, color: "#ffffff", alinear: "LEFT", interlineado: 1.15,
    });

    // Contratapa: la grupal a sangre arriba, la «bajada» abajo
    a.foto(0, "grupal", { x: 0, y: 0, w: PLIEGUE, h: 1290 });
    a.texto(0, "titulo_grupal", "Título foto grupal", { x: 170, y: 1380, w: PLIEGUE - 330, h: 230 }, "LA PROMO", {
      familia: "Bebas Neue", tam: 230, color: "#ffffff", alinear: "LEFT",
    });
    a.variable(0, "curso_colegio", "Curso y colegio", { x: 170, y: 1620, w: PLIEGUE - 330, h: 200 }, "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 64, color: "#ffffff", peso: 700, alinear: "LEFT", interlineado: 1.2,
    });
    a.texto(0, "bajada", "Bajada", { x: 170, y: 1860, w: PLIEGUE - 330, h: 300 }, "Un año de historias, risas y fotos que vamos a mirar mil veces.", {
      familia: "Playfair Display", tam: 64, color: "#cfcfcf", italica: true, alinear: "LEFT", interlineado: 1.3,
    });

    // Interior izquierda: quiénes somos
    a.texto(1, "titulo_listado", "Título del listado", { x: 230, y: 170, w: 1380, h: 300 }, "QUIÉNES SOMOS", {
      familia: "Bebas Neue", tam: 220, color: NEGRO, alinear: "LEFT",
    });
    a.listado(1, { x: 170, y: 640, w: PLIEGUE - 340, h: 1560 }, { familia: "Montserrat", tam: 56, color: NEGRO, alinear: "LEFT", interlineado: 1.45 }, 2);

    // Interior derecha: los amigos y una cita
    a.foto(1, "amigos", FOTO_AMI);
    a.texto(1, "cita", "Cita", { x: FOTO_AMI.x, y: FOTO_AMI.y + FOTO_AMI.h + 120, w: FOTO_AMI.w, h: 270 }, "«Los amigos son la familia que elegimos.»", {
      familia: "Playfair Display", tam: 76, color: NEGRO, italica: true, alinear: "LEFT", interlineado: 1.25,
    });
    a.texto(1, "titulo_amigos", "Título foto con amigos", { x: FOTO_AMI.x, y: FOTO_AMI.y + FOTO_AMI.h + 400, w: FOTO_AMI.w, h: 110 }, "LOS DE SIEMPRE", {
      familia: "Bebas Neue", tam: 100, color: ROJO, alinear: "LEFT",
    });
  },
};
