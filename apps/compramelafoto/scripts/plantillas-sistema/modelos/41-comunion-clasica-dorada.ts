import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, caliz, degradadoLuz, degradadoOro, filete, flor, manojoEspigas, rayos, racimo } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Primera Comunión · Clásica blanca y dorada: marfil, orla dorada, cáliz con hostia y rayos. */

const ORO = "url(#oro)";
const ORO_TXT = "#94702c";
const ORO_PLANO = "#c4a05a";
const TINTA = "#4a3b22";

const FOTO_IND = centrado(CENTRO_IZQ, 300, 1000, 1330);
const FOTO_GRU = centrado(CENTRO_DER, 680, 1320, 880);

const DEFS = `${degradadoOro("oro")}${degradadoLuz("luz", "#fff3c9", 0.9)}${filtroGrano("g", 0.8, 2, 9)}`;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#fbf6ea"/>${grano("g", 0.05)}`;
}

/** Orla de cada mitad: filete dorado grueso, otro fino y una florcita blanca en cada esquina. */
function orla(x0: number) {
  const m = 120;
  const w = PLIEGUE;
  const esquinas = [
    [x0 + m + 14, m + 14], [x0 + w - m - 14, m + 14], [x0 + m + 14, ALTO - m - 14], [x0 + w - m - 14, ALTO - m - 14],
  ];
  return `<rect x="${x0 + m}" y="${m}" width="${w - 2 * m}" height="${ALTO - 2 * m}" fill="none" stroke="${ORO}" stroke-width="9"/>
    <rect x="${x0 + m + 28}" y="${m + 28}" width="${w - 2 * m - 56}" height="${ALTO - 2 * m - 56}" fill="none" stroke="${ORO_PLANO}" stroke-width="3"/>
    ${esquinas.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="40" fill="#fbf6ea"/>${flor(x!, y!, 52, "#ffffff", ORO_PLANO, ORO_PLANO)}`).join("")}`;
}

function marcoFoto(r: { x: number; y: number; w: number; h: number }) {
  const p = agrandar(r, 46);
  const f = agrandar(r, 14);
  return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#fffdf7" stroke="${ORO_PLANO}" stroke-width="3"/>
    <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${ORO}"/>`;
}

export const comunionClasicaDorada: Modelo = {
  slug: "comunion-clasica-dorada",
  nombre: "Librito Primera Comunión · Clásico dorado",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Primera Comunión, clásico en blanco marfil y dorado: orla dorada, cáliz con la hostia entre rayos de luz y espigas. Logo del colegio y listado de compañeros en la contratapa; foto individual y grupal en el interior.",
  serie: "religiosas",
  categoria: "Religioso",
  filtros: {
    evento: "Primera Comunión",
    estilo: "Formal",
    orientacion: "vertical",
    etiquetas: ["cáliz", "hostia", "rayos de luz", "espigas", "dorado", "marfil", "clásico"],
  },

  fondoExterior: () =>
    svg(
      `${papel()}${orla(0)}${orla(PLIEGUE)}
       <circle cx="${CENTRO_DER}" cy="560" r="560" fill="url(#luz)"/>
       ${rayos(CENTRO_DER, 548, 130, 440, 56, ORO_PLANO, 0.5, 0.035)}
       ${manojoEspigas(CENTRO_DER - 250, 1150, 330, ORO_PLANO, -32)}${manojoEspigas(CENTRO_DER + 250, 1150, 330, ORO_PLANO, 32)}
       ${caliz(CENTRO_DER, 650, 300, ORO, { linea: "#9a7430" })}
       ${filete(CENTRO_DER, 1712, 520, ORO_PLANO)}
       ${filete(CENTRO_IZQ, 850, 620, ORO_PLANO)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${papel()}${orla(0)}${orla(PLIEGUE)}
       ${marcoFoto(FOTO_IND)}${marcoFoto(FOTO_GRU)}
       ${filete(CENTRO_DER, 595, 420, ORO_PLANO)}
       ${manojoEspigas(CENTRO_DER - 120, 2140, 190, ORO_PLANO, -20)}${racimo(CENTRO_DER + 100, 2000, 130, ORO_PLANO, ORO_PLANO)}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.logo(0, "logo", centrado(CENTRO_IZQ, 250, 340, 340));
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 610, 1350, 200), "Compañeros de catequesis", {
      familia: "Great Vibes", tam: 120, color: ORO_TXT,
    });
    a.listado(0, { x: 270, y: 930, w: PLIEGUE - 540, h: 1090 }, { familia: "Lora", tam: 50, color: TINTA, interlineado: 1.45 });

    // Tapa
    a.texto(0, "titulo", "Título de tapa", centrado(CENTRO_DER, 1235, 1320, 250), "Mi Primera Comunión", {
      familia: "Great Vibes", tam: 178, color: ORO_TXT,
    });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1520, 1400, 150), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 96, color: TINTA,
    });
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 1760, 1200, 100), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Lora", tam: 60, color: ORO_TXT, italica: true,
    });
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_DER, 1930, 1300, 170), "school.name", "Colegio o parroquia", {
      familia: "Libre Baskerville", tam: 50, color: TINTA, mayus: "uppercase", interlineado: 1.3,
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1730, 1400, 210), "student.fullName", "Nombre del alumno", {
      familia: "Great Vibes", tam: 140, color: ORO_TXT,
    });
    a.texto(1, "recuerdo", "Recuerdo", centrado(CENTRO_IZQ, 1970, 1300, 100), "Recuerdo de mi Primera Comunión", {
      familia: "Lora", tam: 52, color: TINTA, italica: true,
    });

    // Interior derecha
    a.texto(1, "cita", "Cita bíblica", centrado(CENTRO_DER, 280, 1400, 210), "«Dejen que los niños vengan a mí»", {
      familia: "Playfair Display", tam: 76, color: TINTA, italica: true,
    });
    a.texto(1, "cita_ref", "Referencia de la cita", centrado(CENTRO_DER, 480, 600, 80), "Mc 10, 14", {
      familia: "Lora", tam: 44, color: ORO_TXT,
    });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1660, 1350, 170), "course.withSchool", "Curso - Colegio", {
      familia: "Libre Baskerville", tam: 52, color: TINTA, interlineado: 1.3,
    });
    a.variable(1, "fecha", "Fecha", centrado(CENTRO_DER, 1840, 1000, 90), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Lora", tam: 50, color: ORO_TXT, italica: true,
    });
  },
};
