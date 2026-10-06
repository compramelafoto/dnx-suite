import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { NOMBRES_DE_COLOR } from "@/lib/ficha/formato";
import { CLASES, ESTADOS_CAPTACION, EVENTOS, type Clase, type Evento } from "./constantes";

/**
 * Configuración → Circuitos: circuitos, etapas, tareas modelo, reglas de avance y motivos de
 * pérdida. Todo exige `configurar` antes de leer o escribir, y todo filtra por el workspace
 * de la sesión (las etapas, a través de su circuito). Un id de otro workspace es "no
 * encontrado".
 *
 * Nada de acá escribe en los recorridos: reordenar, archivar o renombrar una etapa no mueve
 * ningún registro.
 */

type Tx = Prisma.TransactionClient;
export type CtxConfiguracion = { workspaceId: string; role: string | null };
export type Resultado = { ok: true } | { ok: false; error: string };
export type ResultadoConId = { ok: true; id: string } | { ok: false; error: string };

export const MAX_NOMBRE_CIRCUITO = 60;
export const MAX_NOMBRE_ETAPA = 40;
export const MAX_NOMBRE_MOTIVO = 60;
export const MAX_TITULO_TAREA = 120;
export const MAX_DIAS = 365;
export const MAX_TAREAS_MODELO = 30;
export const COLORES_ETAPA = Object.keys(NOMBRES_DE_COLOR);

export const MENSAJES_CONFIG = {
  sinPermiso: "Sólo el dueño o un administrador pueden cambiar los circuitos.",
  circuitoNoEncontrado: "No encontramos ese circuito.",
  etapaNoEncontrada: "No encontramos esa etapa.",
  motivoNoEncontrado: "No encontramos ese motivo.",
  nombreCircuito: `Escribí un nombre de hasta ${MAX_NOMBRE_CIRCUITO} caracteres.`,
  nombreEtapa: `Escribí un nombre de hasta ${MAX_NOMBRE_ETAPA} caracteres.`,
  nombreMotivo: `Escribí un motivo de hasta ${MAX_NOMBRE_MOTIVO} caracteres.`,
  circuitoRepetido: "Ya hay un circuito con ese nombre.",
  motivoRepetido: "Ya hay un motivo con ese nombre.",
  clase: "Elegí si es un circuito de venta o de trabajo.",
  dias: `Los días van de 0 a ${MAX_DIAS} (0 = sin vencimiento).`,
  color: "Elegí un color de la lista.",
  estadoCaptacion: "Elegí un estado de Captación de la lista.",
  estadoSoloVenta: "El estado de Consultas sólo se usa en circuitos de venta.",
  desactivarPredeterminado: "Es el circuito predeterminado: marcá otro como predeterminado antes de desactivarlo.",
  predeterminadoInactivo: "Activá el circuito antes de marcarlo como predeterminado.",
  ordenInvalido: "El orden no coincide con las etapas del circuito. Recargá la página y probá de nuevo.",
  ordenMotivosInvalido: "El orden no coincide con los motivos. Recargá la página y probá de nuevo.",
  unicaEtapa: "Es la única etapa activa del circuito: tiene que quedar al menos una.",
  etapaConRegistros: "Esta etapa tiene registros: archivala.",
  tareas: `Revisá las tareas: cada una necesita un título de hasta ${MAX_TITULO_TAREA} caracteres y días de 0 a ${MAX_DIAS}.`,
  demasiadasTareas: `Hasta ${MAX_TAREAS_MODELO} tareas por etapa.`,
  evento: "Ese evento no existe.",
  ultimoMotivo: "Tiene que quedar al menos un motivo activo para poder cerrar como perdido.",
} as const;

const M = MENSAJES_CONFIG;
const NEGADO = { ok: false as const, error: M.sinPermiso };
const falla = (error: string) => ({ ok: false as const, error });

function puedeConfigurar(ctx: CtxConfiguracion): boolean {
  return puede(ctx.role, "configurar");
}

/** Nombre limpio (espacios colapsados) o null si está vacío o se pasa del máximo. */
export function limpiarNombre(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const limpio = raw.replace(/\s+/g, " ").trim();
  return limpio.length < 1 || limpio.length > max ? null : limpio;
}

