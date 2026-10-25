import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Secundaria · Urbano: pared de hormigón, aerosol, chorreados y cinta; informal. */

const NEGRO = "#111111";
const AMARILLO = "#f4f53b";
const FUCSIA = "#ff2e88";
const BLANCO = "#ffffff";

const FOTO_IND = centrado(CENTRO_IZQ, 290, 1060, 1340);
const FOTO_GRU = centrado(CENTRO_DER, 560, 1380, 900);

const DEFS = `
  <filter id="hormigon" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="3" seed="21" result="fino"/>
    <feColorMatrix in="fino" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 0.75" result="a"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="8" result="grueso"/>
    <feColorMatrix in="grueso" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.45" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="a"/></feMerge>
  </filter>
  <filter id="spray" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>`;

function pared(base: string) {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${base}"/><rect width="${ANCHO}" height="${ALTO}" filter="url(#hormigon)" opacity="0.35"/>`;
}

function salpicado(cx: number, cy: number, r: number, color: string, semilla: number) {
  const a = azar(semilla);
  let gotas = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" filter="url(#spray)" opacity="0.75"/>`;
  for (let i = 0; i < 70; i++) {
    const ang = a.entre(0, Math.PI * 2);
    const d = r * Math.pow(a.r(), 0.7) * 1.4;
    gotas += `<circle cx="${(cx + Math.cos(ang) * d).toFixed(1)}" cy="${(cy + Math.sin(ang) * d).toFixed(1)}" r="${a.entre(3, 14).toFixed(1)}" fill="${color}"/>`;
  }
  for (let i = 0; i < 4; i++) {
    const x = cx + a.entre(-r * 0.6, r * 0.6);
    const largo = a.entre(120, 380);
    gotas += `<rect x="${x.toFixed(1)}" y="${cy}" width="${a.entre(8, 16).toFixed(1)}" height="${largo.toFixed(1)}" rx="8" fill="${color}" opacity="0.9"/>`;
  }
  return gotas;
}

function cinta(x: number, y: number, w: number, giro: number) {
  let rayas = "";
  for (let i = -2; i < w / 70 + 2; i++) {
    rayas += `<polygon points="${x + i * 70},${y} ${x + i * 70 + 35},${y} ${x + i * 70 + 5},${y + 70} ${x + i * 70 - 30},${y + 70}" fill="${NEGRO}"/>`;
  }
  return `<g transform="rotate(${giro} ${x + w / 2} ${y + 35})"><clipPath id="c${x}${y}"><rect x="${x}" y="${y}" width="${w}" height="70"/></clipPath><rect x="${x}" y="${y}" width="${w}" height="70" fill="${AMARILLO}"/><g clip-path="url(#c${x}${y})">${rayas}</g></g>`;
}

export const secundariaUrbano: Modelo = {
  slug: "secundaria-urbano",
  nombre: "Librito Secundaria · Urbano",
  descripcion:
    "Librito 30×20 cm (2 páginas) informal para secundaria: pared de hormigón, aerosol fucsia y amarillo, cinta de peligro y letras de marcador. Fotos tipo sticker en el interior; listado del curso en la contratapa.",
  categoria: "Secundaria",

  fondoExterior: () =>
    svg(
      `${pared("#8d8f93")}
       ${salpicado(3250, 330, 260, FUCSIA, 3)}
       ${salpicado(2050, 1950, 230, AMARILLO, 5)}
       ${salpicado(120, 1300, 200, AMARILLO, 7)}
       ${salpicado(1450, 2100, 180, FUCSIA, 9)}
       ${cinta(1800, 2140, 1900, -3)}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${pared("#7d8085")}
       ${salpicado(250, 2100, 230, FUCSIA, 11)}
       ${salpicado(1560, 220, 170, AMARILLO, 13)}
       ${salpicado(3320, 2080, 230, AMARILLO, 15)}
       ${salpicado(3380, 260, 160, FUCSIA, 17)}
       ${cinta(-100, 40, 900, -4)}`,
      DEFS,
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 250, 1200, 200), "La banda", {
      familia: "Permanent Marker", tam: 150, color: FUCSIA,
    }, -3);
    a.forma(0, "papel", "Papel del listado", { x: 230, y: 520, w: PLIEGUE - 460, h: 1580 }, { relleno: BLANCO, opacidad: 0.92 });
    a.listado(0, { x: 300, y: 600, w: PLIEGUE - 600, h: 1440 }, { familia: "Permanent Marker", tam: 64, color: NEGRO, interlineado: 1.35 });

    // Tapa
    a.forma(0, "banda", "Banda negra", centrado(CENTRO_DER, 640, 1500, 420), { relleno: NEGRO, giro: -4 });
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 680, 1440, 340), "ESTO FUE 2026", {
      familia: "Anton", tam: 250, color: AMARILLO, interlineado: 1.1,
    }, -4);
    a.variable(0, "colegio", "Nombre del colegio", centrado(CENTRO_DER, 1180, 1400, 330), "school.name", "Nombre del colegio", {
      familia: "Permanent Marker", tam: 115, color: BLANCO, interlineado: 1.15,
    });
    a.variable(0, "curso", "Curso", centrado(CENTRO_DER, 1560, 1300, 160), "course.displayName", "Curso", {
      familia: "Anton", tam: 110, color: FUCSIA, mayus: "uppercase",
    });

    // Interior izquierda: sticker
    a.forma(1, "marco_individual", "Borde sticker individual", agrandar(FOTO_IND, 34), { relleno: BLANCO, giro: -2.5 });
    a.foto(1, "individual", FOTO_IND, { giro: -2.5 });
    a.forma(1, "banda_nombre", "Banda del nombre", centrado(CENTRO_IZQ, 1770, 1420, 300), { relleno: NEGRO, giro: 2 });
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1800, 1360, 240), "student.fullName", "Nombre del alumno", {
      familia: "Anton", tam: 160, color: AMARILLO, mayus: "uppercase",
    }, 2);

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 240, 1300, 200), "Mi gente", {
      familia: "Permanent Marker", tam: 160, color: FUCSIA,
    }, -3);
    a.forma(1, "marco_grupal", "Borde sticker grupal", agrandar(FOTO_GRU, 34), { relleno: BLANCO, giro: 2 });
    a.foto(1, "grupal", FOTO_GRU, { giro: 2 });
    a.variable(1, "curso_colegio", "Curso y colegio", centrado(CENTRO_DER, 1620, 1400, 230), "course.withSchool", "Curso - Colegio", {
      familia: "Permanent Marker", tam: 80, color: BLANCO, interlineado: 1.2,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1880, 1300, 150), "Nos vemos en la próxima", {
      familia: "Anton", tam: 90, color: AMARILLO, mayus: "uppercase",
    });
  },
};
