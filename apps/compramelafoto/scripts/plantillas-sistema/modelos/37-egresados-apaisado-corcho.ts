import { caras, panelDeFondo, type Panel } from "../apaisado";
import { ALTO, ANCHO, girarCon, type RolFoto, type Rect } from "../lienzo";
import { filtroGrano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Egresados · Corcho (apaisado): un tablero de corcho con polaroids inclinadas. En la tapa, la
 * individual y la foto con amigos; adentro, la grupal grande arriba y una foto libre abajo con
 * una frase. Listado en una hoja pinchada en la contratapa. Cuatro fotos.
 */

const TINTA = "#2b2622";
const ROJO = "#d64933";
const CORCHO = "#c99a63";

type Polaroid = { rol: RolFoto; marco: Rect; altoFoto: number; giro: number; epigrafe?: string };

const T_IND: Polaroid = { rol: "individual", marco: { x: 200, y: 230, w: 880, h: 1120 }, altoFoto: 880, giro: -5 };
const T_AMI: Polaroid = { rol: "amigos", marco: { x: 1180, y: 290, w: 1000, h: 900 }, altoFoto: 680, giro: 4, epigrafe: "Con mis amigos" };
const I_GRU: Polaroid = { rol: "grupal", marco: { x: 170, y: 180, w: 2020, h: 1380 }, altoFoto: 1060, giro: -2 };
const I_LIB: Polaroid = { rol: "libre", marco: { x: 200, y: 2000, w: 1150, h: 1250 }, altoFoto: 1000, giro: 3, epigrafe: "Momentos" };

function partes(p: Polaroid) {
  const b = Math.round(p.marco.w * 0.045);
  return {
    foto: { x: p.marco.x + b, y: p.marco.y + b, w: p.marco.w - 2 * b, h: p.altoFoto },
    epigrafe: { x: p.marco.x + b, y: p.marco.y + b + p.altoFoto + 15, w: p.marco.w - 2 * b, h: p.marco.h - p.altoFoto - 2 * b - 15 },
  };
}

/** Polaroid con epígrafe fijo o con una variable (el nombre o el curso). */
function poner(panel: Panel, p: Polaroid, variable?: { key: string; fallback: string }) {
  const { foto, epigrafe } = partes(p);
  panel.polaroid(p.rol, p.marco, foto, p.giro);
  const e = girarCon(epigrafe, p.marco, p.giro);
  const estilo = { familia: "Caveat", tam: 84, color: TINTA, peso: 700 };
  if (variable) panel.variable(`epigrafe_${p.rol}`, `Epígrafe ${p.rol}`, e, variable.key, variable.fallback, estilo, p.giro);
  else panel.texto(`epigrafe_${p.rol}`, `Epígrafe ${p.rol}`, e, p.epigrafe ?? "", estilo, p.giro);
  const pin = girarCon({ x: p.marco.x + p.marco.w / 2 - 32, y: p.marco.y - 22, w: 64, h: 64 }, p.marco, p.giro);
  panel.forma(`chinche_${p.rol}`, "Chinche", pin, { relleno: ROJO, circulo: true, borde: "#7a2a1d", grosor: 4 });
}

const corcho = () =>
  `<rect width="${ANCHO}" height="${ALTO}" fill="${CORCHO}"/><rect width="${ANCHO}" height="${ALTO}" filter="url(#corcho)" opacity="0.5" style="mix-blend-mode:multiply"/>`;

const defs = () =>
  filtroGrano("g", 0.85) +
  `<filter id="corcho" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="12"/><feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.30  0 0 0 0 0.15  0 0 0 0.9 0"/></filter>`;

function sombra(p: Polaroid) {
  const cx = p.marco.x + p.marco.w / 2;
  const cy = p.marco.y + p.marco.h / 2;
  return `<rect x="${p.marco.x + 20}" y="${p.marco.y + 28}" width="${p.marco.w}" height="${p.marco.h}" fill="#000" opacity="0.25" transform="rotate(${p.giro} ${cx} ${cy})"/>`;
}

export const egresadosApaisadoCorcho: Modelo = {
  slug: "egresados-apaisado-corcho",
  serie: "variadas",
  nombre: "Librito Egresados · Corcho apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado) para egresados: tablero de corcho con polaroids inclinadas. La foto individual y la foto con amigos en la tapa; adentro, la grupal grande y una foto libre con una frase. Listado en una hoja pinchada en la contratapa. Cuatro fotos.",
  categoria: "Egresados",
  filtros: { estilo: "Informal", orientacion: "horizontal", evento: "Egreso", etiquetas: ["polaroid", "corcho", "amigos", "collage", "apaisado"] },

  fondoExterior: () => {
    const tapa = panelDeFondo("tapa");
    return svg(`${corcho()}${tapa.svg(sombra(T_IND) + sombra(T_AMI))}`, defs());
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    return svg(`${corcho()}${i.svg(sombra(I_GRU) + sombra(I_LIB))}`, defs());
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);

    // Tapa
    poner(tapa, T_IND, { key: "student.firstName", fallback: "Nombre" });
    poner(tapa, T_AMI);
    tapa.forma("tira", "Tira del título", { x: 560, y: 1430, w: 1400, h: 230 }, { relleno: "#fffdf5", giro: -2 });
    tapa.texto("titulo", "Título", { x: 600, y: 1455, w: 1320, h: 180 }, "Egresados 2026", {
      familia: "Permanent Marker", tam: 130, color: ROJO,
    }, -2);

    // Contratapa: el listado en una hoja
    contratapa.forma("hoja", "Hoja del listado", { x: 170, y: 220, w: 2022, h: 1440 }, { relleno: "#fffdf5", giro: 1 });
    contratapa.texto("titulo_listado", "Título del listado", { x: 240, y: 270, w: 1880, h: 180 }, "Los de la promo", {
      familia: "Permanent Marker", tam: 120, color: ROJO,
    }, 1);
    contratapa.listado({ x: 260, y: 480, w: 1840, h: 1120 }, { familia: "Caveat", tam: 70, color: TINTA, interlineado: 1.2 }, 3);

    // Interior arriba: la grupal
    poner(interior, I_GRU, { key: "course.withSchool", fallback: "Curso - Colegio" });

    // Interior abajo: la libre y una frase
    poner(interior, I_LIB);
    interior.forma("nota", "Nota", { x: 1450, y: 2150, w: 760, h: 860 }, { relleno: "#fff6a8", giro: 2 });
    interior.texto("frase", "Frase", { x: 1500, y: 2220, w: 660, h: 500 }, "Lo que vivimos juntos no se olvida", {
      familia: "Permanent Marker", tam: 92, color: TINTA, interlineado: 1.2,
    }, 2);
    interior.variable("alumno", "Nombre del alumno", { x: 1500, y: 2760, w: 660, h: 200 }, "student.fullName", "Nombre del alumno", {
      familia: "Caveat", tam: 80, color: ROJO, peso: 700, interlineado: 1.1,
    }, 2);
  },
};
