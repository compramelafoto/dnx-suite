/**
 * Más productos escolares sobre los mismos temas: anuarios del curso (6 hojas), señaladores,
 * portarretratos «recuerdo escolar», tarjetas del Día de la Madre y del Padre y pósters del curso.
 */
import type { Estilo, Rect } from "../lienzo";
import { FORMATOS, Hoja } from "./hoja";
import { TEMAS, escala, fondoCon, type ClaveDeTema, type Tema } from "./temas";
import type { EstiloDeCatalogo, ModeloProducto } from "./tipo";

const tam = (e: Estilo, k: number, por = 1): Estilo => ({ ...e, tam: Math.round(e.tam * k * por) });
const nombres = (t: Tema, k: number, base = 40): Estilo => ({ familia: t.fuentes.cuerpo.familia, tam: Math.round(base * k), color: t.tinta, peso: 600, interlineado: 1.05 });

type Comun = {
  slug: string;
  nombre: string;
  tema: ClaveDeTema;
  categoria: "Jardín" | "Primaria" | "Secundaria" | "Egresados" | "Formal" | "Informal";
  estilo: EstiloDeCatalogo;
  evento?: string;
  etiquetas: string[];
};

/* ----------------------------------------------- Anuario ---------------------------------------------- */

function anuario(p: Comun & { anio: string; titulos: [string, string, string, string] }): ModeloProducto {
  const t = TEMAS[p.tema];
  const geo = (h: Hoja) => {
    const k = escala(h);
    const m = h.mm(t.margenMm) + 40 * k;
    const ancho = h.w - 2 * m;
    return {
      k,
      m,
      ancho,
      tapaFoto: h.centrado(m + 1000 * k, ancho, ancho * 0.66),
      grupal: h.centrado(m + 300 * k, ancho, ancho * 0.62),
      individual: h.centrado(m + 300 * k, ancho * 0.72, ancho * 0.88),
      maestra: h.centrado(m + 300 * k, ancho, ancho * 0.6),
      amigos: h.centrado(h.h / 2 + 200 * k, ancho, ancho * 0.6),
      libre: h.centrado(m + 300 * k, ancho, ancho * 0.75),
    };
  };
  const titulo = (h: Hoja, a: Parameters<ModeloProducto["armar"]>[0], pagina: number, texto: string) => {
    const g = geo(h);
    a.texto(pagina, "titulo", "Título de la hoja", h.centrado(g.m + 30 * g.k, g.ancho, 220 * g.k), texto, tam(t.fuentes.titulo, g.k, 0.8));
  };
  return {
    tipo: "Anuario",
    serie: "otros",
    slug: p.slug,
    nombre: p.nombre,
    descripcion: `Anuario del curso, ${FORMATOS.a4Vertical.nombre}, de 6 hojas: tapa con el logo y la foto grupal; el curso con su listado; las caras de todos los compañeros (mosaico); la hoja del alumno con su foto; la maestra y los amigos; y una foto libre en la contratapa. Tema: ${p.etiquetas[0]}.`,
    categoria: p.categoria,
    estilo: p.estilo,
    evento: "Fin de año",
    etiquetas: ["anuario", "curso", ...p.etiquetas],
    formato: FORMATOS.a4Vertical,
    hojas: [
      { nombre: "Tapa", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).tapaFoto, "rect", h)) },
      { nombre: "Nuestro curso", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).grupal, "rect", h)) },
      { nombre: "Nuestras caras", fondo: (h) => fondoCon(t, h) },
      { nombre: "Mi página", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).individual, "rect", h)) },
      { nombre: "La seño y los amigos", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).maestra, "rect", h) + t.marcoFoto(geo(h).amigos, "rect", h)) },
      { nombre: "Contratapa", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).libre, "rect", h)) },
    ],
    armar: (a, h) => {
      const g = geo(h);
      const k = g.k;
      // Tapa
      a.logo(0, "logo", h.centrado(g.m + 20 * k, 420 * k, 260 * k));
      a.texto(0, "titulo", "Título", h.centrado(g.m + 320 * k, g.ancho, 300 * k), "Anuario", tam(t.fuentes.titulo, k, 1.3));
      a.texto(0, "anio", "Año", h.centrado(g.m + 640 * k, g.ancho, 200 * k), p.anio, { ...tam(t.fuentes.nombre, k, 0.9), color: t.acento });
      a.foto(0, "grupal", g.tapaFoto, { clave: "tapa" });
      a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(g.tapaFoto.y + g.tapaFoto.h + 80 * k, g.ancho, 220 * k), "course.withSchool", "Curso - Colegio", { ...tam(t.fuentes.nombre, k, 0.6), interlineado: 1.15 });
      // Nuestro curso
      titulo(h, a, 1, p.titulos[0]);
      a.foto(1, "grupal", g.grupal);
      a.listado(1, { x: g.m, y: g.grupal.y + g.grupal.h + 100 * k, w: g.ancho, h: h.h - g.m - (g.grupal.y + g.grupal.h + 100 * k) }, nombres(t, k, 44), 3);
      // Nuestras caras
      titulo(h, a, 2, p.titulos[1]);
      a.mosaico(2, "mosaico", { x: g.m, y: g.m + 300 * k, w: g.ancho, h: h.h - 2 * g.m - 300 * k }, nombres(t, k, 34), {
        frame: t.fotoRedonda ? "circle" : "rounded",
        cornerRadius: 30,
        photoAspect: t.fotoRedonda ? 1 : 0.8,
        namePosition: "below",
        nameLines: 2,
        givenNames: "first",
        borderWidth: 6,
        borderColor: t.acento,
      });
      // Mi página
      titulo(h, a, 3, p.titulos[2]);
      a.foto(3, "individual", g.individual);
      a.variable(3, "alumno", "Nombre del alumno", h.centrado(g.individual.y + g.individual.h + 90 * k, g.ancho, 260 * k), "student.fullName", "Nombre del alumno", tam(t.fuentes.nombre, k));
      a.texto(3, "recuerdo", "Recuerdo", h.centrado(g.individual.y + g.individual.h + 380 * k, g.ancho, 260 * k), "Lo que más me gustó de este año fue…", { ...tam(t.fuentes.cuerpo, k, 1.1), interlineado: 1.3 });
      // La seño y los amigos
      titulo(h, a, 4, p.titulos[3]);
      a.foto(4, "maestra", g.maestra);
      a.foto(4, "amigos", g.amigos);
      a.texto(4, "amigos_titulo", "Título amigos", h.centrado(g.amigos.y - 200 * k, g.ancho, 160 * k), "Mis amigos", tam(t.fuentes.titulo, k, 0.6));
      // Contratapa
      a.foto(5, "libre", g.libre);
      a.texto(5, "cierre", "Frase de cierre", h.centrado(g.libre.y + g.libre.h + 120 * k, g.ancho, 300 * k), "¡Gracias por este año juntos!", tam(t.fuentes.titulo, k, 0.75));
      a.variable(5, "colegio", "Colegio", h.centrado(h.h - g.m - 140 * k, g.ancho, 110 * k), "school.name", "Colegio", tam(t.fuentes.chico, k, 1.2));
    },
  };
}

