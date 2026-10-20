import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, agrandar, centrado, type Rect } from "../lienzo";
import { azar, filtroGrano, grano, svg } from "../texturas";
import { FECHA_FALLBACK, acuarelas, concha, gota, paloma } from "./religiosos-comun";
import type { Modelo } from "./tipo";

/** Bautismo · Acuarela celeste: manchas de agua celeste, concha con gotas y una paloma. */

const CELESTE = "#9cc6e4";
const CELESTE_OSC = "#6fa3c9";
const SALVIA = "#bcd1b6";
const TEXTO = "#3d6080";
const ORO_TXT = "#a5843f";

const TARJETA: Rect = centrado(CENTRO_IZQ, 240, 1120, 1130);
const FOTO_LIBRE: Rect = { x: TARJETA.x + 50, y: TARJETA.y + 50, w: TARJETA.w - 100, h: 880 };
const FOTO_IND: Rect = centrado(CENTRO_IZQ, 230, 1150, 1480);
const FOTO_GRU: Rect = centrado(CENTRO_DER, 230, 1420, 947);

const DEFS_GRANO = filtroGrano("g", 0.8, 2, 23);

function gotas(zona: Rect, n: number, semilla: number) {
  const a = azar(semilla);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += gota(a.entre(zona.x, zona.x + zona.w), a.entre(zona.y, zona.y + zona.h), a.entre(40, 90), a.elegir([CELESTE, CELESTE_OSC, SALVIA]), a.entre(0.55, 0.9));
  }
  return out;
}

