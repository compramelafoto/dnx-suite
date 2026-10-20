import "server-only";
import { prisma } from "@repo/db";
import { ID_VALIDO, claveDeParte, extensionDeMime, prefijoDeGrabacion, tipoContenido } from "../claves";
import { MINUTOS_SIN_SENAL_MAX, MINUTOS_SIN_SENAL_MIN, MINUTOS_SIN_SENAL_POR_DEFECTO } from "../constants";
import type { CtxDigitalizacion } from "../contexto";
import type { Cierre, Latido, NuevaGrabacion, PedidoParte } from "../validar";
import { borrarPrefijo, tamanoDeParte, urlDeLecturaParte, urlDeSubidaParte } from "./almacen";

export type Nada = Record<never, never>;
export type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string; definitivo?: boolean };

const NO_EXISTE = { ok: false as const, error: "No encontramos esa grabación.", definitivo: true };
const CERRADA = { ok: false as const, error: "Esa grabación ya está cerrada.", definitivo: true };

async function grabacionDelNegocio(ctx: CtxDigitalizacion, id: string) {
  if (!ID_VALIDO.test(id)) return null;
  return prisma.digitalizacionGrabacion.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, workspaceId: true, estado: true, mimeType: true, tramos: true, tipo: true, proyectoId: true, cassetteNumero: true, calidad: true, corregirProporcion: true },
  });
}

export async function crearGrabacion(ctx: CtxDigitalizacion, g: NuevaGrabacion): Promise<Resultado<{ id: string; tramo: number }>> {
  if (g.proyectoId) {
    const p = await prisma.fotofficeProyecto.findFirst({ where: { id: g.proyectoId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!p) return { ok: false, error: "No encontramos ese trabajo." };
  }
  if (g.equipoId) {
    const e = await prisma.digitalizacionEquipo.findFirst({ where: { id: g.equipoId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!e) return { ok: false, error: "No encontramos ese equipo." };
  }
  const creada = await prisma.digitalizacionGrabacion.create({
    data: {
      workspaceId: ctx.workspaceId,
      proyectoId: g.proyectoId,
      cassetteNumero: g.cassetteNumero,
      tipo: g.tipo,
      mimeType: g.mimeType,
      calidad: g.calidad,
      corregirProporcion: g.corregirProporcion,
      equipoId: g.equipoId,
      dvdArchivos: g.dvdArchivos ?? undefined,
      ultimoLatidoAt: new Date(),
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  });
  return { ok: true, id: creada.id, tramo: 1 };
}

export async function pedirParte(
  ctx: CtxDigitalizacion,
  p: PedidoParte,
): Promise<Resultado<{ yaEstaba: true } | { yaEstaba: false; url: string; tipoContenido: string }>> {
  const g = await grabacionDelNegocio(ctx, p.grabacionId);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (p.tramo > g.tramos) return { ok: false, error: "Ese tramo no existe.", definitivo: true };
  const ext = extensionDeMime(g.mimeType);
  if (!ext) return { ok: false, error: "Formato no válido.", definitivo: true };
  const existente = await prisma.digitalizacionParte.findUnique({
    where: { grabacionId_tramo_indice: { grabacionId: g.id, tramo: p.tramo, indice: p.indice } },
    select: { estado: true },
  });
  if (existente?.estado === "LISTA") return { ok: true, yaEstaba: true };
  const key = claveDeParte({ workspaceId: ctx.workspaceId, grabacionId: g.id, tramo: p.tramo, indice: p.indice, extension: ext });
  await prisma.digitalizacionParte.upsert({
    where: { grabacionId_tramo_indice: { grabacionId: g.id, tramo: p.tramo, indice: p.indice } },
    create: { grabacionId: g.id, tramo: p.tramo, indice: p.indice, key, bytes: BigInt(p.bytes) },
    update: { bytes: BigInt(p.bytes) },
  });
  const tipo = tipoContenido(ext);
  return { ok: true, yaEstaba: false, url: await urlDeSubidaParte(key, tipo, p.bytes), tipoContenido: tipo };
}

export async function confirmarParte(ctx: CtxDigitalizacion, p: Omit<PedidoParte, "bytes">): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, p.grabacionId);
  if (!g) return NO_EXISTE;
  const parte = await prisma.digitalizacionParte.findUnique({
    where: { grabacionId_tramo_indice: { grabacionId: g.id, tramo: p.tramo, indice: p.indice } },
    select: { id: true, key: true, bytes: true, estado: true },
  });
  if (!parte) return { ok: false, error: "No encontramos esa parte." };
  if (parte.estado === "LISTA") return { ok: true };
  const tamano = await tamanoDeParte(parte.key);
  if (tamano === null || BigInt(tamano) !== parte.bytes) return { ok: false, error: "La parte no llegó completa." };
  await prisma.$transaction(async (tx) => {
    const r = await tx.digitalizacionParte.updateMany({ where: { id: parte.id, estado: "PENDIENTE" }, data: { estado: "LISTA" } });
    if (r.count === 1) {
      await tx.digitalizacionGrabacion.update({ where: { id: g.id }, data: { bytesSubidos: { increment: parte.bytes }, partesListas: { increment: 1 } } });
    }
  });
  return { ok: true };
}

function datosDeLatido(l: Latido, tramoActual: number, previo: unknown) {
  // Los tramos sin señal de tramos anteriores se conservan; los del tramo actual se reemplazan.
  const anteriores = Array.isArray(previo) ? (previo as { tramo: number }[]).filter((t) => t.tramo !== tramoActual) : [];
  return {
    duracionSeg: l.duracionSeg,
    ...(tramoActual === 1 ? { primeraImagenSeg: l.primeraImagenSeg, sinImagen: l.sinImagen } : {}),
    ...(l.ultimaImagenSeg !== null ? { ultimaImagenSeg: l.ultimaImagenSeg, ultimaImagenTramo: tramoActual } : {}),
    tramosSinSenal: [...anteriores, ...l.tramosSinSenal.filter((t) => t.tramo === tramoActual)],
    ultimoLatidoAt: new Date(),
  };
}

export async function registrarLatido(ctx: CtxDigitalizacion, id: string, l: Latido): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (l.tramo !== g.tramos) return { ok: false, error: "Ese tramo ya no es el actual.", definitivo: true };
  const previo = await prisma.digitalizacionGrabacion.findFirst({ where: { id: g.id }, select: { tramosSinSenal: true } });
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: datosDeLatido(l, g.tramos, previo?.tramosSinSenal) });
  return { ok: true };
}