/* ---------------------------------------------- Señalador --------------------------------------------- */

function senalador(p: Comun & { frase: string }): ModeloProducto {
  const t = TEMAS[p.tema];
  const geo = (h: Hoja) => {
    const k = escala(h);
    const m = h.mm(4);
    const foto: Rect = { x: m + 20 * k, y: m + 40 * k, w: h.w - 2 * m - 40 * k, h: (h.w - 2 * m - 40 * k) * 1.2 };
    return { k, m, foto };
  };
  return {
    tipo: "Señalador",
    serie: "otros",
    slug: p.slug,
    nombre: p.nombre,
    descripcion: `Señalador de libro de 5 × 18 cm con la foto individual arriba, el nombre del alumno, el curso y la frase «${p.frase}». Tema: ${p.etiquetas[0]}.`,
    categoria: p.categoria,
    estilo: p.estilo,
    ...(p.evento ? { evento: p.evento } : {}),
    etiquetas: ["señalador", "lectura", "regalo", ...p.etiquetas],
    formato: FORMATOS.senalador,
    hojas: [{ nombre: "Señalador", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).foto, "rect", h)) }],
    armar: (a, h) => {
      const { k, m, foto } = geo(h);
      // Los textos, a 6 mm de cada costado (el corte pide 5).
      const ancho = h.w - 2 * h.mm(6);
      a.foto(0, "individual", foto);
      // En un señalador la escala de la hoja es chica: las letras se calculan sobre el ancho.
      const e = h.w / 600;
      a.variable(0, "alumno", "Nombre del alumno", h.centrado(foto.y + foto.h + 50 * e, ancho, 200 * e), "student.fullName", "Nombre del alumno", { ...tam(t.fuentes.nombre, e, 0.55), interlineado: 1.05 });
      a.texto(0, "frase", "Frase", h.centrado(foto.y + foto.h + 300 * e, ancho, 520 * e), p.frase, { ...tam(t.fuentes.titulo, e, 0.38), interlineado: 1.15 });
      a.variable(0, "curso", "Curso", h.centrado(h.h - m - 180 * e, ancho, 150 * e), "course.withSchool", "Curso - Colegio", { ...tam(t.fuentes.chico, e, 0.8), interlineado: 1.15 });
    },
  };
}

