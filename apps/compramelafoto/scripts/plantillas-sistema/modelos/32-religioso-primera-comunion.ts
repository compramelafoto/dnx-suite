import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, type Rect } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Religioso · Primera Comunión: blanco y dorado suave, arco de capilla alrededor de la foto
 * individual, una cruz fina y ramitas de olivo. Adentro, la grupal («Juntos en la fe») y la foto con la
 * catequista (hueco «Foto con la maestra»). Listado en la contratapa.
 */

const BLANCO = "#fdfbf6";
const ORO = "#c9a961";
const CELESTE = "#7fa7c9";
const TINTA = "#4a4338";

const FOTO_IND: Rect = centrado(CENTRO_DER, 520, 1000, 1100);
const FOTO_GRU: Rect = centrado(CENTRO_IZQ, 330, 1450, 970);
const FOTO_MAE: Rect = centrado(CENTRO_DER, 520, 1060, 960);

/**
 * Arco de capilla alrededor de `r`: dos lados rectos y un semicírculo arriba, lo bastante ancho
 * para que las esquinas de la foto queden adentro del arco.
 */
function arco(r: Rect, d: number, color: string, grosor: number) {
  const radio = r.w / 2 + d;
  const cx = r.x + r.w / 2;
  const yBase = r.y + Math.sqrt(radio * radio - (r.w / 2) ** 2) * 0.55;
  const abajo = r.y + r.h + 30;
  return `<path d="M ${cx - radio} ${abajo} V ${yBase} A ${radio} ${radio} 0 0 1 ${cx + radio} ${yBase} V ${abajo}" fill="none" stroke="${color}" stroke-width="${grosor}"/>`;
}

/** Una cruz fina, dorada. */
function cruz(cx: number, cy: number, alto: number) {
  const g = alto * 0.11;
  return `<g fill="none" stroke="${ORO}" stroke-width="${g * 0.45}"><rect x="${cx - g / 2}" y="${cy - alto / 2}" width="${g}" height="${alto}"/><rect x="${cx - alto * 0.32}" y="${cy - alto * 0.22 - g / 2}" width="${alto * 0.64}" height="${g}"/></g>`;
}

function olivo(x: number, y: number, largo: number, giro: number) {
  let hojas = "";
  for (let i = 1; i <= 6; i++) {
    const t = (i / 7) * largo;
    hojas += `<ellipse cx="${x + t}" cy="${y - 26}" rx="38" ry="15" fill="#9bb27a" transform="rotate(-30 ${x + t} ${y - 26})"/><ellipse cx="${x + t + 20}" cy="${y + 26}" rx="38" ry="15" fill="#9bb27a" transform="rotate(30 ${x + t + 20} ${y + 26})"/>`;
  }
  return `<g transform="rotate(${giro} ${x} ${y})"><line x1="${x}" y1="${y}" x2="${x + largo}" y2="${y}" stroke="#7d9460" stroke-width="8"/>${hojas}</g>`;
}

const defs = () => filtroGrano("g", 0.85);

export const religiosoPrimeraComunion: Modelo = {
  slug: "religioso-primera-comunion",
  serie: "variadas",
  nombre: "Librito Religioso · Primera Comunión",
  descripcion:
    "Librito 30×20 cm de recuerdo de Primera Comunión: blanco y dorado suave, arco de capilla alrededor de la foto individual, una cruz fina y ramitas de olivo. Adentro, la foto grupal y la foto con la catequista; listado de compañeros en la contratapa.",
  categoria: "Religioso",
  filtros: { estilo: "Clásico", orientacion: "vertical", evento: "Primera Comunión", etiquetas: ["comunión", "catequesis", "maestra"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${BLANCO}"/>
       ${arco(FOTO_IND, 70, ORO, 12)}${arco(FOTO_IND, 110, ORO, 4)}
       ${olivo(PLIEGUE + 240, 1700, 330, -20)}${olivo(ANCHO - 240, 1700, 330, 200)}
       ${cruz(CENTRO_IZQ, 300, 260)}
       <line x1="${CENTRO_IZQ - 300}" y1="2060" x2="${CENTRO_IZQ + 300}" y2="2060" stroke="${ORO}" stroke-width="4"/>
       ${grano("g", 0.035)}`,
      defs(),
    ),

  fondoInterior: () => {
    const g = agrandar(FOTO_GRU, 26);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${BLANCO}"/>
       <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="none" stroke="${ORO}" stroke-width="6"/>
       ${arco(FOTO_MAE, 60, ORO, 8)}
       ${olivo(240, 2100, 280, -10)}${olivo(PLIEGUE - 240, 2100, 280, 190)}
       ${grano("g", 0.035)}`,
      defs(),
    );
  },

  armar: (a) => {
    // Tapa
    a.foto(0, "individual", FOTO_IND, { radio: 0 });
    a.texto(0, "titulo", "Título", centrado(CENTRO_DER, 1740, 1500, 230), "Mi Primera Comunión", {
      familia: "Great Vibes", tam: 150, color: ORO,
    });
    a.variable(0, "alumno", "Nombre del alumno", centrado(CENTRO_DER, 1960, 1400, 140), "student.fullName", "Nombre del alumno", {
      familia: "Playfair Display", tam: 84, color: TINTA,
    });
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 2100, 1400, 120), "school.name", "Nombre del colegio", {
      familia: "Lora", tam: 56, color: CELESTE, italica: true,
    });

    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 520, 1450, 200), "Mis compañeros", {
      familia: "Great Vibes", tam: 130, color: ORO,
    });
    a.listado(0, { x: 220, y: 780, w: PLIEGUE - 440, h: 1200 }, { familia: "Lora", tam: 58, color: TINTA, interlineado: 1.4 }, 2);
    a.texto(0, "fecha", "Fecha", centrado(CENTRO_IZQ, 2100, 1300, 120), "2026", { familia: "Lora", tam: 60, color: ORO, italica: true });

    // Interior izquierda: la grupal
    a.foto(1, "grupal", FOTO_GRU);
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_IZQ, 1400, 1450, 210), "Juntos en la fe", {
      familia: "Great Vibes", tam: 130, color: ORO,
    });
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_IZQ, 1620, 1350, 220), "course.withSchool", "Curso - Colegio", {
      familia: "Lora", tam: 60, color: TINTA, interlineado: 1.25,
    });

    // Interior derecha: la catequista
    a.foto(1, "maestra", FOTO_MAE);
    a.texto(1, "titulo_maestra", "Título foto con la catequista", centrado(CENTRO_DER, 1570, 1450, 200), "Con mi catequista", {
      familia: "Great Vibes", tam: 120, color: ORO,
    });
    a.texto(1, "frase", "Frase", centrado(CENTRO_DER, 1800, 1300, 260), "«Dejen que los niños vengan a mí.»", {
      familia: "Lora", tam: 64, color: TINTA, italica: true, interlineado: 1.3,
    });
  },
};
