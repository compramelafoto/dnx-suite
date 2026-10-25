import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { esSlugDnx } from "@/lib/slug-dnx";
import { MENSAJES_PEDIDO, type CtxPedidos } from "./acceso";
import { PLANTILLAS_CHECKLIST_DNX } from "./checklist-plantillas";

/**
 * Ajustes de Pedidos (Configuración → Pedidos, etapa 3, Entrega B1): una fila por organización
 * (`FotofficePedidoAjustes`). Sin fila valen los de fábrica: recordatorio un día antes, apagado,
 * sin rubro de ingreso por omisión.
 *
 * - `reminderDays` (0 a 30, el mismo CHECK del SQL) y `reminderEnabled`: el recordatorio de cuotas
 *   que manda la tarea diaria (`./recordatorios.ts`).
 * - `incomeCategoryId`: el rubro INGRESO de Caja que se usa al confirmar (o dar de alta a mano) un
 *   pedido si ninguno de sus ítems tiene rubro (`rubroDeItems` en `./pedidos.ts`).
 * - `checklistTemplates`: las plantillas de checklist. Se editan en `./checklist.ts`; acá no se tocan
 *   (salvo la semilla de DNX).
 *
 * Nunca loguea datos personales.
 */

export const RECORDATORIO_MIN_DIAS = 0;
export const RECORDATORIO_MAX_DIAS = 30;

export type AjustesPedidos = {
  recordatorioDias: number;
  recordatorioActivo: boolean;
  /** Rubro INGRESO de Caja por omisión, o null. */
  rubroIngresoId: string | null;
};

export const AJUSTES_PEDIDOS_DE_FABRICA: AjustesPedidos = { recordatorioDias: 1, recordatorioActivo: false, rubroIngresoId: null };

type Lector = { fotofficePedidoAjustes: Pick<typeof prisma.fotofficePedidoAjustes, "findUnique"> };

export async function leerAjustesPedidos(workspaceId: string, cliente: Lector = prisma): Promise<AjustesPedidos> {
  const f = await cliente.fotofficePedidoAjustes.findUnique({
    where: { workspaceId },
    select: { reminderDays: true, reminderEnabled: true, incomeCategoryId: true },
  });
  if (!f) return { ...AJUSTES_PEDIDOS_DE_FABRICA };
  return { recordatorioDias: f.reminderDays, recordatorioActivo: f.reminderEnabled, rubroIngresoId: f.incomeCategoryId };
}

type LectorRubroPorOmision = Pick<Prisma.TransactionClient, "fotofficePedidoAjustes" | "cashCategory">;

/**
 * El rubro de ingreso por omisión de la organización, si sigue siendo un rubro INGRESO de Caja del
 * mismo workspace; si no, null.
 */
export async function rubroIngresoPorOmision(cliente: LectorRubroPorOmision, workspaceId: string): Promise<string | null> {
  const a = await cliente.fotofficePedidoAjustes.findUnique({ where: { workspaceId }, select: { incomeCategoryId: true } });
  if (!a?.incomeCategoryId) return null;
  const c = await cliente.cashCategory.findFirst({ where: { id: a.incomeCategoryId, workspaceId, kind: "INGRESO" }, select: { id: true } });
  return c?.id ?? null;
}

/** Configuración → Pedidos: dueño y administradores (`configurar`). */
export function puedeConfigurarPedidos(ctx: Pick<CtxPedidos, "userId" | "role" | "acceso">): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "configurar");
}

export const MENSAJES_AJUSTES_PEDIDOS = {
  sinPermiso: "Sólo el dueño o un administrador pueden configurar los pedidos.",
  dias: `Los días del recordatorio tienen que ser de ${RECORDATORIO_MIN_DIAS} a ${RECORDATORIO_MAX_DIAS}.`,
  rubro: "Elegí un rubro de ingreso de Caja.",
} as const;

export type ResultadoAjustesPedidos = { ok: true } | { ok: false; error: string };