/* -------------------------------------------- Portarretrato ------------------------------------------- */

function portarretrato(p: Comun & { anio: string }): ModeloProducto {
  const t = TEMAS[p.tema];
  const geo = (h: Hoja) => {
    const k = escala(h);
    const m = h.mm(t.margenMm * 0.7);
    const foto: Rect = h.centrado(m + 340 * k, h.w - 2 * m - 220 * k, (h.w - 2 * m - 220 * k) * 1.22);
    return { k, m, foto };
  };
  return {
    tipo: "Portarretrato",
    serie: "otros",
    slug: p.slug,
    nombre: p.nombre,
    descripcion: `Recuerdo escolar de 15 × 21 cm para enmarcar: la foto individual grande, con el logo del colegio arriba y el nombre, el curso y el año abajo. Tema: ${p.etiquetas[0]}.`,
    categoria: p.categoria,
    estilo: p.estilo,
    evento: "Fin de año",
    etiquetas: ["portarretrato", "recuerdo escolar", "cuadro", ...p.etiquetas],
    formato: FORMATOS.foto15x21,
    hojas: [{ nombre: "Recuerdo", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).foto, "rect", h)) }],
    armar: (a, h) => {
      const { k, m, foto } = geo(h);
      a.logo(0, "logo", h.centrado(m + 40 * k, 360 * k, 230 * k));
      a.foto(0, "individual", foto);
      a.variable(0, "alumno", "Nombre del alumno", h.centrado(foto.y + foto.h + 70 * k, h.w - 2 * m, 230 * k), "student.fullName", "Nombre del alumno", tam(t.fuentes.nombre, k, 0.9));
      a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(foto.y + foto.h + 310 * k, h.w - 2 * m, 120 * k), "course.withSchool", "Curso - Colegio", tam(t.fuentes.chico, k, 1.3));
      a.texto(0, "anio", "Año", h.centrado(foto.y + foto.h + 440 * k, h.w - 2 * m, 120 * k), p.anio, { ...tam(t.fuentes.chico, k, 1.6), color: t.acento, peso: 700 });
    },
  };
}

/* ----------------------------------------------- Tarjetas --------------------------------------------- */

function tarjeta(p: Comun & { saludo: string; mensaje: string }): ModeloProducto {
  const t = TEMAS[p.tema];
  const geo = (h: Hoja) => {
    const k = escala(h);
    const m = h.mm(6);
    const foto: Rect = t.fotoRedonda ? { x: m + 90 * k, y: h.cy - 380 * k, w: 760 * k, h: 760 * k } : { x: m + 90 * k, y: h.cy - 440 * k, w: 700 * k, h: 880 * k };
    return { k, m, foto, x0: foto.x + foto.w + 110 * k, x1: h.w - m - 90 * k };
  };
  return {
    tipo: "Tarjeta",
    serie: "otros",
    slug: p.slug,
    nombre: p.nombre,
    descripcion: `Tarjeta de 15 × 10 cm con la foto individual, el saludo «${p.saludo}», un mensaje corto y el nombre del alumno. Tema: ${p.etiquetas[0]}.`,
    categoria: p.categoria,
    estilo: p.estilo,
    ...(p.evento ? { evento: p.evento } : {}),
    etiquetas: ["tarjeta", "regalo", ...p.etiquetas],
    formato: FORMATOS.tarjeta,
    hojas: [{ nombre: "Tarjeta", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).foto, t.fotoRedonda ? "circle" : "rect", h)) }],
    armar: (a, h) => {
      const { k, foto, x0, x1 } = geo(h);
      const cx = (x0 + x1) / 2;
      const ancho = x1 - x0;
      a.foto(0, "individual", foto, { mascara: t.fotoRedonda ? "circle" : "rect" });
      a.texto(0, "saludo", "Saludo", h.centrado(h.cy - 470 * k, ancho, 420 * k, cx), p.saludo, { ...tam(t.fuentes.titulo, k, 0.95), interlineado: 1.1 });
      a.texto(0, "mensaje", "Mensaje", h.centrado(h.cy + 0 * k, ancho, 220 * k, cx), p.mensaje, { ...tam(t.fuentes.cuerpo, k, 2.1), interlineado: 1.2 });
      a.variable(0, "alumno", "Nombre del alumno", h.centrado(h.cy + 250 * k, ancho, 200 * k, cx), "student.fullName", "Nombre del alumno", tam(t.fuentes.nombre, k, 0.85));
    },
  };
}

