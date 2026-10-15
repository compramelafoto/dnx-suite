import { ALTO, ANCHO, PLIEGUE, agrandar, type Rect } from "../lienzo";
import { caras, panelDeFondo } from "../apaisado";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, caliz, degradadoOro, espiga, filete, manojoEspigas, rayos } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/**
 * Primera Comunión · Horizontal en verde salvia: el librito se lee apaisado (tipo calendario,
 * con el doblez arriba), como la «Plantilla San Patricio». Cada mitad se diseña en su marco local
 * apaisado y `apaisado.ts` la lleva al lienzo: contratapa a +90, tapa e interior a -90.
 */

const SALVIA = "#8fa585";
const SALVIA_CLARO = "#e6ece1";
const ORO_PLANO = "#c3a15f";
const TEXTO = "#3f4a3a";
const ORO_TXT = "#8f7334";
const CREMA = "#fbf8f1";

type Lado = "contratapa" | "tapa" | "intIzq" | "intDer";
const CONTRATAPA: Lado = "contratapa";
const TAPA: Lado = "tapa";
const INT_IZQ: Lado = "intIzq";
const INT_DER: Lado = "intDer";

// Medidas en el marco local de cada mitad (2362 × 1771 = 2362 × 1771).
const GRU: Rect = { x: 150, y: 150, w: 1500, h: 1000 };
const IND: Rect = { x: 190, y: 300, w: 840, h: 1120 };
const CAT: Rect = { x: 1160, y: 300, w: 760, h: 760 };

/**
 * Cada mitad se diseña en su cara leída derecha (2362 × 1771). El interior de `apaisado.ts` es
 * una sola cara de 2362 × 3543: la mitad izquierda es el panel de arriba y la derecha, el de abajo.
 */
const enCara = (l: Lado, r: Rect): Rect => (l === "intDer" ? { ...r, y: r.y + PLIEGUE } : r);
const local = (l: Lado, contenido: string) =>
  l === "tapa" || l === "contratapa"
    ? panelDeFondo(l).svg(contenido)
    : panelDeFondo("interior").svg(l === "intDer" ? `<g transform="translate(0 ${PLIEGUE})">${contenido}</g>` : contenido);

