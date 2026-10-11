import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { asignarNumero } from "@/lib/numeracion/asignar";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { MENSAJES_GALERIA as M, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import { leerAjustesGaleria } from "./ajustes";
import {
  MAX_MENSAJE_GALERIA, MAX_NOMBRE_GALERIA, MODOS_DESCARGA, MODOS_SELECCION, esEstadoGaleria,
  type EstadoGaleria, type ModoDescarga, type ModoOrden, type ModoSeleccion,
} from "./constantes";
import { registrarEvento } from "./eventos";
import { urlsDeLecturaPorLote } from "./almacen";
import { validarConfigSeleccion } from "./seleccion";
import { borrarFoto, type FotoVisible } from "./fotos";

/**
 * Galerías: crear, editar la configuración, publicar, archivar y reactivar, y las lecturas de la
 * ficha. Cada función exige el permiso adentro (Gestionar para escribir, Ver para leer) y acota
 * TODA consulta al `workspaceId` del contexto. Los cambios de estado son escrituras condicionales
 * (`updateMany` con el estado esperado): de dos pedidos a la vez gana uno solo.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);

export type ResultadoGaleria = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoSimpleGaleria = { ok: true } | { ok: false; error: string };

const no = (error: string) => ({ ok: false as const, error });

function nombreLimpio(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= MAX_NOMBRE_GALERIA ? t : null;
}

function mensajeLimpio(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\r\n?/g, "\n").trim();
  if (t.length > MAX_MENSAJE_GALERIA) return undefined;
  return t === "" ? null : t;
}

function enteroOpcional(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? (v.trim() === "" ? NaN : Number(v)) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : undefined;
}

// --- Crear -----------------------------------------------------------------------------------

/**
 * Crea una galería en BORRADOR atada a un proyecto, con los valores por omisión de Configuración →
 * Galería. El nombre, si no se da, es el del proyecto. Número `GALERIA` correlativo del año.
 */
export async function crearGaleria(ctx: CtxGalerias, datos: unknown, ahora: Date = new Date()): Promise<ResultadoGaleria> {
  if (!puedeGestionarGalerias(ctx) || ctx.userId === null) return no(M.sinPermiso);
  if (!datos || typeof datos !== "object") return no(M.datosInvalidos);
  const d = datos as Record<string, unknown>;
  if (!idValido(d.proyectoId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const proyecto = await prisma.fotofficeProyecto.findFirst({ where: { id: d.proyectoId, workspaceId }, select: { id: true, name: true, ownerUserId: true } });
  if (!proyecto) return no(M.proyecto);
  let nombre: string | null;
  if (d.nombre === undefined || d.nombre === null || (typeof d.nombre === "string" && d.nombre.trim() === "")) nombre = nombreLimpio(proyecto.name) ?? proyecto.name.slice(0, MAX_NOMBRE_GALERIA);
  else nombre = nombreLimpio(d.nombre);
  if (!nombre) return no(M.nombreGaleria);
  const ajustes = await leerAjustesGaleria(workspaceId);
  const id = randomUUID();
  try {
    return await prisma.$transaction(async (tx) => {
      const numero = await asignarNumero(tx, { workspaceId, key: "GALERIA", entityType: "GALERIA", entityId: id, fecha: ahora });
      await tx.fotofficeGaleria.create({
        data: {
          id, workspaceId, proyectoId: proyecto.id, number: numero.display, name: nombre,
          message: ajustes.defaultMessage,
          // El modo "por cantidad" necesita mínimo o máximo: una galería nueva siempre nace libre.
          selectionMode: "LIBRE", minSelect: null, maxSelect: null,
          allowComments: ajustes.defaultAllowComments, downloadMode: ajustes.defaultDownloadMode,
          status: "BORRADOR", orderMode: "NOMBRE",
          ownerUserId: proyecto.ownerUserId ?? ctx.userId, createdByUserId: ctx.userId,
        },
        select: { id: true },
      });
      await registrarEvento(tx, { workspaceId, galeriaId: id, tipo: "GALERIA_CREADA", actorUserId: ctx.userId });
      return { ok: true as const, id };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    console.error("[galerias] crear falló", { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
    return no(M.guardar);
  }
}

// --- Editar la configuración ---------------------------------------------------------------------

/**
 * Cambia nombre, mensaje, modo de selección (con mínimo/máximo), comentarios y descarga. No toca el
 * estado ni el orden. Misma regla que los CHECK del SQL (`validarConfigSeleccion`).
 */
export async function editarGaleria(ctx: CtxGalerias, galeriaId: unknown, datos: unknown): Promise<ResultadoSimpleGaleria> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !datos || typeof datos !== "object") return no(M.datosInvalidos);
  const d = datos as Record<string, unknown>;
  const nombre = nombreLimpio(d.nombre);
  if (!nombre) return no(M.nombreGaleria);
  const mensaje = mensajeLimpio(d.mensaje);
  if (mensaje === undefined) return no(M.mensajeGaleria);
  if (typeof d.selectionMode !== "string" || !(MODOS_SELECCION as readonly string[]).includes(d.selectionMode)) return no(M.modoSeleccion);
  const modo = d.selectionMode as ModoSeleccion;
  let minSelect = enteroOpcional(d.minSelect);
  let maxSelect = enteroOpcional(d.maxSelect);
  if (minSelect === undefined || maxSelect === undefined) return no("El mínimo y el máximo tienen que ser números enteros de 1 en adelante.");
  if (modo === "LIBRE") {
    minSelect = null;
    maxSelect = null;
  }
  const validacion = validarConfigSeleccion({ selectionMode: modo, minSelect, maxSelect });
  if (!validacion.ok) return no(validacion.error);
  if (typeof d.allowComments !== "boolean") return no(M.comentarios);
  if (typeof d.downloadMode !== "string" || !(MODOS_DESCARGA as readonly string[]).includes(d.downloadMode)) return no(M.modoDescarga);
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      const r = await tx.fotofficeGaleria.updateMany({
        where: { id: galeriaId, workspaceId },
        data: { name: nombre, message: mensaje, selectionMode: modo, minSelect, maxSelect, allowComments: d.allowComments as boolean, downloadMode: d.downloadMode as ModoDescarga },
      });
      if (r.count !== 1) return no(M.noExiste);
      await registrarEvento(tx, { workspaceId, galeriaId, tipo: "GALERIA_EDITADA", actorUserId: ctx.userId });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}

/** Cambia el orden de las fotos: por nombre (natural) o manual. Pasar a manual conserva el orden que se ve. */
export async function establecerModoOrden(ctx: CtxGalerias, galeriaId: unknown, modo: unknown): Promise<ResultadoSimpleGaleria> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId)) return no(M.datosInvalidos);
  if (modo !== "NOMBRE" && modo !== "MANUAL") return no(M.modoOrden);
  const r = await prisma.fotofficeGaleria.updateMany({ where: { id: galeriaId, workspaceId: ctx.workspaceId }, data: { orderMode: modo as ModoOrden } });
  return r.count === 1 ? { ok: true } : no(M.noExiste);
}

// --- Estado: publicar, archivar, reactivar -----------------------------------------------------------

/** BORRADOR → PUBLICADA. Hace falta al menos una foto LISTA. */
export async function publicarGaleria(ctx: CtxGalerias, galeriaId: unknown, ahora: Date = new Date()): Promise<ResultadoSimpleGaleria> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const g = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { status: true } });
  if (!g) return no(M.noExiste);
  if (g.status === "PUBLICADA") return no(M.yaPublicada);
  if (g.status === "ARCHIVADA") return no(M.galeriaArchivada);
  const listas = await prisma.fotofficeGaleriaFoto.count({ where: { galeriaId, workspaceId, status: "LISTA" } });
  if (listas < 1) return no(M.sinFotosListas);
  return cambiarEstado(ctx, galeriaId, "BORRADOR", { status: "PUBLICADA", publishedAt: ahora }, "PUBLICADA", M.yaPublicada);
}

