import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { nube } from "../animalitos";
import { azar, estrella, filtroGrano, grano, svg } from "../texturas";
import { DESCRIPCION_MOSAICO, ETIQUETAS_MOSAICO, mosaicoEnDosPaginas } from "./mosaicos-comun";
import type { Modelo } from "./tipo";

/**
 * Carpeta del curso · Arcoíris y nubes: cielo celeste con un arcoíris pastel que abraza el
 * retrato de la tapa y nubes blancas. Adentro, el mosaico en recuadros redondeados con el nombre
 * sobre una cinta blanca.
 */

const TINTA = "#3d4a7a";
const ROSA = "#f27c9b";
const ARCOIRIS = ["#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#bdb2ff"];

const RETRATO = centrado(CENTRO_DER, 560, 980, 1180);
const GRUPAL = centrado(CENTRO_IZQ, 380, 1400, 930);
const MAESTRA = { x: 270, y: 1520, w: 500, h: 600 };

const DEFS = `<linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#bfe6ff"/><stop offset="1" stop-color="#eef8ff"/></linearGradient>
  ${filtroGrano("g", 0.85)}`;

/** Arcoíris de bandas gruesas centrado en (cx, cy). */
function arcoiris(cx: number, cy: number, r: number, banda: number) {
  return ARCOIRIS.map(
    (c, i) =>
      `<path d="M ${cx - (r - i * banda)} ${cy} A ${r - i * banda} ${r - i * banda} 0 0 1 ${cx + (r - i * banda)} ${cy}" stroke="${c}" stroke-width="${banda + 1}" fill="none"/>`,
  ).join("");
}

function brillitos(semilla: number, puntos: Array<[number, number]>) {
  const a = azar(semilla);
  return puntos
    .map(([x, y]) => `<polygon points="${estrella(x, y, a.entre(20, 36), 4, 0.35)}" fill="${a.elegir(["#ffffff", "#ffe28a", "#ffc6d3"])}"/>`)
    .join("");
}

export const mosaicoJardinArcoiris: Modelo = {
  slug: "mosaico-jardin-arcoiris",
  serie: "mosaicos",
  nombre: "Carpeta del curso · Arcoíris y nubes",
  descripcion: `Carpeta 30×20 cm para jardín: cielo celeste, arcoíris pastel y nubes blancas. El retrato grande del alumno bajo el arcoíris en la tapa; la foto grupal y la seño en la contratapa. ${DESCRIPCION_MOSAICO}`,
  categoria: "Jardín",
  filtros: { estilo: "Divertido", etiquetas: ["mosaico", "compañeros", "arcoíris", "nubes", "pastel", "maestra"] },
  etiquetasDeFotos: ETIQUETAS_MOSAICO,

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="url(#cielo)"/>
       ${arcoiris(CENTRO_DER, RETRATO.y + 600, 780, 62)}
       ${nube(RETRATO.x - 340, RETRATO.y + 430, 540, 240)}${nube(RETRATO.x + RETRATO.w - 190, RETRATO.y + 450, 520, 230)}
       
       ${nube(60, 2150, 360, 160, "#ffffff", 0.75)}${nube(1340, 2130, 380, 170, "#ffffff", 0.85)}
       ${nube(1880, 2140, 420, 180, "#ffffff", 0.9)}${nube(3060, 2120, 440, 190, "#ffffff", 0.9)}
       ${brillitos(3, [[1960, 420], [3420, 560], [140, 200], [1640, 230], [1620, 1400], [3400, 1500], [2000, 1500], [1600, 2250]])}
       ${grano("g", 0.04)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="url(#cielo)"/>
       ${arcoiris(PLIEGUE, ALTO + 260, 560, 46)}
       ${nube(-60, 40, 420, 190, "#ffffff", 0.9)}${nube(ANCHO - 360, 40, 420, 190, "#ffffff", 0.9)}
       ${nube(PLIEGUE - 520, ALTO - 170, 440, 180, "#ffffff", 0.95)}${nube(PLIEGUE + 80, ALTO - 170, 440, 180, "#ffffff", 0.95)}
       ${brillitos(7, [[240, 300], [1560, 160], [1980, 160], [3300, 300]])}
       ${grano("g", 0.04)}`,
      DEFS,
    ),

  armar: (a) => {
    const titulo = (tam: number, color = TINTA, extra = {}) => ({ familia: "Quicksand", tam, color, peso: 700, ...extra });
    const redonda = (tam: number, color = TINTA, extra = {}) => ({ familia: "Nunito", tam, color, peso: 700, ...extra });

    // Contratapa
    a.texto(0, "titulo_grupal", "Título de la contratapa", centrado(CENTRO_IZQ, 150, 1300, 180), "¡Somos un equipo!", titulo(120, ROSA));
    a.forma(0, "marco_grupal", "Marco de la foto grupal", agrandar(GRUPAL, 26), { relleno: "#ffffff", radio: 70 });
    a.foto(0, "grupal", GRUPAL, { radio: 50 });
    a.forma(0, "marco_maestra", "Marco de la seño", agrandar(MAESTRA, 22), { relleno: "#ffffff", radio: 60, giro: -3 });
    a.foto(0, "maestra", MAESTRA, { radio: 44, giro: -3 });
    a.texto(0, "titulo_maestra", "Título de la seño", { x: 900, y: 1600, w: 740, h: 170 }, "Nuestra seño", titulo(112, TINTA, { alinear: "LEFT" }));
    a.variable(0, "curso_contratapa", "Sala y jardín", { x: 900, y: 1790, w: 740, h: 260 }, "course.withSchool", "Sala - Jardín", redonda(66, "#5a6aa0", { alinear: "LEFT", interlineado: 1.2, peso: 600 }));

    // Tapa: el retrato bajo el arcoíris.
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 150, 1400, 170), "course.displayName", "Sala", titulo(120, ROSA));
    a.forma(0, "marco_retrato", "Marco del retrato", agrandar(RETRATO, 30), { relleno: "#ffffff", radio: 120 });
    a.foto(0, "individual", RETRATO, { radio: 96 });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1810, 1420, 180), "student.fullName", "Nombre del alumno", titulo(108, TINTA, { interlineado: 1.05 }));
    a.variable(0, "colegio", "Jardín", centrado(CENTRO_DER, 2000, 1300, 110), "school.name", "Jardín", redonda(64, "#5a6aa0", { peso: 600 }));

    // Interior
    a.texto(1, "titulo_mosaico", "Título del mosaico", centrado(CENTRO_IZQ, 100, 1300, 170), "Mis compañeros", titulo(118, ROSA));
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 100, 1300, 170), "Sala 2026", titulo(118, TINTA));
    mosaicoEnDosPaginas(a, 330, 1840, redonda(44, TINTA), {
      frame: "rounded",
      cornerRadius: 46,
      photoAspect: 0.95,
      gapX: 40,
      gapY: 28,
      borderWidth: 12,
      borderColor: "#ffffff",
      namePosition: "insideBottom",
      nameLines: 1,
      nameBackground: "#ffffff",
      givenNames: "first",
    });
  },
};
