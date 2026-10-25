import "server-only";
import { Prisma, prisma } from "@repo/db";
import { ID_VALIDO, claveDeParte, esPrefijoHlsDe, extensionDeMime, prefijoDeGrabacion, tipoContenido } from "../claves";
import { MINUTOS_SIN_SENAL_MAX, MINUTOS_SIN_SENAL_MIN, MINUTOS_SIN_SENAL_POR_DEFECTO } from "../constants";
import type { CtxDigitalizacion } from "../contexto";
import { leerFranjas, validarFranjas, type FranjaEnvio } from "../entrega";
import { nombreArchivoVideo, nombreCliente } from "../nombre-archivo";
import { estadoVisible, validarTitulo, type Cierre, type Latido, type NuevaGrabacion, type PedidoParte } from "../validar";
import { borrarPrefijo, tamanoDeParte, urlDeLecturaParte, urlDeSubidaParte, urlDeVideo as firmarVideo } from "./almacen";

export type Nada = Record<never, never>;
export type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string; definitivo?: boolean };

const NO_EXISTE = { ok: false as const, error: "No encontramos esa grabación.", definitivo: true };
const CERRADA = { ok: false as const, error: "Esa grabación ya está cerrada.", definitivo: true };
const CONVERTIDA = { ok: false as const, error: "Esa grabación ya se está convirtiendo o ya está convertida.", definitivo: true };
const EN_CURSO = { ok: false as const, error: "La grabación sigue en curso." };

async function grabacionDelNegocio(ctx: CtxDigitalizacion, id: string) {
  if (!ID_VALIDO.test(id)) return null;
  return prisma.digitalizacionGrabacion.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, workspaceId: true, estado: true, mimeType: true, tramos: true, tipo: true, proyectoId: true, calidad: true, corregirProporcion: true, ultimoLatidoAt: true, iniciadaAt: true, cassetteNumero: true, conversionEstado: true, partesBorradasAt: true, videoKey: true, hlsKey: true, videoBorradoAt: true, sinImagen: true, titulo: true },
  });
}

/** Nombre de descarga: usa el número del pedido y el cliente del trabajo (siempre dentro del negocio). */
async function nombreDeDescarga(ctx: CtxDigitalizacion, g: { proyectoId: string | null; titulo: string | null; tipo: string; cassetteNumero: number | null }, extension: string): Promise<string> {
  const p = g.proyectoId
    ? await prisma.fotofficeProyecto.findFirst({
        where: { id: g.proyectoId, workspaceId: ctx.workspaceId },
        select: { pedido: { select: { number: true } }, client: { select: { firstName: true, lastName: true, businessName: true } } },
      })
    : null;
  return nombreArchivoVideo(
    { pedidoNumero: p?.pedido?.number ?? null, clienteNombre: nombreCliente(p?.client), titulo: g.titulo, tipo: g.tipo === "DVD" ? "DVD" : "VHS", cassetteNumero: g.cassetteNumero },
    extension,
  );
}

/** Una vez que el worker tomó la grabación (o ya la convirtió, o borró las partes) no se aceptan partes nuevas. */
function sinPartesNuevas(g: { conversionEstado: string | null; partesBorradasAt: Date | null }): boolean {
  return g.conversionEstado === "PROCESANDO" || g.conversionEstado === "LISTA" || g.partesBorradasAt != null;
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
      titulo: g.titulo,
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
  // Tras "Terminar con lo grabado" (COMPLETA) pueden quedar partes en el navegador: se aceptan
  // mientras el tramo exista. Sólo una grabación DESCARTADA las rechaza.
  if (g.estado === "DESCARTADA") return CERRADA;
  if (sinPartesNuevas(g)) return CONVERTIDA;
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
    // createdAt = ahora: al pedir de nuevo, la parte cuenta como reciente para la espera de 30 min del worker.
    update: { bytes: BigInt(p.bytes), createdAt: new Date() },
  });
  const tipo = tipoContenido(ext);
  return { ok: true, yaEstaba: false, url: await urlDeSubidaParte(key, tipo, p.bytes), tipoContenido: tipo };
}

export async function confirmarParte(ctx: CtxDigitalizacion, p: Omit<PedidoParte, "bytes">): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, p.grabacionId);
  if (!g) return NO_EXISTE;
  if (g.estado === "DESCARTADA") return CERRADA;
  if (sinPartesNuevas(g)) return CONVERTIDA;
  if (p.tramo > g.tramos) return { ok: false, error: "Ese tramo no existe.", definitivo: true };
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

type PrevioLatido = { tramosSinSenal: unknown; sinImagen: boolean };

