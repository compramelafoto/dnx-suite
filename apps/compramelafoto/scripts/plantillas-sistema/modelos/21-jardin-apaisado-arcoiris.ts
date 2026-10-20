import { caras, panelDeFondo } from "../apaisado";
import { ALTO, ANCHO, agrandar } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Jardín · Arcoíris apaisado: se lee de costado, como un calendario. Arcoíris y nubes; foto
 * individual en un círculo en la tapa, listado en la contratapa, y adentro la grupal y la foto con
 * la seño.
 */

const TINTA = "#3d2c5e";
const ROSA = "#ff6b8b";
const ARCO = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc"];
const CREMA = "#fff8ec";

const FOTO_IND = { x: 150, y: 470, w: 960, h: 960 };
const FOTO_GRU = { x: 230, y: 330, w: 1900, h: 1130 };
const FOTO_MAE = { x: 170, y: 2010, w: 1180, h: 1300 };

function arcoiris(cx: number, cy: number, r: number, grosor: number) {
  return ARCO.map(
    (c, i) =>
      `<path d="M ${cx - (r - i * grosor)} ${cy} A ${r - i * grosor} ${r - i * grosor} 0 0 1 ${cx + (r - i * grosor)} ${cy}" stroke="${c}" stroke-width="${grosor}" fill="none"/>`,
  ).join("");
}

function nube(cx: number, cy: number, s: number) {
  return `<g fill="#ffffff" opacity="0.95"><circle cx="${cx}" cy="${cy}" r="${s}"/><circle cx="${cx - s * 0.9}" cy="${cy + s * 0.25}" r="${s * 0.7}"/><circle cx="${cx + s * 0.95}" cy="${cy + s * 0.2}" r="${s * 0.75}"/><rect x="${cx - s * 1.6}" y="${cy + s * 0.2}" width="${s * 3.3}" height="${s * 0.75}" rx="${s * 0.37}"/></g>`;
}

export const jardinApaisadoArcoiris: Modelo = {
  slug: "jardin-apaisado-arcoiris",
  serie: "variadas",
  nombre: "Librito Jardín · Arcoíris apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado, como un calendario) para jardín: arcoíris, nubes y colores alegres. Foto individual en la tapa, listado de la sala en la contratapa; adentro, la foto grupal y la foto con la seño.",
  categoria: "Jardín",
  filtros: { estilo: "Divertido", orientacion: "horizontal", evento: "Fin de año", etiquetas: ["arcoíris", "maestra", "apaisado"] },

  fondoExterior: () => {
    const tapa = panelDeFondo("tapa");
    const contra = panelDeFondo("contratapa");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>
       ${tapa.svg(`${arcoiris(2160, 1771, 400, 34)}${nube(1500, 1640, 90)}${nube(2220, 1600, 70)}${nube(330, 230, 60)}
         <circle cx="${FOTO_IND.x + FOTO_IND.w / 2}" cy="${FOTO_IND.y + FOTO_IND.h / 2}" r="${FOTO_IND.w / 2 + 70}" fill="${ARCO[2]}"/>
         <circle cx="${FOTO_IND.x + FOTO_IND.w / 2}" cy="${FOTO_IND.y + FOTO_IND.h / 2}" r="${FOTO_IND.w / 2 + 34}" fill="#ffffff"/>`)}
       ${contra.svg(`${arcoiris(0, 1771, 460, 34)}${arcoiris(2362, 1771, 460, 34)}${nube(1950, 260, 70)}${nube(400, 300, 55)}
         <rect x="150" y="410" width="2062" height="1230" rx="70" fill="#ffffff" opacity="0.85"/>`)}
       ${grano("g", 0.04)}`,
      filtroGrano("g", 0.85),
    );
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    const marcoGru = agrandar(FOTO_GRU, 34);
    const marcoMae = agrandar(FOTO_MAE, 34);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>
       ${i.svg(`
         <rect x="0" y="0" width="2362" height="1771" fill="#eaf6ff"/>
         ${nube(260, 1560, 70)}${nube(2120, 160, 60)}
         <rect x="${marcoGru.x}" y="${marcoGru.y}" width="${marcoGru.w}" height="${marcoGru.h}" rx="40" fill="#ffffff"/>
         <rect x="0" y="1771" width="2362" height="1772" fill="${CREMA}"/>
         ${arcoiris(1780, 3543, 420, 30)}
         <rect x="${marcoMae.x}" y="${marcoMae.y}" width="${marcoMae.w}" height="${marcoMae.h}" rx="40" fill="${ARCO[4]}"/>
         ${ARCO.map((c, k) => `<circle cx="${1500 + k * 120}" cy="2010" r="30" fill="${c}"/>`).join("")}`)}
       ${grano("g", 0.04)}`,
      filtroGrano("g", 0.85),
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);

    // Tapa
    tapa.foto("individual", FOTO_IND, { mascara: "circle" });
    tapa.variable("nombre", "Nombre del alumno", { x: 120, y: 1530, w: 1020, h: 160 }, "student.firstName", "Nombre", {
      familia: "Pacifico", tam: 110, color: ROSA,
    });
    tapa.texto("titulo", "Título", { x: 1200, y: 300, w: 1040, h: 260 }, "¡Mi sala!", { familia: "Pacifico", tam: 190, color: TINTA });
    tapa.variable("colegio", "Nombre del jardín", { x: 1200, y: 620, w: 1040, h: 300 }, "school.name", "Nombre del jardín", {
      familia: "Nunito", tam: 92, color: TINTA, peso: 700, interlineado: 1.1,
    });
    tapa.variable("curso", "Sala", { x: 1200, y: 940, w: 1040, h: 130 }, "course.displayName", "Sala", { familia: "Nunito", tam: 76, color: TINTA });
    tapa.texto("anio", "Año", { x: 1200, y: 1090, w: 1040, h: 170 }, "2026", { familia: "Pacifico", tam: 120, color: ARCO[0] });

    // Contratapa
    contratapa.texto("titulo_listado", "Título del listado", { x: 160, y: 170, w: 2040, h: 210 }, "Mis compañeros", {
      familia: "Pacifico", tam: 140, color: TINTA,
    });
    contratapa.listado({ x: 230, y: 470, w: 1900, h: 1110 }, { familia: "Nunito", tam: 68, color: TINTA, interlineado: 1.35 }, 3);

    // Interior arriba: la grupal
    interior.texto("titulo_grupal", "Título foto grupal", { x: 160, y: 110, w: 2040, h: 190 }, "¡Todos juntos!", {
      familia: "Pacifico", tam: 130, color: TINTA,
    });
    interior.foto("grupal", FOTO_GRU, { radio: 30 });
    interior.variable("curso_colegio", "Sala y jardín", { x: 160, y: 1500, w: 2040, h: 130 }, "course.withSchool", "Sala - Jardín", {
      familia: "Nunito", tam: 70, color: TINTA, peso: 700,
    });

    // Interior abajo: la seño
    interior.foto("maestra", FOTO_MAE, { radio: 30 });
    interior.texto("titulo_maestra", "Título foto con la maestra", { x: 1440, y: 2120, w: 800, h: 230 }, "Mi seño", {
      familia: "Pacifico", tam: 150, color: ROSA,
    });
    interior.texto("frase_maestra", "Frase", { x: 1440, y: 2400, w: 800, h: 500 }, "Gracias por enseñarme jugando y por cuidarme cada día.", {
      familia: "Nunito", tam: 74, color: TINTA, interlineado: 1.3,
    });
  },
};
