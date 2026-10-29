/**
 * Calendarios con la cara de los chicos: almanaques de una hoja (vertical, apaisado, del curso
 * en A3, imán) y calendarios de pared de 13 hojas (tapa y un mes por hoja). El año es un «Dato
 * de la plantilla»: el fotógrafo lo elige una vez y los meses y los días se acomodan solos.
 */
import type { Armador, Estilo, Rect, RolFoto } from "../lienzo";
import { FORMATOS, Hoja, type Formato } from "./hoja";
import { TEMAS, escala, fondoCon, type ClaveDeTema, type Tema } from "./temas";
import type { EstiloDeCatalogo, ModeloProducto } from "./tipo";

/** El año de fábrica: se cambia en «Datos de la plantilla». */
const ANIO = 2027;

const tam = (e: Estilo, k: number, por = 1): Estilo => ({ ...e, tam: Math.round(e.tam * k * por) });

/** Las opciones de color y letra del bloque calendario, según el tema. */
function opcionesDeCalendario(t: Tema, extra: Record<string, unknown> = {}) {
  return { year: ANIO, monthNameColor: t.acento, sundayColor: t.domingo, ...extra };
}
/** La letra del calendario. El cuerpo es un tope: el bloque lo achica hasta que entre todo. */
const letraDeCalendario = (t: Tema, k: number, tamBase: number): Estilo => ({
  familia: t.fuentes.cuerpo.familia,
  tam: Math.round(tamBase * k),
  color: t.tinta,
  peso: 600,
  mayus: "uppercase",
});

/** El título con el año: «Calendario» + el año (dato de la plantilla), en dos bloques. */
function tituloConAnio(a: Armador, t: Tema, h: Hoja, r: Rect, k: number, texto = "Calendario", pagina = 0) {
  const alto = r.h;
  a.texto(pagina, "titulo", "Título", { x: r.x, y: r.y, w: r.w, h: alto * 0.55 }, texto, tam(t.fuentes.titulo, k, 0.8));
  a.variable(pagina, "anio", "Año del calendario", { x: r.x, y: r.y + alto * 0.55, w: r.w, h: alto * 0.45 }, "calendar.year", String(ANIO), {
    ...tam(t.fuentes.nombre, k, 0.75),
    color: t.acento,
  });
}

type Disposicion = "almanaque-vertical" | "almanaque-apaisado" | "almanaque-curso" | "iman" | "pared";

