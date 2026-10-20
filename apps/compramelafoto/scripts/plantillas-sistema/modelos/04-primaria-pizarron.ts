import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, estrella, filtroCrayon, onda, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Primaria · Pizarrón: pizarra verde con marco de madera y dibujos de tiza. */

const TIZA = "#f6f3e8";
const AMARILLO = "#ffe58a";
const CELESTE = "#a6e1ff";
const ROSA = "#ffb8cb";
const MARCO = 70;

const FOTO_IND = centrado(CENTRO_IZQ, 300, 1080, 1360);
const FOTO_GRU = centrado(CENTRO_DER, 520, 1380, 920);

function pizarra() {
  return `<rect width="${ANCHO}" height="${ALTO}" fill="#27473c"/>
    <rect width="${ANCHO}" height="${ALTO}" filter="url(#polvo)" opacity="0.5"/>
    <rect width="${ANCHO}" height="${ALTO}" filter="url(#manchas)" opacity="0.35"/>`;
}

function madera() {
  const veta = `<rect width="${ANCHO}" height="${ALTO}" filter="url(#veta)" opacity="0.35"/>`;
  return `<mask id="m"><rect width="${ANCHO}" height="${ALTO}" fill="#fff"/><rect x="${MARCO}" y="${MARCO}" width="${ANCHO - 2 * MARCO}" height="${ALTO - 2 * MARCO}" fill="#000"/></mask>
    <g mask="url(#m)"><rect width="${ANCHO}" height="${ALTO}" fill="#a8743f"/>${veta}</g>
    <rect x="${MARCO}" y="${MARCO}" width="${ANCHO - 2 * MARCO}" height="${ALTO - 2 * MARCO}" fill="none" stroke="#5e3d1c" stroke-width="10" opacity="0.6"/>`;
}

const DEFS = `
  <filter id="polvo" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="4" seed="12"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.8 0 0 0 -0.35"/>
  </filter>
  <filter id="manchas" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.6 1.0"/>
  </filter>
  <filter id="veta" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
    <feTurbulence type="fractalNoise" baseFrequency="0.002 0.08" numOctaves="3" seed="2"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.13  0 0 0 0 0.03  0 0 0 1.4 -0.3"/>
  </filter>
  ${filtroCrayon("tiza", 6, 10)}`;

/** Dibujos de tiza (trazos). */
function sol(cx: number, cy: number, r: number, color: string) {
  let rayos = "";
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    rayos += `<line x1="${cx + Math.cos(ang) * r * 1.3}" y1="${cy + Math.sin(ang) * r * 1.3}" x2="${cx + Math.cos(ang) * r * 1.8}" y2="${cy + Math.sin(ang) * r * 1.8}"/>`;
  }
  return `<g stroke="${color}" stroke-width="14" fill="none" stroke-linecap="round" filter="url(#tiza)"><circle cx="${cx}" cy="${cy}" r="${r}"/>${rayos}</g>`;
}

function casita(x: number, y: number, s: number, color: string) {
  return `<g stroke="${color}" stroke-width="12" fill="none" stroke-linejoin="round" filter="url(#tiza)">
    <rect x="${x}" y="${y}" width="${s}" height="${s * 0.8}"/><polyline points="${x - s * 0.12},${y + 8} ${x + s / 2},${y - s * 0.55} ${x + s * 1.12},${y + 8}"/>
    <rect x="${x + s * 0.38}" y="${y + s * 0.38}" width="${s * 0.24}" height="${s * 0.42}"/></g>`;
}

function simbolos(semilla: number, zonas: Array<{ x: number; y: number }>) {
  const a = azar(semilla);
  let out = "";
  for (const z of zonas) {
    const t = a.entre(40, 70);
    const c = a.elegir([TIZA, AMARILLO, CELESTE, ROSA]);
    const k = Math.floor(a.r() * 4);
    if (k === 0) out += `<path d="M ${z.x - t} ${z.y} h ${2 * t} M ${z.x} ${z.y - t} v ${2 * t}" stroke="${c}"/>`;
    else if (k === 1) out += `<path d="M ${z.x - t} ${z.y - t / 3} h ${2 * t} M ${z.x - t} ${z.y + t / 3} h ${2 * t}" stroke="${c}"/>`;
    else if (k === 2) out += `<polygon points="${estrella(z.x, z.y, t)}" stroke="${c}" fill="none"/>`;
    else out += `<path d="M ${z.x - t} ${z.y - t} l ${2 * t} ${2 * t} M ${z.x + t} ${z.y - t} l -${2 * t} ${2 * t}" stroke="${c}"/>`;
  }
  return `<g stroke-width="12" stroke-linecap="round" fill="none" filter="url(#tiza)">${out}</g>`;
}