function diasValidos(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= MAX_DIAS ? raw : null;
}

function esChoque(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === "P2002";
}

/** Copiar un circuito escribe una fila por etapa, tarea modelo y regla: el tope por defecto (5 s) es justo en Neon. */
const OPCIONES_CLONAR = { timeout: 15_000 };

const ORDEN_ETAPAS = [{ order: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }];

async function circuitoDelWorkspace(db: Tx | typeof prisma, ctx: CtxConfiguracion, id: string) {
  if (typeof id !== "string" || id.length === 0) return null;
  return db.fotofficeCircuit.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, name: true, kind: true, isActive: true, isDefault: true },
  });
}

async function etapaDelWorkspace(db: Tx | typeof prisma, ctx: CtxConfiguracion, id: string) {
  if (typeof id !== "string" || id.length === 0) return null;
  return db.fotofficeStage.findFirst({
    where: { id, circuit: { workspaceId: ctx.workspaceId } },
    select: { id: true, circuitId: true, archivedAt: true },
  });
}

async function nombreDeCircuitoTomado(db: Tx | typeof prisma, ctx: CtxConfiguracion, name: string, salvo?: string) {
  const otros = await db.fotofficeCircuit.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true } });
  return otros.some((c) => c.id !== salvo && c.name.toLowerCase() === name.toLowerCase());
}

async function siguienteOrden(tx: Tx, circuitId: string): Promise<number> {
  const ultima = await tx.fotofficeStage.findFirst({ where: { circuitId }, orderBy: { order: "desc" }, select: { order: true } });
  return (ultima?.order ?? -1) + 1;
}

async function cantidadDeActivas(tx: Tx, circuitId: string): Promise<number> {
  return tx.fotofficeStage.count({ where: { circuitId, archivedAt: null } });
}

// ─── Lectura para la pantalla ────────────────────────────────────────────────

export type TareaModeloConfig = { title: string; days: number; required: boolean };
export type EtapaConfig = {
  id: string;
  name: string;
  color: string;
  order: number;
  days: number;
  requireTasks: boolean;
  leadStatus: string | null;
  archivada: boolean;
  tareas: TareaModeloConfig[];
  reglas: Evento[];
};
export type CircuitoConfig = {
  id: string;
  name: string;
  kind: Clase;
  isActive: boolean;
  isDefault: boolean;
  etapas: EtapaConfig[];
};
export type MotivoConfig = { id: string; name: string; isActive: boolean };
export type Configuracion = { circuitos: CircuitoConfig[]; motivos: MotivoConfig[] };

/** Todo lo que muestra Configuración → Circuitos. Sin `configurar`, null (no se lee nada). */
export async function leerConfiguracion(ctx: CtxConfiguracion): Promise<Configuracion | null> {
  if (!puedeConfigurar(ctx)) return null;
  const circuitos = await prisma.fotofficeCircuit.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ kind: "desc" }, { isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, kind: true, isActive: true, isDefault: true },
  });
  const ids = circuitos.map((c) => c.id);
  const etapas = ids.length
    ? await prisma.fotofficeStage.findMany({
        where: { circuitId: { in: ids }, circuit: { workspaceId: ctx.workspaceId } },
        orderBy: ORDEN_ETAPAS,
        select: { id: true, circuitId: true, name: true, color: true, order: true, days: true, requireTasks: true, leadStatus: true, archivedAt: true },
      })
    : [];
  const idsEtapas = etapas.map((e) => e.id);
  const [tareas, reglas] = idsEtapas.length
    ? await Promise.all([
        prisma.fotofficeStageTaskTemplate.findMany({
          where: { stageId: { in: idsEtapas } },
          orderBy: { order: "asc" },
          select: { stageId: true, title: true, days: true, required: true },
        }),
        prisma.fotofficeStageRule.findMany({ where: { stageId: { in: idsEtapas } }, select: { stageId: true, event: true } }),
      ])
    : [[], []];
  const motivos = await prisma.fotofficeLossReason.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ isActive: "desc" }, { order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  });

  return {
    circuitos: circuitos.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind as Clase,
      isActive: c.isActive,
      isDefault: c.isDefault,
      etapas: etapas
        .filter((e) => e.circuitId === c.id)
        .map((e) => ({
          id: e.id,
          name: e.name,
          color: e.color,
          order: e.order,
          days: e.days,
          requireTasks: e.requireTasks,
          leadStatus: e.leadStatus,
          archivada: e.archivedAt !== null,
          tareas: tareas.filter((t) => t.stageId === e.id).map((t) => ({ title: t.title, days: t.days, required: t.required })),
          reglas: reglas.filter((r) => r.stageId === e.id).map((r) => r.event as Evento),
        })),
    })),
    motivos,
  };
}

