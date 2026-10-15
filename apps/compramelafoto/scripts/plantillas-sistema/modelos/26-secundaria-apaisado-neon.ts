import { caras, panelDeFondo } from "../apaisado";
import { ALTO, ANCHO, agrandar } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Secundaria · Neón (apaisado): fondo oscuro con líneas de neón rosa y celeste. La tapa es la
 * foto con los amigos a sangre; adentro, la grupal arriba y la individual abajo con el nombre
 * grande. Listado en la contratapa.
 */

const FONDO = "#12121f";
const ROSA = "#ff3ea5";
const CELESTE = "#2de2e6";
const BLANCO = "#f4f4ff";

const I_GRU = { x: 170, y: 200, w: 2020, h: 1180 };
const I_IND = { x: 170, y: 1990, w: 1000, h: 1340 };

/** Un trazo de neón: línea gruesa difusa + línea fina clara. */
function neon(d: string, color: string, ancho = 12) {
  return `<path d="${d}" stroke="${color}" stroke-width="${ancho * 3}" fill="none" opacity="0.35" filter="url(#brillo)" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${color}" stroke-width="${ancho}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function rectNeon(r: { x: number; y: number; w: number; h: number }, color: string) {
  return neon(`M ${r.x} ${r.y} H ${r.x + r.w} V ${r.y + r.h} H ${r.x} Z`, color, 10);
}

const defs = () => filtroGrano("g", 0.9) + `<filter id="brillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>`;

export const secundariaApaisadoNeon: Modelo = {
  slug: "secundaria-apaisado-neon",
  serie: "variadas",
  nombre: "Librito Secundaria · Neón apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado) para secundaria: fondo oscuro con líneas de neón rosa y celeste. La foto con los amigos ocupa toda la tapa; adentro, la grupal y la individual con el nombre grande. Listado del curso en la contratapa.",
  categoria: "Secundaria",
  filtros: { estilo: "Moderno", orientacion: "horizontal", etiquetas: ["neón", "amigos", "foto a sangre", "apaisado"] },

  fondoExterior: () => {
    const contra = panelDeFondo("contratapa");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>
       ${contra.svg(`${rectNeon({ x: 120, y: 160, w: 2122, h: 1490 }, CELESTE)}
         ${neon("M 300 420 H 2060", ROSA, 8)}`)}
       ${grano("g", 0.06, "screen")}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>
       ${i.svg(`${rectNeon(agrandar(I_GRU, 30), ROSA)}${rectNeon(agrandar(I_IND, 30), CELESTE)}
         ${neon("M 1280 2960 H 2190", ROSA, 8)}
         ${neon("M 1900 1500 l 60 -60 l 60 60 l 60 -60 l 60 60", CELESTE, 8)}`)}
       ${grano("g", 0.06, "screen")}`,
      defs(),
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);

    // Tapa: los amigos a sangre, con una franja oscura para los textos
    tapa.foto("amigos", { x: 0, y: 0, w: 2362, h: 1771 });
    tapa.forma("franja", "Franja de textos", { x: 0, y: 1220, w: 2362, h: 551 }, { relleno: FONDO, opacidad: 0.7 });
    tapa.texto("titulo", "Título", { x: 160, y: 1250, w: 2040, h: 250 }, "LOS DE SIEMPRE", { familia: "Bebas Neue", tam: 250, color: ROSA });
    tapa.variable("curso_colegio", "Curso y colegio", { x: 160, y: 1510, w: 2040, h: 150 }, "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 66, color: BLANCO, peso: 700,
    });

    // Contratapa
    contratapa.texto("titulo_listado", "Título del listado", { x: 200, y: 210, w: 1960, h: 200 }, "LA PROMO", { familia: "Bebas Neue", tam: 200, color: CELESTE });
    contratapa.listado({ x: 260, y: 480, w: 1840, h: 1100 }, { familia: "Montserrat", tam: 56, color: BLANCO, interlineado: 1.4 }, 3);

    // Interior arriba: la grupal
    interior.foto("grupal", I_GRU);
    interior.texto("titulo_grupal", "Título foto grupal", { x: 170, y: 1420, w: 1600, h: 200 }, "TODOS", {
      familia: "Bebas Neue", tam: 190, color: BLANCO, alinear: "LEFT",
    });

    // Interior abajo: la individual y el nombre
    interior.foto("individual", I_IND);
    interior.variable("alumno", "Nombre del alumno", { x: 1270, y: 2050, w: 940, h: 560 }, "student.fullName", "Nombre del alumno", {
      familia: "Bebas Neue", tam: 230, color: ROSA, alinear: "LEFT", interlineado: 0.95,
    });
    interior.variable("curso", "Curso", { x: 1270, y: 2650, w: 940, h: 130 }, "course.displayName", "Curso", {
      familia: "Montserrat", tam: 66, color: CELESTE, peso: 700, alinear: "LEFT",
    });
    interior.texto("frase", "Frase", { x: 1270, y: 3020, w: 940, h: 300 }, "Lo mejor está por venir.", {
      familia: "Montserrat", tam: 72, color: BLANCO, alinear: "LEFT", interlineado: 1.25,
    });
  },
};
