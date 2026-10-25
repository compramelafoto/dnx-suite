import { ALTO, ANCHO, CENTRO_DER, CENTRO_IZQ, PLIEGUE, agrandar, centrado, girarCon } from "../lienzo";
import { azar, estrella, filtroCrayon, filtroGrano, grano, svg } from "../texturas";
import type { Modelo } from "./tipo";

/**
 * Jardín · Crayones y amigos: sin listado. Garabatos de crayón sobre papel blanco; la tapa es la
 * foto individual en un círculo, la contratapa la foto con los amigos (polaroid inclinada) y
 * adentro la foto con la seño y la grupal.
 */

const TINTA = "#2b2b45";
const COLORES = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#9b5de5", "#f78c6b"];

const FOTO_IND = centrado(CENTRO_DER, 330, 1080, 1080);
const MARCO_AMI = centrado(CENTRO_IZQ, 470, 1320, 1240);
const FOTO_AMI = { x: MARCO_AMI.x + 55, y: MARCO_AMI.y + 55, w: MARCO_AMI.w - 110, h: 930 };
const EPI_AMI = { x: MARCO_AMI.x + 55, y: MARCO_AMI.y + 1010, w: MARCO_AMI.w - 110, h: 170 };
const GIRO_AMI = -4;
const FOTO_MAE = centrado(CENTRO_IZQ, 400, 1260, 1260);
const FOTO_GRU = centrado(CENTRO_DER, 470, 1480, 990);

