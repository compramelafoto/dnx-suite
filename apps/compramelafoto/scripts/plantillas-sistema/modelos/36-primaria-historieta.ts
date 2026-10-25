import { ALTO, ANCHO, PLIEGUE, TUBO_PLIEGUE, type Rect } from "../lienzo";
import { estrella, filtroGrano, grano, puntos, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Primaria · Historieta: viñetas con borde negro grueso, trama de puntos y cartelitos amarillos.
 * La tapa es la individual en una viñeta con un «¡QUÉ AÑO!» en una explosión; adentro, una página
 * de historieta con la grupal, la foto con la seño y la foto con los amigos. Listado como «el
 * elenco» en la contratapa.
 */

const NEGRO = "#151515";
const AMARILLO = "#ffe14d";
const ROJO = "#e8352e";
const CELESTE = "#47b5ff";
const BORDE = 16;

const T_IND: Rect = { x: PLIEGUE + 190, y: 470, w: PLIEGUE - 310, h: 1280 };
const V_GRU: Rect = { x: 100, y: 100, w: PLIEGUE - 100 - TUBO_PLIEGUE, h: 1000 };
const V_MAE: Rect = { x: 100, y: 1170, w: PLIEGUE - 100 - TUBO_PLIEGUE, h: ALTO - 1270 };
const V_AMI: Rect = { x: PLIEGUE + TUBO_PLIEGUE, y: 100, w: PLIEGUE - 100 - TUBO_PLIEGUE, h: 1720 };
const V_CARTEL: Rect = { x: PLIEGUE + TUBO_PLIEGUE, y: 1890, w: PLIEGUE - 100 - TUBO_PLIEGUE, h: ALTO - 1990 };

const vineta = (r: Rect, relleno = "#ffffff") =>
  `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${relleno}" stroke="${NEGRO}" stroke-width="${BORDE * 2}"/>`;

function explosion(cx: number, cy: number, r: number, color: string) {
  return `<polygon points="${estrella(cx, cy, r, 14, 0.72, -90)}" fill="${color}" stroke="${NEGRO}" stroke-width="14" stroke-linejoin="round"/>`;
}

const defs = () => filtroGrano("g", 0.85);

export const primariaHistorieta: Modelo = {
  slug: "primaria-historieta",
  serie: "variadas",
  nombre: "Librito Primaria · Historieta",
  descripcion:
    "Librito 30×20 cm para primaria con forma de historieta: viñetas con borde negro, trama de puntos y cartelitos amarillos. La foto individual en la tapa con un «¡QUÉ AÑO!»; adentro, una página de historieta con la grupal, la foto con la seño y la foto con los amigos. Listado como «el elenco». Cuatro fotos.",
  categoria: "Primaria",
  filtros: { estilo: "Divertido", orientacion: "vertical", etiquetas: ["historieta", "amigos", "maestra"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CELESTE}"/>
       ${puntos({ x: 0, y: 0, w: ANCHO, h: ALTO }, 34, 7, "#ffffff", 0.35)}
       ${explosion(PLIEGUE + PLIEGUE / 2, 270, 470, AMARILLO)}
       ${vineta(T_IND)}
       <path d="M ${PLIEGUE + 260} 1890 h ${PLIEGUE - 450} a 50 50 0 0 1 50 50 v 220 a 50 50 0 0 1 -50 50 h -${PLIEGUE - 450} a 50 50 0 0 1 -50 -50 v -220 a 50 50 0 0 1 50 -50 Z" fill="#ffffff" stroke="${NEGRO}" stroke-width="14"/>
       <polygon points="${PLIEGUE + 450},1895 ${PLIEGUE + 520},1790 ${PLIEGUE + 560},1895" fill="#ffffff" stroke="${NEGRO}" stroke-width="14" stroke-linejoin="round"/>
       <rect x="${PLIEGUE + 455}" y="1880" width="100" height="30" fill="#ffffff"/>
       ${vineta({ x: 150, y: 420, w: PLIEGUE - 300, h: 1780 })}
       ${grano("g", 0.04)}`,
      defs(),
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#ffffff"/>
       ${vineta(V_GRU)}${vineta(V_MAE)}${vineta(V_AMI)}${vineta(V_CARTEL, AMARILLO)}
       ${puntos({ x: V_CARTEL.x + 40, y: V_CARTEL.y + 30, w: V_CARTEL.w - 80, h: V_CARTEL.h - 60 }, 30, 5, "#f2b600", 0.7)}
       ${grano("g", 0.03)}`,
      defs(),
    ),

  armar: (a) => {
    // Tapa
    a.texto(0, "titulo", "Título", { x: PLIEGUE + 400, y: 160, w: PLIEGUE - 800 + 100, h: 230 }, "¡QUÉ AÑO!", {
      familia: "Anton", tam: 190, color: ROJO,
    });
    a.foto(0, "individual", T_IND);
    a.variable(0, "alumno", "Nombre del alumno", { x: PLIEGUE + 260, y: 1920, w: PLIEGUE - 450, h: 140 }, "student.fullName", "Nombre del alumno", {
      familia: "Permanent Marker", tam: 92, color: NEGRO,
    });
    a.variable(0, "curso", "Grado", { x: PLIEGUE + 260, y: 2060, w: PLIEGUE - 450, h: 110 }, "course.displayName", "Grado", {
      familia: "Patrick Hand", tam: 64, color: NEGRO,
    });

    // Contratapa: el elenco
    a.texto(0, "titulo_listado", "Título del listado", { x: 150, y: 170, w: PLIEGUE - 300, h: 220 }, "EL ELENCO", {
      familia: "Anton", tam: 180, color: NEGRO,
    });
    a.listado(0, { x: 250, y: 520, w: PLIEGUE - 500, h: 1580 }, { familia: "Patrick Hand", tam: 66, color: NEGRO, interlineado: 1.3 }, 2);

    // Interior: la página de historieta
    a.foto(1, "grupal", V_GRU);
    a.foto(1, "maestra", V_MAE);
    a.foto(1, "amigos", V_AMI);
    const cartelito = (clave: string, r: Rect, texto: string) => {
      a.forma(1, `cartel_${clave}`, `Cartelito ${clave}`, r, { relleno: AMARILLO, borde: NEGRO, grosor: 10 });
      a.texto(1, `texto_${clave}`, `Texto ${clave}`, { x: r.x + 30, y: r.y + 18, w: r.w - 60, h: r.h - 36 }, texto, {
        familia: "Patrick Hand", tam: 56, color: NEGRO, alinear: "LEFT",
      });
    };
    cartelito("grupal", { x: V_GRU.x + 40, y: V_GRU.y + 40, w: 900, h: 110 }, "Mientras tanto, en el aula…");
    cartelito("maestra", { x: V_MAE.x + 40, y: V_MAE.y + 40, w: 700, h: 110 }, "¡Con mi seño!");
    cartelito("amigos", { x: V_AMI.x + 40, y: V_AMI.y + 40, w: 900, h: 110 }, "Y mis amigos de siempre…");
    a.texto(1, "remate", "Remate", { x: V_CARTEL.x + 60, y: V_CARTEL.y + 60, w: V_CARTEL.w - 120, h: 160 }, "¡JUNTOS SOMOS IMPARABLES!", {
      familia: "Anton", tam: 104, color: NEGRO,
    });
    a.variable(1, "curso_colegio", "Grado y escuela", { x: V_CARTEL.x + 60, y: V_CARTEL.y + 220, w: V_CARTEL.w - 120, h: 90 }, "course.withSchool", "Grado - Escuela", {
      familia: "Patrick Hand", tam: 58, color: NEGRO,
    });
  },
};
