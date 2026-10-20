import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, filtroNube, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cartela, cuatroEsquinas, defsRelieve, defsVineta, esquinaDeco, fileteDoble, relieve, separador, vineta } from "./formales-comun";

/**
 * Verde inglés y oro: tapa verde con un enrejado de rombos en relieve, triple filete dorado y
 * una cartela crema de esquinas cortadas con el logo del colegio. Interior crema con banda verde.
 */

const VERDE = "#1d3b2a";
const VERDE_OSC = "#142b1e";
const ORO = "#c3a25a";
const CREMA = "#f6f0e1";
const TINTA = "#1f3527";
const SEPIA = "#5b4a32";

const CARTELA = { x: CENTRO_DER - 590, y: 330, w: 1180, h: 1700 };
const FOTO_IND = centrado(CENTRO_IZQ, 320, 870, 1160);
const FOTO_GRU = centrado(CENTRO_DER, 470, 1340, 893);

const ROMBO = `<polygon points="60,6 114,60 60,114 6,60" fill="none" stroke="#ffffff" stroke-width="5"/><circle cx="60" cy="60" r="7" fill="#ffffff"/>`;
const DEFS = `${defsRelieve("r", ROMBO, 120)}${defsVineta("v")}${filtroGrano("g", 0.85, 2, 9)}${filtroNube("n", 44, 70)}`;

function tapa() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${VERDE}"/>${relieve("r", 0.55)}${grano("g", 0.07, "overlay")}${vineta("v", 0, 0.8)}${vineta("v", 1, 0.8)}`;
}

function triple(mitad: 0 | 1) {
  return fileteDoble(mitad, 100, ORO, 4, 9, 18) + fileteDoble(mitad, 145, ORO, 3, 3, 1);
}

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>
    <g filter="url(#n)" opacity="0.14"><rect x="200" y="200" width="${ANCHO - 400}" height="${ALTO - 400}" fill="#d9c9a0"/></g>${grano("g", 0.07)}`;
}

function bandaVerde(mitad: 0 | 1) {
  const x0 = mitad === 0 ? 0 : PLIEGUE;
  const b = 92;
  return `<path d="M ${x0} 0 H ${x0 + PLIEGUE} V ${ALTO} H ${x0} Z M ${x0 + b} ${b} V ${ALTO - b} H ${x0 + PLIEGUE - b} V ${b} Z" fill="${VERDE}" fill-rule="evenodd"/>
    <rect x="${x0 + b + 22}" y="${b + 22}" width="${PLIEGUE - 2 * b - 44}" height="${ALTO - 2 * b - 44}" fill="none" stroke="${ORO}" stroke-width="4"/>`;
}

export const formalVerdeIngles: Modelo = {
  slug: "formal-verde-ingles",
  nombre: "Librito Formal · Verde inglés y oro",
  descripcion:
    "Librito 30×20 cm (2 páginas) formal: tapa verde inglés con enrejado en relieve y triple filete dorado; cartela crema con el logo del colegio, el año y el curso. Interior crema con banda verde y fotos con paspartú. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Clásico", etiquetas: ["verde", "oro", "relieve", "cartela", "logo"] },

  fondoExterior: () =>
    svg(
      `${tapa()}${triple(0)}${triple(1)}
       ${cuatroEsquinas({ x: 145, y: 145, w: PLIEGUE - 290, h: ALTO - 290 }, (x, y, sx, sy) => esquinaDeco(x, y, sx, sy, ORO, 0.9))}
       ${cuatroEsquinas({ x: PLIEGUE + 145, y: 145, w: PLIEGUE - 290, h: ALTO - 290 }, (x, y, sx, sy) => esquinaDeco(x, y, sx, sy, ORO, 0.9))}
       ${cartela(agrandar(CARTELA, 16), 96, "none", ORO, 5)}
       ${cartela(CARTELA, 80, CREMA, VERDE_OSC, 3)}
       ${separador(CENTRO_DER, 905, 560, ORO)}${separador(CENTRO_DER, 1370, 560, ORO)}
       ${separador(CENTRO_IZQ, 520, 600, ORO)}`,
      DEFS,
    ),

  fondoInterior: () => svg(`${papel()}${bandaVerde(0)}${bandaVerde(1)}${separador(CENTRO_DER, 1560, 520, ORO)}`, DEFS),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 260, 1300, 230), "Compañeros", {
      familia: "Great Vibes", tam: 180, color: ORO,
    });
    a.listado(0, { x: 300, y: 620, w: PLIEGUE - 600, h: 1440 }, { familia: "Libre Baskerville", tam: 48, color: CREMA, interlineado: 1.5 });

    // Tapa: cartela
    a.logo(0, "logo", centrado(CENTRO_DER, 430, 520, 430));
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 930, 1040, 230), "Recuerdo escolar", {
      familia: "Great Vibes", tam: 150, color: TINTA,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 1170, 600, 170), "2026", {
      familia: "Libre Baskerville", tam: 120, color: TINTA, peso: 700,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1430, 1000, 260), "school.name", "Nombre del colegio", {
      familia: "Libre Baskerville", tam: 66, color: TINTA, mayus: "uppercase", interlineado: 1.3,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1740, 1000, 120), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 56, color: SEPIA, italica: true,
    });

    // Interior izquierda
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 44), { relleno: "#fffdf6", borde: ORO, grosor: 4 });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 10), { relleno: VERDE });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1620, 1300, 230), "student.fullName", "Nombre del alumno", {
      familia: "Great Vibes", tam: 140, color: TINTA,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1890, 1250, 90), "course.displayName", "Curso", {
      familia: "Libre Baskerville", tam: 46, color: SEPIA, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 270, 1250, 140), "Nuestro curso", {
      familia: "Libre Baskerville", tam: 76, color: TINTA, mayus: "uppercase",
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 40), { relleno: "#fffdf6", borde: ORO, grosor: 4 });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 10), { relleno: VERDE });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1610, 1250, 210), "course.withSchool", "Curso - Colegio", {
      familia: "Libre Baskerville", tam: 54, color: TINTA, interlineado: 1.3,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1850, 1250, 150), "Para recordar siempre", {
      familia: "Great Vibes", tam: 100, color: SEPIA,
    });
  },
};
