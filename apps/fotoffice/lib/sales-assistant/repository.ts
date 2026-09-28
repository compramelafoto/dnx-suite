import "server-only";
import { Prisma, prisma } from "@repo/db";
import {
  DEFAULT_STALE_DAYS,
  DEFAULT_WAIT_DAYS,
  type AccionVenta,
  type EstadoSugerencia,
  type EstadoSync,
  type PrioridadVenta,
  type ResultadoSeguimiento,
  type TipoSeguimiento,
} from "./constants";
import { clasificarTarjeta } from "./inbox";
import type { Movimiento, OportunidadVenta } from "./opportunity";
import type { SeguimientoParaContexto, SugerenciaPrevia } from "./prompt";
import type { UltimaSugerencia } from "./needs-analysis";
import type { ResultadoAnalisis } from "./analyzer";
import { ordenarBandeja } from "./priority";

/**
 * Todas las consultas del Asistente de ventas, en un solo lugar.
 *
 * **Regla sin excepciones: cada consulta lleva `workspaceId`.** No alcanza con que la pantalla
 * ya lo haya resuelto; una consulta sin él acá es una fuga esperando a que alguien la use desde
 * otra pantalla. `lib/sales-assistant/aislamiento.test.ts` lo verifica sobre el código fuente.
 */

export type AjustesVentas = {
  pipelinesIncluded: string[];
  signature: string | null;
  voiceNotes: string | null;
  waitDays: number;
  staleDays: number;
  lastSyncAt: Date | null;
  lastSyncStatus: EstadoSync | null;
  lastSyncMessage: string | null;
};

/** Cuánto dura, redondeando a días de calendario, sumar `dias` a `desde` (zona fija UTC-3). */
function agregarDias(desde: Date, dias: number): Date {
  return new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);
}

/** El `snapshot` tal como se guarda: la oportunidad, con sus fechas como texto ISO. */
type SnapshotGuardado = Omit<OportunidadVenta, "fechaEvento" | "creadaEn" | "presupuestoEnviadoEn" | "modificadaEn" | "movimientos"> & {
  fechaEvento: string | null;
  creadaEn: string;
  presupuestoEnviadoEn: string | null;
  modificadaEn: string;
  movimientos: Array<Omit<Movimiento, "fecha"> & { fecha: string }>;
};

function serializarOportunidad(op: OportunidadVenta): Prisma.InputJsonValue {
  const snapshot: SnapshotGuardado = {
    ...op,
    fechaEvento: op.fechaEvento ? op.fechaEvento.toISOString() : null,
    creadaEn: op.creadaEn.toISOString(),
    presupuestoEnviadoEn: op.presupuestoEnviadoEn ? op.presupuestoEnviadoEn.toISOString() : null,
    modificadaEn: op.modificadaEn.toISOString(),
    movimientos: op.movimientos.map((m) => ({ ...m, fecha: m.fecha.toISOString() })),
  };
  return snapshot as unknown as Prisma.InputJsonValue;
}

/**
 * El único lugar que sabe deserializar el `snapshot`: lo usan `oportunidadGuardada`,
 * `detalleOportunidad` y `bandeja` para no repetir la misma conversión tres veces.
 */
function rehidratarOportunidad(json: Prisma.JsonValue): OportunidadVenta {
  const s = json as unknown as SnapshotGuardado;
  return {
    ...s,
    fechaEvento: s.fechaEvento ? new Date(s.fechaEvento) : null,
    creadaEn: new Date(s.creadaEn),
    presupuestoEnviadoEn: s.presupuestoEnviadoEn ? new Date(s.presupuestoEnviadoEn) : null,
    modificadaEn: new Date(s.modificadaEn),
    movimientos: s.movimientos.map((m) => ({ ...m, fecha: new Date(m.fecha) })),
  };
}

