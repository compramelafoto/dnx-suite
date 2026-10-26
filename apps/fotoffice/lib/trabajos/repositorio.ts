import "server-only";
import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import { sanitizeContentHtml } from "@repo/content";
import { deleteFotofficeR2Object, listFotofficeR2Keys } from "@/lib/images/r2-client";
import {
  ALT_MAX,
  MAX_FOTOS_POR_TRABAJO,
  diaUtc,
  esCodigoUnico,
  prefijoFotosTrabajo,
  prefijoWorkspaceTrabajos,
  slugDeTitulo,
  validarSlugTrabajo,
} from "./reglas";

/**
 * Lado del panel: crear, editar y ordenar Trabajos y sus categorías. Todo se filtra por
 * `workspaceId`, que el llamador saca de la sesión (nunca del navegador). Quién puede editar lo
 * decide el guardián de la acción que llama; acá sólo se cuida que nada cruce de institución.
 */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const fallo = (error: string): Resultado<never> => ({ ok: false, error });

export type DatosTrabajo = {
  titulo: string;
  slug?: string;
  categoriaId?: string | null;
  lugar?: string | null;
  /** Día calendario: medianoche UTC (columna `date`). Cualquier Date que llegue se lleva a ese día. */
  fecha?: Date | null;
  descripcionHtml?: string | null;
  destacado?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type FotoNueva = {
  tipo?: "FOTO" | "VIDEO_URL";
  url: string;
  r2Key?: string | null;
  ancho?: number | null;
  alto?: number | null;
  alt?: string | null;
  origenUrl?: string | null;
};

async function categoriaEsDelWorkspace(workspaceId: string, categoriaId: string | null | undefined) {
  if (!categoriaId) return true;
  const c = await prisma.fotofficeTrabajoCategoria.findFirst({ where: { id: categoriaId, workspaceId }, select: { id: true } });
  return Boolean(c);
}

async function slugsOcupados(workspaceId: string, exceptoId?: string): Promise<string[]> {
  const filas = await prisma.fotofficeTrabajo.findMany({
    where: { workspaceId, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
    select: { slug: true },
  });
  return filas.map((f) => f.slug);
}

/** Si el título da una dirección ocupada le agrega -2, -3… */
function slugLibre(base: string, ocupados: string[]): string {
  if (!ocupados.includes(base)) return base;
  let n = 2;
  while (ocupados.includes(`${base.slice(0, 76)}-${n}`)) n++;
  return `${base.slice(0, 76)}-${n}`;
}

// ── Trabajos ────────────────────────────────────────────────────────────────

export async function listarTrabajos(workspaceId: string, filtro: { categoriaId?: string; estado?: string } = {}) {
  const trabajos = await prisma.fotofficeTrabajo.findMany({
    where: {
      workspaceId,
      ...(filtro.categoriaId ? { categoriaId: filtro.categoriaId } : {}),
      ...(filtro.estado ? { estado: filtro.estado } : {}),
    },
    orderBy: [{ fecha: { sort: "desc", nulls: "last" } }, { orden: "asc" }, { createdAt: "desc" }],
  });
  const conteos = await prisma.fotofficeTrabajoFoto.groupBy({
    by: ["trabajoId"],
    where: { workspaceId, trabajoId: { in: trabajos.map((t) => t.id) } },
    _count: { _all: true },
  });
  const porTrabajo = new Map(conteos.map((c) => [c.trabajoId, c._count._all]));
  return trabajos.map((t) => ({ ...t, cantidadFotos: porTrabajo.get(t.id) ?? 0 }));
}

export async function obtenerTrabajo(workspaceId: string, id: string) {
  const trabajo = await prisma.fotofficeTrabajo.findFirst({ where: { id, workspaceId } });
  if (!trabajo) return null;
  const fotos = await prisma.fotofficeTrabajoFoto.findMany({
    where: { trabajoId: id, workspaceId },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
  });
  return { ...trabajo, fotos };
}

export async function crearTrabajo(workspaceId: string, datos: DatosTrabajo) {
  const titulo = datos.titulo.trim();
  if (!titulo) return fallo("Poné un título");
  if (!(await categoriaEsDelWorkspace(workspaceId, datos.categoriaId))) return fallo("Esa categoría no existe");
  const ocupados = await slugsOcupados(workspaceId);
  const slug = datos.slug?.trim() ? datos.slug.trim() : slugLibre(slugDeTitulo(titulo) || "trabajo", ocupados);
  const errorSlug = validarSlugTrabajo(slug, ocupados);
  if (errorSlug) return fallo(errorSlug);
  let trabajo;
  try {
    trabajo = await prisma.fotofficeTrabajo.create({
    data: {
      workspaceId,
      titulo,
      slug,
      categoriaId: datos.categoriaId || null,
      lugar: datos.lugar?.trim() || null,
      fecha: datos.fecha ? diaUtc(datos.fecha) : null,
      descripcionHtml: datos.descripcionHtml ? sanitizeContentHtml(datos.descripcionHtml) : null,
      destacado: datos.destacado ?? false,
      seoTitle: datos.seoTitle?.trim() || null,
      seoDescription: datos.seoDescription?.trim() || null,
    },
    });
  } catch (err) {
    if (esCodigoUnico(err)) return fallo("Ya hay otro trabajo con esa dirección");
    throw err;
  }
  return ok(trabajo);
}

export async function editarTrabajo(workspaceId: string, id: string, datos: Partial<DatosTrabajo>) {
  const actual = await prisma.fotofficeTrabajo.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!actual) return fallo("El trabajo no existe");
  const data: Prisma.FotofficeTrabajoUpdateInput = {};
  if (datos.titulo !== undefined) {
    const titulo = datos.titulo.trim();
    if (!titulo) return fallo("Poné un título");
    data.titulo = titulo;
  }
  if (datos.slug !== undefined) {
    const slug = datos.slug.trim();
    const errorSlug = validarSlugTrabajo(slug, await slugsOcupados(workspaceId, id));
    if (errorSlug) return fallo(errorSlug);
    data.slug = slug;
  }
  if (datos.categoriaId !== undefined) {
    const categoriaId = datos.categoriaId || null;
    if (!(await categoriaEsDelWorkspace(workspaceId, categoriaId))) return fallo("Esa categoría no existe");
    data.categoriaId = categoriaId;
  }
  if (datos.lugar !== undefined) data.lugar = datos.lugar?.trim() || null;
  if (datos.fecha !== undefined) data.fecha = datos.fecha ? diaUtc(datos.fecha) : null;
  if (datos.descripcionHtml !== undefined) {
    data.descripcionHtml = datos.descripcionHtml ? sanitizeContentHtml(datos.descripcionHtml) : null;
  }
  if (datos.destacado !== undefined) data.destacado = datos.destacado;
  if (datos.seoTitle !== undefined) data.seoTitle = datos.seoTitle?.trim() || null;
  if (datos.seoDescription !== undefined) data.seoDescription = datos.seoDescription?.trim() || null;
  try {
    return ok(await prisma.fotofficeTrabajo.update({ where: { id }, data }));
  } catch (err) {
    if (esCodigoUnico(err)) return fallo("Ya hay otro trabajo con esa dirección");
    throw err;
  }
}

export async function publicarTrabajo(workspaceId: string, id: string) {
  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id, workspaceId }, select: { publicadoAt: true } });
  if (!t) return fallo("El trabajo no existe");
  return ok(
    await prisma.fotofficeTrabajo.update({
      where: { id },
      data: { estado: "PUBLICADO", publicadoAt: t.publicadoAt ?? new Date() },
    }),
  );
}