// ─── Circuitos ───────────────────────────────────────────────────────────────

/** Circuito nuevo, activo y no predeterminado, con una etapa "Nueva" sin vencimiento. */
export async function crearCircuito(ctx: CtxConfiguracion, datos: { name: unknown; kind: unknown }): Promise<ResultadoConId> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const name = limpiarNombre(datos.name, MAX_NOMBRE_CIRCUITO);
  if (!name) return falla(M.nombreCircuito);
  if (typeof datos.kind !== "string" || !(CLASES as readonly string[]).includes(datos.kind)) return falla(M.clase);
  const kind = datos.kind;
  try {
    return await prisma.$transaction(async (tx) => {
      if (await nombreDeCircuitoTomado(tx, ctx, name)) return falla(M.circuitoRepetido);
      const c = await tx.fotofficeCircuit.create({ data: { workspaceId: ctx.workspaceId, name, kind }, select: { id: true } });
      await tx.fotofficeStage.create({ data: { circuitId: c.id, name: "Nueva", order: 0, days: 0 } });
      return { ok: true as const, id: c.id };
    });
  } catch (e) {
    if (esChoque(e)) return falla(M.circuitoRepetido);
    throw e;
  }
}

export async function renombrarCircuito(ctx: CtxConfiguracion, id: string, nombre: unknown): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const name = limpiarNombre(nombre, MAX_NOMBRE_CIRCUITO);
  if (!name) return falla(M.nombreCircuito);
  if (!(await circuitoDelWorkspace(prisma, ctx, id))) return falla(M.circuitoNoEncontrado);
  if (await nombreDeCircuitoTomado(prisma, ctx, name, id)) return falla(M.circuitoRepetido);
  try {
    await prisma.fotofficeCircuit.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { name } });
    return { ok: true };
  } catch (e) {
    if (esChoque(e)) return falla(M.circuitoRepetido);
    throw e;
  }
}

/**
 * Copia el circuito con sus etapas activas (en su orden), tareas modelo y reglas. No copia
 * recorridos ni el predeterminado: la copia nace activa y no predeterminada.
 */
export async function clonarCircuito(ctx: CtxConfiguracion, id: string, nuevoNombre: unknown): Promise<ResultadoConId> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const name = limpiarNombre(nuevoNombre, MAX_NOMBRE_CIRCUITO);
  if (!name) return falla(M.nombreCircuito);
  try {
    return await prisma.$transaction(async (tx) => {
      const origen = await circuitoDelWorkspace(tx, ctx, id);
      if (!origen) return falla(M.circuitoNoEncontrado);
      if (await nombreDeCircuitoTomado(tx, ctx, name)) return falla(M.circuitoRepetido);
      const etapas = await tx.fotofficeStage.findMany({
        where: { circuitId: origen.id, archivedAt: null },
        orderBy: ORDEN_ETAPAS,
        select: { id: true, name: true, color: true, days: true, requireTasks: true, leadStatus: true },
      });
      const copia = await tx.fotofficeCircuit.create({
        data: { workspaceId: ctx.workspaceId, name, kind: origen.kind },
        select: { id: true },
      });
      for (const [order, e] of etapas.entries()) {
        const nueva = await tx.fotofficeStage.create({
          data: {
            circuitId: copia.id, name: e.name, color: e.color, order, days: e.days,
            requireTasks: e.requireTasks, leadStatus: e.leadStatus,
          },
          select: { id: true },
        });
        const tareas = await tx.fotofficeStageTaskTemplate.findMany({
          where: { stageId: e.id },
          orderBy: { order: "asc" },
          select: { title: true, days: true, required: true, order: true },
        });
        if (tareas.length) {
          await tx.fotofficeStageTaskTemplate.createMany({ data: tareas.map((t) => ({ ...t, stageId: nueva.id })) });
        }
        const reglas = await tx.fotofficeStageRule.findMany({ where: { stageId: e.id }, select: { event: true } });
        if (reglas.length) {
          await tx.fotofficeStageRule.createMany({ data: reglas.map((r) => ({ stageId: nueva.id, event: r.event })) });
        }
      }
      return { ok: true as const, id: copia.id };
    }, OPCIONES_CLONAR);
  } catch (e) {
    if (esChoque(e)) return falla(M.circuitoRepetido);
    throw e;
  }
}

