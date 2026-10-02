import "server-only";
import { prisma } from "@repo/db";
import { buildWhatsappUrl } from "@/lib/contact/whatsapp";
import { SERVICE_LEAD_EVENT_TYPE_LABELS, SERVICE_LEAD_SUBTYPE_LABELS } from "@/lib/service-leads/form-definitions";
import { estaVencida, proyeccion } from "./calculos";
import { SALIDAS, type Clase } from "./constantes";
import { describirPaso, tareasVisibles, type PasoVista, type TareaFicha } from "./ficha-vista";
import { motivosActivos, responsablesDe } from "./tablero";

/**
 * Datos de la ficha de una consulta de Captación (`/captacion/[id]`). Todo se lee acotado al
 * workspace de la sesión: una consulta de otro workspace (o inexistente) devuelve null y la
 * página responde "no encontrado". Las fechas viajan como ISO (van a componentes de cliente).
 */

const TIPO_SUJETO = "CAPTACION";

export type ConsultaFicha = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  whatsapp: string | null;
  tipo: string;
  subtipo: string | null;
  fechaEvento: string | null;
  lugar: string | null;
  mensaje: string | null;
  formulario: string | null;
  alta: string;
};

export type EtapaFicha = { id: string; nombre: string; color: string; archivada: boolean };

export type RecorridoFicha = {
  id: string;
  abierto: boolean;
  circuito: { id: string; nombre: string };
  /** Etapas activas en orden; la actual aparece aunque esté archivada. */
  etapas: EtapaFicha[];
  etapaActualId: string | null;
  enteredStageAt: string;
  stageDueAt: string | null;
  vencida: boolean;
  outcome: string | null;
  motivo: string | null;
  closedAt: string | null;
  responsableId: number | null;
  salidas: { exito: string; fracaso: string };
};

export type ProyeccionFicha = {
  desdeHoy: boolean;
  etapas: { id: string; nombre: string; inicio: string; fin: string | null }[];
  fin: string | null;
};

export type Ficha = {
  consulta: ConsultaFicha;
  recorrido: RecorridoFicha | null;
  tareas: TareaFicha[];
  proyeccion: ProyeccionFicha | null;
  historial: PasoVista[];
  motivos: { id: string; nombre: string }[];
  responsables: { id: number; nombre: string }[];
};

const etiqueta = (mapa: Record<string, string>, v: string) => mapa[v] ?? v;

/** El recorrido abierto de la consulta; si no hay, el último que se cerró. */
async function recorridoDe(workspaceId: string, leadId: string) {
  const select = {
    id: true, circuitId: true, kind: true, stageId: true, outcome: true, lossReasonId: true,
    enteredStageAt: true, stageDueAt: true, ownerUserId: true, closedAt: true,
  } as const;
  const abierto = await prisma.fotofficeJourney.findFirst({
    where: { workspaceId, subjectType: TIPO_SUJETO, subjectId: leadId, closedAt: null },
    select,
    orderBy: [{ createdAt: "desc" }],
  });
  if (abierto) return abierto;
  return prisma.fotofficeJourney.findFirst({
    where: { workspaceId, subjectType: TIPO_SUJETO, subjectId: leadId, closedAt: { not: null } },
    select,
    orderBy: [{ closedAt: "desc" }],
  });
}

