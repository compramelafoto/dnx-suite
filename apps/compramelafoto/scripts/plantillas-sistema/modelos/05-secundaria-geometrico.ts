import { ALTO, ANCHO, CENTRO_IZQ, PLIEGUE, type Rect } from "../lienzo";
import { puntos, svg } from "../texturas";
import type { Modelo } from "./tipo";

/** Secundaria · Geométrico dúo-tono: azul noche y coral, formas planas y tipografía condensada. */

const NOCHE = "#14213d";
const CORAL = "#ff4d6d";
const HUESO = "#f4f1ea";
const DORADO = "#ffb703";

const IZQ = PLIEGUE + 200;
const FOTO_IND: Rect = { x: 280, y: 250, w: 1080, h: 1400 };
const FOTO_GRU: Rect = { x: PLIEGUE + 170, y: 500, w: 1400, h: 930 };
const SOMBRA = 50;

const desplazado = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w, h: r.h });

export const secundariaGeometrico: Modelo = {
  slug: "secundaria-geometrico",
  nombre: "Librito Secundaria · Geométrico dúo-tono",
  descripcion:
    "Librito 30×20 cm (2 páginas) para secundaria: diseño moderno en azul noche y coral, formas geométricas y letras condensadas. Fotos individual y grupal en el interior; listado del curso en la contratapa.",
  categoria: "Secundaria",

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${HUESO}"/>
       <rect x="${PLIEGUE}" width="${PLIEGUE}" height="${ALTO}" fill="${NOCHE}"/>
       <circle cx="${ANCHO - 120}" cy="${ALTO - 180}" r="560" fill="${CORAL}"/>
       <circle cx="${ANCHO - 120}" cy="${ALTO - 180}" r="380" fill="none" stroke="${NOCHE}" stroke-width="26"/>
       <polygon points="${PLIEGUE},${ALTO} ${PLIEGUE + 620},${ALTO} ${PLIEGUE},${ALTO - 620}" fill="${DORADO}"/>
       ${puntos({ x: ANCHO - 600, y: 140, w: 440, h: 330 }, 55, 9, HUESO, 0.5)}
       <rect x="${IZQ}" y="230" width="220" height="22" fill="${CORAL}"/>
       <polygon points="0,0 520,0 0,520" fill="${NOCHE}"/>
       <polygon points="0,0 300,0 0,300" fill="${CORAL}"/>
       <rect x="${PLIEGUE - 420}" y="${ALTO - 120}" width="300" height="22" fill="${CORAL}"/>
       ${puntos({ x: 1350, y: 150, w: 280, h: 220 }, 55, 9, NOCHE, 0.25)}`,
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="${HUESO}"/>
       <rect x="${PLIEGUE}" width="${PLIEGUE}" height="${ALTO}" fill="${NOCHE}"/>
       <polygon points="${PLIEGUE},0 ${PLIEGUE - 520},0 ${PLIEGUE},520" fill="${CORAL}" opacity="0.15"/>
       ${puntos({ x: 1430, y: 1300, w: 220, h: 400 }, 55, 9, NOCHE, 0.3)}
       <circle cx="${ANCHO + 60}" cy="-60" r="420" fill="${CORAL}"/>
       <polygon points="${ANCHO},${ALTO} ${ANCHO - 520},${ALTO} ${ANCHO},${ALTO - 520}" fill="${DORADO}"/>
       ${puntos({ x: PLIEGUE + 200, y: 2010, w: 600, h: 180 }, 55, 9, HUESO, 0.35)}`,
    ),

  armar: (a) => {
    // Contratapa
    a.texto(0, "titulo_listado", "Título del listado", { x: 280, y: 560, w: 1300, h: 200 }, "Nuestro curso", {
      familia: "Bebas Neue", tam: 190, color: NOCHE, alinear: "LEFT",
    });
    a.forma(0, "raya_listado", "Raya", { x: 285, y: 780, w: 180, h: 18 }, { relleno: CORAL });
    a.listado(0, { x: 280, y: 870, w: PLIEGUE - 520, h: 1300 }, { familia: "Montserrat", tam: 58, color: NOCHE, alinear: "LEFT", interlineado: 1.4 });

    // Tapa
    a.texto(0, "etiqueta", "Etiqueta", { x: IZQ, y: 290, w: 1300, h: 110 }, "Recuerdo escolar", {
      familia: "Montserrat", tam: 70, color: CORAL, peso: 700, alinear: "LEFT", mayus: "uppercase",
    });
    a.texto(0, "anio", "Año", { x: IZQ - 10, y: 380, w: 1300, h: 560 }, "2026", { familia: "Bebas Neue", tam: 600, color: HUESO, alinear: "LEFT", interlineado: 1 });
    a.variable(0, "colegio", "Nombre del colegio", { x: IZQ, y: 1030, w: 1250, h: 300 }, "school.name", "Nombre del colegio", {
      familia: "Montserrat", tam: 92, color: HUESO, peso: 700, alinear: "LEFT", mayus: "uppercase", interlineado: 1.12,
    });
    a.variable(0, "curso", "Curso", { x: IZQ, y: 1360, w: 1000, h: 130 }, "course.displayName", "Curso", {
      familia: "Montserrat", tam: 80, color: CORAL, alinear: "LEFT",
    });

    // Interior izquierda
    a.forma(1, "sombra_individual", "Sombra foto individual", desplazado(FOTO_IND, SOMBRA), { relleno: CORAL });
    a.foto(1, "individual", FOTO_IND);
    a.variable(1, "alumno", "Nombre del alumno", { x: 280, y: 1760, w: 1350, h: 330 }, "student.fullName", "Nombre del alumno", {
      familia: "Bebas Neue", tam: 190, color: NOCHE, alinear: "LEFT", interlineado: 0.95,
    });
    a.variable(1, "curso", "Curso", { x: 285, y: 2110, w: 1300, h: 100 }, "course.displayName", "Curso", {
      familia: "Montserrat", tam: 64, color: CORAL, peso: 700, alinear: "LEFT", mayus: "uppercase",
    });

    // Interior derecha
    a.texto(1, "titulo_grupal", "Título foto grupal", { x: FOTO_GRU.x, y: 230, w: 1300, h: 200 }, "Juntos", {
      familia: "Bebas Neue", tam: 210, color: HUESO, alinear: "LEFT",
    });
    a.forma(1, "sombra_grupal", "Sombra foto grupal", desplazado(FOTO_GRU, SOMBRA), { relleno: CORAL });
    a.foto(1, "grupal", FOTO_GRU);
    a.variable(1, "curso_colegio", "Curso y colegio", { x: FOTO_GRU.x, y: 1560, w: 1400, h: 220 }, "course.withSchool", "Curso - Colegio", {
      familia: "Montserrat", tam: 70, color: HUESO, peso: 700, alinear: "LEFT", interlineado: 1.2,
    });
    a.texto(1, "frase_interior", "Frase interior", { x: FOTO_GRU.x, y: 1800, w: 1300, h: 160 }, "Lo mejor de este año fueron ustedes.", {
      familia: "Montserrat", tam: 62, color: CORAL, alinear: "LEFT", italica: true,
    });
  },
};

void CENTRO_IZQ;