/** Activa o desactiva. El predeterminado no se puede desactivar. */
export async function activarCircuito(ctx: CtxConfiguracion, id: string, activo: boolean): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const c = await circuitoDelWorkspace(prisma, ctx, id);
  if (!c) return falla(M.circuitoNoEncontrado);
  if (!activo && c.isDefault) return falla(M.desactivarPredeterminado);
  await prisma.fotofficeCircuit.updateMany({ where: { id: c.id, workspaceId: ctx.workspaceId }, data: { isActive: activo === true } });
  return { ok: true };
}

/**
 * Lo marca como predeterminado de su clase. En la misma transacción desmarca primero el
 * anterior (la base tiene un único parcial por (workspaceId, kind) WHERE isDefault).
 */
export async function marcarPredeterminado(ctx: CtxConfiguracion, id: string): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  return prisma.$transaction(async (tx) => {
    const c = await circuitoDelWorkspace(tx, ctx, id);
    if (!c) return falla(M.circuitoNoEncontrado);
    if (!c.isActive) return falla(M.predeterminadoInactivo);
    if (c.isDefault) return { ok: true as const };
    await tx.fotofficeCircuit.updateMany({
      where: { workspaceId: ctx.workspaceId, kind: c.kind, isDefault: true },
      data: { isDefault: false },
    });
    await tx.fotofficeCircuit.updateMany({ where: { id: c.id, workspaceId: ctx.workspaceId }, data: { isDefault: true } });
    return { ok: true as const };
  });
}

// ─── Etapas ──────────────────────────────────────────────────────────────────

/** Etapa nueva al final del circuito. */
export async function crearEtapa(
  ctx: CtxConfiguracion,
  circuitId: string,
  datos: { name: unknown; days: unknown; color: unknown },
): Promise<ResultadoConId> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const name = limpiarNombre(datos.name, MAX_NOMBRE_ETAPA);
  if (!name) return falla(M.nombreEtapa);
  const days = diasValidos(datos.days);
  if (days === null) return falla(M.dias);
  if (typeof datos.color !== "string" || !COLORES_ETAPA.includes(datos.color)) return falla(M.color);
  const color = datos.color;
  return prisma.$transaction(async (tx) => {
    const c = await circuitoDelWorkspace(tx, ctx, circuitId);
    if (!c) return falla(M.circuitoNoEncontrado);
    const order = await siguienteOrden(tx, c.id);
    const e = await tx.fotofficeStage.create({ data: { circuitId: c.id, name, days, color, order }, select: { id: true } });
    return { ok: true as const, id: e.id };
  });
}