function marcoLocal(r: Rect) {
  const p = agrandar(r, 36);
  const f = agrandar(r, 10);
  return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff" stroke="${SALVIA}" stroke-width="3"/><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="url(#oro)"/>`;
}

function orlaLocal() {
  return `<rect x="90" y="90" width="${2362 - 180}" height="${1771 - 180}" fill="none" stroke="${SALVIA}" stroke-width="4"/>`;
}

const DEFS = `${degradadoOro("oro")}${filtroGrano("g", 0.8, 2, 12)}`;

export const comunionHorizontalSalvia: Modelo = {
  slug: "comunion-horizontal-salvia",
  nombre: "Librito Primera Comunión · Horizontal salvia",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Primera Comunión que se lee apaisado, con el doblez arriba como un calendario: verde salvia y dorado, cáliz con la hostia y espigas de trigo. Listado de compañeros en la contratapa; foto grupal, individual y con la catequista en el interior.",
  serie: "religiosas",
  categoria: "Religioso",
  etiquetasDeFotos: { maestra: "Foto con la catequista" },
  filtros: {
    evento: "Primera Comunión",
    estilo: "Clásico",
    orientacion: "horizontal",
    etiquetas: ["horizontal", "apaisado", "verde salvia", "espigas", "cáliz", "dorado"],
  },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>${grano("g", 0.05)}
       ${local(CONTRATAPA, `${orlaLocal()}${filete(2362 / 2, 420, 600, ORO_PLANO)}
         ${espiga(250, 1560, 220, -30, SALVIA)}${espiga(2362 - 250, 1560, 220, 30, SALVIA)}`)}
       ${local(TAPA, `<rect x="0" y="0" width="830" height="${1771}" fill="${SALVIA}"/>
         <rect x="830" y="0" width="12" height="${1771}" fill="${ORO_PLANO}"/>
         ${rayos(415, 700, 110, 370, 44, "#ffffff", 0.35, 0.035)}
         ${manojoEspigas(415, 1630, 200, "#f4efe0")}
         ${caliz(415, 790, 270, "url(#oro)", { linea: "#8a6a2a" })}
         <rect x="930" y="150" width="${2362 - 1020}" height="${1771 - 240}" fill="none" stroke="${SALVIA}" stroke-width="3"/>
         ${filete(1600, 1030, 420, ORO_PLANO)}`)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>${grano("g", 0.05)}
       ${local(INT_IZQ, `<rect x="0" y="0" width="${2362}" height="80" fill="${SALVIA_CLARO}"/>${marcoLocal(GRU)}
         ${manojoEspigas(1980, 1450, 260, SALVIA)}`)}
       ${local(INT_DER, `<rect x="0" y="${1771 - 80}" width="${2362}" height="80" fill="${SALVIA_CLARO}"/>${marcoLocal(IND)}${marcoLocal(CAT)}
         ${espiga(2130, 1500, 260, 12, SALVIA)}${espiga(2060, 1520, 230, -14, SALVIA)}`)}`,
      DEFS,
    ),

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);
    // Contratapa (+90)
    contratapa.texto("titulo_listado", "Título del listado", enCara(CONTRATAPA, { x: 200, y: 200, w: 1962, h: 190 }), "Compañeros de catequesis", {
      familia: "Allura", tam: 130, color: ORO_TXT,
    });
    contratapa.listado({ x: 260, y: 480, w: 1842, h: 1010 }, { familia: "Lora", tam: 46, color: TEXTO, interlineado: 1.4 }, 3);
    contratapa.variable("curso", "Curso", enCara(CONTRATAPA, { x: 400, y: 1520, w: 1562, h: 80 }), "course.displayName", "Curso", {
      familia: "Lora", tam: 46, color: ORO_TXT, italica: true,
    });

    // Tapa (-90)
    tapa.texto("titulo", "Título de tapa", enCara(TAPA, { x: 980, y: 260, w: 1260, h: 460 }), "Mi Primera Comunión", {
      familia: "Allura", tam: 196, color: ORO_TXT, interlineado: 1.05,
    });
    tapa.variable("alumno", "Nombre del alumno", enCara(TAPA, { x: 980, y: 800, w: 1260, h: 140 }), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 86, color: TEXTO,
    });
    tapa.variable("fecha", "Fecha", enCara(TAPA, { x: 980, y: 1090, w: 1260, h: 90 }), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Lora", tam: 54, color: ORO_TXT, italica: true,
    });
    tapa.variable("colegio", "Colegio o parroquia", enCara(TAPA, { x: 980, y: 1260, w: 1260, h: 160 }), "school.name", "Colegio o parroquia", {
      familia: "Lora", tam: 46, color: TEXTO, mayus: "uppercase", interlineado: 1.3,
    });

    // Interior, mitad izquierda (-90): la grupal apaisada y la cita.
    interior.foto("grupal", enCara(INT_IZQ, GRU));
    interior.texto("cita", "Cita bíblica", enCara(INT_IZQ, { x: 1740, y: 230, w: 500, h: 560 }), "«Dejen que los niños vengan a mí»", {
      familia: "Allura", tam: 104, color: ORO_TXT, interlineado: 1.15,
    });
    interior.texto("cita_ref", "Referencia de la cita", enCara(INT_IZQ, { x: 1740, y: 820, w: 500, h: 70 }), "Mc 10, 14", {
      familia: "Lora", tam: 42, color: TEXTO,
    });
    interior.variable("curso_colegio", "Curso y colegio", enCara(INT_IZQ, { x: 150, y: 1230, w: 1500, h: 150 }), "course.withSchool", "Curso - Colegio", {
      familia: "Lora", tam: 52, color: TEXTO, interlineado: 1.3,
    });

    // Interior, mitad derecha (-90): individual y con la catequista.
    interior.foto("individual", enCara(INT_DER, IND));
    interior.foto("maestra", enCara(INT_DER, CAT));
    interior.texto("titulo_catequista", "Con mi catequista", enCara(INT_DER, { x: 1120, y: 1110, w: 840, h: 150 }), "Con mi catequista", {
      familia: "Allura", tam: 104, color: ORO_TXT,
    });
    interior.variable("fecha", "Fecha", enCara(INT_DER, { x: 1120, y: 1290, w: 840, h: 80 }), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Lora", tam: 46, color: TEXTO, italica: true,
    });
    interior.variable("alumno", "Nombre del alumno", enCara(INT_DER, { x: 150, y: 1470, w: 920, h: 170 }), "student.fullName", "Nombre del alumno", {
      familia: "Allura", tam: 120, color: ORO_TXT,
    });
  },
};