/* -------------------------------------------- Póster del curso ---------------------------------------- */

function poster(p: Comun & { titulo: string; anio: string }): ModeloProducto {
  const t = TEMAS[p.tema];
  const geo = (h: Hoja) => {
    const k = escala(h);
    const m = h.mm(t.margenMm) + 30 * k;
    const ancho = h.w - 2 * m;
    const grupal = h.centrado(m + 620 * k, ancho, ancho * 0.56);
    return { k, m, ancho, grupal };
  };
  return {
    tipo: "Póster del curso",
    serie: "otros",
    slug: p.slug,
    nombre: p.nombre,
    descripcion: `Póster del curso ${FORMATOS.a3Vertical.nombre}: el logo, el curso y el colegio, la foto grupal y abajo las caras de todos los compañeros con su nombre (mosaico del curso). Tema: ${p.etiquetas[0]}.`,
    categoria: p.categoria,
    estilo: p.estilo,
    evento: p.evento ?? "Fin de año",
    etiquetas: ["póster", "curso", "mosaico", ...p.etiquetas],
    formato: FORMATOS.a3Vertical,
    hojas: [{ nombre: "Póster", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).grupal, "rect", h)) }],
    armar: (a, h) => {
      const { k, m, ancho, grupal } = geo(h);
      a.logo(0, "logo", { x: m, y: m + 20 * k, w: 300 * k, h: 200 * k });
      a.texto(0, "titulo", "Título", h.centrado(m + 10 * k, ancho - 700 * k, 260 * k), p.titulo, tam(t.fuentes.titulo, k, 1.05));
      a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(m + 300 * k, ancho, 150 * k), "course.withSchool", "Curso - Colegio", tam(t.fuentes.nombre, k, 0.6));
      a.texto(0, "anio", "Año", { x: h.w - m - 300 * k, y: m + 60 * k, w: 300 * k, h: 140 * k }, p.anio, { ...tam(t.fuentes.nombre, k, 0.6), color: t.acento });
      a.foto(0, "grupal", grupal);
      const y = grupal.y + grupal.h + 120 * k;
      a.mosaico(0, "mosaico", { x: m, y, w: ancho, h: h.h - m - y }, nombres(t, k, 30), {
        frame: t.fotoRedonda ? "circle" : "rounded",
        cornerRadius: 24,
        photoAspect: t.fotoRedonda ? 1 : 0.8,
        namePosition: "below",
        nameLines: 2,
        givenNames: "first",
        borderWidth: 5,
        borderColor: t.acento,
      });
    },
  };
}

