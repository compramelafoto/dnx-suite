import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, centrado } from "../lienzo";
import { corazon, filtroGrano, grano, puntos, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Jardín · Pastel a sangre: la foto individual ocupa toda la tapa, con una etiqueta redonda para
 * el nombre; la grupal ocupa la parte de arriba de la contratapa. Adentro, el listado entre
 * corazoncitos y la foto con la seño en un círculo.
 */

const TINTA = "#4b3f5c";
const ROSA = "#f7a8c4";
const LILA = "#c9b6f2";
const MENTA = "#bfe8d8";
const CREMA = "#fff9f4";

const FOTO_MAE = centrado(CENTRO_DER, 250, 1250, 1250);

const defs = () => filtroGrano("g", 0.85);

export const jardinPastelASangre: Modelo = {
  slug: "jardin-pastel-a-sangre",
  serie: "variadas",
  nombre: "Librito Jardín · Pastel a sangre",
  descripcion:
    "Librito 30×20 cm para jardín en tonos pastel: la foto individual ocupa toda la tapa y la grupal la parte de arriba de la contratapa. Adentro, el listado de la sala entre corazoncitos y la foto con la seño en un círculo. Tres fotos.",
  categoria: "Jardín",
  filtros: { estilo: "Moderno", orientacion: "vertical", etiquetas: ["foto a sangre", "maestra", "pastel"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>
       <rect x="0" y="1180" width="${PLIEGUE}" height="${ALTO - 1180}" fill="${MENTA}"/>
       ${puntos({ x: 120, y: 1260, w: PLIEGUE - 240, h: 120 }, 60, 8, "#ffffff", 0.8)}
       ${grano("g", 0.04)}`,
      defs(),
    ),

  fondoInterior: () => {
    const corazones = [[220, 220], [1550, 260], [260, 2120], [1500, 2150], [PLIEGUE + 230, 2150], [ANCHO - 230, 2120]]
      .map(([x, y], i) => `<path d="${corazon(x!, y!, 80)}" fill="${i % 2 ? LILA : ROSA}"/>`)
      .join("");
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${CREMA}"/>
       <rect x="0" y="0" width="${PLIEGUE}" height="${ALTO}" fill="#fdeef4"/>
       <rect x="160" y="420" width="${PLIEGUE - 320}" height="1640" rx="80" fill="#ffffff"/>
       <circle cx="${FOTO_MAE.x + FOTO_MAE.w / 2}" cy="${FOTO_MAE.y + FOTO_MAE.h / 2}" r="${FOTO_MAE.w / 2 + 45}" fill="${LILA}"/>
       ${corazones}
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  armar: (a) => {
    // Tapa: la individual a sangre y una etiqueta redonda
    a.foto(0, "individual", { x: PLIEGUE, y: 0, w: PLIEGUE, h: ALTO });
    a.forma(0, "etiqueta", "Etiqueta del nombre", centrado(CENTRO_DER, 1800, 1300, 400), { relleno: "#ffffff", radio: 200, opacidad: 0.92 });
    a.variable(0, "nombre", "Nombre del alumno", centrado(CENTRO_DER, 1850, 1200, 170), "student.firstName", "Nombre", {
      familia: "Pacifico", tam: 120, color: TINTA,
    });
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 2030, 1200, 120), "course.displayName", "Sala", {
      familia: "Quicksand", tam: 66, color: TINTA, peso: 700,
    });

    // Contratapa: la grupal arriba, a sangre
    a.foto(0, "grupal", { x: 0, y: 0, w: PLIEGUE, h: 1180 });
    a.texto(0, "titulo_grupal", "Título foto grupal", centrado(CENTRO_IZQ, 1450, 1400, 230), "Mi sala", {
      familia: "Pacifico", tam: 150, color: TINTA,
    });
    a.variable(0, "colegio", "Nombre del jardín", centrado(CENTRO_IZQ, 1720, 1400, 220), "school.name", "Nombre del jardín", {
      familia: "Quicksand", tam: 84, color: TINTA, peso: 700, interlineado: 1.1,
    });
    a.texto(0, "anio", "Año", centrado(CENTRO_IZQ, 1980, 1400, 140), "2026", { familia: "Quicksand", tam: 80, color: TINTA });

    // Interior izquierda: el listado
    a.texto(1, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 170, 1100, 200), "Mis compañeros", {
      familia: "Pacifico", tam: 120, color: TINTA,
    });
    a.listado(1, { x: 260, y: 520, w: PLIEGUE - 520, h: 1460 }, { familia: "Quicksand", tam: 62, color: TINTA, interlineado: 1.4 }, 2);

    // Interior derecha: la seño en un círculo
    a.foto(1, "maestra", FOTO_MAE, { mascara: "circle" });
    a.texto(1, "titulo_maestra", "Título foto con la maestra", centrado(CENTRO_DER, 1610, 1400, 220), "Mi seño", {
      familia: "Pacifico", tam: 140, color: TINTA,
    });
    a.texto(1, "frase", "Frase", centrado(CENTRO_DER, 1850, 1200, 200), "Gracias por tanto cariño", {
      familia: "Quicksand", tam: 72, color: TINTA, peso: 700,
    });
  },
};