export async function cargarFicha(workspaceId: string, leadId: string, ahora: Date): Promise<Ficha | null> {
  const lead = await prisma.serviceSalesLead.findFirst({
    where: { id: leadId, workspaceId },
    select: {
      id: true, name: true, email: true, phone: true, eventType: true, eventSubtype: true, eventDate: true,
      eventLocation: true, message: true, formId: true, createdAt: true,
    },
  });
  if (!lead) return null;

  const [form, j, motivos, responsables] = await Promise.all([
    lead.formId
      ? prisma.serviceLeadForm.findFirst({ where: { id: lead.formId, workspaceId }, select: { name: true } })
      : Promise.resolve(null),
    recorridoDe(workspaceId, lead.id),
    motivosActivos(workspaceId),
    responsablesDe(workspaceId),
  ]);

  const consulta: ConsultaFicha = {
    id: lead.id,
    nombre: lead.name,
    email: lead.email,
    telefono: lead.phone,
    whatsapp: buildWhatsappUrl(lead.phone),
    tipo: etiqueta(SERVICE_LEAD_EVENT_TYPE_LABELS as Record<string, string>, lead.eventType),
    subtipo: lead.eventSubtype ? etiqueta(SERVICE_LEAD_SUBTYPE_LABELS, lead.eventSubtype) : null,
    fechaEvento: lead.eventDate ? lead.eventDate.toISOString() : null,
    lugar: lead.eventLocation,
    mensaje: lead.message,
    formulario: form?.name ?? null,
    alta: lead.createdAt.toISOString(),
  };

  if (!j) return { consulta, recorrido: null, tareas: [], proyeccion: null, historial: [], motivos, responsables };

  const [circuito, etapas, pasos, tareas, motivo] = await Promise.all([
    prisma.fotofficeCircuit.findFirst({ where: { id: j.circuitId, workspaceId }, select: { id: true, name: true } }),
    prisma.fotofficeStage.findMany({
      where: { circuitId: j.circuitId, circuit: { workspaceId } },
      select: { id: true, name: true, color: true, order: true, days: true, archivedAt: true },
      orderBy: [{ order: "asc" }],
    }),
    prisma.fotofficeJourneyStep.findMany({
      where: { journeyId: j.id, journey: { workspaceId } },
      select: {
        id: true, fromStageId: true, toStageId: true, outcome: true, note: true, auto: true, event: true,
        forcedWithPendingTasks: true, actorLabel: true, createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.fotofficeTask.findMany({
      where: { workspaceId, journeyId: j.id, journey: { workspaceId } },
      select: { id: true, title: true, dueAt: true, doneAt: true, required: true, stageId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    j.lossReasonId
      ? prisma.fotofficeLossReason.findFirst({ where: { id: j.lossReasonId, workspaceId }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  if (!circuito) return { consulta, recorrido: null, tareas: [], proyeccion: null, historial: [], motivos, responsables };

  const nombres = new Map(etapas.map((e) => [e.id, e.name]));
  const abierto = j.closedAt === null && j.stageId !== null;
  const salidas = (SALIDAS as Record<string, { exito: string; fracaso: string } | undefined>)[j.kind] ?? SALIDAS["VENTA" as Clase];

  const recorrido: RecorridoFicha = {
    id: j.id,
    abierto,
    circuito: { id: circuito.id, nombre: circuito.name },
    etapas: etapas
      .filter((e) => e.archivedAt === null || e.id === j.stageId)
      .map((e) => ({ id: e.id, nombre: e.name, color: e.color, archivada: e.archivedAt !== null })),
    etapaActualId: j.stageId,
    enteredStageAt: j.enteredStageAt.toISOString(),
    stageDueAt: j.stageDueAt ? j.stageDueAt.toISOString() : null,
    vencida: abierto && estaVencida(j.stageDueAt, ahora),
    outcome: j.outcome,
    motivo: motivo?.name ?? null,
    closedAt: j.closedAt ? j.closedAt.toISOString() : null,
    responsableId: j.ownerUserId,
    salidas,
  };

  let proy: ProyeccionFicha | null = null;
  if (abierto) {
    const p = proyeccion(etapas, j.stageId!, j.enteredStageAt, j.stageDueAt, ahora);
    proy = {
      desdeHoy: p.desdeHoy,
      etapas: p.etapas.map((e) => ({
        id: e.id,
        nombre: nombres.get(e.id) ?? "",
        inicio: e.inicio.toISOString(),
        fin: e.fin ? e.fin.toISOString() : null,
      })),
      fin: p.fin ? p.fin.toISOString() : null,
    };
  }

  return {
    consulta,
    recorrido,
    tareas: tareasVisibles(tareas, abierto ? j.stageId : null, nombres, ahora),
    proyeccion: proy,
    historial: pasos.map((p) => describirPaso(p, nombres)),
    motivos,
    responsables,
  };
}
