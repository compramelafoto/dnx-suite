import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, filete, flor, puntilla, ramito } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Primera Comunión · Puntillas y flores (para nena): marfil, encaje rosa empolvado y flores blancas. */

const ROSA = "#ead2cc";
const ROSA_TXT = "#a86a6c";
const ORO = "#c7a35e";
const VERDE = "#a8b89f";
const TEXTO = "#5e4a48";
const BORDE_FLOR = "#e2cfc7";

const FOTO_IND: Rect = centrado(CENTRO_IZQ, 330, 1020, 1320);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 330, 1320, 880);
const FOTO_AMI: Rect = { x: 1990, y: 1370, w: 760, h: 570 };
const TXT_X = FOTO_AMI.x + FOTO_AMI.w + 70;

function papel() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#fcf7f2"/>${grano("g", 0.04)}`;
}

/** Encaje arriba y abajo de cada mitad (cortado antes del pliegue). */
function encajes() {
  return [0, PLIEGUE].map((x0) => `${puntilla(x0, x0 + PLIEGUE, 0, 48, ROSA, true)}${puntilla(x0, x0 + PLIEGUE, ALTO, 48, ROSA, false)}`).join("");
}

function marco(r: Rect) {
  const p = agrandar(r, 40);
  const f = agrandar(r, 10);
  return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="14" fill="#ffffff" stroke="${ROSA}" stroke-width="5"/>
    <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="6" fill="${ORO}"/>`;
}

/** Florcitas en las esquinas de un marco. */
function esquinas(r: Rect, t = 44) {
  const p = agrandar(r, 40);
  return [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]]
    .map(([x, y], i) => flor(x!, y!, t, "#ffffff", ORO, BORDE_FLOR, i * 17))
    .join("");
}

export const comunionPuntillasFlores: Modelo = {
  slug: "comunion-puntillas-flores",
  nombre: "Librito Primera Comunión · Puntillas y flores",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Primera Comunión pensado para nenas: papel marfil, puntillas de encaje rosa empolvado, ramito de flores blancas y detalles dorados. Listado de compañeros en la contratapa; foto individual, grupal y con amigos en el interior.",
  serie: "religiosas",
  categoria: "Religioso",
  filtros: {
    evento: "Primera Comunión",
    estilo: "Clásico",
    orientacion: "vertical",
    etiquetas: ["nena", "puntillas", "encaje", "flores blancas", "rosa empolvado", "dorado"],
  },

  fondoExterior: () =>
    svg(
      `${papel()}${encajes()}
       ${ramito(CENTRO_DER, 900, 620, "#ffffff", ORO, VERDE, 7, BORDE_FLOR)}
       ${filete(CENTRO_DER, 1580, 460, ORO)}
       ${filete(CENTRO_IZQ, 560, 520, ORO)}
       ${ramito(CENTRO_IZQ, 2110, 260, "#ffffff", ORO, VERDE, 3, BORDE_FLOR)}`,
      filtroGrano("g", 0.8, 2, 6),
    ),

  fondoInterior: () =>
    svg(
      `${papel()}${encajes()}
       ${marco(FOTO_IND)}${marco(FOTO_GRU)}${marco(FOTO_AMI)}
       ${esquinas(FOTO_IND)}${esquinas(FOTO_GRU)}${esquinas(FOTO_AMI, 34)}`,
      filtroGrano("g", 0.8, 2, 6),
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 300, 1300, 220), "Mis compañeros", {
      familia: "Alex Brush", tam: 140, color: ROSA_TXT,
    });
    a.listado(0, { x: 280, y: 680, w: PLIEGUE - 560, h: 1180 }, { familia: "Lora", tam: 50, color: TEXTO, interlineado: 1.45 });

    // Tapa
    a.texto(0, "titulo", "Título de tapa", centrado(CENTRO_DER, 1060, 1350, 300), "Mi Primera Comunión", {
      familia: "Alex Brush", tam: 196, color: ROSA_TXT,
    });
    a.variable(0, "alumno", "Nombre de la alumna", centrado(CENTRO_DER, 1380, 1400, 150), "student.fullName", "Nombre de la alumna", {
      familia: "Playfair Display", tam: 92, color: TEXTO,
    });
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 1640, 1000, 100), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Lora", tam: 58, color: ROSA_TXT, italica: true,
    });
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_DER, 1830, 1250, 170), "school.name", "Colegio o parroquia", {
      familia: "Lora", tam: 48, color: TEXTO, mayus: "uppercase", interlineado: 1.3,
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND, { radio: 6 });
    a.variable(1, "alumno", "Nombre de la alumna", centrado(CENTRO_IZQ, 1730, 1400, 220), "student.fullName", "Nombre de la alumna", {
      familia: "Alex Brush", tam: 140, color: ROSA_TXT,
    });
    a.texto(1, "cita", "Cita bíblica", centrado(CENTRO_IZQ, 1960, 1350, 110), "«Dejen que los niños vengan a mí» · Mc 10, 14", {
      familia: "Lora", tam: 46, color: TEXTO, italica: true,
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU, { radio: 6 });
    a.foto(1, "amigos", FOTO_AMI, { radio: 6 });
    a.texto(1, "titulo_amigas", "Con mis amigas", { x: TXT_X, y: 1440, w: 640, h: 170 }, "Con mis amigas", {
      familia: "Alex Brush", tam: 112, color: ROSA_TXT, alinear: "LEFT",
    });
    a.texto(1, "frase", "Frase", { x: TXT_X, y: 1620, w: 640, h: 220 }, "Un día lleno de alegría, compartido.", {
      familia: "Lora", tam: 50, color: TEXTO, italica: true, alinear: "LEFT", interlineado: 1.35,
    });
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 2050, 1400, 90), "course.withSchool", "Curso - Colegio", {
      familia: "Lora", tam: 44, color: TEXTO,
    });
  },
};
