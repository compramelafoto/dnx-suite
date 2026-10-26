import "server-only";
import { prisma } from "@repo/db";
import { categoriasActivasPublicas } from "@/lib/website/inquiry";
import { esTablaFaltante, fechaLarga } from "./reglas";

/**
 * Lecturas públicas de Trabajos. Todo lo que sale de acá ya pasó por las dos reglas de
 * visibilidad: el trabajo está PUBLICADO y su categoría está visible. Un trabajo sin categoría
 * tampoco se muestra (la dirección pública lleva la categoría). Si las tablas todavía no existen
 * (el SQL se aplica a mano) se devuelve vacío en vez de romper el sitio.
 */

export type TrabajoTarjeta = {
  titulo: string;
  slug: string;
  categoriaSlug: string;
  categoriaNombre: string;
  lugar: string | null;
  fechaTexto: string | null;
  portadaUrl: string | null;
  href: string;
};

export type FotoPublica = {
  id: string;
  tipo: string;
  url: string;
  ancho: number | null;
  alto: number | null;
  alt: string | null;
};

export type TrabajoPublico = TrabajoTarjeta & {
  /** Sólo para contar la vista (`sumarVistaTrabajo`): no se muestra. */
  id: string;
  descripcionHtml: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  fotos: FotoPublica[];
  relacionados: TrabajoTarjeta[];
};

export type CategoriaPublica = { nombre: string; slug: string; portadaUrl: string | null };

type OpcionesBase = {
  /** Prefijo de las direcciones, por ejemplo `/w/sfpr`. Sin barra final. */
  base?: string;
};

const POR_PAGINA = 12;
const ORDEN_PUBLICO = [{ fecha: { sort: "desc", nulls: "last" } }, { orden: "asc" }] as const;

type FilaTrabajo = {
  titulo: string;
  slug: string;
  lugar: string | null;
  fecha: Date | null;
  portadaUrl: string | null;
};

function tarjeta(fila: FilaTrabajo, cat: { slug: string; nombre: string }, base: string): TrabajoTarjeta {
  return {
    titulo: fila.titulo,
    slug: fila.slug,
    categoriaSlug: cat.slug,
    categoriaNombre: cat.nombre,
    lugar: fila.lugar,
    fechaTexto: fila.fecha ? fechaLarga(fila.fecha) : null,
    portadaUrl: fila.portadaUrl,
    href: `${base}/trabajos/${cat.slug}/${fila.slug}`,
  };
}