/**
 * La duración que informa el navegador es la del tramo actual. Para que la grabación muestre el
 * total, la duración de cada tramo se guarda como una entrada `clase: "DURACION"` dentro de
 * `tramosSinSenal` (no hay columna por tramo): el total es la suma de las de los tramos
 * anteriores (leídas de la fila antes de actualizar) más la del tramo actual.
 */
function datosDeLatido(l: Latido, tramoActual: number, previo: PrevioLatido | null) {
  const guardado = Array.isArray(previo?.tramosSinSenal) ? (previo!.tramosSinSenal as { tramo: number; clase?: string; hasta?: number }[]) : [];
  // Lo de tramos anteriores se conserva; lo del tramo actual se reemplaza.
  const anteriores = guardado.filter((t) => t.tramo !== tramoActual);
  const antes = anteriores.filter((t) => t.clase === "DURACION").reduce((n, t) => n + (t.hasta ?? 0), 0);
  const propia = { tramo: tramoActual, desde: 0, hasta: l.duracionSeg, clase: "DURACION" };
  return {
    duracionSeg: antes + l.duracionSeg,
    ...(tramoActual === 1
      ? { primeraImagenSeg: l.primeraImagenSeg, sinImagen: l.sinImagen }
      : { sinImagen: (previo?.sinImagen ?? true) && l.sinImagen }),
    ...(l.ultimaImagenSeg !== null ? { ultimaImagenSeg: l.ultimaImagenSeg, ultimaImagenTramo: tramoActual } : {}),
    tramosSinSenal: [...anteriores, ...l.tramosSinSenal.filter((t) => t.tramo === tramoActual), propia],
    ultimoLatidoAt: new Date(),
  };
}

export async function registrarLatido(ctx: CtxDigitalizacion, id: string, l: Latido): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (l.tramo !== g.tramos) return { ok: false, error: "Ese tramo ya no es el actual.", definitivo: true };
  const previo = await prisma.digitalizacionGrabacion.findFirst({ where: { id: g.id }, select: { tramosSinSenal: true, sinImagen: true } });
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: datosDeLatido(l, g.tramos, previo ?? null) });
  return { ok: true };
}

/** Un VHS sin imagen en toda la grabación no se convierte; todo lo demás entra a la cola. */
function estadoInicialDeConversion(tipo: string, sinImagen: boolean): "PENDIENTE" | "SIN_IMAGEN" {
  return tipo === "VHS" && sinImagen ? "SIN_IMAGEN" : "PENDIENTE";
}

export async function cerrarGrabacion(ctx: CtxDigitalizacion, id: string, c: Cierre): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (c.tramo !== g.tramos) return { ok: false, error: "Ese tramo ya no es el actual.", definitivo: true };
  const previo = await prisma.digitalizacionGrabacion.findFirst({ where: { id: g.id }, select: { tramosSinSenal: true, sinImagen: true } });
  const datos = datosDeLatido(c, g.tramos, previo ?? null);
  const sinImagenFinal = datos.sinImagen;
  await prisma.digitalizacionGrabacion.update({
    where: { id: g.id },
    data: { ...datos, estado: "COMPLETA", motivoFin: c.motivoFin, terminadaAt: new Date(), conversionEstado: estadoInicialDeConversion(g.tipo, sinImagenFinal) },
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
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (estadoVisible(g, new Date()) === "GRABANDO") return EN_CURSO;
  const r = await prisma.digitalizacionGrabacion.updateMany({
    where: { id: g.id, workspaceId: ctx.workspaceId, estado: "GRABANDO" },
    data: { estado: "COMPLETA", motivoFin: "TERMINADA_CON_LO_GRABADO", terminadaAt: new Date(), conversionEstado: estadoInicialDeConversion(g.tipo, g.sinImagen) },
  });
  return r.count === 1 ? { ok: true } : NO_EXISTE;
}

export async function descartarGrabacion(ctx: CtxDigitalizacion, id: string): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado === "GRABANDO" && estadoVisible(g, new Date()) === "GRABANDO") return EN_CURSO;
  if (g.conversionEstado === "PROCESANDO") return { ok: false as const, error: "La grabación se está convirtiendo." };
  try {
    await borrarPrefijo(prefijoDeGrabacion(ctx.workspaceId, g.id));
  } catch (e) {
    console.error("[digitalizacion] borrar prefijo falló", e instanceof Error ? e.name : "error");
    return { ok: false, error: "No pudimos borrar los archivos. Probá de nuevo." };
  }
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: { estado: "DESCARTADA", terminadaAt: new Date(), conversionEstado: null } });
  return { ok: true };
}

