import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { appUrl } from "@/lib/app-url";
import { checkRateLimit } from "@/lib/geocode/rate-limit";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { asignarNumero } from "@/lib/numeracion/asignar";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { GALLERY_MODULE_KEY, MENSAJES_GALERIA as M } from "./acceso";
import { autenticarDispositivo, type CtxDispositivo } from "./dispositivos";
import { MAX_INTENTOS_FOTO, MAX_NOMBRE_GALERIA, medioDeTipo, tamanoMaximoDe } from "./constantes";
import { borrarObjetoFoto, urlDeSubidaFoto } from "./almacen";
import { registrarEvento } from "./eventos";
import { confirmarFotoDeDispositivo, nombreLimpio as nombreDeArchivo, pedirSubidaFotoDeDispositivo } from "./fotos";

/**
 * API de DNX FLUX (`/api/flux/v1/*`): la lógica de cada ruta. Todo se acota al workspace de la clave del
 * dispositivo, las respuestas son JSON con mensajes en español y nunca se loguean datos personales.
 * El contrato HTTP está fijado por el cliente de DNX FLUX (`dnxflux/fotoffice.py`).
 */

export const MAX_ARCHIVOS_POR_PEDIDO = 50;
export const TOPE_PEDIDOS_POR_MINUTO = 120;
const MINUTO = 60_000;
/** Para buscar por nombre o código externo hace falta un número de al menos 4 caracteres: "1" no tiene que traer medio estudio. */
const MIN_BUSQUEDA_AMPLIA = 4;
const MAX_PEDIDO = 40;
const MAX_PROYECTOS = 20;

export const MENSAJES_FLUX = {
  claveInvalida: "Clave inválida o anulada",
  moduloApagado: "El módulo Galería no está encendido",
  freno: "Demasiados pedidos seguidos. Esperá un momento y reintentá.",
  datos: "Los datos no son válidos.",
  galeria: M.noExiste,
  proyecto: M.proyecto,
  archivos: `Mandá entre 1 y ${MAX_ARCHIVOS_POR_PEDIDO} archivos por pedido.`,
  error: "No pudimos completar el pedido. Reintentá en un momento.",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function respuestaJson(cuerpo: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: { ...NO_STORE, ...headers } });
}
const fallo = (error: string, status: number, headers: Record<string, string> = {}) => respuestaJson({ error }, status, headers);

/** Clave → dispositivo (401), freno por dispositivo (429 + Retry-After) y módulo `gallery` encendido (403). */
export async function autorizarFlux(request: Request): Promise<{ ctx: CtxDispositivo } | { respuesta: NextResponse }> {
  const ctx = await autenticarDispositivo(request.headers.get("authorization"));
  if (!ctx) return { respuesta: fallo(MENSAJES_FLUX.claveInvalida, 401, { "WWW-Authenticate": "Bearer" }) };
  const freno = checkRateLimit({ key: `flux:${ctx.deviceId}`, limit: TOPE_PEDIDOS_POR_MINUTO, windowMs: MINUTO });
  if (!freno.allowed) {
    const espera = Math.max(1, Math.ceil((freno.resetAt - Date.now()) / 1000));
    return { respuesta: fallo(MENSAJES_FLUX.freno, 429, { "Retry-After": String(espera) }) };
  }
  if (!(await isModuleEnabledForWorkspace(ctx.workspaceId, GALLERY_MODULE_KEY))) return { respuesta: fallo(MENSAJES_FLUX.moduloApagado, 403) };
  return { ctx };
}

export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await request.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const idValido = (v: unknown): v is string => typeof v === "string" && ID.test(v);

