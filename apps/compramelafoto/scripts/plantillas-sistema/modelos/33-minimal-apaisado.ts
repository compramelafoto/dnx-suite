import { caras, panelDeFondo } from "../apaisado";
import { ALTO, ANCHO } from "../lienzo";
import { filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Minimalista apaisado: blanco, una línea fina y un punto de color. La grupal ocupa todo el ancho
 * de la tapa (a sangre arriba); adentro, la individual con el nombre al costado y la foto con los
 * amigos de punta a punta. Listado en la contratapa.
 */

const TINTA = "#222222";
const GRIS = "#7a7a7a";
const SALVIA = "#9aae8c";
const PAPEL = "#fbfaf7";

const I_IND = { x: 180, y: 170, w: 1050, h: 1420 };
const I_AMI = { x: 180, y: 1990, w: 2002, h: 1230 };

const defs = () => filtroGrano("g", 0.9);

export const minimalApaisado: Modelo = {
  slug: "minimal-apaisado",
  serie: "variadas",
  nombre: "Librito Minimalista · Apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado) y minimalista: blanco, una línea fina y un punto de color. La foto grupal ocupa todo el ancho de la tapa; adentro, la individual con el nombre al costado y la foto con los amigos de punta a punta. Listado en la contratapa.",
  categoria: "Secundaria",
  filtros: { estilo: "Minimalista", orientacion: "horizontal", etiquetas: ["minimalista", "amigos", "foto a sangre", "apaisado"] },

  fondoExterior: () => {
    const tapa = panelDeFondo("tapa");
    const contra = panelDeFondo("contratapa");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>
       ${tapa.svg(`<circle cx="2120" cy="1600" r="34" fill="${SALVIA}"/>`)}
       ${contra.svg(`<line x1="200" y1="410" x2="460" y2="410" stroke="${TINTA}" stroke-width="4"/>`)}
       ${grano("g", 0.035)}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>
       ${i.svg(`<line x1="1340" y1="860" x2="1600" y2="860" stroke="${TINTA}" stroke-width="4"/>
         <circle cx="2100" cy="300" r="40" fill="${SALVIA}"/>`)}
       ${grano("g", 0.035)}`,
      defs(),
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);

    // Tapa
    tapa.foto("grupal", { x: 0, y: 0, w: 2362, h: 1180 });
    tapa.variable("colegio", "Nombre del colegio", { x: 170, y: 1260, w: 1500, h: 250 }, "school.name", "Nombre del colegio", {
      familia: "Raleway", tam: 92, color: TINTA, alinear: "LEFT", interlineado: 1.12,
    });
    tapa.variable("curso", "Curso", { x: 170, y: 1530, w: 1500, h: 110 }, "course.displayName", "Curso", {
      familia: "Lora", tam: 62, color: GRIS, italica: true, alinear: "LEFT",
    });
    tapa.texto("anio", "Año", { x: 1700, y: 1260, w: 500, h: 200 }, "2026", {
      familia: "Raleway", tam: 150, color: TINTA, peso: 700, alinear: "RIGHT",
    });

    // Contratapa
    contratapa.texto("titulo_listado", "Título del listado", { x: 200, y: 220, w: 1300, h: 150 }, "Compañeros", {
      familia: "Lora", tam: 100, color: TINTA, italica: true, alinear: "LEFT",
    });
    contratapa.listado({ x: 200, y: 500, w: 1960, h: 1100 }, { familia: "Raleway", tam: 54, color: GRIS, alinear: "LEFT", interlineado: 1.5 }, 3);

    // Interior arriba: la individual
    interior.foto("individual", I_IND);
    interior.variable("alumno", "Nombre del alumno", { x: 1340, y: 920, w: 860, h: 300 }, "student.fullName", "Nombre del alumno", {
      familia: "Raleway", tam: 100, color: TINTA, alinear: "LEFT", interlineado: 1.1,
    });
    interior.variable("curso", "Curso", { x: 1340, y: 1240, w: 860, h: 110 }, "course.displayName", "Curso", {
      familia: "Lora", tam: 58, color: GRIS, italica: true, alinear: "LEFT",
    });

    // Interior abajo: los amigos
    interior.foto("amigos", I_AMI);
    interior.texto("frase", "Frase", { x: 180, y: 3270, w: 2002, h: 120 }, "Los amigos de siempre.", {
      familia: "Lora", tam: 66, color: GRIS, italica: true, alinear: "LEFT",
    });
  },
};
