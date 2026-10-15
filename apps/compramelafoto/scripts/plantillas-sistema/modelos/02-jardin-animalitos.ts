import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { conejo, gato, nube, oso, pollito } from "../animalitos";
import { azar, estrella, filtroGrano, grano, puntos, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Jardín · Animalitos pastel: osito, conejo, gatito y pollito; nubes y estrellitas. */

const TINTA = "#4b4a6b";
const ROSA = "#f0738f";
const VERDE = "#3aa58a";

const FOTO_IND = centrado(CENTRO_IZQ, 470, 1120, 1120);
const FOTO_GRU = centrado(CENTRO_DER, 640, 1400, 930);
const NUBE_TAPA = { x: 2010, y: 520, w: 1520, h: 1040 };

function estrellitas(semilla: number, zona: { x: number; y: number; w: number; h: number }, n: number, evitar: Array<{ x: number; y: number; w: number; h: number }>) {
  const a = azar(semilla);
  let out = "";
  let k = 0;
  for (let i = 0; i < n * 10 && k < n; i++) {
    const x = a.entre(zona.x, zona.x + zona.w);
    const y = a.entre(zona.y, zona.y + zona.h);
    if (evitar.some((e) => x > e.x && x < e.x + e.w && y > e.y && y < e.y + e.h)) continue;
    out += `<polygon points="${estrella(x, y, a.entre(18, 34), 5, 0.5)}" fill="${a.elegir(["#ffe28a", "#ffffff", "#ffc6d3"])}" opacity="0.95"/>`;
    k++;
  }
  return out;
}

function pasto(x0: number, x1: number, y: number, color: string) {
  return `<path d="M ${x0} ${ALTO} L ${x0} ${y + 60} Q ${(x0 + x1) / 4 + x0 / 2} ${y - 40} ${(x0 + x1) / 2} ${y + 40} T ${x1} ${y + 20} L ${x1} ${ALTO} Z" fill="${color}"/>`;
}

export const jardinAnimalitos: Modelo = {
  slug: "jardin-animalitos",
  nombre: "Librito Jardín · Animalitos pastel",
  descripcion:
    "Librito 30×20 cm (2 páginas) para jardín: colores pastel, nubes y animalitos (osito, conejo, gatito y pollito). Foto individual redonda y foto grupal en el interior; listado del curso en la contratapa.",
  categoria: "Jardín",

  fondoExterior: () => {
    const evitar = [NUBE_TAPA, { x: 150, y: 150, w: PLIEGUE - 300, h: ALTO - 300 }];
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#cdeee6"/>
       <rect x="${PLIEGUE}" width="${PLIEGUE}" height="${ALTO}" fill="#d6ecfa"/>
       ${puntos({ x: 40, y: 40, w: ANCHO - 80, h: ALTO - 80 }, 90, 6, "#ffffff", 0.45)}
       ${nube(1920, 110, 520, 230, "#ffffff", 0.85)}${nube(3020, 230, 420, 190, "#ffffff", 0.85)}
       ${nube(NUBE_TAPA.x, NUBE_TAPA.y, NUBE_TAPA.w, NUBE_TAPA.h)}
       ${estrellitas(3, { x: 1880, y: 60, w: 1600, h: 1700 }, 22, evitar)}
       ${pasto(PLIEGUE, ANCHO, 1900, "#b5e3a1")}
       ${oso(2160, 1980, 150)}${conejo(2520, 2010, 135)}${gato(2880, 1990, 140)}${pollito(3250, 2030, 120)}
       ${pasto(0, PLIEGUE, 2150, "#a9dccb")}
       ${grano("g", 0.05)}`,
      filtroGrano("g", 0.8),
    );
  },

  fondoInterior: () => {
    const evitar = [agrandar(FOTO_IND, 90), agrandar(FOTO_GRU, 90), { x: 200, y: 140, w: 1370, h: 300 }, { x: 200, y: 1650, w: 1370, h: 500 }, { x: 1950, y: 150, w: 1420, h: 420 }, { x: 1950, y: 1640, w: 1420, h: 520 }];
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fde3ea"/>
       <rect x="${PLIEGUE}" width="${PLIEGUE}" height="${ALTO}" fill="#fff3c9"/>
       ${puntos({ x: 40, y: 40, w: ANCHO - 80, h: ALTO - 80 }, 90, 6, "#ffffff", 0.55)}
       <circle cx="${FOTO_IND.x + FOTO_IND.w / 2}" cy="${FOTO_IND.y + FOTO_IND.h / 2}" r="${FOTO_IND.w / 2 + 70}" fill="#ffffff" opacity="0.6"/>
       ${conejo(FOTO_IND.x + 20, FOTO_IND.y + 120, 140)}
       ${pollito(FOTO_IND.x + FOTO_IND.w - 10, FOTO_IND.y + FOTO_IND.h - 80, 125)}
       ${oso(FOTO_GRU.x + 150, FOTO_GRU.y - 40, 130)}
       ${gato(FOTO_GRU.x + FOTO_GRU.w - 150, FOTO_GRU.y - 30, 125)}
       ${estrellitas(8, { x: 60, y: 60, w: ANCHO - 120, h: ALTO - 120 }, 40, evitar)}
       ${grano("g", 0.05)}`,
      filtroGrano("g", 0.8),
    );
  },

  armar: (a) => {
    // Contratapa
    a.forma(0, "tarjeta", "Tarjeta del listado", { x: 190, y: 200, w: PLIEGUE - 380, h: 1880 }, { relleno: "#ffffff", radio: 90, opacidad: 0.92 });
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 290, 1300, 170), "Mis amigos de la sala", {
      familia: "Nunito", tam: 112, color: VERDE, peso: 700,
    });
    a.listado(0, { x: 270, y: 540, w: PLIEGUE - 540, h: 1460 }, { familia: "Patrick Hand", tam: 80, color: TINTA, interlineado: 1.3 });

    // Tapa (dentro de la nube)
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER + 20, 300, 1300, 200), "Recuerdo 2026", {
      familia: "Nunito", tam: 140, color: ROSA, peso: 700,
    });
    a.variable(0, "colegio", "Nombre del jardín", centrado(CENTRO_DER + 40, 900, 1150, 300), "school.name", "Nombre del jardín", {
      familia: "Nunito", tam: 112, color: TINTA, peso: 700, interlineado: 1.12,
    });
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER + 40, 1230, 1100, 140), "course.displayName", "Sala", {
      familia: "Patrick Hand", tam: 100, color: VERDE,
    });

    // Interior izquierda: foto redonda
    a.texto(1, "hola", "Saludo", centrado(CENTRO_IZQ, 200, 1300, 200), "¡Hola! Soy", { familia: "Patrick Hand", tam: 130, color: TINTA });
    a.forma(1, "marco_individual", "Marco foto individual", agrandar(FOTO_IND, 30), { relleno: "#ffffff", circulo: true });
    a.foto(1, "individual", FOTO_IND, { mascara: "circle" });
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1730, 1450, 330), "student.fullName", "Nombre del alumno", {
      familia: "Nunito", tam: 140, color: ROSA, peso: 700, interlineado: 1.1,
    });

    // Interior derecha: foto grupal
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 220, 1300, 170), "Todos juntos", {
      familia: "Nunito", tam: 120, color: VERDE, peso: 700,
    });
    a.forma(1, "marco_grupal", "Marco foto grupal", agrandar(FOTO_GRU, 32), { relleno: "#ffffff", radio: 80 });
    a.foto(1, "grupal", FOTO_GRU, { radio: 55 });
    a.variable(1, "curso_colegio", "Sala y jardín", centrado(CENTRO_DER, 1700, 1400, 230), "course.withSchool", "Sala - Jardín", {
      familia: "Patrick Hand", tam: 92, color: TINTA, interlineado: 1.15,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1960, 1300, 140), "¡Qué lindo es crecer jugando!", {
      familia: "Patrick Hand", tam: 80, color: ROSA,
    });
  },
};