export async function despublicarTrabajo(workspaceId: string, id: string) {
  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!t) return fallo("El trabajo no existe");
  return ok(await prisma.fotofficeTrabajo.update({ where: { id }, data: { estado: "BORRADOR" } }));
}

/** Borra el trabajo, sus fotos y los archivos de R2. Primero la base: si R2 falla, el trabajo ya
 * no está y lo que no se pudo borrar vuelve en `huerfanas` para que quede registro.
 *
 * Además de las keys con fila se barre todo el prefijo del trabajo: una subida que llegó a R2 pero
 * nunca se confirmó (pestaña cerrada a mitad) no tiene fila y, si no, quedaría para siempre. Si el
 * listado falla, el prefijo entero vuelve como huérfano. */
export async function borrarTrabajo(workspaceId: string, id: string): Promise<Resultado<{ huerfanas: string[] }>> {
  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!t) return fallo("El trabajo no existe");
  const fotos = await prisma.fotofficeTrabajoFoto.findMany({
    where: { trabajoId: id, workspaceId },
    select: { r2Key: true },
  });
  await prisma.$transaction([
    prisma.fotofficeTrabajoFoto.deleteMany({ where: { trabajoId: id, workspaceId } }),
    prisma.fotofficeTrabajo.delete({ where: { id } }),
  ]);
  const huerfanas: string[] = [];
  const propio = prefijoWorkspaceTrabajos(workspaceId);
  const aBorrar = new Set<string>();
  for (const f of fotos) {
    if (!f.r2Key) continue;
    // Sólo se borra lo que cuelga del prefijo de esta institución; el resto queda como huérfana.
    if (f.r2Key.startsWith(propio)) aBorrar.add(f.r2Key);
    else huerfanas.push(f.r2Key);
  }
  const prefijo = prefijoFotosTrabajo(workspaceId, id);
  try {
    for (const k of await listFotofficeR2Keys(prefijo)) aBorrar.add(k);
  } catch (err) {
    console.error("[fotoffice][trabajos] no se pudo listar el prefijo del trabajo borrado:", prefijo, err);
    huerfanas.push(prefijo);
  }
  for (const k of aBorrar) {
    const r = await deleteFotofficeR2Object(k);
    if (!r.ok) huerfanas.push(k);
  }
  return ok({ huerfanas });
}

