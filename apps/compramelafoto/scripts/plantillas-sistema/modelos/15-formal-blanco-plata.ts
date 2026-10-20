import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cajaDeMitad, defsRelieve, fileteDoble, guardaGriega, relieve, separador, x0De } from "./formales-comun";

/**
 * Blanco y plata: papel blanco con un damasco de cuadrifolios en relieve, guarda griega plateada
 * arriba y abajo y el logo del colegio presidiendo la tapa. Textos en gris pizarra.
 */

const BLANCO = "#fbfbf9";
const PLATA = "#a2a9b3";
const PLATA_OSC = "#7d8591";
const PIZARRA = "#2f3746";
const GRIS = "#5a6270";

const FOTO_IND = centrado(CENTRO_IZQ, 420, 900, 1180);
const FOTO_GRU = centrado(CENTRO_DER, 580, 1150, 767);

/** Cuadrifolio: cuatro círculos y un rombo, dibujado en blanco para el relieve. */
const CUADRIFOLIO = `<g fill="#ffffff"><circle cx="80" cy="56" r="20"/><circle cx="80" cy="104" r="20"/><circle cx="56" cy="80" r="20"/><circle cx="104" cy="80" r="20"/><circle cx="0" cy="0" r="7"/><circle cx="160" cy="0" r="7"/><circle cx="0" cy="160" r="7"/><circle cx="160" cy="160" r="7"/></g>`;
const DEFS = `${defsRelieve("r", CUADRIFOLIO, 160)}${filtroGrano("g", 0.85, 2, 15)}`;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${BLANCO}"/>${relieve("r", 0.22)}${grano("g", 0.03)}`;
}

/** Un fondo liso detrás de la zona de textos, para que el relieve no ensucie la lectura. */
function calma(r: { x: number; y: number; w: number; h: number }) {
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${BLANCO}"/>`;
}

function guardas(mitad: 0 | 1, y: number) {
  const r = cajaDeMitad(mitad, 150);
  return guardaGriega(r.x + 10, r.x + r.w - 10, y, 64, PLATA, 5) + guardaGriega(r.x + 10, r.x + r.w - 10, ALTO - y - 64, 64, PLATA, 5);
}

export const formalBlancoPlata: Modelo = {
  slug: "formal-blanco-plata",
  nombre: "Librito Formal · Blanco y plata",
  descripcion:
    "Librito 30×20 cm (2 páginas) formal y luminoso: papel blanco con damasco en relieve, guarda griega plateada y el logo del colegio en la tapa; textos en gris pizarra. Interior con fotos con paspartú blanco y filete plata. Listado del curso en la contratapa.",
  categoria: "Formal",
  filtros: { estilo: "Formal", etiquetas: ["blanco", "plata", "relieve", "guarda griega", "logo"] },

  fondoExterior: () =>
    svg(
      `${papel()}${calma(cajaDeMitad(0, 290))}${calma(cajaDeMitad(1, 290))}
       ${fileteDoble(0, 105, PLATA, 6, 2, 18)}${fileteDoble(1, 105, PLATA, 6, 2, 18)}${guardas(0, 175)}${guardas(1, 175)}
       ${fileteDoble(0, 290, PLATA, 2, 2, 1)}${fileteDoble(1, 290, PLATA, 2, 2, 1)}
       ${separador(CENTRO_DER, 1255, 520, PLATA_OSC)}${separador(CENTRO_IZQ, 560, 560, PLATA_OSC)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}${calma(cajaDeMitad(0, 250))}${calma(cajaDeMitad(1, 250))}
       ${fileteDoble(0, 105, PLATA, 6, 2, 18)}${fileteDoble(1, 105, PLATA, 6, 2, 18)}${guardas(0, 155)}${guardas(1, 155)}
       ${fileteDoble(0, 250, PLATA, 2, 2, 1)}${fileteDoble(1, 250, PLATA, 2, 2, 1)}
       ${separador(x0De(1) + PLIEGUE / 2, 500, 480, PLATA_OSC)}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 330, 1150, 200), "Compañeros", {
      familia: "Alex Brush", tam: 150, color: PIZARRA,
    });
    a.listado(0, { x: 380, y: 640, w: PLIEGUE - 760, h: 1370 }, { familia: "Source Serif 4", tam: 48, color: PIZARRA, interlineado: 1.45 });

    // Tapa
    a.logo(0, "logo", centrado(CENTRO_DER, 360, 600, 520));
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 920, 1150, 200), "Recuerdo escolar", {
      familia: "Alex Brush", tam: 150, color: PIZARRA,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 1110, 500, 120), "2026", {
      familia: "Source Serif 4", tam: 80, color: GRIS,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1330, 1100, 270), "school.name", "Nombre del colegio", {
      familia: "Source Serif 4", tam: 72, color: PIZARRA, mayus: "uppercase", interlineado: 1.25, peso: 700,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1650, 1100, 110), "course.displayName", "Curso", {
      familia: "Source Serif 4", tam: 58, color: GRIS, italica: true,
    });

    // Interior izquierda
    a.forma(1, "paspartu_individual", "Paspartú individual", agrandar(FOTO_IND, 40), { relleno: "#ffffff", borde: PLATA, grosor: 3 });
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 6), { relleno: PLATA_OSC });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1660, 1150, 200), "student.fullName", "Nombre del alumno", {
      familia: "Alex Brush", tam: 130, color: PIZARRA,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 1870, 1150, 80), "course.displayName", "Curso", {
      familia: "Source Serif 4", tam: 44, color: GRIS, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 340, 1150, 130), "Nuestro curso", {
      familia: "Source Serif 4", tam: 76, color: PIZARRA, mayus: "uppercase",
    });
    a.forma(1, "paspartu_grupal", "Paspartú grupal", agrandar(FOTO_GRU, 36), { relleno: "#ffffff", borde: PLATA, grosor: 3 });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 6), { relleno: PLATA_OSC });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1470, 1150, 210), "course.withSchool", "Curso - Colegio", {
      familia: "Source Serif 4", tam: 54, color: PIZARRA, interlineado: 1.3,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1730, 1150, 130), "Con cariño, para recordar siempre", {
      familia: "Alex Brush", tam: 92, color: GRIS,
    });
  },
};
