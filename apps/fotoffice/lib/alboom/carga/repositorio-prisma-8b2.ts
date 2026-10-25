import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma, Prisma } from "@repo/db";
import type { ActorCarga, CatalogosHistoricos } from "./repositorio";
import type { Campos, Decision, FilaMapa } from "./tipos";
import { ACTOR_ALBOOM } from "./traductores/historia";

/**
 * Escritores de la 8B-2 con Prisma (lo histórico de Alboom). Corren DENTRO de la transacción de `repoPrisma.escribir`,
 * que escribe también las filas del mapa: si algo falla no queda un registro sin su fila (que lo duplicaría).
 *
 * Reglas (ver `docs/superpowers/plans/2026-10-25-alboom-8b2.md`):
 * - escriben directo, sin pasar por el alta de consultas, `confirmarPedido`, `registrarCobro`, la creación de
 *   proyectos ni las citas del sistema: nada de `after()`, avisos, correos, WhatsApp, Google Calendar ni laboratorio;
 * - NUNCA tocan la Caja operativa (ni `CashMovement`, ni `CashAccount`, ni turnos): los cobros y pagos históricos
 *   quedan sin movimiento y lo demás va al libro `FotofficeAlboomFinanza`;
 * - cada cuota y cada cita nacen con su recordatorio "ya avisado" para que los crons no le escriban a nadie;
 * - pedidos y presupuestos nacen sin token público; los contratos firmados, como firmados fuera de FOTOFFICE;
 * - todo id que llega en la decisión se vuelve a chequear contra el workspace (nunca se toca otro).
 */

type Tx = Prisma.TransactionClient;

const json = (v: unknown) => v as Prisma.InputJsonValue;
const S = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const N = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dia = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const instante = (v: unknown) => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function ajeno(): never {
  throw Object.assign(new Error("registro ajeno o inexistente"), { code: "P2025" });
}

async function delWs<T>(buscar: Promise<T | null>, obligatorio = true): Promise<T | null> {
  const r = await buscar;
  if (!r && obligatorio) ajeno();
  return r;
}