function borde(r: Rect) {
  const b = agrandar(r, 24);
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="40" fill="#ffffff"/>`;
}

export const bautismoAcuarelaCeleste: Modelo = {
  slug: "bautismo-acuarela-celeste",
  nombre: "Librito Bautismo · Acuarela celeste",
  descripcion:
    "Librito 30×20 cm (2 páginas) de Bautismo, informal y suave: manchas de acuarela celeste y verde salvia, la concha bautismal con gotas de agua y una paloma. Sin listado: foto libre del momento en la contratapa; foto individual y grupal en el interior.",
  serie: "religiosas",
  categoria: "Religioso",
  filtros: {
    evento: "Bautismo",
    estilo: "Informal",
    orientacion: "vertical",
    etiquetas: ["bautismo", "acuarela", "concha", "agua", "paloma", "celeste"],
  },

  fondoExterior: () => {
    const m = acuarelas("be", 51, [
      { x: CENTRO_DER, y: 700, r: 520, color: CELESTE, opacidad: 0.35 },
      { x: CENTRO_DER + 380, y: 420, r: 300, color: SALVIA, opacidad: 0.3 },
      { x: 3420, y: 2240, r: 360, color: CELESTE, opacidad: 0.35 },
      { x: 150, y: 150, r: 340, color: CELESTE, opacidad: 0.3 },
      { x: 1600, y: 2260, r: 320, color: SALVIA, opacidad: 0.35 },
    ]);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fdfdfb"/>${m.out}${grano("g", 0.04)}
       ${paloma(CENTRO_DER + 60, 330, 300, "#ffffff", { linea: CELESTE_OSC, giro: -10 })}
       ${concha(CENTRO_DER, 640, 440, "#ffffff", CELESTE_OSC)}
       ${gota(CENTRO_DER, 1010, 80, CELESTE_OSC)}${gota(CENTRO_DER - 60, 1110, 56, CELESTE)}${gota(CENTRO_DER + 50, 1150, 64, CELESTE)}
       <rect x="${TARJETA.x}" y="${TARJETA.y}" width="${TARJETA.w}" height="${TARJETA.h}" rx="12" fill="#ffffff" stroke="#dbe7f0" stroke-width="4"/>
       ${gotas({ x: 280, y: 1700, w: 1200, h: 220 }, 9, 5)}`,
      `${m.defs}${DEFS_GRANO}`,
    );
  },

  fondoInterior: () => {
    const m = acuarelas("bi", 63, [
      { x: 200, y: 2200, r: 420, color: CELESTE, opacidad: 0.35 },
      { x: 1550, y: 180, r: 300, color: SALVIA, opacidad: 0.3 },
      { x: 3380, y: 2180, r: 380, color: SALVIA, opacidad: 0.35 },
      { x: 2100, y: 2260, r: 300, color: CELESTE, opacidad: 0.3 },
    ]);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fdfdfb"/>${m.out}${grano("g", 0.04)}
       ${borde(FOTO_IND)}${borde(FOTO_GRU)}
       ${gotas({ x: 2500, y: 1880, w: 760, h: 200 }, 7, 9)}`,
      `${m.defs}${DEFS_GRANO}`,
    );
  },

  armar: (a) => {
    // Contratapa: foto libre tipo tarjeta.
    a.foto(0, "libre", FOTO_LIBRE, { radio: 6 });
    a.texto(0, "epigrafe", "Epígrafe de la foto libre", { x: TARJETA.x, y: FOTO_LIBRE.y + FOTO_LIBRE.h + 30, w: TARJETA.w, h: 130 }, "Un día para recordar", {
      familia: "Dancing Script", tam: 88, color: TEXTO,
    });
    a.variable(0, "colegio", "Colegio o parroquia", centrado(CENTRO_IZQ, 1980, 1300, 150), "school.name", "Colegio o parroquia", {
      familia: "Quicksand", tam: 46, color: TEXTO, mayus: "uppercase", interlineado: 1.3,
    });

    // Tapa
    a.texto(0, "titulo", "Título de tapa", centrado(CENTRO_DER, 1180, 1400, 270), "Mi Bautismo", {
      familia: "Dancing Script", tam: 210, color: TEXTO,
    });
    a.variable(0, "alumno", "Nombre", centrado(CENTRO_DER, 1470, 1400, 140), "student.fullName", "Nombre", {
      familia: "Quicksand", tam: 88, color: TEXTO, peso: 700,
    });
    a.texto(0, "cita", "Cita bíblica", centrado(CENTRO_DER, 1640, 1350, 180), "«Te he llamado por tu nombre, tú eres mío»", {
      familia: "Lora", tam: 56, color: TEXTO, italica: true, interlineado: 1.3,
    });
    a.texto(0, "cita_ref", "Referencia de la cita", centrado(CENTRO_DER, 1830, 500, 70), "Is 43, 1", {
      familia: "Quicksand", tam: 42, color: ORO_TXT,
    });
    a.variable(0, "fecha", "Fecha", centrado(CENTRO_DER, 1960, 1000, 90), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Quicksand", tam: 50, color: ORO_TXT, peso: 700,
    });
    a.variable(0, "colegio_tapa", "Colegio o parroquia", centrado(CENTRO_DER, 2070, 1300, 90), "school.name", "Colegio o parroquia", {
      familia: "Quicksand", tam: 42, color: TEXTO, mayus: "uppercase",
    });

    // Interior izquierda
    a.foto(1, "individual", FOTO_IND, { radio: 30 });
    a.variable(1, "alumno", "Nombre", centrado(CENTRO_IZQ, 1790, 1400, 210), "student.fullName", "Nombre", {
      familia: "Dancing Script", tam: 128, color: TEXTO,
    });
    a.variable(1, "curso", "Curso", centrado(CENTRO_IZQ, 2010, 1200, 90), "course.displayName", "Curso", {
      familia: "Quicksand", tam: 48, color: ORO_TXT,
    });

    // Interior derecha
    a.foto(1, "grupal", FOTO_GRU, { radio: 30 });
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 1290, 1400, 180), "Todos juntos", {
      familia: "Dancing Script", tam: 120, color: TEXTO,
    });
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1490, 1400, 160), "course.withSchool", "Curso - Colegio", {
      familia: "Quicksand", tam: 50, color: TEXTO, interlineado: 1.3,
    });
    a.variable(1, "fecha", "Fecha", centrado(CENTRO_DER, 1680, 1000, 90), "event.dateFormatted", FECHA_FALLBACK, {
      familia: "Quicksand", tam: 48, color: ORO_TXT, peso: 700,
    });
  },
};