/** La configuración del workspace, o los valores por omisión si nunca se tocó. */
export async function leerAjustes(workspaceId: string): Promise<AjustesVentas> {
  const fila = await prisma.fotofficeSalesSettings.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId },
  });
  return {
    pipelinesIncluded: fila.pipelinesIncluded,
    signature: fila.signature,
    voiceNotes: fila.voiceNotes,
    waitDays: fila.waitDays,
    staleDays: fila.staleDays,
    lastSyncAt: fila.lastSyncAt,
    lastSyncStatus: fila.lastSyncStatus as EstadoSync | null,
    lastSyncMessage: fila.lastSyncMessage,
  };
}

export async function guardarAjustes(
  workspaceId: string,
  datos: Partial<Pick<AjustesVentas, "pipelinesIncluded" | "signature" | "voiceNotes" | "waitDays" | "staleDays">>,
): Promise<void> {
  await prisma.fotofficeSalesSettings.upsert({
    where: { workspaceId },
    update: datos,
    create: {
      workspaceId,
      pipelinesIncluded: datos.pipelinesIncluded ?? [],
      signature: datos.signature ?? null,
      voiceNotes: datos.voiceNotes ?? null,
      waitDays: datos.waitDays ?? DEFAULT_WAIT_DAYS,
      staleDays: datos.staleDays ?? DEFAULT_STALE_DAYS,
    },
  });
}

export async function registrarSync(workspaceId: string, estado: EstadoSync, mensaje: string | null): Promise<void> {
  await prisma.fotofficeSalesSettings.upsert({
    where: { workspaceId },
    update: { lastSyncAt: new Date(), lastSyncStatus: estado, lastSyncMessage: mensaje },
    create: { workspaceId, lastSyncAt: new Date(), lastSyncStatus: estado, lastSyncMessage: mensaje },
  });
}

/** Hace upsert por `(workspaceId, source, externalId)`. El `snapshot` va con las fechas en ISO. */
export async function guardarOportunidad(
  workspaceId: string,
  op: OportunidadVenta,
  ahora: Date,
): Promise<{ id: string; archivada: boolean }> {
  const datos = {
    customerName: op.nombreCliente,
    phone: op.telefono,
    eventType: op.tipoEvento,
    eventDate: op.fechaEvento,
    pipelineName: op.embudo,
    stageName: op.etapa,
    stageOrder: op.etapaOrden,
    quoteSentAt: op.presupuestoEnviadoEn,
    externalCreatedAt: op.creadaEn,
    externalModifiedAt: op.modificadaEn,
    externalStatus: op.abierta ? "ABIERTA" : "CERRADA",
    snapshot: serializarOportunidad(op),
    syncedAt: ahora,
  };
  const fila = await prisma.fotofficeSalesOpportunity.upsert({
    where: { workspaceId_source_externalId: { workspaceId, source: op.fuente, externalId: op.idExterno } },
    update: datos,
    create: { workspaceId, source: op.fuente, externalId: op.idExterno, ...datos },
    select: { id: true, archivedAt: true },
  });
  return { id: fila.id, archivada: fila.archivedAt !== null };
}

/** Las ABIERTAS que no vinieron en esta lectura pasan a CERRADA. */
export async function marcarNoVistasComoCerradas(
  workspaceId: string,
  idsExternosVistos: string[],
  ahora: Date,
): Promise<void> {
  await prisma.fotofficeSalesOpportunity.updateMany({
    where: {
      workspaceId,
      source: "ALBOOM",
      externalStatus: "ABIERTA",
      externalId: { notIn: idsExternosVistos },
    },
    data: { externalStatus: "CERRADA", syncedAt: ahora },
  });
}

