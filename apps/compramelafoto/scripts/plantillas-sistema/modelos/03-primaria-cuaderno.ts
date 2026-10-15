import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, mm, type Rect } from "../lienzo";
import { estrella, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Primaria · Cuaderno rayado: renglones, margen rojo, cinta adhesiva y útiles dibujados. */

const AZUL = "#1f4e9c";
const ROJO = "#d64545";
const LAPIZ = "#3d3d4d";

const FOTO_IND = centrado(CENTRO_IZQ, 400, 1100, 1380);
const FOTO_GRU = centrado(CENTRO_DER, 470, 1400, 930);
const ETIQUETA = centrado(CENTRO_DER, 820, 1320, 820);

function hoja(fondo = "#fdfdf7") {
  const paso = mm(8);
  let lineas = "";
  for (let y = mm(28); y < ALTO - mm(6); y += paso) {
    lineas += `<line x1="0" y1="${y}" x2="${ANCHO}" y2="${y}" stroke="#9cc3e8" stroke-width="4"/>`;
  }
  const margen = (x: number) => `<line x1="${x}" y1="0" x2="${x}" y2="${ALTO}" stroke="#f08a8a" stroke-width="5"/><line x1="${x + 12}" y1="0" x2="${x + 12}" y2="${ALTO}" stroke="#f08a8a" stroke-width="3"/>`;
  return `<rect width="${ANCHO}" height="${ALTO}" fill="${fondo}"/>${lineas}${margen(mm(16))}${margen(PLIEGUE + mm(16))}`;
}

function cinta(cx: number, cy: number, giro: number, color = "#f7d774") {
  return `<rect x="${cx - 130}" y="${cy - 38}" width="260" height="76" fill="${color}" opacity="0.75" transform="rotate(${giro} ${cx} ${cy})"/>`;
}

function cintasEnEsquinas(r: Rect) {
  return cinta(r.x + 40, r.y + 10, -38) + cinta(r.x + r.w - 40, r.y + 10, 38) + cinta(r.x + 40, r.y + r.h - 10, 38, "#9fd8c9") + cinta(r.x + r.w - 40, r.y + r.h - 10, -38, "#9fd8c9");
}

function lapiz(x: number, y: number, largo: number, giro: number, color: string) {
  return `<g transform="rotate(${giro} ${x} ${y})">
    <rect x="${x}" y="${y - 32}" width="${largo}" height="64" fill="${color}"/>
    <rect x="${x}" y="${y - 32}" width="${largo}" height="18" fill="#ffffff" opacity="0.25"/>
    <rect x="${x - 60}" y="${y - 32}" width="60" height="64" fill="#c0c0c8"/><rect x="${x - 110}" y="${y - 32}" width="50" height="64" rx="16" fill="#f29bb2"/>
    <polygon points="${x + largo},${y - 32} ${x + largo + 110},${y} ${x + largo},${y + 32}" fill="#f1d3a6"/>
    <polygon points="${x + largo + 72},${y - 11} ${x + largo + 110},${y} ${x + largo + 72},${y + 11}" fill="${LAPIZ}"/>
  </g>`;
}

function regla(x: number, y: number, largo: number, giro: number) {
  let marcas = "";
  for (let i = 30; i < largo; i += 30) {
    marcas += `<line x1="${x + i}" y1="${y}" x2="${x + i}" y2="${y + (i % 150 === 0 ? 50 : 28)}" stroke="#6b5a2a" stroke-width="4"/>`;
  }
  return `<g transform="rotate(${giro} ${x} ${y})"><rect x="${x}" y="${y}" width="${largo}" height="110" rx="10" fill="#f6dc7a" opacity="0.95"/>${marcas}</g>`;
}

function manzana(cx: number, cy: number, s: number) {
  return `<g><path d="M ${cx} ${cy - s * 0.6} C ${cx - s * 1.2} ${cy - s * 1.1}, ${cx - s * 1.3} ${cy + s * 0.9}, ${cx} ${cy + s * 0.9} C ${cx + s * 1.3} ${cy + s * 0.9}, ${cx + s * 1.2} ${cy - s * 1.1}, ${cx} ${cy - s * 0.6} Z" fill="#e5484d"/>
    <path d="M ${cx} ${cy - s * 0.6} q ${s * 0.05} -${s * 0.4} ${s * 0.25} -${s * 0.55}" stroke="#6b4423" stroke-width="${s * 0.1}" fill="none"/>
    <ellipse cx="${cx + s * 0.4}" cy="${cy - s * 0.95}" rx="${s * 0.3}" ry="${s * 0.14}" fill="#46a35a" transform="rotate(-25 ${cx + s * 0.4} ${cy - s * 0.95})"/></g>`;
}

function avion(cx: number, cy: number, s: number) {
  return `<g stroke="${AZUL}" stroke-width="6" fill="#ffffff" stroke-linejoin="round">
    <polygon points="${cx - s},${cy} ${cx + s},${cy - s * 0.55} ${cx - s * 0.1},${cy + s * 0.15}"/>
    <polygon points="${cx - s * 0.1},${cy + s * 0.15} ${cx + s},${cy - s * 0.55} ${cx},${cy + s * 0.55}"/>
  </g><path d="M ${cx - s * 1.2} ${cy + s * 0.2} q -${s * 0.6} ${s * 0.4} -${s * 1.4} ${s * 0.1}" stroke="${AZUL}" stroke-width="6" stroke-dasharray="18 16" fill="none"/>`;
}

export const primariaCuaderno: Modelo = {
  slug: "primaria-cuaderno",
  nombre: "Librito Primaria · Cuaderno rayado",
  descripcion:
    "Librito 30×20 cm (2 páginas) para primaria: hoja de cuaderno rayada con margen, cinta adhesiva y útiles escolares dibujados. Fotos individual y grupal en el interior; listado del curso en la contratapa.",
  categoria: "Primaria",

  fondoExterior: () =>
    svg(
      `${hoja()}
       ${lapiz(2050, 300, 520, -8, "#3a86ff")}
       ${manzana(3260, 330, 120)}
       ${regla(2050, 1880, 900, -4)}
       <polygon points="${estrella(3250, 1880, 90)}" fill="#ffd43b" stroke="#e0a800" stroke-width="6"/>
       ${lapiz(500, 2180, 700, 3, "#46a35a")}
       ${avion(1450, 160, 110)}
       ${cinta(ETIQUETA.x + 60, ETIQUETA.y - 10, -30)}${cinta(ETIQUETA.x + ETIQUETA.w - 60, ETIQUETA.y - 10, 30)}
       ${grano("g", 0.06)}`,
      filtroGrano("g", 0.85),
    ),

  fondoInterior: () =>
    svg(
      `${hoja()}
       ${cintasEnEsquinas(FOTO_IND)}${cintasEnEsquinas(FOTO_GRU)}
       ${manzana(1560, 230, 90)}
       ${lapiz(2050, 2130, 560, 0, "#e5484d")}
       ${avion(3250, 2200, 80)}
       <polygon points="${estrella(260, 2200, 60)}" fill="#ffd43b" stroke="#e0a800" stroke-width="5"/>
       ${grano("g", 0.06)}`,
      filtroGrano("g", 0.85),
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", { x: 330, y: 260, w: 1300, h: 190 }, "Mis compañeros", {
      familia: "Kalam", tam: 140, color: ROJO, peso: 700, alinear: "LEFT",
    });
    a.listado(0, { x: 330, y: 560, w: PLIEGUE - 520, h: 1500 }, { familia: "Architects Daughter", tam: 72, color: AZUL, alinear: "LEFT", interlineado: 1.32 });

    // Tapa: etiqueta de cuaderno
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 500, 1400, 220), "Mi año en la escuela", {
      familia: "Kalam", tam: 150, color: ROJO, peso: 700,
    });
    a.forma(0, "etiqueta", "Etiqueta", ETIQUETA, { relleno: "#ffffff", borde: AZUL, grosor: 10, radio: 60 });
    a.forma(0, "etiqueta_franja", "Franja de la etiqueta", { x: ETIQUETA.x, y: ETIQUETA.y + 40, w: ETIQUETA.w, h: 24 }, { relleno: "#9cc3e8" });
    a.variable(0, "colegio", "Nombre de la escuela", centrado(CENTRO_DER, ETIQUETA.y + 130, 1180, 300), "school.name", "Nombre de la escuela", {
      familia: "Kalam", tam: 110, color: AZUL, peso: 700, interlineado: 1.1,
    });
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, ETIQUETA.y + 470, 1180, 140), "course.displayName", "Grado", {
      familia: "Architects Daughter", tam: 92, color: LAPIZ,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, ETIQUETA.y + 630, 1180, 140), "2026", { familia: "Kalam", tam: 100, color: ROJO, peso: 700 });

    // Interior izquierda
    a.texto(1, "titulo_individual", "Título foto individual", { x: 330, y: 170, w: 1300, h: 190 }, "Este soy yo", {
      familia: "Kalam", tam: 130, color: ROJO, peso: 700, alinear: "LEFT",
    });
    a.forma(1, "marco_individual", "Marco foto individual", agrandar(FOTO_IND, 26), { relleno: "#ffffff", borde: "#d9d9e0", grosor: 3 });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1880, 1400, 260), "student.fullName", "Nombre del alumno", {
      familia: "Kalam", tam: 130, color: AZUL, peso: 700, interlineado: 1.1,
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", { x: PLIEGUE + 330, y: 170, w: 1300, h: 190 }, "Mi grado", {
      familia: "Kalam", tam: 130, color: ROJO, peso: 700, alinear: "LEFT",
    });
    a.forma(1, "marco_grupal", "Marco foto grupal", agrandar(FOTO_GRU, 26), { relleno: "#ffffff", borde: "#d9d9e0", grosor: 3 });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Grado y escuela", centrado(CENTRO_DER, 1530, 1400, 230), "course.withSchool", "Grado - Escuela", {
      familia: "Architects Daughter", tam: 84, color: AZUL, interlineado: 1.2,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1800, 1400, 200), "Aprender juntos es la mejor aventura", {
      familia: "Kalam", tam: 84, color: LAPIZ,
    });
  },
};