export async function urlsDeLectura(ctx: CtxDigitalizacion, id: string): Promise<Resultado<{ urls: string[]; nombre: string }>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado === "DESCARTADA") return CERRADA;
  if (g.partesBorradasAt) return { ok: false, error: "Los archivos crudos ya se borraron. Descargá el video final.", definitivo: true };
  const partes = await prisma.digitalizacionParte.findMany({
    where: { grabacionId: g.id, estado: "LISTA" },
    orderBy: [{ tramo: "asc" }, { indice: "asc" }],
    select: { key: true },
  });
  const urls = await Promise.all(partes.map((p) => urlDeLecturaParte(p.key)));
  return { ok: true, urls, nombre: await nombreDeDescarga(ctx, g, extensionDeMime(g.mimeType) ?? "bin") };
}

export async function reintentarConversion(ctx: CtxDigitalizacion, id: string): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  const r = await prisma.digitalizacionGrabacion.updateMany({
    where: { id: g.id, workspaceId: ctx.workspaceId, conversionEstado: "ERROR" },
    data: { conversionEstado: "PENDIENTE", conversionIntentos: 0, conversionError: null, conversionLockAt: null },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: "Esa grabación no está con error." };
}

export async function urlDeVideo(ctx: CtxDigitalizacion, id: string, modo: "ver" | "descargar"): Promise<Resultado<{ url: string }>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.conversionEstado !== "LISTA" || !g.videoKey || g.videoKey !== `${prefijoDeGrabacion(ctx.workspaceId, g.id)}final.mp4`) return { ok: false, error: "El video todavía no está listo." };
  const nombre = await nombreDeDescarga(ctx, g, "mp4");
  return { ok: true, url: await firmarVideo(g.videoKey, nombre, modo) };
}

/** "Ver video" de la lista (E10): la carpeta HLS de una grabación del negocio, si la tiene. */
export async function hlsDeGrabacion(ctx: CtxDigitalizacion, id: string): Promise<Resultado<{ hlsKey: string }>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.conversionEstado !== "LISTA" || g.videoBorradoAt || !g.hlsKey || !esPrefijoHlsDe(ctx.workspaceId, g.id, g.hlsKey)) {
    return { ok: false, error: "Esta grabación no tiene versión para mirar." };
  }
  return { ok: true, hlsKey: g.hlsKey };
}

export async function editarTitulo(ctx: CtxDigitalizacion, id: string, titulo: unknown): Promise<Resultado<{ titulo: string | null }>> {
  if (typeof titulo !== "string" && titulo !== null) return { ok: false, error: "El título no es válido.", definitivo: true };
  const t = validarTitulo(titulo);
  if (!t.ok) return { ok: false, error: "El título es demasiado largo (máximo 120 caracteres).", definitivo: true };
  if (!ID_VALIDO.test(id)) return NO_EXISTE;
  const r = await prisma.digitalizacionGrabacion.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { titulo: t.titulo } });
  return r.count === 1 ? { ok: true, titulo: t.titulo } : NO_EXISTE;
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

/** E11: "Enviar al cliente automáticamente al terminar" y las franjas de envío de cassettes. */
export async function guardarAjustesEntrega(ctx: CtxDigitalizacion, envioAutomatico: unknown, franjas: unknown): Promise<Resultado<{ franjas: FranjaEnvio[] }>> {
  if (typeof envioAutomatico !== "boolean") return { ok: false, error: "Los datos no son válidos." };
  const f = validarFranjas(franjas);
  if (!f.ok) return f;
  // Sin franjas = "a coordinar": se guarda null, como dice el esquema.
  const enviosFranjas = f.franjas.length ? f.franjas : Prisma.DbNull;
  await prisma.digitalizacionAjustes.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId, envioAutomatico, enviosFranjas },
    update: { envioAutomatico, enviosFranjas },
  });
  return { ok: true, franjas: f.franjas };
}

export async function leerAjustes(workspaceId: string): Promise<{ minutosSinSenal: number; envioAutomatico: boolean; franjas: FranjaEnvio[] }> {
  const a = await prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { minutosSinSenal: true, envioAutomatico: true, enviosFranjas: true } });
  return {
    minutosSinSenal: a?.minutosSinSenal ?? MINUTOS_SIN_SENAL_POR_DEFECTO,
    envioAutomatico: a?.envioAutomatico ?? true,
    franjas: leerFranjas(a?.enviosFranjas ?? null),
  };
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
      id: true, titulo: true, tipo: true, estado: true, motivoFin: true, cassetteNumero: true, duracionSeg: true, bytesSubidos: true,
      tramos: true, ultimoLatidoAt: true, iniciadaAt: true, sinImagen: true, mimeType: true,
      conversionEstado: true, conversionError: true, videoBytes: true, videoDuracionSeg: true, partesBorradasAt: true, hlsKey: true, videoBorradoAt: true,
      proyecto: { select: { number: true, name: true, pedido: { select: { number: true } }, client: { select: { firstName: true, lastName: true, businessName: true } } } },
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
