import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { EVENTOS, ESTADOS_CAPTACION, NOTA_IMPORTADA, SALIDAS, type Evento } from "./constantes";
import { esRetroceso } from "./calculos";
import {
  cerrar,
  cerrarEnTransaccion,
  esRechazo,
  iniciarEnTransaccion,
  iniciarRecorrido,
  moverEnTransaccion,
  OPCIONES_TRANSACCION,
} from "./recorridos";
import { asegurarCircuitos } from "./semillas/asegurar";
import { adaptadorDe, type Sujeto } from "./sujetos";
import { contextoDeSistema, type CtxCircuitos } from "./acceso";
import { numerarConsultasPendientes } from "@/lib/service-leads/numero";

/** Consultas que se enganchan como mucho en cada llamada (cada una es una transacción). */
export const TOPE_ENGANCHE = 150;
/**
 * Consultas que se numeran como mucho en cada llamada. Más bajo que el enganche: cada número es
 * una transacción con bloqueo de la secuencia del workspace, y esto corre al abrir Captación.
 */
export const TOPE_NUMERACION = 50;
/** Nota de todos los pasos que escribe la importación de consultas (el informe los reconoce por ella). */
export { NOTA_IMPORTADA } from "./constantes";
const MOTIVO_IMPORTADA = "Otro";