export async function cerrarGrabacion(ctx: CtxDigitalizacion, id: string, c: Cierre): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (c.tramo !== g.tramos) return { ok: false, error: "Ese tramo ya no es el actual.", definitivo: true };
  const previo = await prisma.digitalizacionGrabacion.findFirst({ where: { id: g.id }, select: { tramosSinSenal: true } });
  await prisma.digitalizacionGrabacion.update({
    where: { id: g.id },
    data: { ...datosDeLatido(c, g.tramos, previo?.tramosSinSenal), estado: "COMPLETA", motivoFin: c.motivoFin, terminadaAt: new Date() },
  });
  return { ok: true };
}

export async function continuarGrabacion(ctx: CtxDigitalizacion, id: string) {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  // Un DVD se retoma en el mismo tramo: las partes ya LISTAS se saltean solas.
  const tramo = g.tipo === "DVD" ? 1 : g.tramos + 1;
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: { tramos: tramo, ultimoLatidoAt: new Date() } });
  return {
    ok: true as const,
    tramo,
    tipo: g.tipo as "VHS" | "DVD",
    proyectoId: g.proyectoId,
    cassetteNumero: g.cassetteNumero,
    calidad: g.calidad,
    corregirProporcion: g.corregirProporcion,
  };
}

export async function terminarConLoGrabado(ctx: CtxDigitalizacion, id: string): Promise<Resultado<Nada>> {
  if (typeof id !== "string" || !ID_VALIDO.test(id)) return NO_EXISTE;
  const r = await prisma.digitalizacionGrabacion.updateMany({
    where: { id, workspaceId: ctx.workspaceId, estado: "GRABANDO" },
    data: { estado: "COMPLETA", motivoFin: "TERMINADA_CON_LO_GRABADO", terminadaAt: new Date() },
  });
  return r.count === 1 ? { ok: true } : NO_EXISTE;
}

export async function descartarGrabacion(ctx: CtxDigitalizacion, id: string): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  try {
    await borrarPrefijo(prefijoDeGrabacion(ctx.workspaceId, g.id));
  } catch (e) {
    console.error("[digitalizacion] borrar prefijo falló", e instanceof Error ? e.name : "error");
    return { ok: false, error: "No pudimos borrar los archivos. Probá de nuevo." };
  }
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: { estado: "DESCARTADA", terminadaAt: new Date() } });
  return { ok: true };
}

export async function urlsDeLectura(ctx: CtxDigitalizacion, id: string): Promise<Resultado<{ urls: string[]; nombre: string }>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  const partes = await prisma.digitalizacionParte.findMany({
    where: { grabacionId: g.id, estado: "LISTA" },
    orderBy: [{ tramo: "asc" }, { indice: "asc" }],
    select: { key: true },
  });
  const urls = await Promise.all(partes.map((p) => urlDeLecturaParte(p.key)));
  return { ok: true, urls, nombre: `grabacion-${g.id}.${extensionDeMime(g.mimeType) ?? "bin"}` };
}