/** Nombre, días, color, "exige tareas completas" y estado de Captación (sólo VENTA). */
export async function editarEtapa(
  ctx: CtxConfiguracion,
  id: string,
  datos: { name: unknown; days: unknown; color: unknown; requireTasks: unknown; leadStatus: unknown },
): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const name = limpiarNombre(datos.name, MAX_NOMBRE_ETAPA);
  if (!name) return falla(M.nombreEtapa);
  const days = diasValidos(datos.days);
  if (days === null) return falla(M.dias);
  if (typeof datos.color !== "string" || !COLORES_ETAPA.includes(datos.color)) return falla(M.color);
  const color = datos.color;
  const requireTasks = datos.requireTasks === true;
  const leadStatus = datos.leadStatus === null || datos.leadStatus === undefined || datos.leadStatus === "" ? null : datos.leadStatus;
  if (leadStatus !== null && (typeof leadStatus !== "string" || !(ESTADOS_CAPTACION as readonly string[]).includes(leadStatus))) {
    return falla(M.estadoCaptacion);
  }
  const etapa = await etapaDelWorkspace(prisma, ctx, id);
  if (!etapa) return falla(M.etapaNoEncontrada);
  const c = await circuitoDelWorkspace(prisma, ctx, etapa.circuitId);
  if (!c) return falla(M.etapaNoEncontrada);
  if (leadStatus !== null && c.kind !== "VENTA") return falla(M.estadoSoloVenta);
  await prisma.fotofficeStage.updateMany({
    where: { id: etapa.id, circuit: { workspaceId: ctx.workspaceId } },
    data: { name, days, color, requireTasks, leadStatus: leadStatus as string | null },
  });
  return { ok: true };
}

/**
 * Nuevo orden de las etapas activas. Exige exactamente las etapas no archivadas del circuito
 * (sin repetidas, sin faltantes, sin ajenas) y reescribe `order` 0..n-1; las archivadas quedan
 * detrás (n…), en el orden relativo que tenían. Sólo escribe en
 * `fotofficeStage`: ningún recorrido cambia de etapa.
 */
export async function reordenarEtapas(ctx: CtxConfiguracion, circuitId: string, idsEnOrden: unknown): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  if (!Array.isArray(idsEnOrden) || idsEnOrden.some((x) => typeof x !== "string")) return falla(M.ordenInvalido);
  const ids = idsEnOrden as string[];
  return prisma.$transaction(async (tx) => {
    const c = await circuitoDelWorkspace(tx, ctx, circuitId);
    if (!c) return falla(M.circuitoNoEncontrado);
    const activas = await tx.fotofficeStage.findMany({
      where: { circuitId: c.id, circuit: { workspaceId: ctx.workspaceId }, archivedAt: null },
      select: { id: true },
    });
    const esperadas = new Set(activas.map((e) => e.id));
    const pedidas = new Set(ids);
    if (pedidas.size !== ids.length || ids.length !== esperadas.size || ids.some((x) => !esperadas.has(x))) {
      return falla(M.ordenInvalido);
    }
    for (const [order, stageId] of ids.entries()) {
      await tx.fotofficeStage.updateMany({ where: { id: stageId, circuitId: c.id }, data: { order } });
    }
    // Las archivadas van detrás (n, n+1, …) conservando su orden relativo: si compartieran
    // número con una activa, `esRetroceso` no sabría cuál va antes.
    const archivadas = await tx.fotofficeStage.findMany({
      where: { circuitId: c.id, circuit: { workspaceId: ctx.workspaceId }, archivedAt: { not: null } },
      select: { id: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    for (const [i, etapa] of archivadas.entries()) {
      await tx.fotofficeStage.updateMany({ where: { id: etapa.id, circuitId: c.id }, data: { order: ids.length + i } });
    }
    return { ok: true as const };
  });
}

/** Deja de ofrecerse como destino. No si es la única activa del circuito. */
export async function archivarEtapa(ctx: CtxConfiguracion, id: string): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  return prisma.$transaction(async (tx) => {
    const etapa = await etapaDelWorkspace(tx, ctx, id);
    if (!etapa) return falla(M.etapaNoEncontrada);
    if (etapa.archivedAt) return { ok: true as const };
    if ((await cantidadDeActivas(tx, etapa.circuitId)) <= 1) return falla(M.unicaEtapa);
    await tx.fotofficeStage.updateMany({ where: { id: etapa.id }, data: { archivedAt: new Date() } });
    return { ok: true as const };
  });
}

/** Vuelve a ofrecerse, al final del circuito. */
export async function desarchivarEtapa(ctx: CtxConfiguracion, id: string): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  return prisma.$transaction(async (tx) => {
    const etapa = await etapaDelWorkspace(tx, ctx, id);
    if (!etapa) return falla(M.etapaNoEncontrada);
    if (!etapa.archivedAt) return { ok: true as const };
    const order = await siguienteOrden(tx, etapa.circuitId);
    await tx.fotofficeStage.updateMany({ where: { id: etapa.id }, data: { archivedAt: null, order } });
    return { ok: true as const };
  });
}