const nombreDe = (c: { firstName: string | null; lastName: string | null; businessName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.businessName || "Contacto de Alboom";

/** Número sin año con el id de Alboom (no consume la secuencia del año). */
async function numeroDeAlboom(tx: Tx, ws: string, key: string, entityType: string, entityId: string, numero: unknown) {
  const t = S(numero);
  if (!t || !/^\d{1,9}$/.test(t)) return;
  const valor = Number(t);
  const ocupado = await tx.fotofficeRecordNumber.findFirst({ where: { workspaceId: ws, sequenceKey: key, year: null, value: valor }, select: { id: true } });
  if (!ocupado) await tx.fotofficeRecordNumber.create({ data: { workspaceId: ws, sequenceKey: key, entityType, entityId, year: null, value: valor, display: t } });
}

async function notaEnFicha(tx: Tx, ws: string, clientId: string, cuerpo: unknown, cuando: Date | null) {
  const body = S(cuerpo);
  if (body) await tx.fotofficeNote.create({ data: { workspaceId: ws, clientId, body, authorLabel: ACTOR_ALBOOM, ...(cuando ? { createdAt: cuando } : {}) } });
}

/**
 * Recorrido histórico: en su etapa (si está abierto) o cerrado con su resultado. Sin tareas automáticas ni eventos:
 * no pasa por el motor de circuitos. Si está abierto y no hay etapa, no se crea (el CHECK exige etapa).
 */
async function recorrido(tx: Tx, ws: string, v: Campos, kind: "VENTA" | "TRABAJO", subjectType: string, subjectId: string): Promise<{ leadStatus: string | null } | null> {
  const circuitId = S(v.circuitId);
  if (!circuitId) return null;
  await delWs(tx.fotofficeCircuit.findFirst({ where: { id: circuitId, workspaceId: ws, kind }, select: { id: true } }));
  const outcome = S(v.outcome);
  let stage: { id: string; leadStatus: string | null } | null = null;
  if (!outcome) {
    const pedida = S(v.stageId);
    stage = pedida ? await tx.fotofficeStage.findFirst({ where: { id: pedida, circuitId, circuit: { workspaceId: ws } }, select: { id: true, leadStatus: true } }) : null;
    stage ??= await tx.fotofficeStage.findFirst({ where: { circuitId, archivedAt: null, circuit: { workspaceId: ws } }, orderBy: { order: "asc" }, select: { id: true, leadStatus: true } });
    if (!stage) return null;
  }
  let lossReasonId: string | null = null;
  const motivo = S(v.motivoPerdida);
  if (outcome === "PERDIDA" && motivo) {
    const r = await tx.fotofficeLossReason.upsert({
      where: { workspaceId_name: { workspaceId: ws, name: motivo } },
      create: { workspaceId: ws, name: motivo, order: 900 },
      update: {},
      select: { id: true },
    });
    lossReasonId = r.id;
  }
  const creado = instante(v.createdAt);
  await tx.fotofficeJourney.create({
    data: {
      workspaceId: ws,
      circuitId,
      kind,
      subjectType,
      subjectId,
      stageId: stage?.id ?? null,
      outcome,
      lossReasonId,
      enteredStageAt: instante(v.enteredStageAt) ?? creado ?? new Date(),
      stageDueAt: instante(v.stageDueAt),
      ownerUserId: N(v.ownerUserId),
      closedAt: outcome ? (instante(v.closedAt) ?? creado ?? new Date()) : null,
      ...(creado ? { createdAt: creado } : {}),
    },
  });
  return { leadStatus: stage?.leadStatus ?? null };
}

async function cuentaPagar(tx: Tx, ws: string, v: Campos): Promise<string> {
  const pedidoId = S(v.pedidoId);
  if (pedidoId) await delWs(tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId: ws }, select: { id: true } }));
  const supplierClientId = S(v.supplierClientId);
  if (supplierClientId) await delWs(tx.client.findFirst({ where: { id: supplierClientId, workspaceId: ws }, select: { id: true } }));
  const costCategoryId = S(v.costCategoryId);
  if (costCategoryId) await delWs(tx.cashCategory.findFirst({ where: { id: costCategoryId, workspaceId: ws }, select: { id: true } }));
  const paidAt = instante(v.paidAt);
  const c = await tx.fotofficeCuentaPagar.create({
    data: {
      workspaceId: ws,
      pedidoId,
      supplierClientId,
      concept: String(v.concept),
      amountArs: String(v.amountArs),
      dueDate: dia(v.dueDate),
      costCategoryId,
      // Pagada en Alboom: con fecha y medio, SIN movimiento de Caja (`paidCashMovementId` queda nulo).
      paidAt,
      paidMethod: paidAt ? (S(v.paidMethod) ?? "OTRO") : null,
    },
    select: { id: true },
  });
  return c.id;
}

async function finanza(tx: Tx, ws: string, v: Campos, fila: FilaMapa | undefined): Promise<string> {
  if (!fila) throw new Error("finanza sin id de Alboom");
  const f = await tx.fotofficeAlboomFinanza.create({
    data: {
      workspaceId: ws,
      alboomEntity: fila.entity,
      alboomId: fila.alboomId,
      source: String(v.source),
      kind: String(v.kind),
      amountArs: String(v.amountArs),
      occurredOn: dia(v.occurredOn)!,
      dueOn: dia(v.dueOn),
      accountCode: S(v.accountCode),
      accountName: S(v.accountName),
      methodName: S(v.methodName),
      documentNumber: S(v.documentNumber),
      alboomCategory: S(v.alboomCategory),
      alboomOrderId: S(v.alboomOrderId),
      clientId: S(v.clientId),
      pedidoId: S(v.pedidoId),
      memo: S(v.memo),
      cleared: v.cleared === true,
    },
    select: { id: true },
  });
  return f.id;
}

/** Busca el recorrido del sujeto (el primero) para colgarle pasos o tareas. */
async function recorridoDe(tx: Tx, ws: string, subjectType: string, subjectId: string) {
  return tx.fotofficeJourney.findFirst({ where: { workspaceId: ws, subjectType, subjectId }, orderBy: { createdAt: "asc" }, select: { id: true, circuitId: true } });
}

