// lib/payments/split-1n-cursos.ts
/**
 * La orden de Mercado Pago (Orders API, split 1:N) de una venta de curso con reparto
 * (spec del mercado de cursos, sección 5.2). APAGADA: `prepararOrdenDeCursoConReparto` pasa por
 * `cobroConRepartoHabilitado()`, que hoy devuelve false (ver split-1n.ts y
 * docs/payments/fotoffice-split-1n-disabled.md).
 *
 * Vive en lib/payments/ a propósito: es la única carpeta donde el test del guard admite los
 * símbolos de Orders/Split. Reusa los constructores y el validador de @repo/payments; no inventa
 * nada nuevo:
 * - Montos fijos (`amount_type = fixed`) calculados por el motor de reparto.
 * - Dueño de la orden (`owner`): el beneficiario que absorbe la comisión de Mercado Pago. MP la
 *   cobra sobre el dueño; A CONFIRMAR en la homologación.
 * - Socios (`partner`): el resto de los beneficiarios, el revendedor y la plataforma (su
 *   comisión), cada uno con su consentimiento ACTIVE real.
 * - Una parte en cero (por ejemplo, el revendedor que regaló toda su parte) no viaja.
 */
import { money } from "@repo/payments/money";
import {
  MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS,
  buildMercadoPagoSplitOrderRequest,
  buildOpaqueExternalReference,
  singleIntangibleItem,
  validateMercadoPagoSplitOrder,
  type PartnerConsentEvidence,
} from "@repo/payments/mercado-pago";
import type { ParteDelReparto } from "@/lib/course-marketplace/reparto";
import { normalizeConsentStatus } from "./connect/consent";
import { cobroConRepartoHabilitado } from "./split-1n";

export type ReceptorDeSplit = { receiverId: string; consentimiento: PartnerConsentEvidence | null };
export type PagoConTarjeta = { token: string; metodo: string; cuotas: number; deviceSessionId: string };

export type EntradaOrdenDeCurso = {
  enrollmentId: string;
  tituloCurso: string;
  payerEmail: string;
  partes: ParteDelReparto[];
  /** Por id de parte (el workspaceId de cada beneficiario y del revendedor). */
  receptores: Map<string, ReceptorDeSplit>;
  plataforma: ReceptorDeSplit | null;
  pago: PagoConTarjeta;
  /** Sólo tests: acepta consentimientos de prueba. Nunca en producción. */
  permitirFixturesDePrueba?: boolean;
};

export type CodigoOrdenDeCurso =
  | "SPLIT_APAGADO"
  | "SIN_DUENO"
  | "SIN_RECEPTOR"
  | "SIN_CONSENTIMIENTO"
  | "SIN_PLATAFORMA"
  | "DEMASIADOS_RECEPTORES"
  | "INVALIDA";

type OrdenConstruida = ReturnType<typeof buildMercadoPagoSplitOrderRequest>;
type Entradas = Parameters<typeof buildMercadoPagoSplitOrderRequest>[0]["entries"];

export type ResultadoOrdenDeCurso =
  | ({ ok: true; ownerReceiverId: string } & OrdenConstruida)
  | { ok: false; codigo: CodigoOrdenDeCurso; detalle: string };

/** Lo guardado en `DnxSplitConsent` → receptor con su evidencia. Un estado desconocido nunca es ACTIVE. */
export function evidenciaDeConsentimiento(fila: { providerReceiverId: string | null; status: string } | null): ReceptorDeSplit | null {
  if (!fila?.providerReceiverId) return null;
  const estado = normalizeConsentStatus(fila.status);
  return {
    receiverId: fila.providerReceiverId,
    consentimiento: estado === "NONE" ? null : { receiverId: fila.providerReceiverId, status: estado, provider: "mercadopago" },
  };
}

function consentimientoActivo(r: ReceptorDeSplit): boolean {
  return r.consentimiento?.status === "ACTIVE" && r.consentimiento.receiverId === r.receiverId;
}