/**
 * Borra una etapa que nunca se usó: ningún recorrido, paso de historial ni tarea la nombra.
 * Si alguno la usa, hay que archivarla. Tampoco se borra la única activa.
 */
export async function borrarEtapa(ctx: CtxConfiguracion, id: string): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  return prisma.$transaction(async (tx) => {
    const etapa = await etapaDelWorkspace(tx, ctx, id);
    if (!etapa) return falla(M.etapaNoEncontrada);
    const [recorridos, pasos, tareas] = await Promise.all([
      tx.fotofficeJourney.count({ where: { stageId: etapa.id } }),
      tx.fotofficeJourneyStep.count({ where: { OR: [{ fromStageId: etapa.id }, { toStageId: etapa.id }] } }),
      tx.fotofficeTask.count({ where: { stageId: etapa.id } }),
    ]);
    if (recorridos + pasos + tareas > 0) return falla(M.etapaConRegistros);
    if (!etapa.archivedAt && (await cantidadDeActivas(tx, etapa.circuitId)) <= 1) return falla(M.unicaEtapa);
    await tx.fotofficeStageTaskTemplate.deleteMany({ where: { stageId: etapa.id } });
    await tx.fotofficeStageRule.deleteMany({ where: { stageId: etapa.id } });
    await tx.fotofficeStage.deleteMany({ where: { id: etapa.id, circuit: { workspaceId: ctx.workspaceId } } });
    return { ok: true as const };
  });
}

// ─── Tareas modelo y reglas ──────────────────────────────────────────────────

/** Reemplaza la lista de tareas modelo de la etapa (las tareas ya creadas no cambian). */
export async function guardarTareasModelo(ctx: CtxConfiguracion, stageId: string, lista: unknown): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  if (!Array.isArray(lista)) return falla(M.tareas);
  if (lista.length > MAX_TAREAS_MODELO) return falla(M.demasiadasTareas);
  const tareas: TareaModeloConfig[] = [];
  for (const t of lista as { title?: unknown; days?: unknown; required?: unknown }[]) {
    const title = limpiarNombre(t?.title, MAX_TITULO_TAREA);
    const days = diasValidos(t?.days);
    if (!title || days === null) return falla(M.tareas);
    tareas.push({ title, days, required: t.required === true });
  }
  return prisma.$transaction(async (tx) => {
    const etapa = await etapaDelWorkspace(tx, ctx, stageId);
    if (!etapa) return falla(M.etapaNoEncontrada);
    await tx.fotofficeStageTaskTemplate.deleteMany({ where: { stageId: etapa.id } });
    if (tareas.length) {
      await tx.fotofficeStageTaskTemplate.createMany({ data: tareas.map((t, order) => ({ ...t, order, stageId: etapa.id })) });
    }
    return { ok: true as const };
  });
}

/** Reemplaza los eventos que traen un registro a esta etapa. */
export async function guardarReglas(ctx: CtxConfiguracion, stageId: string, eventos: unknown): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  if (!Array.isArray(eventos) || eventos.some((e) => typeof e !== "string" || !(EVENTOS as readonly string[]).includes(e))) {
    return falla(M.evento);
  }
  const unicos = [...new Set(eventos as Evento[])];
  return prisma.$transaction(async (tx) => {
    const etapa = await etapaDelWorkspace(tx, ctx, stageId);
    if (!etapa) return falla(M.etapaNoEncontrada);
    await tx.fotofficeStageRule.deleteMany({ where: { stageId: etapa.id } });
    if (unicos.length) {
      await tx.fotofficeStageRule.createMany({ data: unicos.map((event) => ({ stageId: etapa.id, event })) });
    }
    return { ok: true as const };
  });
}

// ─── Motivos de pérdida ──────────────────────────────────────────────────────