function disenar(t: Tema, disp: Disposicion): Pick<ModeloProducto, "hojas" | "armar" | "formato"> & { fotos: RolFoto[] } {
  const formato: Formato =
    disp === "almanaque-apaisado" ? FORMATOS.a4Apaisado : disp === "almanaque-curso" ? FORMATOS.a3Vertical : disp === "iman" ? FORMATOS.iman : FORMATOS.a4Vertical;
  const forma = t.fotoRedonda ? "circle" : "rect";

  if (disp === "almanaque-vertical") {
    const geo = (h: Hoja) => {
      const k = escala(h);
      const m = h.mm(t.margenMm);
      const foto: Rect = forma === "circle" ? h.centrado(m + 90 * k, 820 * k, 820 * k) : h.centrado(m + 80 * k, 1000 * k, 820 * k);
      // Los meses, debajo del nombre, el curso y el año.
      const yCal = foto.y + foto.h + 520 * k;
      const cal: Rect = { x: m + 40 * k, y: yCal, w: h.w - 2 * m - 80 * k, h: h.h - m - 40 * k - yCal };
      return { k, m, foto, cal };
    };
    return {
      formato,
      fotos: ["individual"],
      hojas: [{ nombre: "Almanaque", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).foto, forma, h)) }],
      armar: (a, h) => {
        const { k, foto, cal } = geo(h);
        a.foto(0, "individual", foto, { mascara: forma });
        a.variable(0, "alumno", "Nombre del alumno", h.centrado(foto.y + foto.h + 50 * k, h.w * 0.8, 200 * k), "student.fullName", "Nombre del alumno", tam(t.fuentes.nombre, k, 0.95));
        a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(foto.y + foto.h + 250 * k, h.w * 0.8, 90 * k), "course.withSchool", "Curso - Colegio", tam(t.fuentes.chico, k, 1.1));
        a.variable(0, "anio", "Año del calendario", h.centrado(foto.y + foto.h + 350 * k, h.w * 0.5, 130 * k), "calendar.year", String(ANIO), { ...tam(t.fuentes.titulo, k, 0.55), color: t.acento });
        a.calendario(0, "calendario", cal, letraDeCalendario(t, k, 110), opcionesDeCalendario(t, { columns: 4 }));
      },
    };
  }

  if (disp === "almanaque-apaisado") {
    const geo = (h: Hoja) => {
      const k = escala(h);
      const m = h.mm(t.margenMm);
      const izq = h.w * 0.36;
      const foto: Rect = forma === "circle" ? { x: izq / 2 - 470 * k + m * 0.3, y: m + 300 * k, w: 940 * k, h: 940 * k } : { x: izq / 2 - 440 * k + m * 0.3, y: m + 260 * k, w: 880 * k, h: 1100 * k };
      const cal: Rect = { x: izq + 60 * k, y: m + 40 * k, w: h.w - izq - m - 100 * k, h: h.h - 2 * m - 80 * k };
      return { k, m, izq, foto, cal };
    };
    return {
      formato,
      fotos: ["individual"],
      hojas: [{ nombre: "Almanaque", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).foto, forma, h)) }],
      armar: (a, h) => {
        const { k, m, foto, cal } = geo(h);
        const cx = foto.x + foto.w / 2;
        const ancho = Math.min(1200 * k, 2 * (cx - m) - 40 * k);
        a.variable(0, "anio", "Año del calendario", h.centrado(m + 60 * k, ancho, 190 * k, cx), "calendar.year", String(ANIO), { ...tam(t.fuentes.titulo, k, 0.8), color: t.acento });
        a.foto(0, "individual", foto, { mascara: forma });
        a.variable(0, "alumno", "Nombre del alumno", h.centrado(foto.y + foto.h + 60 * k, ancho, 220 * k, cx), "student.fullName", "Nombre del alumno", { ...tam(t.fuentes.nombre, k, 0.8), interlineado: 1.05 });
        a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(foto.y + foto.h + 290 * k, ancho, 150 * k, cx), "course.withSchool", "Curso - Colegio", { ...tam(t.fuentes.chico, k, 1.05), interlineado: 1.2 });
        a.calendario(0, "calendario", cal, letraDeCalendario(t, k, 110), opcionesDeCalendario(t, { columns: 3 }));
      },
    };
  }

  if (disp === "almanaque-curso") {
    const geo = (h: Hoja) => {
      const k = escala(h);
      const m = h.mm(t.margenMm);
      const foto: Rect = h.centrado(m + 380 * k, h.w - 2 * m - 300 * k, (h.w - 2 * m - 300 * k) * 0.62);
      const cal: Rect = { x: m + 60 * k, y: foto.y + foto.h + 300 * k, w: h.w - 2 * m - 120 * k, h: h.h - m - 60 * k - (foto.y + foto.h + 300 * k) };
      return { k, m, foto, cal };
    };
    return {
      formato,
      fotos: ["grupal"],
      hojas: [{ nombre: "Almanaque del curso", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).foto, "rect", h)) }],
      armar: (a, h) => {
        const { k, m, foto, cal } = geo(h);
        a.logo(0, "logo", h.centrado(m + 40 * k, 300 * k, 170 * k));
        a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(m + 220 * k, h.w * 0.8, 130 * k), "course.withSchool", "Curso - Colegio", tam(t.fuentes.nombre, k, 0.55));
        a.foto(0, "grupal", foto);
        a.variable(0, "anio", "Año del calendario", h.centrado(foto.y + foto.h + 60 * k, h.w * 0.5, 200 * k), "calendar.year", String(ANIO), { ...tam(t.fuentes.titulo, k, 0.75), color: t.acento });
        a.calendario(0, "calendario", cal, letraDeCalendario(t, k, 110), opcionesDeCalendario(t, { columns: 4 }));
      },
    };
  }

  if (disp === "iman") {
    const geo = (h: Hoja) => {
      const k = escala(h);
      const m = h.mm(Math.min(t.margenMm, 8));
      const foto: Rect = h.centrado(m + 30 * k, (h.w - 2 * m) * 0.74, (h.w - 2 * m) * 0.62);
      const cal: Rect = { x: m + 20 * k, y: foto.y + foto.h + 250 * k, w: h.w - 2 * m - 40 * k, h: h.h - m - 30 * k - (foto.y + foto.h + 250 * k) };
      return { k, m, foto, cal };
    };
    return {
      formato,
      fotos: ["individual"],
      hojas: [{ nombre: "Imán", fondo: (h) => fondoCon(t, h, t.marcoFoto(geo(h).foto, "rect", h)) }],
      armar: (a, h) => {
        const { k, foto, cal } = geo(h);
        a.foto(0, "individual", foto);
        a.variable(0, "alumno", "Nombre del alumno", h.centrado(foto.y + foto.h + 30 * k, h.w * 0.86, 130 * k), "student.fullName", "Nombre del alumno", tam(t.fuentes.nombre, k, 0.6));
        a.variable(0, "anio", "Año del calendario", h.centrado(foto.y + foto.h + 150 * k, h.w * 0.6, 90 * k), "calendar.year", String(ANIO), { ...tam(t.fuentes.chico, k, 1.4), color: t.acento, peso: 700 });
        a.calendario(0, "calendario", cal, letraDeCalendario(t, k, 110), opcionesDeCalendario(t, { columns: 3, weekdayStyle: "initial", monthNameScale: 1.2 }));
      },
    };
  }

  // Pared: tapa y un mes por hoja, cada mes con una foto (se repiten las cinco del pedido).
  const rolesPorMes: RolFoto[] = ["individual", "grupal", "maestra", "amigos", "libre", "individual", "grupal", "amigos", "maestra", "libre", "individual", "grupal"];
  const geoMes = (h: Hoja) => {
    const k = escala(h);
    const m = h.mm(t.margenMm);
    const foto: Rect = h.centrado(m + 60 * k, h.w - 2 * m - 160 * k, h.h * 0.5);
    const cal: Rect = { x: m + 120 * k, y: foto.y + foto.h + 120 * k, w: h.w - 2 * m - 240 * k, h: h.h - m - 80 * k - (foto.y + foto.h + 120 * k) };
    return { k, m, foto, cal };
  };
  const geoTapa = (h: Hoja) => {
    const k = escala(h);
    const m = h.mm(t.margenMm);
    const foto: Rect = forma === "circle" ? h.centrado(m + 700 * k, 1300 * k, 1300 * k) : h.centrado(m + 650 * k, 1400 * k, 1700 * k);
    return { k, m, foto };
  };
  return {
    formato,
    fotos: ["individual", "grupal", "maestra", "amigos", "libre"],
    hojas: [
      { nombre: "Tapa", fondo: (h) => fondoCon(t, h, t.marcoFoto(geoTapa(h).foto, forma, h)) },
      ...Array.from({ length: 12 }, (_, i) => ({
        nombre: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][i]!,
        fondo: (h: Hoja) => fondoCon(t, h, t.marcoFoto(geoMes(h).foto, "rect", h)),
      })),
    ],
    armar: (a, h) => {
      const tapa = geoTapa(h);
      const k = tapa.k;
      tituloConAnio(a, t, h, h.centrado(tapa.m + 80 * k, h.w * 0.8, 520 * k), k);
      a.foto(0, "individual", tapa.foto, { mascara: forma, clave: "tapa" });
      a.variable(0, "alumno", "Nombre del alumno", h.centrado(tapa.foto.y + tapa.foto.h + 90 * k, h.w * 0.8, 240 * k), "student.fullName", "Nombre del alumno", tam(t.fuentes.nombre, k));
      a.variable(0, "curso_colegio", "Curso y colegio", h.centrado(tapa.foto.y + tapa.foto.h + 360 * k, h.w * 0.8, 100 * k), "course.withSchool", "Curso - Colegio", tam(t.fuentes.chico, k, 1.2));
      const g = geoMes(h);
      rolesPorMes.forEach((rol, i) => {
        a.foto(i + 1, rol, g.foto, { clave: `mes_${i + 1}` });
        a.calendario(i + 1, "calendario", g.cal, letraDeCalendario(t, g.k, 150), opcionesDeCalendario(t, { month: i + 1, showYearInTitle: true, monthNameScale: 1.6, weekdayStyle: "short" }));
      });
    },
  };
}

