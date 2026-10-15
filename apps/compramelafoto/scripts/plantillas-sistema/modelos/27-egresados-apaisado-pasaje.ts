import { caras, panelDeFondo } from "../apaisado";
import { ALTO, ANCHO, agrandar } from "../lienzo";
import { azar, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Egresados · Pasaje (apaisado): la tapa es una tarjeta de embarque con la foto individual y los
 * datos del «pasajero». Adentro, la grupal («¡Buen viaje!») y, abajo, la foto con amigos y la foto
 * con la profe, lado a lado. Listado como «tripulación».
 */

const AZUL = "#16325c";
const CIELO = "#dcefff";
const NARANJA = "#f28c28";
const GRIS = "#6a7489";

const TICKET = { x: 120, y: 260, w: 2122, h: 1320 };
const TALON = 1640;
const T_IND = { x: 200, y: 470, w: 640, h: 860 };
const I_GRU = { x: 170, y: 290, w: 2020, h: 1130 };
const I_AMI = { x: 170, y: 2000, w: 990, h: 1100 };
const I_MAE = { x: 1200, y: 2000, w: 990, h: 1100 };

function avion(cx: number, cy: number, s: number, color = AZUL, giro = 0) {
  return `<g transform="rotate(${giro} ${cx} ${cy})" fill="${color}"><path d="M ${cx - s} ${cy} L ${cx + s * 0.9} ${cy - s * 0.12} Q ${cx + s * 1.15} ${cy} ${cx + s * 0.9} ${cy + s * 0.12} Z"/>
    <path d="M ${cx - s * 0.1} ${cy} L ${cx - s * 0.45} ${cy - s * 0.75} L ${cx - s * 0.2} ${cy - s * 0.75} L ${cx + s * 0.35} ${cy} Z"/>
    <path d="M ${cx - s * 0.1} ${cy} L ${cx - s * 0.45} ${cy + s * 0.75} L ${cx - s * 0.2} ${cy + s * 0.75} L ${cx + s * 0.35} ${cy} Z"/>
    <path d="M ${cx - s * 0.85} ${cy} L ${cx - s} ${cy - s * 0.35} L ${cx - s * 0.85} ${cy - s * 0.35} L ${cx - s * 0.6} ${cy} Z"/></g>`;
}

function nube(cx: number, cy: number, s: number) {
  return `<g fill="#ffffff" opacity="0.9"><ellipse cx="${cx}" cy="${cy}" rx="${s * 1.6}" ry="${s * 0.55}"/><circle cx="${cx - s * 0.4}" cy="${cy - s * 0.3}" r="${s * 0.55}"/><circle cx="${cx + s * 0.35}" cy="${cy - s * 0.4}" r="${s * 0.65}"/></g>`;
}

/** Código de barras falso, determinístico. */
function barras(x: number, y: number, w: number, h: number) {
  const a = azar(42);
  let out = "";
  let cx = x;
  while (cx < x + w) {
    const g = Math.round(a.entre(4, 16));
    if (a.r() < 0.6) out += `<rect x="${cx}" y="${y}" width="${g}" height="${h}" fill="${AZUL}"/>`;
    cx += g + Math.round(a.entre(4, 10));
  }
  return out;
}

function sello(cx: number, cy: number, r: number, color: string, giro: number) {
  return `<g transform="rotate(${giro} ${cx} ${cy})" opacity="0.55"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"/><circle cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="none" stroke="${color}" stroke-width="4"/>
    <text x="${cx}" y="${cy + r * 0.12}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${r * 0.32}" fill="${color}" text-anchor="middle">2026</text></g>`;
}

const defs = () => filtroGrano("g", 0.85);

export const egresadosApaisadoPasaje: Modelo = {
  slug: "egresados-apaisado-pasaje",
  serie: "variadas",
  nombre: "Librito Egresados · Pasaje apaisado",
  descripcion:
    "Librito 30×20 cm apaisado (se lee de costado) para egresados: la tapa es una tarjeta de embarque con la foto individual y los datos del pasajero. Adentro, la foto grupal y, abajo, la foto con amigos y la foto con la profe lado a lado. Listado como «tripulación». Cuatro fotos.",
  categoria: "Egresados",
  filtros: { estilo: "Divertido", orientacion: "horizontal", evento: "Egreso", etiquetas: ["viaje", "pasaje", "amigos", "maestra", "apaisado"] },

  fondoExterior: () => {
    const tapa = panelDeFondo("tapa");
    const contra = panelDeFondo("contratapa");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CIELO}"/>
       ${tapa.svg(`${nube(400, 140, 80)}${nube(1900, 1680, 90)}${avion(2100, 140, 90, AZUL, -8)}
         <rect x="${TICKET.x + 16}" y="${TICKET.y + 22}" width="${TICKET.w}" height="${TICKET.h}" rx="50" fill="#000" opacity="0.12"/>
         <rect x="${TICKET.x}" y="${TICKET.y}" width="${TICKET.w}" height="${TICKET.h}" rx="50" fill="#ffffff"/>
         <path d="M ${TICKET.x} ${TICKET.y + 50} a 50 50 0 0 1 50 -50 H ${TICKET.x + TICKET.w - 50} a 50 50 0 0 1 50 50 V ${TICKET.y + 160} H ${TICKET.x} Z" fill="${AZUL}"/>
         <line x1="${TALON}" y1="${TICKET.y + 190}" x2="${TALON}" y2="${TICKET.y + TICKET.h - 30}" stroke="#b9c3d6" stroke-width="8" stroke-dasharray="22 18"/>
         <circle cx="${TALON}" cy="${TICKET.y}" r="40" fill="${CIELO}"/><circle cx="${TALON}" cy="${TICKET.y + TICKET.h}" r="40" fill="${CIELO}"/>
         ${barras(1700, 1180, 470, 260)}
         <rect x="${agrandar(T_IND, 12).x}" y="${agrandar(T_IND, 12).y}" width="${T_IND.w + 24}" height="${T_IND.h + 24}" rx="20" fill="#e5ebf5"/>`)}
       ${contra.svg(`${nube(300, 1650, 80)}${nube(2050, 1660, 70)}${avion(2160, 230, 70, NARANJA, 12)}
         <rect x="160" y="420" width="2042" height="1230" rx="40" fill="#ffffff" opacity="0.9"/>`)}
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const i = panelDeFondo("interior");
    const m = (r: { x: number; y: number; w: number; h: number }) => {
      const k = agrandar(r, 24);
      return `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="24" fill="#ffffff"/>`;
    };
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CIELO}"/>
       ${i.svg(`${m(I_GRU)}${m(I_AMI)}${m(I_MAE)}
         ${sello(2090, 1560, 105, NARANJA, -14)}${sello(2190, 3400, 105, AZUL, 10)}
         ${avion(2050, 130, 70, AZUL, -5)}${nube(400, 1680, 60)}${nube(1900, 3420, 60)}`)}
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  armar: (a) => {
    const { tapa, contratapa, interior } = caras(a);
    const etiqueta = { familia: "Oswald", tam: 50, color: GRIS, alinear: "LEFT" as const, mayus: "uppercase" as const };
    const dato = { familia: "Oswald", color: AZUL, peso: 700, alinear: "LEFT" as const };

    // Tapa: la tarjeta de embarque
    tapa.texto("cabecera", "Cabecera", { x: 200, y: 290, w: 1960, h: 110 }, "PASAJE DE EGRESADOS · 2026", {
      familia: "Oswald", tam: 84, color: "#ffffff", peso: 700, alinear: "LEFT",
    });
    tapa.foto("individual", T_IND, { radio: 14 });
    tapa.texto("et_pasajero", "Etiqueta pasajero", { x: 900, y: 480, w: 690, h: 70 }, "Pasajero", etiqueta);
    tapa.variable("alumno", "Nombre del alumno", { x: 900, y: 550, w: 690, h: 240 }, "student.fullName", "Nombre del alumno", {
      ...dato, tam: 92, interlineado: 1.05,
    });
    tapa.texto("et_curso", "Etiqueta curso", { x: 900, y: 830, w: 690, h: 70 }, "Curso", etiqueta);
    tapa.variable("curso", "Curso", { x: 900, y: 900, w: 690, h: 120 }, "course.displayName", "Curso", { ...dato, tam: 70 });
    tapa.texto("et_destino", "Etiqueta destino", { x: 900, y: 1070, w: 690, h: 70 }, "Destino", etiqueta);
    tapa.texto("destino", "Destino", { x: 900, y: 1140, w: 690, h: 140 }, "El futuro", { ...dato, tam: 100, color: NARANJA });
    tapa.texto("et_embarque", "Etiqueta embarque", { x: 1700, y: 480, w: 480, h: 70 }, "Embarque", etiqueta);
    tapa.variable("colegio", "Nombre del colegio", { x: 1700, y: 550, w: 480, h: 560 }, "school.name", "Nombre del colegio", {
      ...dato, tam: 66, interlineado: 1.1,
    });

    // Contratapa: la tripulación
    contratapa.texto("titulo_listado", "Título del listado", { x: 160, y: 200, w: 1900, h: 190 }, "TRIPULACIÓN", {
      familia: "Oswald", tam: 150, color: AZUL, peso: 700, alinear: "LEFT",
    });
    contratapa.listado({ x: 240, y: 480, w: 1880, h: 1110 }, { familia: "Oswald", tam: 58, color: AZUL, interlineado: 1.35 }, 3);

    // Interior arriba
    interior.texto("titulo_grupal", "Título foto grupal", { x: 170, y: 90, w: 1700, h: 170 }, "¡BUEN VIAJE!", {
      familia: "Oswald", tam: 130, color: AZUL, peso: 700, alinear: "LEFT",
    });
    interior.foto("grupal", I_GRU, { radio: 14 });
    interior.variable("curso_colegio", "Curso y colegio", { x: 170, y: 1460, w: 1750, h: 140 }, "course.withSchool", "Curso - Colegio", {
      familia: "Oswald", tam: 66, color: AZUL, alinear: "LEFT",
    });

    // Interior abajo: amigos y profe
    interior.foto("amigos", I_AMI, { radio: 14 });
    interior.foto("maestra", I_MAE, { radio: 14 });
    interior.texto("titulo_amigos", "Título foto con amigos", { x: 170, y: 3150, w: 990, h: 120 }, "Compañeros de viaje", {
      familia: "Oswald", tam: 76, color: AZUL, peso: 700,
    });
    interior.texto("titulo_maestra", "Título foto con la maestra", { x: 1200, y: 3150, w: 990, h: 120 }, "Con mi profe", {
      familia: "Oswald", tam: 76, color: NARANJA, peso: 700,
    });
  },
};