export async function buscarTrabajos(ctx: CtxDigitalizacion, q: string) {
  const texto = q.trim().slice(0, 60);
  const trabajos = await prisma.fotofficeProyecto.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(texto ? { OR: [{ number: { contains: texto } }, { name: { contains: texto, mode: "insensitive" as const } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, number: true, name: true },
  });
  return { ok: true as const, trabajos: trabajos.map((t) => ({ id: t.id, numero: t.number, nombre: t.name })) };
}

export async function guardarEquipo(ctx: CtxDigitalizacion, x: unknown): Promise<Resultado<{ id: string }>> {
  if (typeof x !== "object" || x === null) return { ok: false, error: "Los datos no son válidos." };
  const { etiqueta, huellaSinSenal, corregirProporcion } = x as Record<string, unknown>;
  if (typeof etiqueta !== "string" || etiqueta.length < 1 || etiqueta.length > 200) return { ok: false, error: "Los datos no son válidos." };
  if (typeof corregirProporcion !== "boolean") return { ok: false, error: "Los datos no son válidos." };
  const huellaOk = huellaSinSenal === null || (Array.isArray(huellaSinSenal) && huellaSinSenal.length === 144 && huellaSinSenal.every((n) => typeof n === "number" && n >= 0 && n <= 255));
  if (!huellaOk) return { ok: false, error: "Los datos no son válidos." };
  const e = await prisma.digitalizacionEquipo.upsert({
    where: { workspaceId_etiqueta: { workspaceId: ctx.workspaceId, etiqueta } },
    create: { workspaceId: ctx.workspaceId, etiqueta, huellaSinSenal: huellaSinSenal ?? undefined, corregirProporcion },
    update: { ...(huellaSinSenal ? { huellaSinSenal } : {}), corregirProporcion },
    select: { id: true },
  });
  return { ok: true, id: e.id };
}

export async function guardarAjustes(ctx: CtxDigitalizacion, minutos: number): Promise<Resultado<Nada>> {
  if (!Number.isInteger(minutos) || minutos < MINUTOS_SIN_SENAL_MIN || minutos > MINUTOS_SIN_SENAL_MAX) {
    return { ok: false, error: `Elegí entre ${MINUTOS_SIN_SENAL_MIN} y ${MINUTOS_SIN_SENAL_MAX} minutos.` };
  }
  await prisma.digitalizacionAjustes.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId, minutosSinSenal: minutos },
    update: { minutosSinSenal: minutos },
  });
  return { ok: true };
}

export async function leerAjustes(workspaceId: string): Promise<{ minutosSinSenal: number }> {
  const a = await prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { minutosSinSenal: true } });
  return { minutosSinSenal: a?.minutosSinSenal ?? MINUTOS_SIN_SENAL_POR_DEFECTO };
}

export async function listarEquipos(workspaceId: string) {
  const equipos = await prisma.digitalizacionEquipo.findMany({
    where: { workspaceId },
    select: { id: true, etiqueta: true, huellaSinSenal: true, corregirProporcion: true },
  });
  return equipos.map((e) => ({ ...e, huellaSinSenal: Array.isArray(e.huellaSinSenal) ? (e.huellaSinSenal as number[]) : null }));
}

export async function listarGrabaciones(workspaceId: string) {
  return prisma.digitalizacionGrabacion.findMany({
    where: { workspaceId, estado: { not: "DESCARTADA" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, tipo: true, estado: true, motivoFin: true, cassetteNumero: true, duracionSeg: true, bytesSubidos: true,
      tramos: true, ultimoLatidoAt: true, iniciadaAt: true, sinImagen: true,
      proyecto: { select: { number: true, name: true } },
    },
  });
}

/** Lo que necesita la estación para retomar una grabación que sigue abierta (null si no es del negocio o ya cerró). */
export async function leerGrabacionParaContinuar(workspaceId: string, id: string) {
  if (!ID_VALIDO.test(id)) return null;
  return prisma.digitalizacionGrabacion.findFirst({
    where: { id, workspaceId, estado: "GRABANDO" },
    select: {
      id: true, tipo: true, cassetteNumero: true, calidad: true, mimeType: true, corregirProporcion: true,
      tramos: true, duracionSeg: true, partesListas: true, proyectoId: true, equipoId: true, dvdArchivos: true,
      proyecto: { select: { number: true, name: true } },
    },
  });
}