export async function listarCategoriasPublicas(workspaceId: string): Promise<CategoriaPublica[]> {
  try {
    const filas = await prisma.fotofficeTrabajoCategoria.findMany({
      where: { workspaceId, visible: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { nombre: true, slug: true, portadaUrl: true },
    });
    return filas.map((c) => ({ nombre: c.nombre, slug: c.slug, portadaUrl: c.portadaUrl }));
  } catch (err) {
    if (esTablaFaltante(err)) return [];
    throw err;
  }
}

/**
 * Si el sitio tiene al menos un trabajo a la vista (publicado, de categoría visible): decide si
 * «Trabajos» entra al menú. Corre en cada página del sitio, por eso es lo más barato posible.
 */
export async function hayTrabajosPublicados(workspaceId: string): Promise<boolean> {
  try {
    // Dos consultas y no una: las tablas de Trabajos no tienen relación declarada en Prisma (no
    // hay FK, el SQL se aplica a mano), así que no se puede filtrar el trabajo por su categoría en
    // un solo `findFirst`. Las dos van por índice (`workspaceId`) y la segunda corta en la primera fila.
    const categorias = await prisma.fotofficeTrabajoCategoria.findMany({
      where: { workspaceId, visible: true },
      select: { id: true },
    });
    if (categorias.length === 0) return false;
    const uno = await prisma.fotofficeTrabajo.findFirst({
      where: { workspaceId, estado: "PUBLICADO", categoriaId: { in: categorias.map((c) => c.id) } },
      select: { id: true },
    });
    return uno !== null;
  } catch (err) {
    if (esTablaFaltante(err)) return false;
    throw err;
  }
}

/** Las categorías visibles con su id, para elegir una en el bloque PORTFOLIO del constructor. */
export async function categoriasParaBloque(workspaceId: string): Promise<Array<{ id: string; nombre: string }>> {
  try {
    return await prisma.fotofficeTrabajoCategoria.findMany({
      where: { workspaceId, visible: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true },
    });
  } catch (err) {
    if (esTablaFaltante(err)) return [];
    throw err;
  }
}

export async function listarTrabajosPublicos(
  workspaceId: string,
  opciones: OpcionesBase & {
    categoriaSlug?: string;
    /** Lo usa el bloque PORTFOLIO, que guarda la categoría por id. */
    categoriaId?: string;
    limite?: number;
    pagina?: number;
    soloDestacados?: boolean;
    /** Sin paginado (bloque PORTFOLIO) el total no se usa: se ahorra la cuenta y vuelve 0. */
    sinTotal?: boolean;
  } = {},
): Promise<{ trabajos: TrabajoTarjeta[]; total: number }> {
  const base = opciones.base ?? "";
  const limite = Math.max(1, opciones.limite ?? POR_PAGINA);
  const pagina = Math.max(1, opciones.pagina ?? 1);
  try {
    // Sólo categorías visibles: es la regla que deja afuera a los trabajos de una categoría oculta.
    const categorias = await prisma.fotofficeTrabajoCategoria.findMany({
      where: {
        workspaceId,
        visible: true,
        ...(opciones.categoriaSlug ? { slug: opciones.categoriaSlug } : {}),
        ...(opciones.categoriaId ? { id: opciones.categoriaId } : {}),
      },
      select: { id: true, slug: true, nombre: true },
    });
    if (categorias.length === 0) return { trabajos: [], total: 0 };
    const porId = new Map(categorias.map((c) => [c.id, c]));
    const where = {
      workspaceId,
      estado: "PUBLICADO",
      categoriaId: { in: categorias.map((c) => c.id) },
      ...(opciones.soloDestacados ? { destacado: true } : {}),
    };
    const [filas, total] = await Promise.all([
      prisma.fotofficeTrabajo.findMany({
        where,
        orderBy: [...ORDEN_PUBLICO],
        take: limite,
        skip: (pagina - 1) * limite,
        select: { titulo: true, slug: true, lugar: true, fecha: true, portadaUrl: true, categoriaId: true },
      }),
      opciones.sinTotal ? Promise.resolve(0) : prisma.fotofficeTrabajo.count({ where }),
    ]);
    const trabajos: TrabajoTarjeta[] = [];
    for (const f of filas) {
      const cat = f.categoriaId ? porId.get(f.categoriaId) : undefined;
      if (cat) trabajos.push(tarjeta(f, cat, base));
    }
    return { trabajos, total };
  } catch (err) {
    if (esTablaFaltante(err)) return { trabajos: [], total: 0 };
    throw err;
  }
}

export async function obtenerTrabajoPublico(
  workspaceId: string,
  categoriaSlug: string,
  slug: string,
  opciones: OpcionesBase = {},
): Promise<TrabajoPublico | null> {
  const base = opciones.base ?? "";
  try {
    const cat = await prisma.fotofficeTrabajoCategoria.findFirst({
      where: { workspaceId, slug: categoriaSlug, visible: true },
      select: { id: true, slug: true, nombre: true },
    });
    if (!cat) return null;
    const t = await prisma.fotofficeTrabajo.findFirst({
      where: { workspaceId, slug, estado: "PUBLICADO", categoriaId: cat.id },
      select: {
        id: true,
        titulo: true,
        slug: true,
        lugar: true,
        fecha: true,
        portadaUrl: true,
        descripcionHtml: true,
        seoTitle: true,
        seoDescription: true,
      },
    });
    if (!t) return null;
    const [fotos, relacionados] = await Promise.all([
      prisma.fotofficeTrabajoFoto.findMany({
        where: { trabajoId: t.id, workspaceId },
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        select: { id: true, tipo: true, url: true, ancho: true, alto: true, alt: true },
      }),
      prisma.fotofficeTrabajo.findMany({
        where: { workspaceId, estado: "PUBLICADO", categoriaId: cat.id, id: { not: t.id } },
        orderBy: [...ORDEN_PUBLICO],
        take: 3,
        select: { titulo: true, slug: true, lugar: true, fecha: true, portadaUrl: true },
      }),
    ]);
    return {
      ...tarjeta(t, cat, base),
      id: t.id,
      descripcionHtml: t.descripcionHtml,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
      fotos,
      relacionados: relacionados.map((r) => tarjeta(r, cat, base)),
    };
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

/** Minúsculas, sin tildes y con un solo espacio entre palabras: «Sesión  de Fotos» = «sesion de fotos». */
function nombreNormalizado(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La categoría ACTIVA de Consultas que se llama igual que la categoría del trabajo (sin mirar
 * tildes, mayúsculas ni espacios), para que «Pedir presupuesto» desde un casamiento llegue con
 * «Casamientos» ya elegida. `null` si no hay ninguna o si la lectura falla: el botón igual lleva
 * al formulario, sin categoría preelegida.
 */
export async function categoriaConsultaParaTrabajo(workspaceId: string, nombreCategoriaTrabajo: string): Promise<string | null> {
  const buscado = nombreNormalizado(nombreCategoriaTrabajo);
  if (!buscado) return null;
  try {
    const categorias = await categoriasActivasPublicas(workspaceId);
    return categorias.find((c) => nombreNormalizado(c.nombre) === buscado)?.id ?? null;
  } catch (err) {
    console.error("[fotoffice][trabajos] no se pudieron leer las categorías de Consultas:", err);
    return null;
  }
}

/**
 * Suma una vista. Se llama después de responder (`after`), así que nunca demora la página; el
 * filtro repite las reglas públicas para que nadie infle un borrador ni un trabajo de otro lado.
 */
export async function sumarVistaTrabajo(workspaceId: string, trabajoId: string): Promise<void> {
  await prisma.fotofficeTrabajo.updateMany({
    where: { id: trabajoId, workspaceId, estado: "PUBLICADO" },
    data: { vistas: { increment: 1 } },
  });
}