/** BORRADOR o PUBLICADA → ARCHIVADA. Los enlaces de los clientes dejan de abrir la galería. */
export async function archivarGaleria(ctx: CtxGalerias, galeriaId: unknown, ahora: Date = new Date()): Promise<ResultadoSimpleGaleria> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId)) return no(M.datosInvalidos);
  return cambiarEstado(ctx, galeriaId, ["BORRADOR", "PUBLICADA"], { status: "ARCHIVADA", archivedAt: ahora }, "ARCHIVADA", M.yaArchivada);
}

/** ARCHIVADA → PUBLICADA (si alguna vez se publicó) o BORRADOR. */
export async function reactivarGaleria(ctx: CtxGalerias, galeriaId: unknown): Promise<ResultadoSimpleGaleria> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId)) return no(M.datosInvalidos);
  const g = await prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId: ctx.workspaceId }, select: { status: true, publishedAt: true } });
  if (!g) return no(M.noExiste);
  if (g.status !== "ARCHIVADA") return no(M.noEstaArchivada);
  return cambiarEstado(ctx, galeriaId, "ARCHIVADA", { status: g.publishedAt ? "PUBLICADA" : "BORRADOR", archivedAt: null }, "REACTIVADA", M.noEstaArchivada);
}

async function cambiarEstado(
  ctx: CtxGalerias,
  galeriaId: string,
  desde: EstadoGaleria | EstadoGaleria[],
  data: Prisma.FotofficeGaleriaUpdateManyMutationInput,
  evento: string,
  mensajeSiYaCambio: string,
): Promise<ResultadoSimpleGaleria> {
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx) => {
      const r = await tx.fotofficeGaleria.updateMany({
        where: { id: galeriaId, workspaceId, status: Array.isArray(desde) ? { in: desde } : desde },
        data,
      });
      if (r.count !== 1) {
        const existe = await tx.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true } });
        return no(existe ? mensajeSiYaCambio : M.noExiste);
      }
      await registrarEvento(tx, { workspaceId, galeriaId, tipo: evento, actorUserId: ctx.userId });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch {
    return no(M.guardar);
  }
}

