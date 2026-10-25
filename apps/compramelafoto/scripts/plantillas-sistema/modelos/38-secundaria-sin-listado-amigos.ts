import { ALTO, ANCHO, CENTRO_DER, PLIEGUE, centrado, girarCon, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Secundaria · Amigos x siempre, sin listado: gris cemento, negro y verde lima, con cinta de
 * embalar. La foto con los amigos ocupa toda la tapa; la grupal la parte de arriba de la
 * contratapa; adentro, la individual a sangre a la izquierda y una foto libre con una nota a la
 * derecha. Cuatro fotos.
 */

const NEGRO = "#121212";
const LIMA = "#c6f432";
const CEMENTO = "#d9d6cf";

const CINTA_TAPA: Rect = { x: PLIEGUE + 140, y: 1720, w: 1500, h: 300 };
const GIRO_CINTA = -5;
const FOTO_LIB: Rect = centrado(CENTRO_DER, 170, 1450, 1150);

const defs = () =>
  filtroGrano("g", 0.85) +
  `<filter id="cemento" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="3"/><feColorMatrix type="saturate" values="0"/></filter>`;

const cemento = () =>
  `<rect width="${ANCHO}" height="${ALTO}" fill="${CEMENTO}"/><rect width="${ANCHO}" height="${ALTO}" filter="url(#cemento)" opacity="0.18" style="mix-blend-mode:multiply"/>`;

export const secundariaSinListadoAmigos: Modelo = {
  slug: "secundaria-amigos-x-siempre",
  serie: "variadas",
  nombre: "Librito Secundaria · Amigos x siempre",
  descripcion:
    "Librito 30×20 cm para secundaria, sin listado y descontracturado: gris cemento, negro y verde lima, con cinta de embalar. La foto con los amigos ocupa toda la tapa y la grupal media contratapa; adentro, la individual a sangre y una foto libre con una nota. Cuatro fotos.",
  categoria: "Secundaria",
  filtros: { estilo: "Informal", orientacion: "vertical", etiquetas: ["amigos", "sin listado", "foto a sangre", "urbano"] },

  fondoExterior: () =>
    svg(
      `${cemento()}
       <rect x="0" y="1300" width="${PLIEGUE}" height="${ALTO - 1300}" fill="${NEGRO}"/>
       ${grano("g", 0.05)}`,
      defs(),
    ),

  fondoInterior: () =>
    svg(
      `${cemento()}
       <rect x="${FOTO_LIB.x + 18}" y="${FOTO_LIB.y + 22}" width="${FOTO_LIB.w}" height="${FOTO_LIB.h}" fill="#000" opacity="0.18"/>
       <rect x="${PLIEGUE + 170}" y="1470" width="16" height="660" fill="${LIMA}"/>
       ${grano("g", 0.05)}`,
      defs(),
    ),

  armar: (a) => {
    // Tapa: los amigos a sangre y una cinta con el título
    a.foto(0, "amigos", { x: PLIEGUE, y: 0, w: PLIEGUE, h: ALTO });
    a.forma(0, "cinta", "Cinta del título", CINTA_TAPA, { relleno: LIMA, opacidad: 0.95, giro: GIRO_CINTA });
    a.texto(0, "titulo", "Título", girarCon({ x: CINTA_TAPA.x + 40, y: CINTA_TAPA.y + 25, w: CINTA_TAPA.w - 80, h: 170 }, CINTA_TAPA, GIRO_CINTA), "AMIGOS X SIEMPRE", {
      familia: "Anton", tam: 150, color: NEGRO,
    }, GIRO_CINTA);
    a.texto(0, "anio", "Año", girarCon({ x: CINTA_TAPA.x + 40, y: CINTA_TAPA.y + 190, w: CINTA_TAPA.w - 80, h: 90 }, CINTA_TAPA, GIRO_CINTA), "PROMO 2026", {
      familia: "Montserrat", tam: 60, color: NEGRO, peso: 700,
    }, GIRO_CINTA);

    // Contratapa: la grupal arriba, a sangre
    a.foto(0, "grupal", { x: 0, y: 0, w: PLIEGUE, h: 1300 });
    a.texto(0, "titulo_grupal", "Título foto grupal", { x: 170, y: 1400, w: PLIEGUE - 330, h: 220 }, "TODOS", {
      familia: "Anton", tam: 200, color: LIMA, alinear: "LEFT",
    });
    a.variable(0, "curso_colegio", "Curso y colegio", { x: 170, y: 1650, w: PLIEGUE - 330, h: 230 }, "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 66, color: "#ffffff", peso: 700, alinear: "LEFT", interlineado: 1.2,
    });
    a.texto(0, "frase", "Frase", { x: 170, y: 1930, w: PLIEGUE - 330, h: 200 }, "Los que estuvieron siempre.", {
      familia: "Permanent Marker", tam: 76, color: "#ffffff", alinear: "LEFT",
    });

    // Interior izquierda: la individual a sangre con el nombre
    a.foto(1, "individual", { x: 0, y: 0, w: PLIEGUE, h: ALTO });
    a.forma(1, "franja_nombre", "Franja del nombre", { x: 0, y: 1960, w: PLIEGUE - 200, h: 230 }, { relleno: NEGRO, opacidad: 0.9 });
    a.variable(1, "alumno", "Nombre del alumno", { x: 170, y: 1990, w: PLIEGUE - 450, h: 170 }, "student.fullName", "Nombre del alumno", {
      familia: "Anton", tam: 130, color: LIMA, alinear: "LEFT",
    });

    // Interior derecha: una foto libre y una nota
    a.foto(1, "libre", FOTO_LIB);
    a.texto(1, "etiqueta", "Etiqueta", { x: PLIEGUE + 240, y: 1470, w: 1250, h: 120 }, "ESTE AÑO FUE…", {
      familia: "Anton", tam: 96, color: NEGRO, alinear: "LEFT",
    });
    a.texto(1, "nota", "Nota", { x: PLIEGUE + 240, y: 1610, w: 1250, h: 520 }, "Recreos eternos, risas en el fondo del aula y un montón de historias que ya son leyenda.", {
      familia: "Permanent Marker", tam: 72, color: NEGRO, alinear: "LEFT", interlineado: 1.3,
    });
  },
};
