import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";
import { cajaDeMitad, cuatroEsquinas, esquinaDeco, rayado, rect } from "./formales-comun";

/**
 * Egresados · Gris grafito y plata: tapa grafito con rayado diagonal fino, esquinas art déco
 * plateadas y el año grande. Interior gris perla con bandas grafito en los bordes de afuera.
 */

const GRAFITO = "#2a2c31";
const PLATA = "#c5cad2";
const BLANCO_PLATA = "#eef0f3";
const PERLA = "#eceef1";
const TINTA = "#25272c";
const GRIS = "#5d636d";

const FOTO_IND = centrado(CENTRO_IZQ + 60, 300, 940, 1250);
const FOTO_GRU = centrado(CENTRO_DER - 60, 520, 1320, 880);

const DEFS = `${filtroGrano("g", 0.9, 2, 12)}`;

function tapa() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${GRAFITO}"/>${rayado("#ffffff", 26, 2, 0.045)}${grano("g", 0.08, "overlay")}`;
}

function marcoDeco(mitad: 0 | 1, color: string) {
  const r = cajaDeMitad(mitad, 120);
  return rect(r, color, 3) + rect(agrandar(r, -30), color, 2) + cuatroEsquinas(agrandar(r, -50), (x, y, sx, sy) => esquinaDeco(x, y, sx, sy, color, 1.1));
}

/** Líneas horizontales con un rombo calado en el medio (ritmo art déco). */
function lineasDeco(cx: number, y: number, ancho: number, color: string) {
  const g = 34;
  return `<g stroke="${color}" stroke-width="3" fill="none">
    <line x1="${cx - ancho / 2}" y1="${y - 12}" x2="${cx - g}" y2="${y - 12}"/><line x1="${cx + g}" y1="${y - 12}" x2="${cx + ancho / 2}" y2="${y - 12}"/>
    <line x1="${cx - ancho / 2 + 60}" y1="${y + 12}" x2="${cx - g}" y2="${y + 12}"/><line x1="${cx + g}" y1="${y + 12}" x2="${cx + ancho / 2 - 60}" y2="${y + 12}"/>
    <polygon points="${cx},${y - 26} ${cx + 26},${y} ${cx},${y + 26} ${cx - 26},${y}"/></g>`;
}

function interior() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${PERLA}"/>${grano("g", 0.05)}
    <rect x="0" y="0" width="150" height="${ALTO}" fill="${GRAFITO}"/><rect x="${ANCHO - 150}" y="0" width="150" height="${ALTO}" fill="${GRAFITO}"/>
    <line x1="172" y1="0" x2="172" y2="${ALTO}" stroke="${GRAFITO}" stroke-width="4"/><line x1="${ANCHO - 172}" y1="0" x2="${ANCHO - 172}" y2="${ALTO}" stroke="${GRAFITO}" stroke-width="4"/>`;
}

export const egresadosGrafito: Modelo = {
  slug: "egresados-grafito",
  nombre: "Librito Egresados · Gris grafito y plata",
  descripcion:
    "Librito 30×20 cm (2 páginas) para egresados: tapa gris grafito con rayado fino, marco art déco plateado y el año de la promoción en grande. Interior gris perla con bandas grafito y fotos con filete. Listado del curso en la contratapa.",
  categoria: "Egresados",
  filtros: { estilo: "Moderno", evento: "Egresados", etiquetas: ["grafito", "plata", "art déco", "promoción"] },

  fondoExterior: () =>
    svg(
      `${tapa()}${marcoDeco(0, PLATA)}${marcoDeco(1, PLATA)}
       ${lineasDeco(CENTRO_DER, 640, 760, PLATA)}${lineasDeco(CENTRO_DER, 1290, 760, PLATA)}
       ${lineasDeco(CENTRO_IZQ, 520, 700, PLATA)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(`${interior()}<line x1="${CENTRO_DER - 60 - 300}" y1="1590" x2="${CENTRO_DER - 60 + 300}" y2="1590" stroke="${GRIS}" stroke-width="3"/>`, DEFS),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 300, 1250, 150), "Mis compañeros", {
      familia: "Raleway", tam: 84, color: BLANCO_PLATA, mayus: "uppercase", peso: 700,
    });
    a.listado(0, { x: 320, y: 620, w: PLIEGUE - 640, h: 1420 }, { familia: "Raleway", tam: 48, color: PLATA, interlineado: 1.5 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 440, 1200, 130), "Promoción", {
      familia: "Raleway", tam: 92, color: PLATA, mayus: "uppercase", peso: 700,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 700, 1200, 520), "2026", {
      familia: "Playfair Display", tam: 400, color: BLANCO_PLATA, peso: 700, interlineado: 1.1,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1400, 1150, 250), "school.name", "Nombre del colegio", {
      familia: "Raleway", tam: 66, color: BLANCO_PLATA, mayus: "uppercase", interlineado: 1.3, peso: 700,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1700, 1150, 110), "course.displayName", "Curso", {
      familia: "Raleway", tam: 56, color: PLATA,
    });

    // Interior izquierda
    a.forma(1, "filete_individual", "Filete individual", agrandar(FOTO_IND, 18), { relleno: "#ffffff", borde: GRAFITO, grosor: 5 });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ + 60, 1630, 1300, 200), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 112, color: TINTA, peso: 700,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ + 60, 1850, 1300, 90), "course.displayName", "Curso", {
      familia: "Raleway", tam: 48, color: GRIS, mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER - 60, 300, 1300, 130), "Egresados 2026", {
      familia: "Raleway", tam: 80, color: TINTA, mayus: "uppercase", peso: 700,
    });
    a.forma(1, "filete_grupal", "Filete grupal", agrandar(FOTO_GRU, 18), { relleno: "#ffffff", borde: GRAFITO, grosor: 5 });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER - 60, 1640, 1300, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Playfair Display", tam: 60, color: TINTA, interlineado: 1.3,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER - 60, 1900, 1300, 100), "El final de una etapa, el comienzo de otra", {
      familia: "Raleway", tam: 46, color: GRIS, italica: true,
    });
  },
};