// --- Buscar proyectos (para crear desde el listado) ------------------------------------------------------

export type ProyectoEncontrado = { id: string; numero: string; nombre: string; contacto: string };

/** Proyectos del workspace por número, nombre o contacto. Pide Gestionar Galería y Ver Proyectos. Como mucho 15. */
export async function buscarProyectos(ctx: CtxGalerias, texto: unknown): Promise<{ ok: true; proyectos: ProyectoEncontrado[] } | { ok: false; error: string }> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!puedeEnContexto(ctx, "ver", "projects")) return no(M.buscarProyectos);
  if (typeof texto !== "string") return no(M.datosInvalidos);
  const q = texto.trim().replace(/\s+/g, " ").slice(0, 100);
  if (q.length < 2) return { ok: true, proyectos: [] };
  const contiene = { contains: q, mode: "insensitive" as const };
  const filas = await prisma.fotofficeProyecto.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      OR: [
        { number: contiene }, { name: contiene },
        { client: { is: { firstName: contiene } } }, { client: { is: { lastName: contiene } } }, { client: { is: { businessName: contiene } } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 15,
    select: { id: true, number: true, name: true, client: { select: { firstName: true, lastName: true, businessName: true } } },
  });
  return { ok: true, proyectos: filas.map((f) => ({ id: f.id, numero: f.number, nombre: f.name, contacto: nombreDeContacto(f.client) })) };
}

// --- Lecturas ----------------------------------------------------------------------------------------

export type FichaGaleria = {
  id: string;
  numero: string;
  nombre: string;
  mensaje: string | null;
  estado: EstadoGaleria;
  selectionMode: ModoSeleccion;
  minSelect: number | null;
  maxSelect: number | null;
  allowComments: boolean;
  downloadMode: ModoDescarga;
  orderMode: ModoOrden;
  coverFotoId: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  proyecto: { id: string; numero: string; nombre: string };
  contacto: { id: string; nombre: string; email: string | null; telefono: string | null };
  fotos: { listas: number; pendientes: number; conError: number };
};

/** La galería con su proyecto, el contacto del proyecto y el conteo de fotos. null si no existe en el workspace o no hay "Ver". */
export async function cargarFichaGaleria(ctx: CtxGalerias, galeriaId: unknown): Promise<FichaGaleria | null> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId)) return null;
  const { workspaceId } = ctx;
  const g = await prisma.fotofficeGaleria.findFirst({
    where: { id: galeriaId, workspaceId },
    select: {
      id: true, number: true, name: true, message: true, status: true, selectionMode: true, minSelect: true, maxSelect: true,
      allowComments: true, downloadMode: true, orderMode: true, coverFotoId: true, publishedAt: true, archivedAt: true, createdAt: true,
      proyecto: { select: { id: true, number: true, name: true, client: { select: { id: true, firstName: true, lastName: true, businessName: true, email: true, phone: true } } } },
    },
  });
  if (!g) return null;
  const cuentas = await prisma.fotofficeGaleriaFoto.groupBy({ by: ["status"], where: { galeriaId: g.id, workspaceId }, _count: { _all: true } });
  const n = (s: string) => cuentas.find((c) => c.status === s)?._count._all ?? 0;
  const c = g.proyecto.client;
  return {
    id: g.id,
    numero: g.number,
    nombre: g.name,
    mensaje: g.message,
    estado: esEstadoGaleria(g.status) ? g.status : "BORRADOR",
    selectionMode: g.selectionMode === "CANTIDAD" ? "CANTIDAD" : "LIBRE",
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    allowComments: g.allowComments,
    downloadMode: (MODOS_DESCARGA as readonly string[]).includes(g.downloadMode) ? (g.downloadMode as ModoDescarga) : "VISTA",
    orderMode: g.orderMode === "MANUAL" ? "MANUAL" : "NOMBRE",
    coverFotoId: g.coverFotoId,
    publishedAt: g.publishedAt,
    archivedAt: g.archivedAt,
    createdAt: g.createdAt,
    proyecto: { id: g.proyecto.id, numero: g.proyecto.number, nombre: g.proyecto.name },
    contacto: { id: c.id, nombre: nombreDeContacto(c), email: c.email, telefono: c.phone },
    fotos: { listas: n("LISTA"), pendientes: n("PENDIENTE"), conError: n("ERROR") },
  };
}