/** Partes de la 8B-2 que sabe escribir. */
export const CLAVES_8B2 = new Set([
  "consultas",
  "consultas_historial",
  "consultas_notas",
  "consultas_actividades",
  "consultas_correos",
  "presupuestos",
  "pedidos",
  "cuotas",
  "costos_pedido",
  "cobros",
  "cuentas_cobrar",
  "cuentas_pagar",
  "pagos",
  "movimientos_bancos",
  "contratos",
  "proyectos",
  "proyectos_historial",
  "proyectos_participantes",
  "citas",
  "tareas",
]);

export async function escribirHistorico(tx: Tx, ws: string, clave: string, d: Decision, filas: FilaMapa[], _actor: ActorCarga): Promise<string> {
  if (d.accion !== "CREAR") throw new Error("lo histórico no se actualiza");
  const v = d.datos ?? {};
  const x = d.extra ?? {};
  const creado = instante(v.createdAt);
  const conFecha = creado ? { createdAt: creado } : {};

  switch (clave) {
    case "consultas": {
      const cat = await delWs(tx.fotofficeConsultaCategoria.findFirst({ where: { id: String(v.categoryId), workspaceId: ws }, select: { id: true, legacyEventType: true } }));
      const cli = await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true, firstName: true, lastName: true, businessName: true, email: true, phone: true } }));
      const originId = S(v.originId);
      if (originId) await delWs(tx.fotofficeOrigen.findFirst({ where: { id: originId, workspaceId: ws }, select: { id: true } }));
      const referrer = S(v.referrerClientId);
      const ref = referrer ? await tx.client.findFirst({ where: { id: referrer, workspaceId: ws }, select: { id: true } }) : null;
      const lead = await tx.serviceSalesLead.create({
        data: {
          workspaceId: ws,
          name: nombreDe(cli!).slice(0, 200),
          email: cli!.email,
          phone: cli!.phone,
          eventType: cat!.legacyEventType ?? "OTRO_EVENTO",
          eventDate: dia(v.eventDate),
          eventLocation: S(v.eventLocation),
          message: S(v.message),
          metaJson: json(x.metaJson ?? { origen: "alboom" }),
          status: "NEW",
          ...conFecha,
        },
        select: { id: true },
      });
      await tx.fotofficeConsulta.create({
        data: {
          workspaceId: ws,
          leadId: lead.id,
          clientId: cli!.id,
          categoryId: cat!.id,
          originId,
          referrerClientId: ref?.id ?? null,
          estimatedValue: S(v.estimatedValue),
          eventStartsAt: instante(v.eventStartsAt),
          eventTimeKnown: v.eventTimeKnown === true,
          venue: S(v.venue),
          receptionVenue: S(v.receptionVenue),
          city: S(v.city),
          guests: N(v.guests),
          partnerOneName: S(v.partnerOneName),
          partnerTwoName: S(v.partnerTwoName),
          ...conFecha,
        },
      });
      await numeroDeAlboom(tx, ws, "CONSULTA", "CONSULTA", lead.id, v.numero);
      const r = await recorrido(tx, ws, v, "VENTA", "CAPTACION", lead.id);
      // El estado viejo de la consulta: el de la etapa (si abierta y la etapa lo dice) o el del resultado.
      const status = (S(v.outcome) ? S(v.leadStatus) : (r?.leadStatus ?? S(v.leadStatus))) ?? "NEW";
      if (status !== "NEW") await tx.serviceSalesLead.updateMany({ where: { id: lead.id, workspaceId: ws }, data: { status: status as Prisma.ServiceSalesLeadUpdateManyMutationInput["status"] } });
      await notaEnFicha(tx, ws, cli!.id, v.nota, creado);
      return lead.id;
    }

    case "consultas_historial":
    case "proyectos_historial": {
      const j = (await delWs(recorridoDe(tx, ws, String(v.subjectType), String(v.subjectId))))!;
      const pedida = S(v.toStageId);
      const etapa = pedida ? await tx.fotofficeStage.findFirst({ where: { id: pedida, circuitId: j.circuitId, circuit: { workspaceId: ws } }, select: { id: true } }) : null;
      const s = await tx.fotofficeJourneyStep.create({
        data: { journeyId: j.id, toStageId: etapa?.id ?? null, note: S(v.note), event: "ALBOOM", actorUserId: N(v.actorUserId), actorLabel: S(v.actorLabel) ?? ACTOR_ALBOOM, ...conFecha },
        select: { id: true },
      });
      return s.id;
    }

    case "consultas_notas": {
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      const cat = S(v.categoryId);
      const categoria = cat ? await tx.fotofficeNoteCategory.findFirst({ where: { id: cat, workspaceId: ws }, select: { id: true } }) : null;
      const n = await tx.fotofficeNote.create({
        data: { workspaceId: ws, clientId: String(v.clientId), categoryId: categoria?.id ?? null, body: String(v.body), authorUserId: N(v.authorUserId), authorLabel: S(v.authorLabel) ?? ACTOR_ALBOOM, ...conFecha },
        select: { id: true },
      });
      return n.id;
    }

    case "consultas_actividades": {
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      const e = await tx.fotofficePersonEvent.create({
        data: { workspaceId: ws, clientId: String(v.clientId), kind: String(v.kind), detail: json({ texto: v.texto, consulta: v.consulta }), actorUserId: N(v.actorUserId), actorLabel: S(v.actorLabel) ?? ACTOR_ALBOOM, ...conFecha },
        select: { id: true },
      });
      return e.id;
    }

    case "consultas_correos": {
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      // Ya enviado desde Alboom: sólo queda en la ficha. No es una plantilla automática ni pasa por el envío.
      const m = await tx.fotofficeMessage.create({
        data: {
          workspaceId: ws,
          channel: String(v.channel),
          entityType: "CLIENTE",
          entityId: String(v.clientId),
          toAddress: String(v.toAddress),
          subject: S(v.subject),
          body: String(v.body),
          status: String(v.status),
          automatic: false,
          actorUserId: N(v.actorUserId),
          actorLabel: S(v.actorLabel) ?? ACTOR_ALBOOM,
          ...conFecha,
        },
        select: { id: true },
      });
      return m.id;
    }

    case "presupuestos": {
      await delWs(tx.serviceSalesLead.findFirst({ where: { id: String(v.consultaLeadId), workspaceId: ws }, select: { id: true } }));
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      const p = await tx.fotofficePresupuesto.create({
        data: { workspaceId: ws, consultaLeadId: String(v.consultaLeadId), clientId: String(v.clientId), status: String(v.status), ownerUserId: N(v.ownerUserId), validUntil: dia(v.validUntil), ...conFecha },
        select: { id: true },
      });
      // Sin `tokenHash`: no hay enlace público que mandar ni que siga el seguimiento.
      const ver = await tx.fotofficePresupuestoVersion.create({
        data: {
          workspaceId: ws,
          presupuestoId: p.id,
          number: 1,
          items: json(x.items ?? []),
          totals: json(x.totals ?? {}),
          terms: S(v.terms),
          paymentProposal: S(v.paymentProposal),
          sentAt: instante(v.sentAt),
          acceptedAt: instante(v.acceptedAt),
          ...conFecha,
        },
        select: { id: true },
      });
      await tx.fotofficePresupuesto.updateMany({ where: { id: p.id, workspaceId: ws }, data: { currentVersionId: ver.id, acceptedVersionId: v.status === "ACEPTADO" ? ver.id : null } });
      await numeroDeAlboom(tx, ws, "PRESUPUESTO", "PRESUPUESTO", p.id, v.numero);
      return p.id;
    }

    case "pedidos": {
      const cli = (await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } })))!;
      const leadId = S(v.consultaLeadId);
      const lead = leadId ? await tx.serviceSalesLead.findFirst({ where: { id: leadId, workspaceId: ws }, select: { id: true } }) : null;
      const presId = S(v.presupuestoId);
      const pres = presId ? await tx.fotofficePresupuesto.findFirst({ where: { id: presId, workspaceId: ws, pedido: null }, select: { id: true, currentVersionId: true } }) : null;
      // Sin `accessTokenHash` (no hay enlace público) y sin pasar por `confirmarPedido` (no crea proyectos, citas,
      // cuentas, avisos ni envíos al laboratorio).
      const ped = await tx.fotofficePedido.create({
        data: {
          workspaceId: ws,
          number: String(v.number),
          presupuestoId: pres?.id ?? null,
          acceptedVersionId: pres?.currentVersionId ?? null,
          consultaLeadId: lead?.id ?? null,
          clientId: cli.id,
          status: String(v.status),
          cancelReason: S(v.cancelReason),
          items: json(x.items ?? []),
          totals: json(x.totals ?? {}),
          totalArs: String(v.totalArs),
          eventDate: dia(v.eventDate),
          eventLabel: S(v.eventLabel),
          ownerUserId: N(v.ownerUserId),
          ...conFecha,
        },
        select: { id: true },
      });
      let orden = 1;
      for (const k of ["contratante1", "contratante2"]) {
        const id = S(v[k]);
        const c = id ? await tx.client.findFirst({ where: { id, workspaceId: ws }, select: { id: true } }) : null;
        if (c) await tx.fotofficePedidoContratante.create({ data: { workspaceId: ws, pedidoId: ped.id, orden: orden++, clientId: c.id } });
      }
      await notaEnFicha(tx, ws, cli.id, v.nota, creado);
      return ped.id;
    }

    case "cuotas": {
      await delWs(tx.fotofficePedido.findFirst({ where: { id: String(v.pedidoId), workspaceId: ws }, select: { id: true } }));
      const dueDate = dia(v.dueDate)!;
      const c = await tx.fotofficePedidoCuota.create({
        data: { workspaceId: ws, pedidoId: String(v.pedidoId), position: Math.max(1, N(v.position) ?? 1), dueDate, amountArs: String(v.amountArs), suggestedMethod: S(v.suggestedMethod) },
        select: { id: true },
      });
      // "Ya avisada": el recordatorio de cuotas (`pedidos/recordatorios.ts`) saltea (cuota, vencimiento) avisados.
      await tx.fotofficeCuotaRecordatorio.create({ data: { workspaceId: ws, cuotaId: c.id, dueDate } });
      return c.id;
    }

    case "costos_pedido":
    case "cuentas_pagar":
    case "pagos":
      return cuentaPagar(tx, ws, v);

    case "cuentas_cobrar":
    case "movimientos_bancos":
      return finanza(tx, ws, v, filas[0]);

    case "cobros": {
      if (S(v.source)) return finanza(tx, ws, v, filas[0]);
      await delWs(tx.fotofficePedido.findFirst({ where: { id: String(v.pedidoId), workspaceId: ws }, select: { id: true } }));
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      // Cobro histórico: SIN movimiento de Caja (`cashMovementId` nulo) y con un token que nadie tiene (sin enlace).
      const cobro = await tx.fotofficeCobro.create({
        data: {
          workspaceId: ws,
          pedidoId: String(v.pedidoId),
          clientId: String(v.clientId),
          paidAt: instante(v.paidAt)!,
          method: String(v.method),
          amountArs: String(v.amountArs),
          receiptNumber: String(v.receiptNumber),
          receiptTokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
          idempotencyKey: String(v.idempotencyKey),
        },
        select: { id: true },
      });
      for (const i of (x.imputaciones as { cuotaId: string; amountArs: string }[] | undefined) ?? []) {
        const cuota = await tx.fotofficePedidoCuota.findFirst({ where: { id: i.cuotaId, workspaceId: ws, pedidoId: String(v.pedidoId) }, select: { id: true } });
        if (cuota) await tx.fotofficeCobroImputacion.create({ data: { workspaceId: ws, cobroId: cobro.id, cuotaId: cuota.id, amountArs: i.amountArs } });
      }
      return cobro.id;
    }

    case "contratos": {
      await delWs(tx.fotofficePedido.findFirst({ where: { id: String(v.pedidoId), workspaceId: ws }, select: { id: true } }));
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      // Firmado en Alboom → firmado "fuera de FOTOFFICE" (`manualSignedAt`): ni recordatorios ni PDF por correo.
      // No firmado → borrador sin versión ni firmantes: no hay enlace.
      const k = await tx.fotofficeContrato.create({
        data: {
          workspaceId: ws,
          pedidoId: String(v.pedidoId),
          clientId: String(v.clientId),
          number: String(v.number),
          name: String(v.name),
          status: String(v.status),
          bodyText: String(v.bodyText),
          signedAt: instante(v.signedAt),
          manualSignedAt: instante(v.manualSignedAt),
          ownerUserId: N(v.ownerUserId),
          ...conFecha,
        },
        select: { id: true },
      });
      await tx.fotofficeContratoEvento.create({ data: { workspaceId: ws, contratoId: k.id, type: "ALBOOM_HISTORICO", data: json(x.evento ?? {}), ...conFecha } });
      return k.id;
    }

    case "proyectos": {
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      const pedidoId = S(v.pedidoId);
      const ped = pedidoId ? await tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId: ws }, select: { id: true } }) : null;
      await delWs(tx.fotofficeCircuit.findFirst({ where: { id: String(v.circuitId), workspaceId: ws, kind: "TRABAJO" }, select: { id: true } }));
      const p = await tx.fotofficeProyecto.create({
        data: {
          workspaceId: ws,
          number: String(v.number),
          name: String(v.name),
          clientId: String(v.clientId),
          pedidoId: ped?.id ?? null,
          circuitId: String(v.circuitId),
          eventDate: dia(v.eventDate),
          baseDate: dia(v.baseDate)!,
          finalDueDate: dia(v.finalDueDate),
          ownerUserId: N(v.ownerUserId),
          delegateUserId: N(v.delegateUserId),
          description: S(v.description),
          suspendedAt: instante(v.suspendedAt),
          suspendReason: S(v.suspendReason),
          externalId: S(v.externalId),
          ...conFecha,
        },
        select: { id: true },
      });
      await recorrido(tx, ws, v, "TRABAJO", "PROYECTO", p.id);
      return p.id;
    }

    case "proyectos_participantes": {
      await delWs(tx.fotofficeProyecto.findFirst({ where: { id: String(v.proyectoId), workspaceId: ws }, select: { id: true } }));
      await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
      const rol = S(v.roleId);
      const r = rol ? await tx.fotofficeProyectoRol.findFirst({ where: { id: rol, workspaceId: ws }, select: { id: true } }) : null;
      const pp = await tx.fotofficeProyectoParticipante.create({
        data: { workspaceId: ws, proyectoId: String(v.proyectoId), clientId: String(v.clientId), roleId: r?.id ?? null, note: S(v.note) },
        select: { id: true },
      });
      return pp.id;
    }

    case "citas": {
      const ref = async <T>(id: string | null, buscar: (id: string) => Promise<T | null>) => (id ? await buscar(id) : null);
      const cliente = await ref(S(v.clientId), (id) => tx.client.findFirst({ where: { id, workspaceId: ws }, select: { id: true } }));
      const pedido = await ref(S(v.pedidoId), (id) => tx.fotofficePedido.findFirst({ where: { id, workspaceId: ws }, select: { id: true } }));
      const proyecto = await ref(S(v.proyectoId), (id) => tx.fotofficeProyecto.findFirst({ where: { id, workspaceId: ws }, select: { id: true } }));
      const lead = await ref(S(v.consultaLeadId), (id) => tx.serviceSalesLead.findFirst({ where: { id, workspaceId: ws }, select: { id: true } }));
      const tipo = await ref(S(v.typeId), (id) => tx.fotofficeCitaTipo.findFirst({ where: { id, workspaceId: ws }, select: { id: true } }));
      const startAt = instante(v.startAt)!;
      // Sin `googleEventId`: la sincronización con Google la saltea por estar en el mapa (`lib/alboom/historico.ts`).
      const cita = await tx.fotofficeCita.create({
        data: {
          workspaceId: ws,
          title: String(v.title),
          typeId: tipo?.id ?? null,
          status: String(v.status),
          startAt,
          endAt: instante(v.endAt)!,
          allDay: v.allDay === true,
          location: S(v.location),
          notes: S(v.notes),
          ownerUserId: N(v.ownerUserId),
          clientId: cliente?.id ?? null,
          pedidoId: pedido?.id ?? null,
          proyectoId: proyecto?.id ?? null,
          consultaLeadId: lead?.id ?? null,
          ...conFecha,
        },
        select: { id: true },
      });
      const miembros = new Set(
        (await tx.workspaceMembership.findMany({ where: { workspaceId: ws, userId: { in: ((x.participantes as number[] | undefined) ?? []).filter(Number.isInteger) } }, select: { userId: true } })).map((m) => m.userId),
      );
      for (const userId of miembros) await tx.fotofficeCitaParticipante.create({ data: { citaId: cita.id, userId } });
      // "Ya recordada": el recordatorio de citas (`agenda/recordatorios.ts`) saltea (cita, inicio) avisados.
      await tx.fotofficeCitaRecordatorio.create({ data: { citaId: cita.id, startAt } });
      return cita.id;
    }

    case "tareas": {
      const destino = S(v.destino);
      if (destino === "PEDIDO_TAREA") {
        await delWs(tx.fotofficePedido.findFirst({ where: { id: String(v.pedidoId), workspaceId: ws }, select: { id: true } }));
        const ultima = await tx.fotofficePedidoTarea.findFirst({ where: { pedidoId: String(v.pedidoId), workspaceId: ws }, orderBy: { position: "desc" }, select: { position: true } });
        const t = await tx.fotofficePedidoTarea.create({
          data: { workspaceId: ws, pedidoId: String(v.pedidoId), position: (ultima?.position ?? 0) + 1, title: String(v.title), doneAt: instante(v.doneAt), doneByUserId: N(v.doneByUserId) },
          select: { id: true },
        });
        return t.id;
      }
      if (destino === "NOTA") {
        await delWs(tx.client.findFirst({ where: { id: String(v.clientId), workspaceId: ws }, select: { id: true } }));
        const n = await tx.fotofficeNote.create({ data: { workspaceId: ws, clientId: String(v.clientId), body: String(v.body), authorUserId: N(v.authorUserId), authorLabel: S(v.authorLabel) ?? ACTOR_ALBOOM, ...conFecha }, select: { id: true } });
        return n.id;
      }
      const subjectType = String(v.subjectType);
      const subjectId = String(v.subjectId);
      const j = await recorridoDe(tx, ws, subjectType, subjectId);
      const doneAt = instante(v.doneAt);
      const t = await tx.fotofficeTask.create({
        data: {
          workspaceId: ws,
          journeyId: j?.id ?? null,
          subjectType,
          subjectId,
          title: String(v.title),
          dueAt: instante(v.dueAt),
          assigneeUserId: N(v.assigneeUserId),
          doneAt,
          doneByUserId: doneAt ? N(v.assigneeUserId) : null,
          ...conFecha,
        },
        select: { id: true },
      });
      return t.id;
    }

    default:
      throw new Error("parte sin escritor");
  }
}