async function motivoConNombre(ctx: CtxConfiguracion, name: string, salvo?: string) {
  const todos = await prisma.fotofficeLossReason.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true, isActive: true },
  });
  return todos.find((m) => m.id !== salvo && m.name.toLowerCase() === name.toLowerCase()) ?? null;
}

async function siguienteOrdenMotivo(ctx: CtxConfiguracion): Promise<number> {
  const ultimo = await prisma.fotofficeLossReason.findFirst({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (ultimo?.order ?? -1) + 1;
}

/** Motivo nuevo al final. Si existía desactivado con ese nombre, vuelve a activarse. */
export async function crearMotivo(ctx: CtxConfiguracion, nombre: unknown): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const name = limpiarNombre(nombre, MAX_NOMBRE_MOTIVO);
  if (!name) return falla(M.nombreMotivo);
  const ya = await motivoConNombre(ctx, name);
  const order = await siguienteOrdenMotivo(ctx);
  if (ya) {
    if (ya.isActive) return falla(M.motivoRepetido);
    await prisma.fotofficeLossReason.updateMany({ where: { id: ya.id, workspaceId: ctx.workspaceId }, data: { isActive: true, order } });
    return { ok: true };
  }
  try {
    await prisma.fotofficeLossReason.create({ data: { workspaceId: ctx.workspaceId, name, order } });
    return { ok: true };
  } catch (e) {
    if (esChoque(e)) return falla(M.motivoRepetido);
    throw e;
  }
}

export async function renombrarMotivo(ctx: CtxConfiguracion, id: string, nombre: unknown): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const name = limpiarNombre(nombre, MAX_NOMBRE_MOTIVO);
  if (!name) return falla(M.nombreMotivo);
  if (await motivoConNombre(ctx, name, id)) return falla(M.motivoRepetido);
  try {
    const r = await prisma.fotofficeLossReason.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { name } });
    return r.count === 0 ? falla(M.motivoNoEncontrado) : { ok: true };
  } catch (e) {
    if (esChoque(e)) return falla(M.motivoRepetido);
    throw e;
  }
}

/** Activa (al final) o desactiva. No se puede desactivar el último activo. */
export async function activarMotivo(ctx: CtxConfiguracion, id: string, activo: boolean): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  const motivo = await prisma.fotofficeLossReason.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, isActive: true },
  });
  if (!motivo) return falla(M.motivoNoEncontrado);
  if (motivo.isActive === activo) return { ok: true };
  if (!activo) {
    const activos = await prisma.fotofficeLossReason.count({ where: { workspaceId: ctx.workspaceId, isActive: true } });
    if (activos <= 1) return falla(M.ultimoMotivo);
    await prisma.fotofficeLossReason.updateMany({ where: { id: motivo.id, workspaceId: ctx.workspaceId }, data: { isActive: false } });
    return { ok: true };
  }
  const order = await siguienteOrdenMotivo(ctx);
  await prisma.fotofficeLossReason.updateMany({ where: { id: motivo.id, workspaceId: ctx.workspaceId }, data: { isActive: true, order } });
  return { ok: true };
}

/** Nuevo orden de los motivos activos: exige exactamente los activos del workspace. */
export async function ordenarMotivos(ctx: CtxConfiguracion, idsEnOrden: unknown): Promise<Resultado> {
  if (!puedeConfigurar(ctx)) return NEGADO;
  if (!Array.isArray(idsEnOrden) || idsEnOrden.some((x) => typeof x !== "string")) return falla(M.ordenMotivosInvalido);
  const ids = idsEnOrden as string[];
  return prisma.$transaction(async (tx) => {
    const activos = await tx.fotofficeLossReason.findMany({ where: { workspaceId: ctx.workspaceId, isActive: true }, select: { id: true } });
    const esperados = new Set(activos.map((m) => m.id));
    if (new Set(ids).size !== ids.length || ids.length !== esperados.size || ids.some((x) => !esperados.has(x))) {
      return falla(M.ordenMotivosInvalido);
    }
    for (const [order, id] of ids.entries()) {
      await tx.fotofficeLossReason.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { order } });
    }
    return { ok: true as const };
  });
}