export const OTROS: ModeloProducto[] = [
  anuario({ slug: "jardin-arcoiris", nombre: "Anuario Jardín · Arcoíris", tema: "arcoiris", categoria: "Jardín", estilo: "Divertido", etiquetas: ["arcoíris"], anio: "Sala 2026", titulos: ["¡Nuestra sala!", "Las caritas de la sala", "¡Este soy yo!", "Con la seño"] }),
  anuario({ slug: "primaria-cuaderno", nombre: "Anuario Primaria · Cuaderno", tema: "cuaderno", categoria: "Primaria", estilo: "Informal", etiquetas: ["cuaderno"], anio: "2026", titulos: ["Nuestro grado", "Todos los compañeros", "Mi página", "Con la maestra"] }),
  anuario({ slug: "secundaria-geometrico", nombre: "Anuario Secundaria · Geométrico", tema: "geometrico", categoria: "Secundaria", estilo: "Moderno", etiquetas: ["geométrico"], anio: "2026", titulos: ["Nuestro curso", "Todos", "Yo", "Profes y amigos"] }),
  anuario({ slug: "egresados-negro-dorado", nombre: "Anuario Egresados · Negro y dorado", tema: "negroDorado", categoria: "Egresados", estilo: "Formal", etiquetas: ["negro y dorado", "promoción"], anio: "Promoción 2026", titulos: ["La promo", "Todos los egresados", "Mi recuerdo", "Profes y amigos"] }),

  senalador({ slug: "arcoiris", nombre: "Señalador · Arcoíris", tema: "arcoiris", categoria: "Jardín", estilo: "Divertido", etiquetas: ["arcoíris"], frase: "Leer es volar" }),
  senalador({ slug: "espacio", nombre: "Señalador · Espacio", tema: "espacio", categoria: "Primaria", estilo: "Divertido", etiquetas: ["espacio"], frase: "Cada libro, un viaje" }),
  senalador({ slug: "flores", nombre: "Señalador · Flores pastel", tema: "floresPastel", categoria: "Primaria", estilo: "Clásico", etiquetas: ["flores"], frase: "Leer es soñar despierto" }),
  senalador({ slug: "minimal-azul", nombre: "Señalador · Minimal azul", tema: "minimalAzul", categoria: "Secundaria", estilo: "Minimalista", etiquetas: ["minimalista"], frase: "Una página más" }),

  portarretrato({ slug: "honor", nombre: "Recuerdo escolar · Dorado clásico", tema: "honor", categoria: "Primaria", estilo: "Clásico", etiquetas: ["dorado", "clásico"], anio: "2026" }),
  portarretrato({ slug: "animalitos", nombre: "Recuerdo escolar · Animalitos", tema: "animalitos", categoria: "Jardín", estilo: "Divertido", etiquetas: ["animales"], anio: "2026" }),
  portarretrato({ slug: "pizarron", nombre: "Recuerdo escolar · Pizarrón", tema: "pizarron", categoria: "Primaria", estilo: "Divertido", etiquetas: ["pizarrón"], anio: "2026" }),
  portarretrato({ slug: "negro-dorado", nombre: "Recuerdo escolar · Negro y dorado", tema: "negroDorado", categoria: "Egresados", estilo: "Formal", etiquetas: ["negro y dorado", "egresados"], anio: "Promoción 2026" }),

  tarjeta({ slug: "dia-de-la-madre-flores", nombre: "Tarjeta Día de la Madre · Flores", tema: "floresPastel", categoria: "Jardín", estilo: "Clásico", evento: "Día de la Madre", etiquetas: ["flores", "mamá"], saludo: "¡Feliz día, mamá!", mensaje: "Te quiero muchísimo" }),
  tarjeta({ slug: "dia-de-la-madre-arcoiris", nombre: "Tarjeta Día de la Madre · Arcoíris", tema: "arcoiris", categoria: "Jardín", estilo: "Divertido", evento: "Día de la Madre", etiquetas: ["arcoíris", "mamá"], saludo: "¡Feliz día, ma!", mensaje: "Sos mi persona favorita" }),
  tarjeta({ slug: "dia-de-la-madre-crayones", nombre: "Tarjeta Día de la Madre · Crayones", tema: "crayones", categoria: "Primaria", estilo: "Divertido", evento: "Día de la Madre", etiquetas: ["crayones", "mamá"], saludo: "Feliz día, mamá", mensaje: "Gracias por todo tu amor" }),
  tarjeta({ slug: "dia-del-padre-minimal", nombre: "Tarjeta Día del Padre · Minimal azul", tema: "minimalAzul", categoria: "Primaria", estilo: "Minimalista", evento: "Día del Padre", etiquetas: ["papá", "minimalista"], saludo: "¡Feliz día, papá!", mensaje: "Sos mi héroe" }),
  tarjeta({ slug: "dia-del-padre-espacio", nombre: "Tarjeta Día del Padre · Espacio", tema: "espacio", categoria: "Primaria", estilo: "Divertido", evento: "Día del Padre", etiquetas: ["papá", "espacio"], saludo: "Feliz día, pa", mensaje: "Te quiero hasta la luna" }),
  tarjeta({ slug: "dia-del-padre-deportivo", nombre: "Tarjeta Día del Padre · Campeón", tema: "deportivo", categoria: "Secundaria", estilo: "Moderno", evento: "Día del Padre", etiquetas: ["papá", "deportes"], saludo: "Feliz día, campeón", mensaje: "El mejor papá del mundo" }),

  poster({ slug: "crayones", nombre: "Póster del curso · Crayones (A3)", tema: "crayones", categoria: "Jardín", estilo: "Divertido", etiquetas: ["crayones"], titulo: "¡Nuestra sala!", anio: "2026" }),
  poster({ slug: "laureles", nombre: "Póster del curso · Laureles (A3)", tema: "laurel", categoria: "Secundaria", estilo: "Formal", etiquetas: ["laureles"], titulo: "Nuestro curso", anio: "2026" }),
  poster({ slug: "birretes", nombre: "Póster del curso · Egresados (A3)", tema: "birretes", categoria: "Egresados", estilo: "Divertido", evento: "Egreso", etiquetas: ["egresados", "birretes"], titulo: "¡Egresados!", anio: "2026" }),
];
