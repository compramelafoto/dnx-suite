import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, puedeVerPedidos, type CtxPedidos } from "./acceso";
import { puedeConfigurarPedidos } from "./ajustes";
import { bloquearPedido } from "./plan";
import {
  MAX_TAREAS_PEDIDO,
  MENSAJES_CHECKLIST,
  leerPlantillas,
  validarPlantillas,
  validarTituloTarea,
  type PlantillaChecklist,
} from "./checklist-plantillas";

export * from "./checklist-plantillas";

/**
 * Checklist del pedido (Entrega B1, Task 5): las plantillas se guardan en
 * `FotofficePedidoAjustes.checklistTemplates` (JSON validado por `./checklist-plantillas.ts`) y se
 * copian al pedido (`FotofficePedidoTarea`) al confirmarlo o al aplicar una plantilla a mano.
 *
 * - Leer: "Ver" en Pedidos. Escribir (tildar, agregar, quitar, aplicar): "Gestionar". Editar las
 *   plantillas: `configurar`.
 * - Cada id (pedido, tarea) se busca DENTRO del workspace de la sesión y del pedido.
 * - Tildar es idempotente: si ya estaba hecha conserva el quién y el cuándo originales.
 * - Un pedido cancelado no se toca.
 *
 * Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;
type Resultado = { ok: true } | { ok: false; error: string };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function falla(donde: string, error: unknown): void {
  const e = error as { code?: unknown } | null;
  console.error(`[pedidos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

// --- Plantillas (Configuración → Pedidos) --------------------------------------------------------

type LectorPlantillas = Pick<Tx, "fotofficePedidoAjustes">;

/** Las plantillas de la organización (vacío si no hay fila o el JSON no sirve). */
export async function leerPlantillasChecklist(cliente: LectorPlantillas, workspaceId: string): Promise<PlantillaChecklist[]> {
  const a = await cliente.fotofficePedidoAjustes.findUnique({ where: { workspaceId }, select: { checklistTemplates: true } });
  return leerPlantillas(a?.checklistTemplates);
}

/**
 * Guarda TODAS las plantillas (reemplazo completo). Exige `configurar`. Valida topes y nombres en
 * el servidor; no toca el recordatorio ni el rubro.
 */
export async function guardarPlantillasChecklist(ctx: CtxPedidos, datos: unknown): Promise<Resultado> {
  if (!puedeConfigurarPedidos(ctx)) return { ok: false, error: MENSAJES_CHECKLIST.sinPermiso };
  const v = validarPlantillas(datos);
  if (!v.ok) return v;
  const valor = v.valor as unknown as Prisma.InputJsonValue;
  try {
    await prisma.fotofficePedidoAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, checklistTemplates: valor },
      update: { checklistTemplates: valor },
      select: { id: true },
    });
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code !== "P2002") {
      falla("guardarPlantillasChecklist", e);
      return { ok: false, error: MENSAJES_CHECKLIST.fallo };
    }
    await prisma.fotofficePedidoAjustes.updateMany({ where: { workspaceId: ctx.workspaceId }, data: { checklistTemplates: valor } });
  }
  return { ok: true };
}

/**
 * Qué plantilla se copia al crear un pedido: `undefined` = la primera (si hay), `null` = ninguna
 * ("Sin checklist"), un texto = la plantilla con ese nombre (si no existe, error).
 */
export async function titulosParaPedidoNuevo(
  cliente: LectorPlantillas,
  workspaceId: string,
  seleccion: unknown,
): Promise<{ ok: true; titulos: string[] } | { ok: false; error: string }> {
  if (seleccion === null) return { ok: true, titulos: [] };
  if (seleccion !== undefined && typeof seleccion !== "string") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const plantillas = await leerPlantillasChecklist(cliente, workspaceId);
  if (seleccion === undefined) return { ok: true, titulos: plantillas[0]?.tasks ?? [] };
  const elegida = plantillas.find((p) => p.name === seleccion);
  if (!elegida) return { ok: false, error: MENSAJES_CHECKLIST.plantillaNoExiste };
  return { ok: true, titulos: elegida.tasks };
}

/** Copia las tareas a un pedido recién creado (posiciones desde 1), dentro de su transacción. */
export async function copiarTareasAlPedido(
  tx: Pick<Tx, "fotofficePedidoTarea">,
  d: { workspaceId: string; pedidoId: string; titulos: readonly string[]; desde?: number },
): Promise<number> {
  if (d.titulos.length === 0) return 0;
  const desde = d.desde ?? 1;
  await tx.fotofficePedidoTarea.createMany({
    data: d.titulos.map((title, i) => ({ workspaceId: d.workspaceId, pedidoId: d.pedidoId, position: desde + i, title })),
  });
  return d.titulos.length;
}

// --- Checklist de un pedido ----------------------------------------------------------------------

export type TareaDePedido = {
  id: string;
  posicion: number;
  titulo: string;
  hecha: boolean;
  /** ISO, o null si no está hecha. */
  hechaEn: string | null;
  hechaPorId: number | null;
};

export type ChecklistDelPedido = { tareas: TareaDePedido[]; plantillas: string[] };