export function armarOrdenDeCursoConReparto(e: EntradaOrdenDeCurso): ResultadoOrdenDeCurso {
  const dueno = e.partes.find((p) => p.tipo === "BENEFICIARIO" && p.absorbeMp);
  if (!dueno) return { ok: false, codigo: "SIN_DUENO", detalle: "Ninguna parte absorbe la comisión de Mercado Pago." };

  const entries: Entradas = [];
  const partnerReceiverIds = new Map<string, string>();
  const consentimientos = new Map<string, PartnerConsentEvidence>();
  let ownerReceiverId = "";

  for (const p of e.partes) {
    if (p !== dueno && p.centavos <= 0) continue;
    const receptor = p.tipo === "PLATAFORMA" ? e.plataforma : (e.receptores.get(p.id) ?? null);
    if (!receptor) {
      return {
        ok: false,
        codigo: p.tipo === "PLATAFORMA" ? "SIN_PLATAFORMA" : "SIN_RECEPTOR",
        detalle: `${p.nombre} no tiene una cuenta de Mercado Pago para el reparto.`,
      };
    }
    if (!consentimientoActivo(receptor)) {
      return { ok: false, codigo: "SIN_CONSENTIMIENTO", detalle: `${p.nombre} no tiene activo su consentimiento de Mercado Pago.` };
    }
    const amount = money("ARS", p.centavos);
    if (p === dueno) {
      ownerReceiverId = receptor.receiverId;
      entries.unshift({ receiverType: "owner", receiverId: receptor.receiverId, amount });
    } else {
      entries.push({ receiverType: "partner", receiverId: receptor.receiverId, consentStatus: "ACTIVE", amount });
      partnerReceiverIds.set(p.id, receptor.receiverId);
      consentimientos.set(p.id, receptor.consentimiento!);
    }
  }

  if (partnerReceiverIds.size > MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS) {
    return {
      ok: false,
      codigo: "DEMASIADOS_RECEPTORES",
      detalle: `Mercado Pago reparte entre el dueño de la orden y ${MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS} cuentas más como máximo.`,
    };
  }

  const total = money("ARS", e.partes.reduce((s, p) => s + p.centavos, 0));
  try {
    const externalReference = buildOpaqueExternalReference("fotoffice", "curso", e.enrollmentId);
    const items = [singleIntangibleItem({ title: e.tituloCurso, total })];
    const validada = validateMercadoPagoSplitOrder({
      externalReference,
      total,
      amountType: "fixed",
      entries,
      deviceSessionId: e.pago.deviceSessionId,
      payerEmail: e.payerEmail,
      statementDescriptor: "FOTOFFICE",
      items,
      partnerReceiverIds,
      partnerConsentsByRecipientId: consentimientos,
      ownerUserId: ownerReceiverId,
      allowTestFixtures: e.permitirFixturesDePrueba ?? false,
    });
    const construida = buildMercadoPagoSplitOrderRequest({
      externalReference: validada.externalReference,
      total,
      amountType: "fixed",
      entries,
      deviceSessionId: validada.deviceSessionId,
      payerEmail: validada.payerEmail,
      statementDescriptor: validada.statementDescriptor,
      items,
      paymentToken: e.pago.token,
      paymentMethodId: e.pago.metodo,
      installments: e.pago.cuotas,
    });
    return { ok: true, ownerReceiverId, ...construida };
  } catch (error) {
    return { ok: false, codigo: "INVALIDA", detalle: error instanceof Error ? error.message : String(error) };
  }
}

/** La única entrada que usa el resto de la app: primero la llave del guard, después la orden. */
export function prepararOrdenDeCursoConReparto(e: EntradaOrdenDeCurso, env: NodeJS.ProcessEnv = process.env): ResultadoOrdenDeCurso {
  if (!cobroConRepartoHabilitado(env)) {
    return { ok: false, codigo: "SPLIT_APAGADO", detalle: "El reparto automático de Mercado Pago está apagado para FOTOFFICE." };
  }
  return armarOrdenDeCursoConReparto(e);
}