/** Garabatos de crayón sueltos por el borde de la página. */
function garabatos(semilla: number) {
  const a = azar(semilla);
  let out = "";
  const lugares = [
    [140, 140], [1600, 160], [180, 2200], [1500, 2230], [PLIEGUE + 200, 150], [ANCHO - 170, 300], [PLIEGUE + 220, 2220], [ANCHO - 200, 2180],
  ] as const;
  for (const [x, y] of lugares) {
    const c = a.elegir(COLORES);
    if (a.r() < 0.5) {
      out += `<polygon points="${estrella(x, y, 70)}" fill="none" stroke="${c}" stroke-width="16" stroke-linejoin="round"/>`;
    } else {
      let d = `M ${x - 90} ${y}`;
      for (let i = 0; i < 6; i++) d += ` q 15 ${i % 2 ? 50 : -50} 30 0`;
      out += `<path d="${d}" stroke="${c}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
    }
  }
  return `<g filter="url(#crayon)">${out}</g>`;
}

/** Un marco de crayón a mano alrededor de un rectángulo. */
function marcoCrayon(r: { x: number; y: number; w: number; h: number }, color: string, circulo = false) {
  const d = agrandar(r, 40);
  return circulo
    ? `<g filter="url(#crayon)"><circle cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" r="${r.w / 2 + 40}" fill="none" stroke="${color}" stroke-width="34"/><circle cx="${r.x + r.w / 2 + 8}" cy="${r.y + r.h / 2 - 6}" r="${r.w / 2 + 70}" fill="none" stroke="${COLORES[1]}" stroke-width="18"/></g>`
    : `<g filter="url(#crayon)"><rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="30" fill="none" stroke="${color}" stroke-width="30"/></g>`;
}

const defs = () => filtroGrano("g", 0.85) + filtroCrayon("crayon", 7, 16);

export const jardinCrayonesAmigos: Modelo = {
  slug: "jardin-crayones-amigos",
  serie: "variadas",
  nombre: "Librito Jardín · Crayones y amigos",
  descripcion:
    "Librito 30×20 cm para jardín, sin listado: garabatos de crayón sobre papel blanco. La tapa es la foto individual en un círculo, la contratapa la foto con los amigos; adentro, la foto con la seño y la grupal. Cuatro fotos.",
  categoria: "Jardín",
  filtros: { estilo: "Divertido", orientacion: "vertical", etiquetas: ["amigos", "maestra", "sin listado", "crayones"] },

  fondoExterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fffdf8"/>
       ${garabatos(11)}
       ${marcoCrayon(FOTO_IND, COLORES[0], true)}
       <g transform="rotate(${GIRO_AMI} ${MARCO_AMI.x + MARCO_AMI.w / 2} ${MARCO_AMI.y + MARCO_AMI.h / 2})">
         <rect x="${MARCO_AMI.x + 18}" y="${MARCO_AMI.y + 24}" width="${MARCO_AMI.w}" height="${MARCO_AMI.h}" fill="#000000" opacity="0.08"/>
       </g>
       ${grano("g", 0.05)}`,
      defs(),
    ),

  fondoInterior: () =>
    svg(
      `<rect width="${ANCHO}" height="${ALTO}" fill="#fffdf8"/>
       ${garabatos(23)}
       ${marcoCrayon(FOTO_MAE, COLORES[2])}
       ${marcoCrayon(FOTO_GRU, COLORES[3])}
       ${grano("g", 0.05)}`,
      defs(),
    ),

  armar: (a) => {
    // Contratapa: los amigos, en una polaroid inclinada
    a.texto(0, "titulo_amigos", "Título foto con amigos", centrado(CENTRO_IZQ, 170, 1400, 230), "Mis amigos", {
      familia: "Gloria Hallelujah", tam: 140, color: COLORES[0],
    });
    a.forma(0, "marco_amigos", "Marco foto con amigos", MARCO_AMI, { relleno: "#ffffff", borde: "#e6e2da", grosor: 4, giro: GIRO_AMI });
    a.foto(0, "amigos", girarCon(FOTO_AMI, MARCO_AMI, GIRO_AMI), { giro: GIRO_AMI });
    a.texto(0, "epigrafe_amigos", "Epígrafe foto con amigos", girarCon(EPI_AMI, MARCO_AMI, GIRO_AMI), "¡Amigos para siempre!", {
      familia: "Patrick Hand", tam: 84, color: TINTA,
    }, GIRO_AMI);
    a.texto(0, "frase_amigos", "Frase", centrado(CENTRO_IZQ, 1840, 1400, 260), "Jugar con ustedes fue lo mejor del año", {
      familia: "Patrick Hand", tam: 80, color: TINTA, interlineado: 1.25,
    });

    // Tapa: la foto individual en un círculo
    a.foto(0, "individual", FOTO_IND, { mascara: "circle" });
    a.variable(0, "nombre", "Nombre del alumno", centrado(CENTRO_DER, 1530, 1500, 230), "student.firstName", "Nombre", {
      familia: "Gloria Hallelujah", tam: 150, color: COLORES[3],
    });
    a.variable(0, "colegio", "Nombre del jardín", centrado(CENTRO_DER, 1790, 1500, 200), "school.name", "Nombre del jardín", {
      familia: "Patrick Hand", tam: 88, color: TINTA, interlineado: 1.1,
    });
    a.variable(0, "curso", "Sala", centrado(CENTRO_DER, 2010, 1500, 130), "course.displayName", "Sala", {
      familia: "Patrick Hand", tam: 72, color: TINTA,
    });

    // Interior izquierda: la seño
    a.texto(1, "titulo_maestra", "Título foto con la maestra", centrado(CENTRO_IZQ, 140, 1400, 210), "Mi seño", {
      familia: "Gloria Hallelujah", tam: 130, color: COLORES[2],
    });
    a.foto(1, "maestra", FOTO_MAE, { radio: 30 });
    a.texto(1, "frase_maestra", "Frase", centrado(CENTRO_IZQ, 1760, 1450, 300), "Gracias por tanta paciencia y tantos abrazos", {
      familia: "Patrick Hand", tam: 84, color: TINTA, interlineado: 1.25,
    });

    // Interior derecha: la grupal
    a.texto(1, "titulo_grupal", "Título foto grupal", centrado(CENTRO_DER, 140, 1400, 210), "Mi sala", {
      familia: "Gloria Hallelujah", tam: 130, color: COLORES[3],
    });
    a.foto(1, "grupal", FOTO_GRU, { radio: 30 });
    a.variable(1, "curso_colegio", "Sala y jardín", centrado(CENTRO_DER, 1580, 1500, 240), "course.withSchool", "Sala - Jardín", {
      familia: "Patrick Hand", tam: 84, color: TINTA, interlineado: 1.2,
    });
    a.texto(1, "anio", "Año", centrado(CENTRO_DER, 1880, 1400, 200), "2026", { familia: "Gloria Hallelujah", tam: 120, color: COLORES[0] });
  },
};
