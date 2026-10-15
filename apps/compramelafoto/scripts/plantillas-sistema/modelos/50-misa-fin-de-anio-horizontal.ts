import { ALTO, ANCHO, PLIEGUE, agrandar, type Rect } from "../lienzo";
import { caras, panelDeFondo } from "../apaisado";
import { filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, degradadoOro, filete, ojivaPath, rayos, vitral } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/**
 * Acto religioso · Misa de fin de año, horizontal: marfil, dorado y azul, vitrales ojivales.
 * Se lee apaisado con el doblez arriba (ver `apaisado.ts`): contratapa a +90, tapa e interior a -90.
 */

const MARFIL = "#fbf7ee";
const AZUL = "#2e4a66";
const ORO_PLANO = "#c4a15c";
const ORO_TXT = "#8d6c2b";
const GRIS = "#5d6a78";
const VIDRIOS = ["#a9c8e0", "#c7dceb", "#d6e3cf", "#b9cdb0", "#f0dfae", "#fbf6e8", "#8fb4d3"] as const;

type Lado = "contratapa" | "tapa" | "intIzq" | "intDer";
const CONTRATAPA: Lado = "contratapa";
const TAPA: Lado = "tapa";
const INT_IZQ: Lado = "intIzq";
const INT_DER: Lado = "intDer";

// Medidas en el marco local de cada mitad (2362 × 1771).
const GRU: Rect = { x: 160, y: 150, w: 1560, h: 1040 };
const IND: Rect = { x: 200, y: 290, w: 820, h: 1093 };
const DOC: Rect = { x: 1200, y: 290, w: 820, h: 1093 };
const VENTANA_TAPA: Rect = { x: 170, y: 190, w: 560, h: 1400 };
const VENTANA_INT: Rect = { x: 1880, y: 170, w: 340, h: 620 };

/**
 * Cada mitad se diseña en su cara leída derecha (2362 × 1771). El interior de `apaisado.ts` es
 * una sola cara de 2362 × 3543: la mitad izquierda es el panel de arriba y la derecha, el de abajo.
 */
const enCara = (l: Lado, r: Rect): Rect => (l === "intDer" ? { ...r, y: r.y + PLIEGUE } : r);
const local = (l: Lado, contenido: string) =>
  l === "tapa" || l === "contratapa"
    ? panelDeFondo(l).svg(contenido)
    : panelDeFondo("interior").svg(l === "intDer" ? `<g transform="translate(0 ${PLIEGUE})">${contenido}</g>` : contenido);

function marco(r: Rect) {
  const p = agrandar(r, 30);
  const f = agrandar(r, 9);
  return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#ffffff" stroke="${ORO_PLANO}" stroke-width="3"/><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="url(#oro)"/>`;
}

function orla() {
  return `<rect x="80" y="80" width="${2362 - 160}" height="${1771 - 160}" fill="none" stroke="url(#oro)" stroke-width="8"/>
    <rect x="104" y="104" width="${2362 - 208}" height="${1771 - 208}" fill="none" stroke="${AZUL}" stroke-width="2" opacity="0.5"/>`;
}

const DEFS = `${degradadoOro("oro")}${filtroGrano("g", 0.8, 2, 27)}`;