// ── Fotos ───────────────────────────────────────────────────────────────────

export async function agregarFotos(workspaceId: string, trabajoId: string, fotos: FotoNueva[]) {
  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { portadaUrl: true } });
  if (!t) return fallo("El trabajo no existe");
  const prefijo = prefijoFotosTrabajo(workspaceId, trabajoId);
  for (const f of fotos) {
    if (!/^https:\/\//i.test(f.url)) return fallo("La dirección de la foto debe empezar con https://");
    // La key la arma el servidor al subir: una que no cuelgue de este trabajo no se acepta.
    if (f.r2Key && (!f.r2Key.startsWith(prefijo) || f.r2Key.includes(".."))) return fallo("La foto no es de este trabajo");
  }
  const existentes = await prisma.fotofficeTrabajoFoto.count({ where: { trabajoId, workspaceId } });
  if (existentes + fotos.length > MAX_FOTOS_POR_TRABAJO) {
    return fallo(`Cada trabajo admite hasta ${MAX_FOTOS_POR_TRABAJO} fotos`);
  }
  const ultima = await prisma.fotofficeTrabajoFoto.findFirst({
    where: { trabajoId, workspaceId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  const desde = ultima ? ultima.orden + 1 : 0;
  await prisma.fotofficeTrabajoFoto.createMany({
    data: fotos.map((f, i) => ({
      trabajoId,
      workspaceId,
      tipo: f.tipo ?? "FOTO",
      url: f.url,
      r2Key: f.r2Key ?? null,
      ancho: f.ancho ?? null,
      alto: f.alto ?? null,
      alt: f.alt ?? null,
      origenUrl: f.origenUrl ?? null,
      orden: desde + i,
    })),
  });
  // La primera foto de un trabajo sin portada pasa a ser la portada.
  const primera = fotos.find((f) => (f.tipo ?? "FOTO") === "FOTO");
  if (!t.portadaUrl && primera) {
    await prisma.fotofficeTrabajo.update({ where: { id: trabajoId }, data: { portadaUrl: primera.url } });
  }
  return ok({ agregadas: fotos.length });
}

export async function borrarFoto(
  workspaceId: string,
  trabajoId: string,
  fotoId: string,
): Promise<Resultado<{ huerfanas: string[] }>> {
  const f = await prisma.fotofficeTrabajoFoto.findFirst({
    where: { id: fotoId, trabajoId, workspaceId },
    select: { r2Key: true, url: true },
  });
  if (!f) return fallo("La foto no existe");
  await prisma.fotofficeTrabajoFoto.delete({ where: { id: fotoId } });
  // Si era la portada, pasa a la siguiente foto por orden (o queda sin portada).
  const trabajo = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { portadaUrl: true } });
  if (trabajo?.portadaUrl === f.url) {
    const siguiente = await prisma.fotofficeTrabajoFoto.findFirst({
      where: { trabajoId, workspaceId, tipo: "FOTO" },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      select: { url: true },
    });
    await prisma.fotofficeTrabajo.update({ where: { id: trabajoId }, data: { portadaUrl: siguiente?.url ?? null } });
  }
  const huerfanas: string[] = [];
  if (f.r2Key) {
    if (!f.r2Key.startsWith(prefijoWorkspaceTrabajos(workspaceId))) huerfanas.push(f.r2Key);
    else if (!(await deleteFotofficeR2Object(f.r2Key)).ok) huerfanas.push(f.r2Key);
  }
  return ok({ huerfanas });
}

/** Texto alternativo de una foto: lo que lee Google y quien no puede verla. Vacío = sin texto. */
export async function editarAltFoto(workspaceId: string, trabajoId: string, fotoId: string, alt: string | null) {
  const f = await prisma.fotofficeTrabajoFoto.findFirst({ where: { id: fotoId, trabajoId, workspaceId }, select: { id: true } });
  if (!f) return fallo("La foto no existe");
  const limpio = alt?.trim().slice(0, ALT_MAX) || null;
  await prisma.fotofficeTrabajoFoto.update({ where: { id: fotoId }, data: { alt: limpio } });
  return ok(true);
}

/** `ids` en el orden nuevo. Los que no son de este trabajo se ignoran. */
export async function reordenarFotos(workspaceId: string, trabajoId: string, ids: string[]) {
  const propias = await prisma.fotofficeTrabajoFoto.findMany({
    where: { trabajoId, workspaceId, id: { in: ids } },
    select: { id: true },
  });
  const validas = new Set(propias.map((p) => p.id));
  const orden = ids.filter((id) => validas.has(id));
  await prisma.$transaction(
    orden.map((id, i) => prisma.fotofficeTrabajoFoto.update({ where: { id }, data: { orden: i } })),
  );
  return ok(true);
}

export async function elegirPortada(workspaceId: string, trabajoId: string, fotoId: string) {
  const f = await prisma.fotofficeTrabajoFoto.findFirst({
    where: { id: fotoId, trabajoId, workspaceId, tipo: "FOTO" },
    select: { url: true },
  });
  if (!f) return fallo("La foto no existe");
  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { id: true } });
  if (!t) return fallo("El trabajo no existe");
  await prisma.fotofficeTrabajo.update({ where: { id: trabajoId }, data: { portadaUrl: f.url } });
  return ok(true);
}

