import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Graduación · Sol: papel crema con un sol suave detrás del año, tres franjas cálidas (rojo,
 * naranja y amarillo) al pie de cada cara y un filete verde. Tapa con el logo del colegio y
 * «Graduación 7° 2026»; contratapa con un «2026» grande. Interior: foto individual con el nombre
 * del alumno y el curso, y la foto grupal con el curso y el colegio. Hecho para la colación de
 * 7° grado de la Escuela N° 1061 «José Ingenieros» (Funes), con los colores de su logo.
 */

const CREMA = "#fdf8ef";
const ROJO = "#d7261e";
const NARANJA = "#f28c28";
const AMARILLO = "#ffd21f";
const VERDE = "#3a9a3f";
const TINTA = "#2b2420";
const GRIS = "#6d635b";

const FOTO_IND: Rect = centrado(CENTRO_IZQ, 200, 1150, 1500);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 260, 1450, 967);

const DEFS = filtroGrano("g", 0.9, 2, 75);

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>${grano("g", 0.035)}`;
}

/** Las tres franjas cálidas al pie, de corte a corte (el doblez no las corta: es fondo). */
function franjas() {
  return `<rect x="0" y="${ALTO - 140}" width="${ANCHO}" height="40" fill="${ROJO}"/>
    <rect x="0" y="${ALTO - 100}" width="${ANCHO}" height="40" fill="${NARANJA}"/>
    <rect x="0" y="${ALTO - 60}" width="${ANCHO}" height="60" fill="${AMARILLO}"/>`;
}

export const graduacionSol: Modelo = {
  slug: "graduacion-sol",
  nombre: "Librito Graduación · Sol",
  descripcion:
    "Librito 30×20 cm abierto (2 páginas) para la colación de 7° grado: papel crema con un sol suave y franjas rojo, naranja y amarillo. Tapa con el logo del colegio y «Graduación 7° 2026»; contratapa con un «2026» grande. Interior con la foto individual (nombre del alumno y curso) y la foto grupal (curso y colegio).",
  // 7° grado es el último de la primaria: así la vista 3D usa las fotos de demo de primaria.
  categoria: "Primaria",
  serie: "graduacion",
  filtros: { estilo: "Moderno", evento: "Egreso", etiquetas: ["graduación", "colación", "7° grado", "sol", "logo", "cálido"] },

  fondoExterior: () =>
    svg(
      `${papel()}
       <circle cx="${CENTRO_IZQ}" cy="1000" r="640" fill="${AMARILLO}" opacity="0.22"/>
       <circle cx="${CENTRO_IZQ}" cy="1000" r="470" fill="${NARANJA}" opacity="0.12"/>
       <rect x="${CENTRO_DER - 160}" y="1470" width="320" height="10" fill="${VERDE}"/>
       ${franjas()}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}
       <rect x="${FOTO_GRU.x}" y="${FOTO_GRU.y + FOTO_GRU.h + 300}" width="320" height="10" fill="${VERDE}"/>
       ${franjas()}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa: el año grande sobre el sol.
    a.texto(0, "anio_grande", "Año grande", centrado(CENTRO_IZQ, 640, 1400, 720), "2026", {
      familia: "Anton", tam: 600, color: ROJO, interlineado: 1,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_IZQ, 1780, 1400, 200), "school.name", "Nombre del colegio", {
      familia: "Montserrat", tam: 58, color: GRIS, mayus: "uppercase", interlineado: 1.25,
    });

    // Tapa: logo, «Graduación» y «7° 2026».
    a.logo(0, "logo", centrado(CENTRO_DER, 200, 860, 860));
    a.texto(0, "titulo", "Título", centrado(CENTRO_DER, 1130, 1400, 280), "Graduación", {
      familia: "Playfair Display", tam: 210, color: TINTA, italica: true, interlineado: 1.1,
    });
    a.texto(0, "subtitulo", "Grado y año", centrado(CENTRO_DER, 1540, 1400, 220), "7° 2026", {
      familia: "Montserrat", tam: 160, color: ROJO, peso: 700,
    });

    // Interior izquierda: foto individual, nombre y curso.
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 14), { relleno: NARANJA });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, FOTO_IND.y + FOTO_IND.h + 60, 1300, 170), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 104, color: TINTA, italica: true,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, FOTO_IND.y + FOTO_IND.h + 235, 1300, 110), "course.displayName", "Curso", {
      familia: "Montserrat", tam: 58, color: ROJO, peso: 600,
    });

    // Interior derecha: foto grupal con el curso y el colegio.
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 14), { relleno: NARANJA });
    a.foto(1, "grupal", FOTO_GRU);
    a.texto(1, "titulo_grupal", "Título foto grupal", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 90, w: FOTO_GRU.w, h: 180 }, "Nuestro curso", {
      familia: "Playfair Display", tam: 110, color: TINTA, italica: true, alinear: "LEFT",
    });
    a.variable(1, "curso_colegio", "Curso y colegio", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 360, w: FOTO_GRU.w, h: 230 }, "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 60, color: TINTA, interlineado: 1.35, alinear: "LEFT",
    });
    a.texto(1, "frase_interior", "Frase interior", { x: FOTO_GRU.x, y: FOTO_GRU.y + FOTO_GRU.h + 620, w: FOTO_GRU.w, h: 110 }, "Promoción 2026", {
      familia: "Montserrat", tam: 52, color: GRIS, mayus: "uppercase", alinear: "LEFT",
    });
  },
};