export const primariaPizarron: Modelo = {
  slug: "primaria-pizarron",
  nombre: "Librito Primaria · Pizarrón",
  descripcion:
    "Librito 30×20 cm (2 páginas) para primaria: pizarrón verde con marco de madera, letras y dibujos de tiza de colores. Fotos individual y grupal en el interior; listado del curso en la contratapa.",
  categoria: "Primaria",

  fondoExterior: () =>
    svg(
      `${pizarra()}
       ${sol(3220, 330, 95, AMARILLO)}
       ${casita(2030, 1780, 230, CELESTE)}
       <path d="${onda(2170, 3140, 760, 22, 120)}" stroke="${AMARILLO}" stroke-width="12" fill="none" stroke-linecap="round" filter="url(#tiza)"/>
       ${simbolos(3, [{ x: 3250, y: 1950 }, { x: 2950, y: 2080 }, { x: 330, y: 2100 }, { x: 1450, y: 2120 }, { x: 2050, y: 330 }])}
       <path d="M 380 470 q 400 50 1010 -10" stroke="${TIZA}" stroke-width="10" fill="none" stroke-linecap="round" filter="url(#tiza)" opacity="0.8"/>
       ${madera()}`,
      DEFS,
    ),

  fondoInterior: () =>
    svg(
      `${pizarra()}
       ${sol(1560, 2040, 70, AMARILLO)}
       ${simbolos(9, [{ x: 250, y: 260 }, { x: 1540, y: 260 }, { x: 260, y: 2080 }, { x: 2030, y: 2100 }, { x: 3300, y: 2100 }, { x: 3330, y: 260 }])}
       <path d="M ${CENTRO_DER - 500} 455 q 500 40 1000 -5" stroke="${AMARILLO}" stroke-width="10" fill="none" stroke-linecap="round" filter="url(#tiza)"/>
       ${madera()}`,
      DEFS,
    ),

  armar: (a) => {
    const chalk = (tam: number, color = TIZA, extra = {}) => ({ familia: "Schoolbell", tam, color, ...extra });

    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 280, 1300, 190), "Nuestro grado", chalk(130, AMARILLO));
    a.listado(0, { x: 250, y: 560, w: PLIEGUE - 500, h: 1480 }, chalk(70, TIZA, { interlineado: 1.35 }));

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 480, 1350, 260), "¡Recuerdo 2026!", chalk(175, AMARILLO));
    a.variable(0, "colegio", "Nombre de la escuela", centrado(CENTRO_DER, 900, 1350, 330), "school.name", "Nombre de la escuela", chalk(125, TIZA, { interlineado: 1.15 }));
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 1290, 1350, 160), "course.displayName", "Grado", chalk(100, CELESTE));

    // Interior izquierda
    a.forma(1, "marco_individual", "Marco foto individual", agrandar(FOTO_IND, 24), { relleno: TIZA });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1760, 1400, 330), "student.fullName", "Nombre del alumno", chalk(140, AMARILLO, { interlineado: 1.1 }));

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 250, 1300, 200), "¡Mi grado!", chalk(140, TIZA));
    a.forma(1, "marco_grupal", "Marco foto grupal", agrandar(FOTO_GRU, 24), { relleno: TIZA });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Grado y escuela", centrado(CENTRO_DER, 1560, 1400, 230), "course.withSchool", "Grado - Escuela", chalk(86, CELESTE, { interlineado: 1.2 }));
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1830, 1300, 160), "Cada día aprendimos algo nuevo", chalk(80, ROSA));
  },
};