type Pedido = {
  slug: string;
  nombre: string;
  tema: ClaveDeTema;
  categoria: "Jardín" | "Primaria" | "Secundaria" | "Egresados" | "Formal" | "Informal";
  estilo: EstiloDeCatalogo;
  disp: Disposicion;
  etiquetas: string[];
  como: string;
};

const PEDIDOS: Pedido[] = [
  { slug: "almanaque-arcoiris", nombre: "Calendario Jardín · Arcoíris", tema: "arcoiris", categoria: "Jardín", estilo: "Divertido", disp: "almanaque-vertical", etiquetas: ["arcoíris", "almanaque"], como: "arcoíris de acuarela" },
  { slug: "almanaque-animalitos", nombre: "Calendario Jardín · Animalitos", tema: "animalitos", categoria: "Jardín", estilo: "Divertido", disp: "almanaque-vertical", etiquetas: ["animales", "almanaque"], como: "animalitos en el pasto" },
  { slug: "almanaque-flores", nombre: "Calendario · Flores pastel", tema: "floresPastel", categoria: "Jardín", estilo: "Clásico", disp: "almanaque-vertical", etiquetas: ["flores", "almanaque"], como: "ramitos de flores en tonos pastel" },
  { slug: "almanaque-espacio", nombre: "Calendario Primaria · Espacio", tema: "espacio", categoria: "Primaria", estilo: "Divertido", disp: "almanaque-vertical", etiquetas: ["espacio", "planetas", "almanaque"], como: "planetas y estrellas" },
  { slug: "almanaque-minimal-azul", nombre: "Calendario Secundaria · Minimal azul", tema: "minimalAzul", categoria: "Secundaria", estilo: "Minimalista", disp: "almanaque-vertical", etiquetas: ["minimalista", "almanaque"], como: "blanco con banda azul" },
  { slug: "almanaque-negro-dorado", nombre: "Calendario Egresados · Negro y dorado", tema: "negroDorado", categoria: "Egresados", estilo: "Formal", disp: "almanaque-vertical", etiquetas: ["egresados", "dorado", "almanaque"], como: "negro con filigranas doradas" },
  { slug: "apaisado-pizarron", nombre: "Calendario Primaria · Pizarrón apaisado", tema: "pizarron", categoria: "Primaria", estilo: "Divertido", disp: "almanaque-apaisado", etiquetas: ["pizarrón", "almanaque"], como: "pizarrón verde con marco de madera" },
  { slug: "apaisado-globos", nombre: "Calendario Jardín · Globos apaisado", tema: "globos", categoria: "Jardín", estilo: "Divertido", disp: "almanaque-apaisado", etiquetas: ["globos", "almanaque"], como: "globos y confeti" },
  { slug: "apaisado-geometrico", nombre: "Calendario Secundaria · Geométrico apaisado", tema: "geometrico", categoria: "Secundaria", estilo: "Moderno", disp: "almanaque-apaisado", etiquetas: ["geométrico", "almanaque"], como: "triángulos de colores" },
  { slug: "apaisado-minimal-blanco", nombre: "Calendario Egresados · Minimal blanco apaisado", tema: "minimalBlanco", categoria: "Egresados", estilo: "Minimalista", disp: "almanaque-apaisado", etiquetas: ["minimalista", "almanaque"], como: "blanco con un filete dorado" },
  { slug: "curso-lapices", nombre: "Calendario del curso · Lápices (A3)", tema: "lapices", categoria: "Primaria", estilo: "Divertido", disp: "almanaque-curso", etiquetas: ["curso", "grupal", "póster", "almanaque"], como: "lápices de colores, con la foto grupal y el logo" },
  { slug: "curso-azul-oro", nombre: "Calendario del curso · Azul y oro (A3)", tema: "azulOro", categoria: "Egresados", estilo: "Formal", disp: "almanaque-curso", etiquetas: ["curso", "grupal", "egresados", "almanaque"], como: "azul marino con filigranas doradas, con la foto grupal y el logo" },
  { slug: "iman-estrellas", nombre: "Calendario imán · Estrellas", tema: "estrellas", categoria: "Jardín", estilo: "Divertido", disp: "iman", etiquetas: ["imán", "heladera", "estrellas"], como: "cielo de noche con estrellas" },
  { slug: "iman-crayones", nombre: "Calendario imán · Crayones", tema: "crayones", categoria: "Primaria", estilo: "Divertido", disp: "iman", etiquetas: ["imán", "heladera", "crayones"], como: "bordes de crayón" },
  { slug: "iman-birretes", nombre: "Calendario imán · Egresados", tema: "birretes", categoria: "Egresados", estilo: "Divertido", disp: "iman", etiquetas: ["imán", "heladera", "egresados"], como: "birretes y confeti" },
  { slug: "pared-arcoiris", nombre: "Calendario de pared · Arcoíris (13 hojas)", tema: "arcoiris", categoria: "Jardín", estilo: "Divertido", disp: "pared", etiquetas: ["pared", "12 meses", "anillado"], como: "arcoíris de acuarela" },
  { slug: "pared-minimal", nombre: "Calendario de pared · Minimal (13 hojas)", tema: "minimalBlanco", categoria: "Informal", estilo: "Minimalista", disp: "pared", etiquetas: ["pared", "12 meses", "anillado"], como: "blanco y limpio, para que mande la foto" },
];

