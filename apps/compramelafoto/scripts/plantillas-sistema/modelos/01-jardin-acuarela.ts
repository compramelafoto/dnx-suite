import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado } from "../lienzo";
import { azar, confeti, corazon, estrella, filtroAcuarela, filtroCrayon, filtroGrano, grano, onda, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Jardín · Acuarelas y crayones: manchas de colores, letras redondeadas. */

const ROSA = "#ef5d82";
const AZUL = "#3a86ff";
const VIOLETA = "#8e6cd1";
const GRIS = "#4a4a58";
const COLORES = ["#ff8fab", "#ffd166", "#72c9f2", "#8fe3b0", "#c3a6ff", "#ffb077"];

const FOTO_IND = centrado(CENTRO_IZQ, 250, 1150, 1480);
const FOTO_GRU = centrado(CENTRO_DER, 560, 1440, 960);
const TARJETA = { x: 170, y: 210, w: PLIEGUE - 340, h: ALTO - 420 };

function manchas(semilla: number, zonas: Array<{ x: number; y: number }>, radio: [number, number]) {
  const a = azar(semilla);
  let defs = "";
  let out = "";
  zonas.forEach((z, i) => {
    const id = `ac${semilla}_${i}`;
    defs += filtroAcuarela(id, semilla + i * 3);
    const r = a.entre(radio[0], radio[1]);
    const c = COLORES[i % COLORES.length];
    out += `<g filter="url(#${id})" fill="${c}" fill-opacity="0.55" stroke="${c}" stroke-width="12" stroke-opacity="0.7"><circle cx="${z.x}" cy="${z.y}" r="${r}"/><circle cx="${z.x + r * a.entre(-0.7, 0.7)}" cy="${z.y + r * a.entre(-0.6, 0.6)}" r="${r * a.entre(0.5, 0.8)}"/><circle cx="${z.x + r * a.entre(-0.7, 0.7)}" cy="${z.y + r * a.entre(-0.6, 0.6)}" r="${r * a.entre(0.4, 0.7)}"/></g>`;
  });
  return { defs, out };
}

function crayones(y0: number, x0: number, x1: number, semilla: number) {
  let out = "";
  COLORES.forEach((c, i) => {
    out += `<path d="${onda(x0, x1, y0 + i * 34, 22, 260 + i * 10)}" stroke="${c}" stroke-width="26" fill="none" stroke-linecap="round" filter="url(#cray${semilla})"/>`;
  });
  return out;
}

export const jardinAcuarela: Modelo = {
  slug: "jardin-acuarela",
  nombre: "Librito Jardín · Acuarelas",
  descripcion:
    "Librito 30×20 cm (2 páginas) para jardín de infantes: manchas de acuarela y crayones de colores, letras redondeadas. Foto individual y grupal en el interior; listado del curso en la contratapa.",
  categoria: "Jardín",

  fondoExterior: () => {
    const m = manchas(11, [
      { x: 120, y: 140 }, { x: 1650, y: 120 }, { x: 140, y: 2250 }, { x: 1560, y: 2280 },
      { x: 1990, y: 150 }, { x: 3420, y: 160 }, { x: 3480, y: 1150 }, { x: 1930, y: 1900 },
    ], [190, 300]);
    const a = azar(5);
    let estrellas = "";
    for (let i = 0; i < 14; i++) {
      const x = a.entre(1900, 3420);
      const y = a.entre(80, 2250);
      if (x > 2120 && x < 3200 && y > 300 && y < 2050) continue;
      estrellas += `<polygon points="${estrella(x, y, a.entre(26, 48))}" fill="${a.elegir(COLORES)}"/>`;
    }
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fffaf2"/>
       ${m.out}
       ${crayones(2110, 1820, 3560, 1)}
       ${estrellas}
       <path d="${corazon(2657, 1140, 120)}" fill="#ff8fab" opacity="0.9"/>
       ${grano("g", 0.08)}`,
      `${m.defs}${filtroCrayon("cray1", 4)}${filtroGrano("g", 0.85)}`,
    );
  },

  fondoInterior: () => {
    const m = manchas(23, [
      { x: 90, y: 110 }, { x: 1700, y: 2280 }, { x: 40, y: 1150 },
      { x: 1880, y: 120 }, { x: 3470, y: 120 }, { x: 3470, y: 2250 }, { x: 1880, y: 2260 },
    ], [200, 320]);
    const evitar = [agrandar(FOTO_IND, 80), agrandar(FOTO_GRU, 80), { x: 1950, y: 200, w: 1420, h: 320 }, { x: 1950, y: 1500, w: 1420, h: 650 }, { x: 200, y: 1750, w: 1400, h: 400 }];
    return svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fffaf2"/>
       ${m.out}
       ${confeti({ x: 60, y: 60, w: ANCHO - 120, h: ALTO - 120 }, 70, COLORES, 9, [18, 40], evitar)}
       ${grano("g", 0.08)}`,
      `${m.defs}${filtroGrano("g", 0.85)}`,
    );
  },

  armar: (a) => {
    // Contratapa
    a.forma(0, "tarjeta", "Tarjeta del listado", TARJETA, { relleno: "#ffffff", radio: 80, opacidad: 0.88 });
    a.texto(0, "titulo_listado", "Título del listado", centrado(CENTRO_IZQ, 300, 1300, 200), "Mis compañeritos", {
      familia: "Pacifico", tam: 125, color: VIOLETA,
    });
    a.listado(0, { x: 250, y: 580, w: PLIEGUE - 500, h: 1460 }, { familia: "Quicksand", tam: 76, color: GRIS, peso: 400, interlineado: 1.35 });

    // Tapa
    a.texto(0, "frase", "Frase de tapa", centrado(CENTRO_DER, 360, 1250, 460), "Mis días\nen el jardín", {
      familia: "Pacifico", tam: 175, color: ROSA, interlineado: 1.25,
    });
    a.forma(0, "circulo_anio", "Círculo del año", centrado(CENTRO_DER, 900, 460, 460), { relleno: "#ffd166", circulo: true });
    a.texto(0, "anio", "Año", centrado(CENTRO_DER, 1040, 460, 190), "2026", { familia: "Quicksand", tam: 150, color: "#ffffff", peso: 700 });
    a.variable(0, "colegio", "Nombre del jardín", centrado(CENTRO_DER, 1480, 1300, 290), "school.name", "Nombre del jardín", {
      familia: "Quicksand", tam: 110, color: AZUL, peso: 700, interlineado: 1.15,
    });
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 1800, 1300, 140), "course.displayName", "Sala", {
      familia: "Quicksand", tam: 90, color: GRIS, peso: 700,
    });

    // Interior izquierda: foto individual con marco blanco
    a.forma(1, "marco_individual", "Marco foto individual", agrandar(FOTO_IND, 34), { relleno: "#ffffff", radio: 110 });
    a.foto(1, "individual", FOTO_IND, { radio: 80 });
    a.variable(1, "alumno", "Nombre del alumno", centrado(CENTRO_IZQ, 1820, 1450, 280), "student.fullName", "Nombre del alumno", {
      familia: "Pacifico", tam: 150, color: ROSA,
    });

    // Interior derecha: foto grupal
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 270, 1300, 220), "Mi salita", {
      familia: "Pacifico", tam: 150, color: AZUL,
    });
    a.forma(1, "marco_grupal", "Marco foto grupal", agrandar(FOTO_GRU, 30), { relleno: "#ffffff", radio: 90 });
    a.foto(1, "grupal", FOTO_GRU, { radio: 60 });
    a.variable(1, "curso_colegio", "Sala y jardín", centrado(CENTRO_DER, 1610, 1440, 230), "course.withSchool", "Sala - Jardín", {
      familia: "Quicksand", tam: 82, color: VIOLETA, peso: 700, interlineado: 1.2,
    });
    a.texto(1, "frase_interior", "Frase interior", centrado(CENTRO_DER, 1880, 1300, 200), "Jugamos, aprendimos y crecimos juntos", {
      familia: "Quicksand", tam: 66, color: GRIS, peso: 400,
    });
  },
};