/** El contexto para analizar una oportunidad: la última sugerencia y su historial reciente. */
export async function contextoDeAnalisis(
  workspaceId: string,
  opportunityId: string,
): Promise<{
  ultima: UltimaSugerencia | null;
  ultimoSeguimientoEn: Date | null;
  seguimientos: SeguimientoParaContexto[];
  sugerenciasPrevias: SugerenciaPrevia[];
}> {
  const fila = await prisma.fotofficeSalesOpportunity.findFirst({
    where: { id: opportunityId, workspaceId },
    select: {
      suggestions: { orderBy: { createdAt: "desc" }, take: 5 },
      followUps: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!fila) {
    return { ultima: null, ultimoSeguimientoEn: null, seguimientos: [], sugerenciasPrevias: [] };
  }

  const ultimaFila = fila.suggestions[0] ?? null;
  const ultima: UltimaSugerencia | null = ultimaFila
    ? {
        creadaEn: ultimaFila.createdAt,
        accion: ultimaFila.action as AccionVenta,
        estado: ultimaFila.status as EstadoSugerencia,
        esperarHasta: ultimaFila.waitUntil,
        oportunidadModificadaEn: ultimaFila.opportunityModifiedAt,
      }
    : null;

  const ultimoSeguimientoEn = fila.followUps[0]?.createdAt ?? null;

  const seguimientos: SeguimientoParaContexto[] = [...fila.followUps]
    .reverse()
    .map((f) => ({
      fecha: f.createdAt,
      tipo: f.kind as TipoSeguimiento,
      resultado: f.outcome as ResultadoSeguimiento | null,
      texto: f.text,
    }));

  const sugerenciasPrevias: SugerenciaPrevia[] = [...fila.suggestions]
    .reverse()
    .map((s) => ({
      fecha: s.createdAt,
      accion: s.action as AccionVenta,
      estado: s.status as EstadoSugerencia,
      mensaje: s.message,
    }));

  return { ultima, ultimoSeguimientoEn, seguimientos, sugerenciasPrevias };
}

/**
 * Guarda el resultado de un análisis: en una transacción pasa la PENDIENTE/POSPUESTA previa a
 * REEMPLAZADA (una ENVIADA o DESCARTADA ya está resuelta y queda como historial, tal cual) y crea
 * la nueva sugerencia.
 */
export async function guardarSugerencia(
  workspaceId: string,
  opportunityId: string,
  r: ResultadoAnalisis,
  oportunidadModificadaEn: Date,
  ahora: Date,
): Promise<void> {
  const { sugerencia } = r;
  await prisma.$transaction([
    prisma.fotofficeSalesSuggestion.updateMany({
      where: { workspaceId, opportunityId, status: { in: ["PENDIENTE", "POSPUESTA"] } },
      data: { status: "REEMPLAZADA" },
    }),
    prisma.fotofficeSalesSuggestion.create({
      data: {
        workspaceId,
        opportunityId,
        action: sugerencia.accion,
        priority: sugerencia.prioridad,
        reason: sugerencia.motivo,
        message: sugerencia.mensaje,
        waitUntil: sugerencia.esperarDias != null ? agregarDias(ahora, sugerencia.esperarDias) : null,
        opportunityModifiedAt: oportunidadModificadaEn,
        model: r.modelo,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
      },
    }),
  ]);
}

/** La oportunidad guardada por su identificador externo, con el snapshot re-hidratado. */
export async function oportunidadGuardada(
  workspaceId: string,
  source: "ALBOOM",
  externalId: string,
): Promise<{ id: string; modificadaEn: Date; snapshot: OportunidadVenta; archivada: boolean } | null> {
  const fila = await prisma.fotofficeSalesOpportunity.findFirst({
    where: { workspaceId, source, externalId },
    select: { id: true, externalModifiedAt: true, snapshot: true, archivedAt: true },
  });
  if (!fila) return null;
  return {
    id: fila.id,
    modificadaEn: fila.externalModifiedAt,
    snapshot: rehidratarOportunidad(fila.snapshot),
    archivada: fila.archivedAt !== null,
  };
}

export type TarjetaBandeja = {
  oportunidadId: string;
  nombre: string;
  tipoEvento: string | null;
  fechaEvento: Date | null;
  etapa: string;
  telefono: string | null;
  externalId: string;
  sugerencia: {
    id: string;
    accion: AccionVenta;
    prioridad: PrioridadVenta;
    motivo: string;
    mensaje: string | null;
    estado: EstadoSugerencia;
    creadaEn: Date;
  } | null;
  ultimoResultado: ResultadoSeguimiento | null;
  motivoCierre: string | null;
  accionHoy: boolean;
  prioridad: PrioridadVenta | null;
};

/**
 * La bandeja: oportunidades ABIERTAS (o archivadas, si el filtro es ARCHIVADAS) con su sugerencia
 * vigente, clasificadas y ordenadas. La clasificación es pura (`clasificarTarjeta`, en
 * `inbox.ts`); acá sólo se trae lo que hace falta y se filtra por el grupo pedido.
 */
export async function bandeja(
  workspaceId: string,
  filtro: "HOY" | "ESPERANDO" | "PARA_CERRAR" | "ARCHIVADAS",
  staleDays: number,
  hoy: Date,
): Promise<TarjetaBandeja[]> {
  const filas = await prisma.fotofficeSalesOpportunity.findMany({
    where:
      filtro === "ARCHIVADAS"
        ? { workspaceId, archivedAt: { not: null } }
        : { workspaceId, archivedAt: null, externalStatus: "ABIERTA" },
    include: {
      suggestions: { orderBy: { createdAt: "desc" }, take: 1 },
      followUps: { where: { outcome: { not: null } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const tarjetas: TarjetaBandeja[] = [];
  for (const fila of filas) {
    const sugerenciaFila = fila.suggestions[0] ?? null;
    const sugerencia = sugerenciaFila
      ? {
          id: sugerenciaFila.id,
          accion: sugerenciaFila.action as AccionVenta,
          prioridad: sugerenciaFila.priority as PrioridadVenta,
          motivo: sugerenciaFila.reason,
          mensaje: sugerenciaFila.message,
          estado: sugerenciaFila.status as EstadoSugerencia,
          creadaEn: sugerenciaFila.createdAt,
        }
      : null;

    let accionHoy = false;
    let prioridad: PrioridadVenta | null = sugerencia?.prioridad ?? null;
    let motivoCierre: string | null = null;

    if (filtro === "ARCHIVADAS") {
      // Ya está archivada: no hace falta reclasificarla, sólo listarla con su prioridad actual.
    } else {
      const oportunidad = rehidratarOportunidad(fila.snapshot);
      const clasificacion = clasificarTarjeta({
        oportunidad,
        staleDays,
        hoy,
        sugerencia: sugerencia
          ? { accion: sugerencia.accion, prioridad: sugerencia.prioridad, estado: sugerencia.estado, motivo: sugerencia.motivo }
          : null,
      });
      if (clasificacion.grupo !== filtro) continue;
      accionHoy = clasificacion.accionHoy;
      prioridad = clasificacion.prioridad;
      motivoCierre = clasificacion.motivoCierre;
    }

    tarjetas.push({
      oportunidadId: fila.id,
      nombre: fila.customerName,
      tipoEvento: fila.eventType,
      fechaEvento: fila.eventDate,
      etapa: fila.stageName,
      telefono: fila.phone,
      externalId: fila.externalId,
      sugerencia,
      ultimoResultado: (fila.followUps[0]?.outcome as ResultadoSeguimiento | null) ?? null,
      motivoCierre,
      accionHoy,
      prioridad,
    });
  }

  return ordenarBandeja(tarjetas);
}

/** El detalle de una oportunidad: su snapshot re-hidratado, sus sugerencias y sus seguimientos. */
export async function detalleOportunidad(
  workspaceId: string,
  id: string,
): Promise<{
  oportunidad: OportunidadVenta;
  archivada: boolean;
  externalStatus: string;
  sugerencias: {
    id: string;
    accion: AccionVenta;
    prioridad: PrioridadVenta;
    motivo: string;
    mensaje: string | null;
    editedMessage: string | null;
    estado: EstadoSugerencia;
    creadaEn: Date;
    resolvedAt: Date | null;
  }[];
  seguimientos: {
    id: string;
    kind: TipoSeguimiento;
    outcome: ResultadoSeguimiento | null;
    text: string | null;
    actorLabel: string;
    creadaEn: Date;
  }[];
} | null> {
  const fila = await prisma.fotofficeSalesOpportunity.findFirst({
    where: { id, workspaceId },
    include: {
      suggestions: { orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!fila) return null;

  return {
    oportunidad: rehidratarOportunidad(fila.snapshot),
    archivada: fila.archivedAt !== null,
    externalStatus: fila.externalStatus,
    sugerencias: fila.suggestions.map((s) => ({
      id: s.id,
      accion: s.action as AccionVenta,
      prioridad: s.priority as PrioridadVenta,
      motivo: s.reason,
      mensaje: s.message,
      editedMessage: s.editedMessage,
      estado: s.status as EstadoSugerencia,
      creadaEn: s.createdAt,
      resolvedAt: s.resolvedAt,
    })),
    seguimientos: fila.followUps.map((f) => ({
      id: f.id,
      kind: f.kind as TipoSeguimiento,
      outcome: f.outcome as ResultadoSeguimiento | null,
      text: f.text,
      actorLabel: f.actorLabel,
      creadaEn: f.createdAt,
    })),
  };
}

export async function resolverSugerencia(
  workspaceId: string,
  suggestionId: string,
  estado: "ENVIADA" | "DESCARTADA" | "POSPUESTA",
  extra: { editedMessage?: string | null; posponerDias?: number },
  ahora: Date,
): Promise<void> {
  await prisma.fotofficeSalesSuggestion.updateMany({
    where: { id: suggestionId, workspaceId },
    data: {
      status: estado,
      resolvedAt: ahora,
      ...(extra.editedMessage !== undefined ? { editedMessage: extra.editedMessage } : {}),
      ...(estado === "POSPUESTA" ? { waitUntil: agregarDias(ahora, extra.posponerDias ?? DEFAULT_WAIT_DAYS) } : {}),
    },
  });
}

export async function registrarSeguimiento(
  workspaceId: string,
  opportunityId: string,
  s: {
    kind: TipoSeguimiento;
    outcome?: ResultadoSeguimiento | null;
    text?: string | null;
    suggestionId?: string | null;
    actorUserId: number | null;
    actorLabel: string;
  },
): Promise<void> {
  await prisma.fotofficeSalesFollowUp.create({
    data: {
      workspaceId,
      opportunityId,
      kind: s.kind,
      outcome: s.outcome ?? null,
      text: s.text ?? null,
      suggestionId: s.suggestionId ?? null,
      actorUserId: s.actorUserId,
      actorLabel: s.actorLabel,
    },
  });
}

export async function archivar(workspaceId: string, opportunityId: string, archivar: boolean): Promise<void> {
  await prisma.fotofficeSalesOpportunity.updateMany({
    where: { id: opportunityId, workspaceId },
    data: { archivedAt: archivar ? new Date() : null },
  });
}

/**
 * Lo mínimo de una oportunidad para actuar sobre ella desde una pantalla: confirma que es de este
 * workspace y da el id de Alboom para volver a analizarla. Un `null` es "no existe para vos",
 * sea porque no existe o porque es de otro workspace; la pantalla no distingue.
 */
export async function referenciaOportunidad(
  workspaceId: string,
  id: string,
): Promise<{ id: string; externalId: string } | null> {
  return prisma.fotofficeSalesOpportunity.findFirst({
    where: { id, workspaceId },
    select: { id: true, externalId: true },
  });
}

/** Una sugerencia de este workspace, con lo que hace falta para marcarla como enviada. */
export async function referenciaSugerencia(
  workspaceId: string,
  id: string,
): Promise<{ id: string; opportunityId: string; mensaje: string | null; estado: EstadoSugerencia } | null> {
  const fila = await prisma.fotofficeSalesSuggestion.findFirst({
    where: { id, workspaceId },
    select: { id: true, opportunityId: true, message: true, status: true },
  });
  if (!fila) return null;
  return { id: fila.id, opportunityId: fila.opportunityId, mensaje: fila.message, estado: fila.status as EstadoSugerencia };
}

/**
 * Cuándo se leyó Alboom bien por última vez. `lastSyncAt` no sirve para eso: se escribe también
 * cuando la corrida falla. En cambio `syncedAt` sólo se toca al guardar lo que Alboom devolvió.
 */
export async function ultimaLecturaBuena(workspaceId: string): Promise<Date | null> {
  const r = await prisma.fotofficeSalesOpportunity.aggregate({
    where: { workspaceId },
    _max: { syncedAt: true },
  });
  return r._max.syncedAt;
}