/** El checklist del pedido y los nombres de las plantillas (para "Aplicar plantilla"). Exige "Ver". */
export async function leerChecklist(ctx: CtxPedidos, pedidoId: unknown): Promise<ChecklistDelPedido | null> {
  if (!puedeVerPedidos(ctx) || !idValido(pedidoId)) return null;
  const { workspaceId } = ctx;
  const p = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true } });
  if (!p) return null;
  const [filas, plantillas] = await Promise.all([
    prisma.fotofficePedidoTarea.findMany({
      where: { workspaceId, pedidoId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, position: true, title: true, doneAt: true, doneByUserId: true },
      take: MAX_TAREAS_PEDIDO + 20,
    }),
    leerPlantillasChecklist(prisma, workspaceId),
  ]);
  return {
    tareas: filas.map((f) => ({
      id: f.id,
      posicion: f.position,
      titulo: f.title,
      hecha: f.doneAt !== null,
      hechaEn: f.doneAt ? f.doneAt.toISOString() : null,
      hechaPorId: f.doneByUserId,
    })),
    plantillas: plantillas.map((p2) => p2.name),
  };
}

/** Común a las escrituras: permiso, ids, pedido del workspace y no cancelado, con el candado del pedido. */
async function conPedido(
  ctx: CtxPedidos,
  pedidoId: unknown,
  donde: string,
  trabajo: (tx: Tx, pedidoId: string) => Promise<Resultado>,
): Promise<Resultado> {
  if (!puedeGestionarPedidos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const { workspaceId } = ctx;
  try {
    return await prisma.$transaction(async (tx): Promise<Resultado> => {
      await bloquearPedido(tx, pedidoId);
      const p = await tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, status: true } });
      if (!p) return { ok: false, error: MENSAJES_PEDIDO.noExiste };
      if (p.status === "CANCELADO") return { ok: false, error: MENSAJES_PEDIDO.cancelado };
      return trabajo(tx, pedidoId);
    });
  } catch (e) {
    falla(donde, e);
    return { ok: false, error: MENSAJES_CHECKLIST.fallo };
  }
}

/**
 * Tilda o destilda una tarea. Idempotente: tildar una ya hecha no cambia quién ni cuándo; destildar
 * una pendiente no hace nada.
 */
export async function marcarTarea(ctx: CtxPedidos, pedidoId: unknown, tareaId: unknown, hecha: unknown, deps: { ahora?: () => Date } = {}): Promise<Resultado> {
  if (!idValido(tareaId) || typeof hecha !== "boolean") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const ahora = deps.ahora?.() ?? new Date();
  return conPedido(ctx, pedidoId, "marcarTarea", async (tx, pid) => {
    const { workspaceId, userId } = ctx;
    const t = await tx.fotofficePedidoTarea.findFirst({ where: { id: tareaId, workspaceId, pedidoId: pid }, select: { id: true } });
    if (!t) return { ok: false, error: MENSAJES_CHECKLIST.tareaNoExiste };
    if (hecha) {
      // Sólo si todavía no está hecha: así conserva el quién y el cuándo originales.
      await tx.fotofficePedidoTarea.updateMany({ where: { id: tareaId, workspaceId, pedidoId: pid, doneAt: null }, data: { doneAt: ahora, doneByUserId: userId } });
    } else {
      await tx.fotofficePedidoTarea.updateMany({ where: { id: tareaId, workspaceId, pedidoId: pid }, data: { doneAt: null, doneByUserId: null } });
    }
    return { ok: true };
  });
}

/** Agrega una tarea al final del checklist del pedido. */
export async function agregarTarea(ctx: CtxPedidos, pedidoId: unknown, titulo: unknown): Promise<Resultado> {
  const t = validarTituloTarea(titulo);
  if (!t.ok) return t;
  return conPedido(ctx, pedidoId, "agregarTarea", async (tx, pid) => {
    const { workspaceId } = ctx;
    const actuales = await tx.fotofficePedidoTarea.findMany({ where: { workspaceId, pedidoId: pid }, select: { position: true }, take: MAX_TAREAS_PEDIDO + 1 });
    if (actuales.length >= MAX_TAREAS_PEDIDO) return { ok: false, error: MENSAJES_CHECKLIST.demasiadasEnPedido };
    const siguiente = actuales.reduce((m, a) => Math.max(m, a.position), 0) + 1;
    await copiarTareasAlPedido(tx, { workspaceId, pedidoId: pid, titulos: [t.valor], desde: siguiente });
    return { ok: true };
  });
}

/** Quita una tarea del checklist del pedido (sin renumerar: el orden se conserva). */
export async function quitarTarea(ctx: CtxPedidos, pedidoId: unknown, tareaId: unknown): Promise<Resultado> {
  if (!idValido(tareaId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  return conPedido(ctx, pedidoId, "quitarTarea", async (tx, pid) => {
    const { workspaceId } = ctx;
    const r = await tx.fotofficePedidoTarea.deleteMany({ where: { id: tareaId, workspaceId, pedidoId: pid } });
    return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_CHECKLIST.tareaNoExiste };
  });
}

/** "Aplicar plantilla": copia las tareas de la plantilla elegida, sólo si el pedido no tiene ninguna. */
export async function aplicarPlantilla(ctx: CtxPedidos, pedidoId: unknown, nombre: unknown): Promise<Resultado> {
  if (typeof nombre !== "string" || nombre.length === 0 || nombre.length > 200) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  return conPedido(ctx, pedidoId, "aplicarPlantilla", async (tx, pid) => {
    const { workspaceId } = ctx;
    const hay = await tx.fotofficePedidoTarea.findFirst({ where: { workspaceId, pedidoId: pid }, select: { id: true } });
    if (hay) return { ok: false, error: MENSAJES_CHECKLIST.yaTieneTareas };
    const sel = await titulosParaPedidoNuevo(tx, workspaceId, nombre);
    if (!sel.ok) return sel;
    await copiarTareasAlPedido(tx, { workspaceId, pedidoId: pid, titulos: sel.titulos });
    return { ok: true };
  });
}