function fechaIso(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// --- GET proyectos ---------------------------------------------------------------------------------

export type ProyectoFlux = { id: string; nombre: string; cliente: string; fecha: string | null; tipo: string };

/**
 * Proyectos del pedido `numero`. DNX FLUX manda el número que conoce (el del CRM/Alboom). Se busca, en
 * este orden y acotado al workspace: (1) el pedido de FOTOFFICE cuyo `number` es exactamente ese y sus
 * proyectos; (2) si no hay, los proyectos cuyo `externalId` es exactamente ese número; (3) si tampoco, los
 * proyectos cuyo nombre contiene el número (sólo con 4 caracteres o más). Sin coincidencias, lista vacía
 * (también para "0" y para un número vacío o demasiado largo: es lo que usa «Probar conexión»).
 */
export async function proyectosDePedido(workspaceId: string, pedido: unknown): Promise<ProyectoFlux[]> {
  const n = typeof pedido === "string" ? pedido.trim() : "";
  if (n.length === 0 || n.length > MAX_PEDIDO || n === "0") return [];
  const select = {
    id: true, name: true, eventDate: true, baseDate: true,
    client: { select: { firstName: true, lastName: true, businessName: true } },
    product: { select: { name: true } },
    circuit: { select: { name: true } },
  } as const;
  const orderBy = [{ createdAt: "asc" as const }, { id: "asc" as const }];
  let filas = await prisma.fotofficeProyecto.findMany({ where: { workspaceId, pedido: { workspaceId, number: n } }, orderBy, take: MAX_PROYECTOS, select });
  if (filas.length === 0) filas = await prisma.fotofficeProyecto.findMany({ where: { workspaceId, externalId: n }, orderBy, take: MAX_PROYECTOS, select });
  if (filas.length === 0 && n.length >= MIN_BUSQUEDA_AMPLIA) {
    filas = await prisma.fotofficeProyecto.findMany({ where: { workspaceId, name: { contains: n, mode: "insensitive" } }, orderBy, take: MAX_PROYECTOS, select });
  }
  return filas.map((p) => ({
    id: p.id,
    nombre: p.name,
    cliente: nombreDeContacto(p.client),
    fecha: fechaIso(p.eventDate ?? p.baseDate),
    tipo: p.product?.name ?? p.circuit.name,
  }));
}

// --- POST galerias ---------------------------------------------------------------------------------

/**
 * La galería de entrega de un proyecto: la que ya tiene (no archivada) o una nueva en BORRADOR. Una por
 * proyecto. Si dos pedidos llegan exactamente a la vez podrían crearse dos; DNX FLUX pide de a uno.
 */
export async function galeriaDeEntregaParaProyecto(
  ctx: CtxDispositivo,
  proyectoId: unknown,
  nombre: unknown,
  ahora: Date = new Date(),
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  if (!idValido(proyectoId)) return { ok: false, error: MENSAJES_FLUX.datos, status: 400 };
  if (nombre !== undefined && nombre !== null && typeof nombre !== "string") return { ok: false, error: MENSAJES_FLUX.datos, status: 400 };
  const { workspaceId } = ctx;
  const proyecto = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId }, select: { id: true, name: true, ownerUserId: true } });
  if (!proyecto) return { ok: false, error: MENSAJES_FLUX.proyecto, status: 404 };
  const existente = await prisma.fotofficeGaleria.findFirst({
    where: { workspaceId, proyectoId: proyecto.id, kind: "ENTREGA", NOT: { status: "ARCHIVADA" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (existente) return { ok: true, id: existente.id };
  const pedido = typeof nombre === "string" ? nombre.replace(/\s+/g, " ").trim() : "";
  const nombreGaleria = (pedido.length > 0 ? pedido : proyecto.name.replace(/\s+/g, " ").trim()).slice(0, MAX_NOMBRE_GALERIA);
  if (nombreGaleria.length === 0) return { ok: false, error: M.nombreGaleria, status: 400 };
  const id = randomUUID();
  try {
    await prisma.$transaction(async (tx) => {
      const numero = await asignarNumero(tx, { workspaceId, key: "GALERIA", entityType: "GALERIA", entityId: id, fecha: ahora });
      await tx.fotofficeGaleria.create({
        data: {
          id, workspaceId, proyectoId: proyecto.id, number: numero.display, name: nombreGaleria, kind: "ENTREGA", saleMode: "SELECCION",
          message: null, selectionMode: "LIBRE", minSelect: null, maxSelect: null, allowComments: false, downloadMode: "SELECCIONADAS",
          status: "BORRADOR", orderMode: "NOMBRE", ownerUserId: proyecto.ownerUserId ?? null, createdByUserId: null,
        },
        select: { id: true },
      });
      await registrarEvento(tx, { workspaceId, galeriaId: id, tipo: "GALERIA_CREADA", actorUserId: null, data: { tipo: "ENTREGA", dispositivoId: ctx.deviceId } });
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    console.error("[flux] crear galería falló", { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
    return { ok: false, error: MENSAJES_FLUX.error, status: 503 };
  }
  return { ok: true, id };
}

/** URL absoluta a la ficha de la galería en el estudio. Si no hay dirección configurada se usa la del pedido. */
export function enlaceDeEstudio(request: Request, galeriaId: string): string {
  const base = appUrl() || new URL(request.url).origin;
  return `${base}/galerias/${galeriaId}`;
}

// --- Archivos ---------------------------------------------------------------------------------------

export type ArchivoPedido = { nombre: string; tipo: string; tamano: number };
export type ItemSubida = { yaEstaba: true } | { fotoId: string; urlSubida: string };

/** Valida el lote completo antes de crear nada: o todos sirven, o ninguno. Devuelve el mensaje del primer problema. */
export function validarArchivos(v: unknown): { ok: true; archivos: ArchivoPedido[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_ARCHIVOS_POR_PEDIDO) return { ok: false, error: MENSAJES_FLUX.archivos };
  const archivos: ArchivoPedido[] = [];
  for (const a of v as unknown[]) {
    if (!a || typeof a !== "object") return { ok: false, error: MENSAJES_FLUX.datos };
    const { nombre, tipo, tamano } = a as Record<string, unknown>;
    const n = nombreDeArchivo(nombre);
    if (!n) return { ok: false, error: M.nombre };
    const medio = medioDeTipo(tipo);
    if (!medio) return { ok: false, error: `${n}: ${M.tipo}` };
    if (typeof tamano !== "number" || !Number.isInteger(tamano) || tamano <= 0 || tamano > tamanoMaximoDe(medio)) {
      return { ok: false, error: `${n}: ${medio === "VIDEO" ? M.tamanoVideo : M.tamano}` };
    }
    archivos.push({ nombre: n, tipo: tipo as string, tamano });
  }
  return { ok: true, archivos };
}

/** ¿La galería existe en este workspace y es de entrega? (Las de selección no se tocan desde DNX FLUX.) */
export async function galeriaDeEntrega(workspaceId: string, galeriaId: unknown) {
  if (!idValido(galeriaId)) return null;
  return prisma.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId, kind: "ENTREGA" }, select: { id: true, status: true } });
}

/**
 * Por cada archivo, en el mismo orden: `{ yaEstaba }` si ya hay uno LISTA con ese nombre; una URL firmada
 * nueva para la misma fila si existe una PENDIENTE o en ERROR reintentable (no se duplica); o una fila
 * nueva con su URL. Una fila en ERROR definitivo se descarta y se vuelve a crear. Si el mismo nombre viene
 * dos veces en el lote, la segunda vez se resuelve contra lo que acaba de pasar con la primera.
 */
export async function pedirSubidasDeDispositivo(
  ctx: CtxDispositivo,
  galeriaId: string,
  archivos: ArchivoPedido[],
): Promise<{ ok: true; items: ItemSubida[]; nuevos: number } | { ok: false; error: string; status: number }> {
  const { workspaceId } = ctx;
  const filas = await prisma.fotofficeGaleriaFoto.findMany({
    where: { galeriaId, workspaceId, fileName: { in: archivos.map((a) => a.nombre) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, fileName: true, status: true, attempts: true, originalKey: true },
  });
  type Fila = (typeof filas)[number];
  const porNombre = new Map<string, Fila[]>();
  for (const f of filas) porNombre.set(f.fileName, [...(porNombre.get(f.fileName) ?? []), f]);
  const items: ItemSubida[] = [];
  const resueltos = new Map<string, ItemSubida>();
  let nuevos = 0;
  for (const a of archivos) {
    const previo = resueltos.get(a.nombre);
    if (previo) {
      items.push(previo);
      continue;
    }
    const mias = porNombre.get(a.nombre) ?? [];
    let item: ItemSubida | null = null;
    if (mias.some((f) => f.status === "LISTA")) {
      item = { yaEstaba: true };
    } else {
      const reintentable = mias.find((f) => f.status === "PENDIENTE" || (f.status === "ERROR" && f.attempts < MAX_INTENTOS_FOTO));
      if (reintentable) {
        try {
          const urlSubida = await urlDeSubidaFoto(reintentable.originalKey, a.tipo, a.tamano);
          // Mismo archivo, quizá con otro tamaño o tipo: la fila queda con lo que se va a subir ahora.
          await prisma.fotofficeGaleriaFoto.updateMany({
            where: { id: reintentable.id, workspaceId, status: { in: ["PENDIENTE", "ERROR"] } },
            data: { sizeBytes: BigInt(a.tamano), contentType: a.tipo, mediaType: medioDeTipo(a.tipo) ?? "FOTO" },
          });
          item = { fotoId: reintentable.id, urlSubida };
        } catch {
          return { ok: false, error: MENSAJES_FLUX.error, status: 503 };
        }
      }
    }
    if (!item) {
      // ERROR definitivo: se limpia la fila vieja y se arma una nueva.
      for (const f of mias.filter((x) => x.status === "ERROR")) {
        await borrarObjetoFoto(f.originalKey).catch(() => undefined);
        await prisma.fotofficeGaleriaFoto.deleteMany({ where: { id: f.id, workspaceId, galeriaId } });
      }
      const r = await pedirSubidaFotoDeDispositivo(workspaceId, galeriaId, a);
      if (!r.ok) {
        // 503 (reintentable) sólo si falló la firma; el resto son topes o datos: no se reintentan.
        return { ok: false, error: r.error, status: r.error === M.preparar ? 503 : 409 };
      }
      nuevos += 1;
      item = { fotoId: r.id, urlSubida: r.url };
    }
    resueltos.set(a.nombre, item);
    items.push(item);
  }
  if (nuevos > 0) {
    try {
      await registrarEvento(prisma, { workspaceId, galeriaId, tipo: "ARCHIVOS_PEDIDOS_DISPOSITIVO", actorUserId: null, data: { dispositivoId: ctx.deviceId, cantidad: nuevos } });
    } catch {
      /* el historial no puede tumbar la subida */
    }
  }
  return { ok: true, items, nuevos };
}

/** Confirma y procesa un archivo. 200 si quedó LISTA; 409 si la subida no llegó; 422 si no se pudo procesar. */
export async function confirmarArchivoDeDispositivo(
  ctx: CtxDispositivo,
  galeriaId: string,
  fotoId: unknown,
): Promise<{ status: number; cuerpo: Record<string, unknown> }> {
  if (!idValido(fotoId)) return { status: 400, cuerpo: { error: MENSAJES_FLUX.datos } };
  const r = await confirmarFotoDeDispositivo(ctx.workspaceId, galeriaId, fotoId);
  if (r.ok) return { status: 200, cuerpo: { ok: true, estado: "LISTA" } };
  if (r.error === M.fotoNoExiste) return { status: 404, cuerpo: { error: r.error } };
  if (r.error === M.subidaIncompleta) return { status: 409, cuerpo: { ok: false, estado: "PENDIENTE", error: r.error } };
  if (r.error === M.verificar) return { status: 503, cuerpo: { error: r.error } };
  return { status: 422, cuerpo: { ok: false, estado: "ERROR", error: r.error } };
}

/** Conteos por estado de la galería (para el reintento de DNX FLUX). */
export async function estadoDeGaleria(workspaceId: string, galeriaId: string): Promise<{ id: string; estado: string; conteos: { LISTA: number; PENDIENTE: number; ERROR: number } } | null> {
  const g = await galeriaDeEntrega(workspaceId, galeriaId);
  if (!g) return null;
  const grupos = await prisma.fotofficeGaleriaFoto.groupBy({ by: ["status"], where: { galeriaId: g.id, workspaceId }, _count: { _all: true } });
  const conteos = { LISTA: 0, PENDIENTE: 0, ERROR: 0 };
  for (const x of grupos) if (x.status === "LISTA" || x.status === "PENDIENTE" || x.status === "ERROR") conteos[x.status] = x._count._all;
  return { id: g.id, estado: g.status, conteos };
}

export { fallo as falloFlux };