const QUE: Record<Disposicion, (h: Hoja) => string> = {
  "almanaque-vertical": () => "Almanaque de una hoja A4 vertical: la foto individual arriba, el nombre y los 12 meses abajo",
  "almanaque-apaisado": () => "Almanaque de una hoja A4 apaisada: la foto individual y el nombre a la izquierda, los 12 meses a la derecha",
  "almanaque-curso": () => "Almanaque del curso en A3: la foto grupal, el logo del colegio y los 12 meses",
  iman: (h) => `Calendario imán de ${h.medida}: la foto, el nombre y los 12 meses en chiquito`,
  pared: () => "Calendario de pared A4 de 13 hojas: tapa con la foto individual y un mes por hoja, cada uno con una de las fotos del pedido",
};

export const CALENDARIOS: ModeloProducto[] = PEDIDOS.map((p) => {
  const tema = TEMAS[p.tema];
  const d = disenar(tema, p.disp);
  return {
    tipo: "Calendario",
    serie: "calendarios",
    slug: p.slug,
    nombre: p.nombre,
    descripcion: `${QUE[p.disp](new Hoja(d.formato))}; ${p.como}. El año se elige una vez en «Datos de la plantilla» y los meses y los días se acomodan solos (bisiestos incluidos).`,
    categoria: p.categoria,
    estilo: p.estilo,
    etiquetas: ["calendario", ...p.etiquetas],
    formato: d.formato,
    hojas: d.hojas,
    armar: d.armar,
  };
});