// ── Categorías ──────────────────────────────────────────────────────────────

export async function listarCategorias(workspaceId: string) {
  return prisma.fotofficeTrabajoCategoria.findMany({
    where: { workspaceId },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
}

async function slugsDeCategorias(workspaceId: string, exceptoId?: string): Promise<string[]> {
  const filas = await prisma.fotofficeTrabajoCategoria.findMany({
    where: { workspaceId, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
    select: { slug: true },
  });
  return filas.map((f) => f.slug);
}

export async function crearCategoria(workspaceId: string, datos: { nombre: string; slug?: string; portadaUrl?: string | null }) {
  const nombre = datos.nombre.trim();
  if (!nombre) return fallo("Poné un nombre");
  const ocupados = await slugsDeCategorias(workspaceId);
  const slug = datos.slug?.trim() ? datos.slug.trim() : slugLibre(slugDeTitulo(nombre) || "categoria", ocupados);
  const errorSlug = validarSlugTrabajo(slug, ocupados);
  if (errorSlug) return fallo(errorSlug.replace("otro trabajo", "otra categoría"));
  const ultima = await prisma.fotofficeTrabajoCategoria.findFirst({
    where: { workspaceId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  try {
    return ok(
      await prisma.fotofficeTrabajoCategoria.create({
        data: { workspaceId, nombre, slug, portadaUrl: datos.portadaUrl ?? null, orden: ultima ? ultima.orden + 1 : 0 },
      }),
    );
  } catch (err) {
    if (esCodigoUnico(err)) return fallo("Ya hay otra categoría con esa dirección");
    throw err;
  }
}

export async function editarCategoria(
  workspaceId: string,
  id: string,
  datos: { nombre?: string; slug?: string; visible?: boolean; portadaUrl?: string | null },
) {
  const c = await prisma.fotofficeTrabajoCategoria.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!c) return fallo("La categoría no existe");
  const data: Prisma.FotofficeTrabajoCategoriaUpdateInput = {};
  if (datos.nombre !== undefined) {
    const nombre = datos.nombre.trim();
    if (!nombre) return fallo("Poné un nombre");
    data.nombre = nombre;
  }
  if (datos.slug !== undefined) {
    const slug = datos.slug.trim();
    const errorSlug = validarSlugTrabajo(slug, await slugsDeCategorias(workspaceId, id));
    if (errorSlug) return fallo(errorSlug.replace("otro trabajo", "otra categoría"));
    data.slug = slug;
  }
  if (datos.visible !== undefined) data.visible = datos.visible;
  if (datos.portadaUrl !== undefined) data.portadaUrl = datos.portadaUrl;
  try {
    return ok(await prisma.fotofficeTrabajoCategoria.update({ where: { id }, data }));
  } catch (err) {
    if (esCodigoUnico(err)) return fallo("Ya hay otra categoría con esa dirección");
    throw err;
  }
}

/** Los trabajos de una categoría borrada quedan sin categoría (y por eso fuera del sitio). */
export async function borrarCategoria(workspaceId: string, id: string) {
  const c = await prisma.fotofficeTrabajoCategoria.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!c) return fallo("La categoría no existe");
  await prisma.$transaction([
    prisma.fotofficeTrabajo.updateMany({ where: { workspaceId, categoriaId: id }, data: { categoriaId: null } }),
    prisma.fotofficeTrabajoCategoria.delete({ where: { id } }),
  ]);
  return ok(true);
}

export async function reordenarCategorias(workspaceId: string, ids: string[]) {
  const propias = await prisma.fotofficeTrabajoCategoria.findMany({
    where: { workspaceId, id: { in: ids } },
    select: { id: true },
  });
  const validas = new Set(propias.map((p) => p.id));
  const orden = ids.filter((id) => validas.has(id));
  await prisma.$transaction(
    orden.map((id, i) => prisma.fotofficeTrabajoCategoria.update({ where: { id }, data: { orden: i } })),
  );
  return ok(true);
}
