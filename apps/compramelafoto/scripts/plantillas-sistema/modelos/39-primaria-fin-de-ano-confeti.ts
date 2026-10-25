import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { confeti, estrella, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Primaria · Fin de año con confeti: azul noche con confeti dorado y de colores. La tapa festeja
 * «¡Terminamos!» con la foto grupal; adentro, la individual («¡Lo logré!») y la foto con la seño.
 * Listado de «los campeones» en la contratapa.
 */

const NOCHE = "#1b2550";
const ORO = "#f6c945";
const BLANCO = "#ffffff";
const COLORES = ["#f6c945", "#ff6b8b", "#4dd4ac", "#5fa8ff", "#ffffff"];

const FOTO_GRU = centrado(CENTRO_DER, 560, 1460, 980);
const FOTO_IND = centrado(CENTRO_IZQ, 220, 1100, 1420);
const FOTO_MAE = centrado(CENTRO_DER, 260, 1460, 1080);

const defs = () => filtroGrano("g", 0.85);

export const primariaFinDeAnoConfeti: Modelo = {
  slug: "primaria-fin-de-ano-confeti",
  serie: "variadas",
  nombre: "Librito Primaria · Fin de año con confeti",
  descripcion:
    "Librito 30×20 cm de fin de año para primaria: azul noche con confeti dorado y de colores. La tapa festeja «¡Terminamos!» con la foto grupal; adentro, la foto individual y la foto con la seño. Listado del grado en la contratapa.",
  categoria: "Primaria",
  filtros: { estilo: "Divertido", orientacion: "vertical", evento: "Fin de año", etiquetas: ["confeti", "fiesta", "maestra"] },

  fondoExterior: () => {
    const m = agrandar(FOTO_GRU, 26);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${NOCHE}"/>
       ${confeti({ x: 60, y: 60, w: ANCHO - 120, h: ALTO - 120 }, 420, COLORES, 17, [16, 38], [
         { x: 150, y: 90, w: PLIEGUE - 300, h: 2100 },
         { x: m.x - 20, y: 150, w: m.w + 40, h: 2050 },
       ])}
       <rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="${BLANCO}"/>
       <polygon points="${estrella(PLIEGUE + 220, 250, 70)}" fill="${ORO}"/>
       <polygon points="${estrella(ANCHO - 220, 250, 70)}" fill="${ORO}"/>
       ${grano("g", 0.05, "screen")}`,
      defs(),
    );
  },

  fondoInterior: () => {
    const mi = agrandar(FOTO_IND, 26);
    const mm = agrandar(FOTO_MAE, 26);
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fffaf0"/>
       ${confeti({ x: 60, y: 60, w: ANCHO - 120, h: ALTO - 120 }, 260, COLORES.slice(0, 4), 29, [14, 32], [
         { x: mi.x - 30, y: mi.y - 30, w: mi.w + 60, h: 2100 },
         { x: mm.x - 30, y: mm.y - 30, w: mm.w + 60, h: 2100 },
       ])}
       <rect x="${mi.x}" y="${mi.y}" width="${mi.w}" height="${mi.h}" fill="${NOCHE}"/>
       <rect x="${mm.x}" y="${mm.y}" width="${mm.w}" height="${mm.h}" fill="${NOCHE}"/>
       ${grano("g", 0.04)}`,
      defs(),
    );
  },

  armar: (a) => {
    // Tapa
    a.texto(0, "titulo", "Título", centrado(CENTRO_DER, 200, 1300, 260), "¡Terminamos!", { familia: "Pacifico", tam: 170, color: ORO });
    a.foto(0, "grupal", FOTO_GRU);
    a.variable(0, "curso", "Grado", centrado(CENTRO_DER, 1640, 1500, 150), "course.displayName", "Grado", {
      familia: "Nunito", tam: 100, color: BLANCO, peso: 700,
    });
    a.variable(0, "colegio", "Nombre de la escuela", centrado(CENTRO_DER, 1800, 1500, 200), "school.name", "Nombre de la escuela", {
      familia: "Nunito", tam: 70, color: BLANCO, interlineado: 1.15,
    });
    a.texto(0, "evento", "Evento", centrado(CENTRO_DER, 2030, 1500, 120), "FIN DE AÑO 2026", { familia: "Nunito", tam: 66, color: ORO, peso: 700 });

    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 160, 1450, 230), "Los campeones", {
      familia: "Pacifico", tam: 140, color: ORO,
    });
    a.listado(0, { x: 240, y: 480, w: PLIEGUE - 480, h: 1600 }, { familia: "Nunito", tam: 64, color: BLANCO, interlineado: 1.4 }, 2);

    // Interior izquierda: la individual
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1720, 1450, 200), "student.fullName", "Nombre del alumno", {
      familia: "Pacifico", tam: 110, color: NOCHE,
    });
    a.texto(1, "logro", "Frase", centrado(CENTRO_IZQ, 1950, 1400, 150), "¡Lo logré!", { familia: "Nunito", tam: 84, color: "#e0485f", peso: 700 });

    // Interior derecha: la seño
    a.foto(1, "maestra", FOTO_MAE);
    a.texto(1, "titulo_maestra", "Título foto con la maestra", centrado(CENTRO_DER, 1440, 1450, 220), "¡Gracias, seño!", {
      familia: "Pacifico", tam: 130, color: NOCHE,
    });
    a.texto(1, "frase_maestra", "Frase", centrado(CENTRO_DER, 1680, 1350, 220), "Por un año inolvidable", {
      familia: "Nunito", tam: 80, color: NOCHE, peso: 700,
    });
  },
};