function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Guarda días y encendido del recordatorio y el rubro de ingreso por omisión. Exige `configurar`.
 * El rubro (opcional: vacío = sin rubro) tiene que ser un INGRESO de Caja del workspace. Las
 * plantillas de checklist no se tocan.
 */
export async function guardarAjustesPedidos(ctx: CtxPedidos, datos: unknown): Promise<ResultadoAjustesPedidos> {
  if (!puedeConfigurarPedidos(ctx)) return { ok: false, error: MENSAJES_AJUSTES_PEDIDOS.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const d = datos as Record<string, unknown>;
  const reminderDays = entero(d.recordatorioDias, RECORDATORIO_MIN_DIAS, RECORDATORIO_MAX_DIAS);
  if (reminderDays === null) return { ok: false, error: MENSAJES_AJUSTES_PEDIDOS.dias };
  if (typeof d.recordatorioActivo !== "boolean") return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const crudo = d.rubroIngresoId;
  let incomeCategoryId: string | null = null;
  if (crudo !== undefined && crudo !== null && crudo !== "") {
    if (typeof crudo !== "string" || crudo.length > 64) return { ok: false, error: MENSAJES_AJUSTES_PEDIDOS.rubro };
    const c = await prisma.cashCategory.findFirst({ where: { id: crudo, workspaceId: ctx.workspaceId, kind: "INGRESO" }, select: { id: true } });
    if (!c) return { ok: false, error: MENSAJES_AJUSTES_PEDIDOS.rubro };
    incomeCategoryId = c.id;
  }
  const valores = { reminderDays, reminderEnabled: d.recordatorioActivo, incomeCategoryId };
  try {
    await prisma.fotofficePedidoAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, ...valores },
      update: valores,
      select: { id: true },
    });
  } catch (e) {
    // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    await prisma.fotofficePedidoAjustes.updateMany({ where: { workspaceId: ctx.workspaceId }, data: valores });
  }
  return { ok: true };
}

/** Los rubros INGRESO activos de Caja del workspace, para elegir el de omisión. */
export async function rubrosDeIngreso(workspaceId: string): Promise<{ id: string; nombre: string }[]> {
  const filas = await prisma.cashCategory.findMany({
    where: { workspaceId, kind: "INGRESO", isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
    take: 200,
  });
  return filas.map((f) => ({ id: f.id, nombre: f.name }));
}

/**
 * Ajustes de Pedidos de DNX Estudio (Global Constraints): recordatorio un día antes, ENCENDIDO, y
 * las plantillas de checklist "Pedidos con Contrato" y "Pedidos Simple". Sólo para DNX. Idempotente
 * y sin pisar nada: sin fila, la crea con todo; con fila y `checklistTemplates` en null (nunca
 * configuradas), completa sólo las plantillas; si ya hay plantillas (aunque sea una lista vacía) o
 * recordatorio configurado, no toca nada. Devuelve si escribió algo.
 *
 * Se llama al abrir Configuración → Pedidos y la lista de Pedidos; la tarea diaria nunca crea filas.
 */
export async function asegurarAjustesPedidosDnx(workspaceId: string): Promise<boolean> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } });
  if (!esSlugDnx(branding?.publicSlug)) return false;
  const plantillas = PLANTILLAS_CHECKLIST_DNX as unknown as Prisma.InputJsonValue;
  const r = await prisma.fotofficePedidoAjustes.createMany({
    data: [{ workspaceId, reminderDays: 1, reminderEnabled: true, checklistTemplates: plantillas }],
    skipDuplicates: true,
  });
  if (r.count > 0) return true;
  // La fila ya existía: sólo se completan las plantillas si nunca se configuraron (null).
  const f = await prisma.fotofficePedidoAjustes.findUnique({ where: { workspaceId }, select: { checklistTemplates: true } });
  if (!f || f.checklistTemplates !== null) return false;
  await prisma.fotofficePedidoAjustes.updateMany({ where: { workspaceId }, data: { checklistTemplates: plantillas } });
  return true;
}