export const misaFinDeAnioHorizontal: Modelo = {
  slug: "misa-fin-de-anio-horizontal",
  nombre: "Librito Misa de fin de año · Horizontal",
  descripcion:
    "Librito 30×20 cm (2 páginas) para la misa de Acción de Gracias de fin de año o un acto del colegio católico. Se lee apaisado, con el doblez arriba: marfil, dorado y azul, vitrales ojivales. Logo del colegio en la tapa, listado del curso en la contratapa; foto grupal, individual y con la docente en el interior.",
  serie: "religiosas",
  categoria: "Religioso",
  etiquetasDeFotos: { maestra: "Foto con la docente" },
  filtros: {
    evento: "Acto religioso",
    estilo: "Formal",
    orientacion: "horizontal",
    etiquetas: ["misa", "fin de año", "acción de gracias", "vitral", "colegio católico", "horizontal", "apaisado"],
  },

  fondoExterior: () => {
    const v = vitral("vt", ojivaPath(VENTANA_TAPA.x, VENTANA_TAPA.y, VENTANA_TAPA.w, VENTANA_TAPA.h), VENTANA_TAPA, VIDRIOS, ORO_PLANO, 71, 110);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${MARFIL}"/>${grano("g", 0.05)}
       ${local(CONTRATAPA, `${orla()}${filete(2362 / 2, 400, 700, ORO_PLANO)}${filete(2362 / 2, 1440, 500, ORO_PLANO)}`)}
       ${local(TAPA, `${orla()}
         ${rayos(VENTANA_TAPA.x + VENTANA_TAPA.w / 2, 620, 300, 620, 40, ORO_PLANO, 0.3, 0.025)}
         <path d="${ojivaPath(VENTANA_TAPA.x - 30, VENTANA_TAPA.y - 30, VENTANA_TAPA.w + 60, VENTANA_TAPA.h + 60)}" fill="${MARFIL}" stroke="url(#oro)" stroke-width="12"/>
         ${v.out}
         ${filete(1570, 910, 520, ORO_PLANO)}`)}`,
      `${v.defs}${DEFS}`,
    );
  },

  fondoInterior: () => {
    const v = vitral("vi", ojivaPath(VENTANA_INT.x, VENTANA_INT.y, VENTANA_INT.w, VENTANA_INT.h), VENTANA_INT, VIDRIOS, ORO_PLANO, 83, 80);
    const banda = vitral("vb", `M 2130 290 H 2240 V 1383 H 2130 Z`, { x: 2130, y: 290, w: 110, h: 1093 }, VIDRIOS, ORO_PLANO, 89, 70);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${MARFIL}"/>${grano("g", 0.05)}
       ${local(INT_IZQ, `${marco(GRU)}${v.out}${filete(2050, 860, 300, ORO_PLANO)}`)}
       ${local(INT_DER, `${marco(IND)}${marco(DOC)}${banda.out}`)}`,
      `${v.defs}${banda.defs}${DEFS}`,
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);
    // Contratapa (+90)
    contratapa.texto("titulo_listado", "Título del listado", enCara(CONTRATAPA, { x: 200, y: 190, w: 1962, h: 150 }), "Nuestro curso", {
      familia: "Playfair Display", tam: 96, color: AZUL,
    });
    contratapa.listado({ x: 260, y: 460, w: 1842, h: 930 }, { familia: "Lora", tam: 44, color: GRIS, interlineado: 1.4 }, 3);
    contratapa.texto("cita", "Cita bíblica", enCara(CONTRATAPA, { x: 200, y: 1480, w: 1962, h: 90 }), "«Den gracias al Señor, porque es bueno» · Sal 136, 1", {
      familia: "Lora", tam: 50, color: ORO_TXT, italica: true,
    });

    // Tapa (-90)
    tapa.logo("logo", { x: 1420, y: 190, w: 300, h: 300 });
    tapa.texto("titulo", "Título de tapa", enCara(TAPA, { x: 880, y: 540, w: 1380, h: 330 }), "Misa de Acción de Gracias", {
      familia: "Playfair Display", tam: 112, color: AZUL, interlineado: 1.15,
    });
    tapa.texto("subtitulo", "Subtítulo", enCara(TAPA, { x: 880, y: 950, w: 1380, h: 100 }), "Fin del ciclo lectivo 2026", {
      familia: "Lora", tam: 64, color: ORO_TXT, italica: true,
    });
    tapa.variable("colegio", "Colegio", enCara(TAPA, { x: 880, y: 1110, w: 1380, h: 160 }), "school.name", "Nombre del colegio", {
      familia: "Lora", tam: 50, color: AZUL, mayus: "uppercase", interlineado: 1.3,
    });
    tapa.variable("alumno", "Nombre del alumno", enCara(TAPA, { x: 880, y: 1320, w: 1380, h: 110 }), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 70, color: AZUL, italica: true,
    });
    tapa.variable("fecha", "Fecha", enCara(TAPA, { x: 880, y: 1460, w: 1380, h: 80 }), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Lora", tam: 46, color: GRIS,
    });

    // Interior, mitad izquierda (-90): la grupal apaisada.
    interior.foto("grupal", enCara(INT_IZQ, GRU));
    interior.texto("gracias", "Agradecimiento", enCara(INT_IZQ, { x: 1800, y: 900, w: 500, h: 360 }), "Gracias, Señor, por este año compartido", {
      familia: "Playfair Display", tam: 62, color: AZUL, italica: true, interlineado: 1.3,
    });
    interior.variable("curso_colegio", "Curso y colegio", enCara(INT_IZQ, { x: 160, y: 1260, w: 1560, h: 150 }), "course.withSchool", "Curso - Colegio", {
      familia: "Lora", tam: 52, color: AZUL, interlineado: 1.3,
    });

    // Interior, mitad derecha (-90): individual y con la docente.
    interior.foto("individual", enCara(INT_DER, IND));
    interior.foto("maestra", enCara(INT_DER, DOC));
    interior.variable("alumno", "Nombre del alumno", enCara(INT_DER, { x: 150, y: 1430, w: 920, h: 110 }), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 68, color: AZUL,
    });
    interior.texto("titulo_docente", "Con mi docente", enCara(INT_DER, { x: 1150, y: 1430, w: 920, h: 110 }), "Con mi docente", {
      familia: "Playfair Display", tam: 68, color: AZUL, italica: true,
    });
    interior.variable("fecha", "Fecha", enCara(INT_DER, { x: 150, y: 1570, w: 1920, h: 80 }), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Lora", tam: 44, color: ORO_TXT, italica: true,
    });
  },
};
