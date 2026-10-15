import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cuatroEsquinas, defsLino, esquinaDeco, fileteDoble, lino, rect, separador } from "./formales-comun";

/**
 * Institucional · Azul marino y plata: tapa de tela azul marino con filete plateado y una
 * etiqueta clara al centro con el logo del colegio; interior crema con fotos enmarcadas.
 */

const MARINO = "#15284a";
const PLATA = "#b9c0ca";
const PLATA_OSC = "#7f8896";
const CREMA = "#f4f1e9";
const TINTA = "#1a2a48";
const GRIS = "#56606f";

const ETIQUETA = { x: CENTRO_DER - 560, y: 300, w: 1120, h: 1760 };
const FOTO_IND = centrado(CENTRO_IZQ, 300, 960, 1250);
const FOTO_GRU = centrado(CENTRO_DER, 560, 1320, 880);

const DEFS = `${defsLino("l", 7)}${filtroGrano("g", 0.8, 2, 4)}`;

function tela() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${MARINO}"/>${lino("l", 0.22, "overlay")}${grano("g", 0.06, "screen")}`;
}

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>${lino("l", 0.09)}${grano("g", 0.05)}`;
}

export const formalAzulMarino: Modelo = {
  slug: "formal-azul-marino",
  nombre: "Librito Institucional · Azul marino y plata",
  descripcion:
    "Librito 30×20 cm (2 páginas) institucional: tapa de tela azul marino con filete plateado y etiqueta clara con el logo del colegio, el año y el curso. Interior crema con fotos enmarcadas en plata. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Formal", etiquetas: ["azul marino", "plata", "tela", "institucional", "logo"] },

  fondoExterior: () =>
    svg(
      `${tela()}${fileteDoble(0, 110, PLATA, 7, 3, 24)}${fileteDoble(1, 110, PLATA, 7, 3, 24)}
       <rect x="${ETIQUETA.x}" y="${ETIQUETA.y}" width="${ETIQUETA.w}" height="${ETIQUETA.h}" fill="${CREMA}"/>
       ${rect(agrandar({ ...ETIQUETA }, -22), PLATA_OSC, 3)}
       ${cuatroEsquinas(agrandar({ ...ETIQUETA }, -40), (x, y, sx, sy) => esquinaDeco(x, y, sx, sy, PLATA_OSC, 0.75))}
       ${separador(CENTRO_DER, 925, 520, PLATA_OSC)}${separador(CENTRO_DER, 1385, 520, PLATA_OSC)}
       ${separador(CENTRO_IZQ, 500, 560, PLATA)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}${fileteDoble(0, 95, MARINO, 6, 2, 20)}${fileteDoble(1, 95, MARINO, 6, 2, 20)}
       ${separador(CENTRO_DER, 470, 520, PLATA_OSC)}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 260, 1300, 200), "Nuestro curso", {
      familia: "Playfair Display", tam: 130, color: CREMA, italica: true,
    });
    a.listado(0, { x: 270, y: 590, w: PLIEGUE - 540, h: 1480 }, { familia: "Lora", tam: 50, color: CREMA, interlineado: 1.45 });

    // Tapa: etiqueta clara
    a.logo(0, "logo", centrado(CENTRO_DER, 420, 560, 450));
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 960, 1000, 160), "Recuerdo escolar", {
      familia: "Playfair Display", tam: 110, color: TINTA, italica: true,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 1140, 600, 190), "2026", {
      familia: "Playfair Display", tam: 150, color: TINTA, peso: 700,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1440, 980, 260), "school.name", "Nombre del colegio", {
      familia: "Playfair Display", tam: 70, color: TINTA, mayus: "uppercase", interlineado: 1.25,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1760, 980, 120), "course.displayName", "Curso", {
      familia: "Montserrat", tam: 50, color: GRIS,
    });

    // Interior izquierda
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 36), { relleno: "#ffffff", borde: PLATA, grosor: 4 });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 8), { relleno: MARINO });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1640, 1300, 200), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 112, color: TINTA, italica: true,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1870, 1300, 90), "course.displayName", "Curso", {
      familia: "Montserrat", tam: 44, color: GRIS, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 280, 1300, 160), "Compañeros de curso", {
      familia: "Playfair Display", tam: 92, color: TINTA,
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 36), { relleno: "#ffffff", borde: PLATA, grosor: 4 });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 8), { relleno: MARINO });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1560, 1300, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Lora", tam: 58, color: TINTA, interlineado: 1.3,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1830, 1300, 90), "Ciclo lectivo 2026", {
      familia: "Montserrat", tam: 44, color: GRIS, mayus: "uppercase",
    });
  },
};