// ── Lecturas ────────────────────────────────────────────────────────────────────

const LOTE_IDS = 5000;

/** Ids de FOTOFFICE de un tipo que siguen existiendo, mirando sólo los que el mapa ató (lo único que importa). */
export async function idsExistentesPrisma(ws: string, targetType: string): Promise<Set<string>> {
  const atados = (await prisma.fotofficeAlboomMapa.findMany({ where: { workspaceId: ws, targetType }, select: { targetId: true } })).map((m) => m.targetId);
  const out = new Set<string>();
  for (let i = 0; i < atados.length; i += LOTE_IDS) {
    const ids = [...new Set(atados.slice(i, i + LOTE_IDS))];
    const w = { id: { in: ids }, workspaceId: ws };
    const sel = { select: { id: true } } as const;
    let filas: { id: string }[] = [];
    switch (targetType) {
      case "CONSULTA": filas = await prisma.serviceSalesLead.findMany({ where: w, ...sel }); break;
      case "JOURNEY_STEP": filas = await prisma.fotofficeJourneyStep.findMany({ where: { journey: { workspaceId: ws }, id: { in: ids } }, ...sel }); break;
      case "NOTE": filas = await prisma.fotofficeNote.findMany({ where: w, ...sel }); break;
      case "PERSON_EVENT": filas = await prisma.fotofficePersonEvent.findMany({ where: w, ...sel }); break;
      case "MESSAGE": filas = await prisma.fotofficeMessage.findMany({ where: w, ...sel }); break;
      case "PRESUPUESTO": filas = await prisma.fotofficePresupuesto.findMany({ where: w, ...sel }); break;
      case "PEDIDO": filas = await prisma.fotofficePedido.findMany({ where: w, ...sel }); break;
      case "PEDIDO_CUOTA": filas = await prisma.fotofficePedidoCuota.findMany({ where: w, ...sel }); break;
      case "CUENTA_PAGAR": filas = await prisma.fotofficeCuentaPagar.findMany({ where: w, ...sel }); break;
      case "COBRO": filas = await prisma.fotofficeCobro.findMany({ where: w, ...sel }); break;
      case "FINANZA_HISTORICA": filas = await prisma.fotofficeAlboomFinanza.findMany({ where: w, ...sel }); break;
      case "CONTRATO": filas = await prisma.fotofficeContrato.findMany({ where: w, ...sel }); break;
      case "PROYECTO": filas = await prisma.fotofficeProyecto.findMany({ where: w, ...sel }); break;
      case "PROYECTO_PARTICIPANTE": filas = await prisma.fotofficeProyectoParticipante.findMany({ where: w, ...sel }); break;
      case "CITA": filas = await prisma.fotofficeCita.findMany({ where: w, ...sel }); break;
      case "TAREA":
        filas = [
          ...(await prisma.fotofficeTask.findMany({ where: w, ...sel })),
          ...(await prisma.fotofficePedidoTarea.findMany({ where: w, ...sel })),
          ...(await prisma.fotofficeNote.findMany({ where: w, ...sel })),
        ];
        break;
      default:
        throw new Error("tipo sin lector");
    }
    for (const f of filas) out.add(f.id);
  }
  // Los cobros sin pedido van al libro histórico aunque el mapa diga COBRO.
  if (targetType === "COBRO" && atados.length > 0) for (const f of await prisma.fotofficeAlboomFinanza.findMany({ where: { workspaceId: ws, id: { in: atados } }, select: { id: true } })) out.add(f.id);
  return out;
}