export type GaleriaDeTarjeta = { id: string; numero: string; nombre: string; estado: EstadoGaleria; fotos: number; enRevision: number };

/** Galerías de un proyecto, para su tarjeta. null si no hay "Ver" en Galería. */
export async function galeriasDeProyecto(ctx: CtxGalerias, proyectoId: string): Promise<GaleriaDeTarjeta[] | null> {
  if (!puedeVerGalerias(ctx) || !idValido(proyectoId)) return null;
  const { workspaceId } = ctx;
  const filas = await prisma.fotofficeGaleria.findMany({
    where: { workspaceId, proyectoId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true, number: true, name: true, status: true,
      _count: { select: { fotos: { where: { status: "LISTA" } } } },
      clientes: { where: { status: "EN_REVISION", revokedAt: null }, select: { id: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id, numero: f.number, nombre: f.name, estado: esEstadoGaleria(f.status) ? f.status : "BORRADOR",
    fotos: f._count.fotos, enRevision: f.clientes.length,
  }));
}

/**
 * Fotos puntuales de una galería (para refrescar la grilla mientras se sube): hasta 100 ids, con URLs
 * firmadas de lectura. Sólo las de esta galería y este workspace.
 */
export async function fotosPorIds(ctx: CtxGalerias, galeriaId: unknown, ids: unknown): Promise<FotoVisible[]> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId) || !Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every(idValido)) return [];
  const { workspaceId } = ctx;
  const filas = await prisma.fotofficeGaleriaFoto.findMany({
    where: { galeriaId, workspaceId, id: { in: ids as string[] } },
    select: { id: true, fileName: true, status: true, errorReason: true, width: true, height: true, sizeBytes: true, order: true, viewKey: true, thumbKey: true },
  });
  const urls = await urlsDeLecturaPorLote(filas.map((f) => ({ id: f.id, viewKey: null, thumbKey: f.thumbKey })));
  return filas.map((f) => ({
    id: f.id, fileName: f.fileName, status: f.status as FotoVisible["status"], errorReason: f.errorReason, width: f.width, height: f.height,
    sizeBytes: f.sizeBytes === null ? null : Number(f.sizeBytes), order: f.order,
    thumbUrl: urls.get(f.id)?.thumbUrl ?? null, viewUrl: null,
  }));
}

/**
 * URLs firmadas de la vista grande (2048 px) de hasta 20 fotos LISTAS de la galería: la foto que se abre y sus
 * vecinas. Sólo con Ver y sólo de este workspace; devuelve id → URL.
 */
export async function vistasPorIds(ctx: CtxGalerias, galeriaId: unknown, ids: unknown): Promise<Record<string, string>> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId) || !Array.isArray(ids) || ids.length === 0 || ids.length > 20 || !ids.every(idValido)) return {};
  const filas = await prisma.fotofficeGaleriaFoto.findMany({
    where: { galeriaId, workspaceId: ctx.workspaceId, status: "LISTA", id: { in: ids as string[] } },
    select: { id: true, viewKey: true },
  });
  const urls = await urlsDeLecturaPorLote(filas.map((f) => ({ id: f.id, viewKey: f.viewKey, thumbKey: null })));
  const salida: Record<string, string> = {};
  for (const f of filas) {
    const u = urls.get(f.id)?.viewUrl;
    if (u) salida[f.id] = u;
  }
  return salida;
}

// --- Borrar una foto dejando constancia -----------------------------------------------------------------

/**
 * Borra una foto (los tres archivos y la fila). Si estaba LISTA, queda en el historial junto con cuántas
 * selecciones de clientes se llevó puestas (la selección desaparece con la foto).
 */
export async function borrarFotoDeGaleria(ctx: CtxGalerias, galeriaId: unknown, fotoId: unknown): Promise<ResultadoSimpleGaleria> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId) || !idValido(fotoId)) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const foto = await prisma.fotofficeGaleriaFoto.findFirst({ where: { id: fotoId, galeriaId, workspaceId }, select: { id: true, status: true } });
  if (!foto) return no(M.fotoNoExiste);
  const selecciones = foto.status === "LISTA" ? await prisma.fotofficeGaleriaSeleccion.count({ where: { fotoId, workspaceId } }) : 0;
  const r = await borrarFoto(ctx, galeriaId, fotoId);
  if (!r.ok) return r;
  if (foto.status === "LISTA") {
    try {
      await registrarEvento(prisma, { workspaceId, galeriaId, tipo: "FOTO_BORRADA", actorUserId: ctx.userId, data: { selecciones } });
    } catch {
      // La foto ya se borró: el historial no puede deshacerlo.
    }
  }
  return { ok: true };
}