function esChoqueDeUnicidad(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

/** Sólo el tipo y el código del error: nunca su mensaje (puede traer datos de la consulta). */
function registrarFalla(donde: string, datos: Record<string, string>, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[circuitos] ${donde} falló`, { ...datos, error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/** Si el workspace todavía no tiene ningún circuito, carga los iniciales (DNX o el mínimo). */
async function asegurarAlgunCircuito(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeCircuit.count({ where: { workspaceId } })) > 0) return;
  const branding = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId }, select: { publicSlug: true } });
  await asegurarCircuitos(workspaceId, branding?.publicSlug ?? "");
}

/**
 * Un módulo avisa que pasó `evento` sobre un registro. Nunca lanza: una falla del motor no
 * puede romper la operación del módulo que avisa.
 *
 * - `CONSULTA_RECIBIDA`: pone el registro en la primera etapa del circuito predeterminado
 *   (cargando los circuitos iniciales si el workspace no tiene ninguno).
 * - Los demás: en cada recorrido abierto del registro, busca una regla de ese evento en su
 *   circuito y lo mueve a esa etapa como "Sistema". Nunca retrocede ni se queda en el lugar, y el
 *   mismo evento con el mismo `sourceRef` no mueve dos veces (`FotofficeProcessedEvent`).
 */
export async function notificarEvento(workspaceId: string, sujeto: Sujeto, evento: Evento, sourceRef: string): Promise<{ movido: boolean }> {
  try {
    if (!(EVENTOS as readonly string[]).includes(evento) || !adaptadorDe(sujeto.tipo)) return { movido: false };
    const ctx = contextoDeSistema(workspaceId);

    if (evento === "CONSULTA_RECIBIDA") {
      await asegurarAlgunCircuito(workspaceId);
      await iniciarRecorrido(ctx, sujeto);
      return { movido: true };
    }

    const abiertos = await prisma.fotofficeJourney.findMany({
      where: { workspaceId, subjectType: sujeto.tipo, subjectId: sujeto.id, closedAt: null },
      select: { id: true, circuitId: true, stageId: true, enteredStageAt: true },
      orderBy: { createdAt: "asc" },
    });
    let movido = false;
    for (const j of abiertos) {
      if (j.stageId === null) continue;
      if (await aplicarRegla(ctx, { ...j, stageId: j.stageId }, evento, sourceRef)) movido = true;
    }
    return { movido };
  } catch (error) {
    registrarFalla("notificarEvento", { workspaceId, evento, tipo: sujeto.tipo }, error);
    return { movido: false };
  }
}

/**
 * Otro módulo ya dio por ganada una consulta (p. ej. se aprobó la inscripción de alguien que
 * ya había consultado): cierra como Ganada su recorrido de venta abierto, como Sistema. Las
 * tareas obligatorias pendientes no lo frenan (el paso queda marcado como forzado). Nunca
 * lanza: una falla del motor no puede romper la operación del módulo que avisa.
 */
export async function ganarConsultaPorSistema(workspaceId: string, leadId: string, nota: string): Promise<{ cerrado: boolean }> {
  try {
    const abierto = await prisma.fotofficeJourney.findFirst({
      where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, kind: "VENTA", closedAt: null },
      select: { id: true },
    });
    if (!abierto) return { cerrado: false };
    const r = await cerrar(contextoDeSistema(workspaceId), abierto.id, SALIDAS.VENTA.exito, undefined, nota, { deSistema: true });
    return { cerrado: r.ok };
  } catch (error) {
    registrarFalla("ganarConsultaPorSistema", { workspaceId }, error);
    return { cerrado: false };
  }
}

async function aplicarRegla(
  ctx: CtxCircuitos,
  j: { id: string; circuitId: string; stageId: string; enteredStageAt: Date },
  evento: Evento,
  sourceRef: string,
): Promise<boolean> {
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: j.circuitId, circuit: { workspaceId: ctx.workspaceId } },
    select: { id: true, order: true, days: true, archivedAt: true },
  });
  const activas = etapas.filter((e) => e.archivedAt === null);
  if (activas.length === 0) return false;
  const reglas = await prisma.fotofficeStageRule.findMany({
    where: { event: evento, stageId: { in: activas.map((e) => e.id) } },
    select: { stageId: true },
  });
  // Si varias etapas escuchan el mismo evento, gana la más avanzada.
  const destino = activas
    .filter((e) => reglas.some((r) => r.stageId === e.id))
    .sort((a, b) => b.order - a.order)[0];
  if (!destino || esRetroceso(etapas, j.stageId, destino.id)) return false;

  // El registro del evento y el movimiento van juntos: si el movimiento se frena o falla, el
  // evento no queda marcado y un nuevo aviso puede moverlo.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fotofficeProcessedEvent.create({ data: { journeyId: j.id, event: evento, sourceRef } });
      await moverEnTransaccion(tx, ctx, j.id, destino.id, { auto: { evento }, esperado: j.enteredStageAt });
      // READ COMMITTED (ver `OPCIONES_TRANSACCION`): el índice único de eventos procesados y el
      // `updateMany` condicionado a `esperado` frenan a la otra corrida simultánea.
    }, OPCIONES_TRANSACCION);
  } catch (error) {
    // Ya procesado, o el motor lo rechazó (tareas obligatorias, cambió mientras tanto).
    if (esChoqueDeUnicidad(error) || esRechazo(error)) return false;
    throw error;
  }
  return true;
}

type EstadoConsulta = (typeof ESTADOS_CAPTACION)[number] | "WON" | "LOST";
type ConsultaSinRecorrido = { id: string; status: string; createdAt: Date; updatedAt: Date };

/**
 * Engancha una vez las consultas del workspace que todavía no tienen recorrido de venta:
 * NEW → primera etapa del circuito predeterminado; CONTACTED / QUOTED / INTERESTED → la etapa
 * marcada con ese estado (o la primera); WON / LOST → recorrido cerrado como Ganada / Perdida
 * (motivo "Otro").
 *
 * Es una importación de datos viejos, fechada con su historia: la entrada a la primera etapa
 * es el alta de la consulta (`createdAt`), y el cierre de una ganada o perdida, su última
 * modificación (`updatedAt`, nunca antes del alta). Todos sus pasos llevan la nota
 * `NOTA_IMPORTADA`, que el informe usa para no contarlos como movimiento real.
 *
 * Cada consulta se engancha en UNA transacción que primero toma un bloqueo por consulta y vuelve
 * a mirar si ya tiene recorrido de venta (abierto o cerrado): dos corridas simultáneas no la
 * duplican, y una falla no la deja a medias (se reintenta en la próxima llamada). Engancha como
 * mucho `TOPE_ENGANCHE` por llamada.
 *
 * Además numera (0.5) las consultas que todavía no tienen número —las de antes de la numeración
 * y las que no se pudieron numerar al darse de alta—, también de la más vieja a la más nueva,
 * con el año de su alta y cada una en su propia transacción (ver `numerarConsultasPendientes`),
 * hasta `TOPE_NUMERACION` por llamada. `quedan` cuenta las consultas a las que les falta el
 * recorrido, el número o las dos cosas.
 *
 * Se llama cada vez que se abre Captación: lee sólo las consultas sin recorrido y las sin número
 * (dos consultas acotadas), así que con todo enganchado cuesta dos lecturas que no devuelven nada.
 */
export async function engancharConsultas(workspaceId: string): Promise<{ enganchadas: number; quedan: number }> {
  const recorridos = await engancharRecorridos(workspaceId);
  let numeracionCompleta = false;
  try {
    numeracionCompleta = (await numerarConsultasPendientes(workspaceId, TOPE_NUMERACION)).completo;
  } catch (error) {
    registrarFalla("numerarConsultasPendientes", { workspaceId }, error);
  }
  // Lo común (todo enganchado y numerado de una) no necesita contar de nuevo.
  if (recorridos.completo && numeracionCompleta) return { enganchadas: recorridos.enganchadas, quedan: 0 };
  return { enganchadas: recorridos.enganchadas, quedan: await contarPendientes(workspaceId) };
}

/** Los recorridos de `engancharConsultas`. `completo`: no quedó ninguna consulta sin recorrido. */
async function engancharRecorridos(workspaceId: string): Promise<{ enganchadas: number; completo: boolean }> {
  const circuito = await circuitoDeVenta(workspaceId);
  if (!circuito) return { enganchadas: 0, completo: false };
  const etapas = await prisma.fotofficeStage.findMany({
    where: { circuitId: circuito.id, circuit: { workspaceId }, archivedAt: null },
    select: { id: true, leadStatus: true },
    orderBy: { order: "asc" },
  });
  const primera = etapas[0];
  if (!primera) return { enganchadas: 0, completo: false };
  const etapaPorEstado = new Map<string, string>();
  for (const e of etapas) if (e.leadStatus && !etapaPorEstado.has(e.leadStatus)) etapaPorEstado.set(e.leadStatus, e.id);
  const motivoId = await motivoDeImportacion(workspaceId);

  // La importación refleja el estado que la consulta ya tenía: no la frenan tareas
  // obligatorias de etapas por las que nunca pasó (el paso queda marcado como forzado).
  const ctx: CtxCircuitos = { ...contextoDeSistema(workspaceId), role: "WORKSPACE_OWNER" };
  const plan = { circuitoId: circuito.id, primeraId: primera.id, etapaPorEstado, motivoId };

  // Sin motivo activo no se puede perder: las perdidas esperan y no ocupan lugar en el lote
  // (si no, con muchas perdidas el lote nunca llegaría a las demás).
  const lote = await consultasSinRecorrido(workspaceId, motivoId !== null, TOPE_ENGANCHE + 1);
  const hayMas = lote.length > TOPE_ENGANCHE;
  let enganchadas = 0;
  let fallidas = 0;
  for (const lead of lote.slice(0, TOPE_ENGANCHE)) {
    const estado = lead.status as EstadoConsulta;
    try {
      if (await engancharUna(ctx, lead, estado, plan)) enganchadas++;
    } catch (error) {
      fallidas++;
      registrarFalla("engancharConsultas", { workspaceId, estado }, error);
    }
  }
  return { enganchadas, completo: !hayMas && motivoId !== null && fallidas === 0 };
}

/*
 * Las consultas de abajo son SQL crudo porque Prisma no sabe expresar "sin ningún
 * recorrido" ni "sin número" (el recorrido y el número nombran a la consulta por `subjectId` /
 * `entityId`, sin relación). Los valores van siempre como parámetros. `status` es un enum: se
 * compara y devuelve como texto. Los comentarios `consultas-sin-recorrido` y
 * `consultas-pendientes` los usa la base en memoria de las pruebas para reconocerlas. Usan el
 * índice de FotofficeJourney (workspaceId, subjectType, subjectId) y el único de
 * FotofficeRecordNumber (entityType, entityId).
 */

/** Hasta `limite` consultas sin ningún recorrido de venta, de la más vieja a la más nueva. */
async function consultasSinRecorrido(workspaceId: string, conPerdidas: boolean, limite: number): Promise<ConsultaSinRecorrido[]> {
  return prisma.$queryRaw<ConsultaSinRecorrido[]>`
    /* consultas-sin-recorrido: lista */
    SELECT l."id", l."status"::text AS "status", l."createdAt", l."updatedAt"
    FROM "ServiceSalesLead" l
    WHERE l."workspaceId" = ${workspaceId}
      AND (${conPerdidas}::boolean OR l."status"::text <> 'LOST')
      AND NOT EXISTS (
        SELECT 1 FROM "FotofficeJourney" j
        WHERE j."workspaceId" = l."workspaceId" AND j."subjectType" = 'CAPTACION' AND j."subjectId" = l."id" AND j."kind" = 'VENTA'
      )
    ORDER BY l."createdAt" ASC, l."id" ASC
    LIMIT ${limite}`;
}

/** Cuántas consultas del workspace siguen sin recorrido de venta, sin número o sin las dos cosas. */
async function contarPendientes(workspaceId: string): Promise<number> {
  const [fila] = await prisma.$queryRaw<{ n: bigint | number }[]>`
    /* consultas-pendientes: cuenta */
    SELECT count(*) AS "n"
    FROM "ServiceSalesLead" l
    WHERE l."workspaceId" = ${workspaceId}
      AND (
        NOT EXISTS (
          SELECT 1 FROM "FotofficeJourney" j
          WHERE j."workspaceId" = l."workspaceId" AND j."subjectType" = 'CAPTACION' AND j."subjectId" = l."id" AND j."kind" = 'VENTA'
        )
        OR NOT EXISTS (
          SELECT 1 FROM "FotofficeRecordNumber" r
          WHERE r."entityType" = 'CONSULTA' AND r."entityId" = l."id"
        )
      )`;
  return Number(fila?.n ?? 0);
}

/** 1 ms entre pasos importados con la misma fecha, para que el historial conserve su orden. */
const MS = 1;

/**
 * Engancha una consulta en una sola transacción. Devuelve false si otra corrida ya la enganchó.
 * El bloqueo es por consulta y dura hasta el fin de la transacción.
 *
 * Depende de READ COMMITTED (ver `OPCIONES_TRANSACCION`): después de tomar el bloqueo, el
 * `count` tiene que ver el recorrido que otra corrida confirmó mientras esperábamos.
 */
async function engancharUna(
  ctx: CtxCircuitos,
  lead: ConsultaSinRecorrido,
  estado: EstadoConsulta,
  plan: { circuitoId: string; primeraId: string; etapaPorEstado: Map<string, string>; motivoId: string | null },
): Promise<boolean> {
  const { workspaceId } = ctx;
  const alta = new Date(lead.createdAt);
  // Nunca antes del alta (ni del paso anterior): el historial no puede ir hacia atrás.
  const cierre = new Date(Math.max(new Date(lead.updatedAt).getTime(), alta.getTime() + 2 * MS));
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-enganche:${lead.id}`}))`;
    const ya = await tx.fotofficeJourney.count({ where: { workspaceId, subjectType: "CAPTACION", subjectId: lead.id, kind: "VENTA" } });
    if (ya > 0) return false;

    const { journeyId } = await iniciarEnTransaccion(tx, ctx, { tipo: "CAPTACION", id: lead.id }, plan.circuitoId, undefined, {
      fecha: alta,
      nota: NOTA_IMPORTADA,
    });
    const destino = plan.etapaPorEstado.get(estado);
    if (estado !== "NEW" && destino && destino !== plan.primeraId) {
      await moverEnTransaccion(tx, ctx, journeyId, destino, { nota: NOTA_IMPORTADA, forzar: true, fecha: new Date(alta.getTime() + MS) });
    }
    if (estado === "WON" || estado === "LOST") {
      const exito = estado === "WON";
      const salida = exito ? SALIDAS.VENTA.exito : SALIDAS.VENTA.fracaso;
      await cerrarEnTransaccion(tx, ctx, journeyId, salida, exito ? undefined : plan.motivoId!, NOTA_IMPORTADA, {
        forzar: true,
        fecha: cierre,
      });
    }
    return true;
  }, OPCIONES_TRANSACCION);
}

async function circuitoDeVenta(workspaceId: string) {
  const pred = await prisma.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: "VENTA", isActive: true, isDefault: true },
    select: { id: true },
  });
  if (pred) return pred;
  return prisma.fotofficeCircuit.findFirst({
    where: { workspaceId, kind: "VENTA", isActive: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

/** "Otro" si está activo; si no, el primer motivo activo del workspace. */
async function motivoDeImportacion(workspaceId: string): Promise<string | null> {
  const otro = await prisma.fotofficeLossReason.findFirst({
    where: { workspaceId, name: MOTIVO_IMPORTADA, isActive: true },
    select: { id: true },
  });
  if (otro) return otro.id;
  const primero = await prisma.fotofficeLossReason.findFirst({
    where: { workspaceId, isActive: true },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  return primero?.id ?? null;
}