export async function catalogosHistoricosPrisma(ws: string): Promise<CatalogosHistoricos> {
  const [pedidos, proyectos, contratos, categoriasNota, tiposCita, rolesProyecto, rubrosEgreso, imputaciones] = await Promise.all([
    prisma.fotofficePedido.findMany({ where: { workspaceId: ws }, select: { number: true, presupuestoId: true } }),
    prisma.fotofficeProyecto.findMany({ where: { workspaceId: ws }, select: { number: true } }),
    prisma.fotofficeContrato.findMany({ where: { workspaceId: ws }, select: { number: true } }),
    prisma.fotofficeNoteCategory.findMany({ where: { workspaceId: ws }, select: { id: true, name: true } }),
    prisma.fotofficeCitaTipo.findMany({ where: { workspaceId: ws }, select: { id: true, name: true } }),
    prisma.fotofficeProyectoRol.findMany({ where: { workspaceId: ws }, select: { id: true, name: true } }),
    prisma.cashCategory.findMany({ where: { workspaceId: ws, kind: "EGRESO" }, select: { id: true, name: true } }),
    prisma.fotofficeCobroImputacion.findMany({ where: { workspaceId: ws, cobro: { voidedAt: null } }, select: { cuotaId: true, amountArs: true } }),
  ]);
  const imputado: Record<string, number> = {};
  for (const i of imputaciones) imputado[i.cuotaId] = (imputado[i.cuotaId] ?? 0) + Math.round(Number(i.amountArs.toFixed(2)) * 100);
  return {
    numerosPedido: pedidos.map((p) => p.number),
    numerosProyecto: proyectos.map((p) => p.number),
    numerosContrato: contratos.map((p) => p.number),
    presupuestosConPedido: pedidos.map((p) => p.presupuestoId).filter((x): x is string => !!x),
    categoriasNota,
    tiposCita,
    rolesProyecto,
    rubrosEgreso,
    imputado,
  };
}
