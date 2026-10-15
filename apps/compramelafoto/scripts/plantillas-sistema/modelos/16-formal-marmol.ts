import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, filtroNube, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cajaDeMitad, cuatroEsquinas, defsMarmol, esquinaDeco, marmol, rect, separador } from "./formales-comun";

/**
 * Mármol suave: mármol blanco con vetas grises apenas marcadas, marco dorado fino con esquinas
 * art déco y un recuadro central en la tapa. Textos azul pizarra.
 */

const FONDO = "#f3f1ed";
const VETA = "#8f949c";
const ORO = "#b08d57";
const PIZARRA = "#24324a";
const GRIS = "#5b6372";

const RECUADRO = { x: CENTRO_DER - 600, y: 480, w: 1200, h: 1260 };
const FOTO_IND = centrado(CENTRO_IZQ, 300, 980, 1300);
const FOTO_GRU = centrado(CENTRO_DER, 640, 1320, 880);

const DEFS = `${defsMarmol("m", VETA, 21)}${defsMarmol("m2", "#b9b2a6", 37)}${filtroNube("n", 61, 90)}${filtroGrano("g", 0.85, 2, 17)}`;

function piedra(intensidad: number) {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>
    <g filter="url(#n)" opacity="0.22"><rect x="300" y="300" width="${ANCHO - 600}" height="${ALTO - 600}" fill="#dcd6cb"/></g>
    ${marmol("m", 0.3 * intensidad)}${marmol("m2", 0.2 * intensidad)}${grano("g", 0.04)}`;
}

function marco(mitad: 0 | 1) {
  const r = cajaDeMitad(mitad, 115);
  return rect(r, ORO, 4) + rect(agrandar(r, -14), ORO, 2) + cuatroEsquinas(agrandar(r, -34), (x, y, sx, sy) => esquinaDeco(x, y, sx, sy, ORO, 0.8));
}

export const formalMarmol: Modelo = {
  slug: "formal-marmol",
  nombre: "Librito Formal · Mármol suave",
  descripcion:
    "Librito 30×20 cm (2 páginas) formal: mármol blanco de vetas suaves, marco dorado fino con esquinas art déco y recuadro central en la tapa; textos azul pizarra. Interior con fotos con paspartú blanco y filete dorado. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Clásico", etiquetas: ["mármol", "oro", "art déco", "claro"] },

  fondoExterior: () =>
    svg(
      `${piedra(1)}${marco(0)}${marco(1)}
       <rect x="${RECUADRO.x}" y="${RECUADRO.y}" width="${RECUADRO.w}" height="${RECUADRO.h}" fill="#fbfaf7" fill-opacity="0.82"/>
       ${rect(RECUADRO, ORO, 3)}${rect(agrandar(RECUADRO, 18), ORO, 2)}
       ${separador(CENTRO_DER, 1080, 520, ORO)}${separador(CENTRO_IZQ, 520, 560, ORO)}`,
      DEFS,
    ),

  fondoInterior: () => svg(`${piedra(0.6)}${marco(0)}${marco(1)}${separador(CENTRO_DER, 540, 480, ORO)}`, DEFS),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 280, 1250, 190), "Compañeros", {
      familia: "Playfair Display", tam: 120, color: PIZARRA, italica: true,
    });
    a.listado(0, { x: 320, y: 620, w: PLIEGUE - 640, h: 1440 }, { familia: "Playfair Display", tam: 48, color: PIZARRA, interlineado: 1.5 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 620, 1100, 250), "Recuerdo", {
      familia: "Playfair Display", tam: 190, color: PIZARRA, italica: true,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 860, 500, 150), "2026", {
      familia: "Raleway", tam: 100, color: ORO, peso: 700,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1170, 1060, 260), "school.name", "Nombre del colegio", {
      familia: "Raleway", tam: 66, color: PIZARRA, mayus: "uppercase", interlineado: 1.3, peso: 700,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1480, 1060, 110), "course.displayName", "Curso", {
      familia: "Playfair Display", tam: 60, color: GRIS, italica: true,
    });

    // Interior izquierda
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 34), { relleno: "#ffffff" });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 8), { relleno: ORO });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1680, 1300, 200), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 116, color: PIZARRA, italica: true,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1900, 1300, 90), "course.displayName", "Curso", {
      familia: "Raleway", tam: 46, color: GRIS, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 330, 1250, 160), "Nuestro curso", {
      familia: "Playfair Display", tam: 96, color: PIZARRA, italica: true,
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 34), { relleno: "#ffffff" });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 8), { relleno: ORO });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1640, 1300, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Raleway", tam: 54, color: PIZARRA, interlineado: 1.35,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1890, 1300, 110), "Juntos, para siempre", {
      familia: "Playfair Display", tam: 60, color: ORO, italica: true,
    });
  },
};
