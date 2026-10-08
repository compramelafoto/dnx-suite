import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { decimalArsToMinor } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { crearTareaDeConsulta, destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";
import { registrarCobroDelSistema, type MotivoSinAcreditar } from "./cobros";
import { enlaceDelPedidoDelSistema } from "./enlace";
import { imputadoPorCuota } from "./estado";
import { planesDe } from "./plan";
import { aCentavos, desdeCentavos } from "./plan-cuotas";
import { enviarReciboAutomatico } from "./recibos";
import { cuotaDeReferencia, hechosDelPago, referenciaCuota, TITULO_TAREA_PAGO_SIN_APLICAR } from "./mp-puro";

export { cuotaDeReferencia, hechosDelPago, referenciaCuota, TITULO_TAREA_PAGO_SIN_APLICAR };

/**
 * Pagar una cuota de un pedido con Mercado Pago (etapa 3, Entrega B2). Es el mismo circuito que
 * la tienda (`lib/store/payment.ts` y `mp-payment.ts`): Checkout Pro con el token de la
 * organización; el dinero no pasa por DNX.
 *
 * - `iniciarPagoCuota`: abre la preferencia por el saldo de la cuota. SIN `marketplace_fee`: hasta
 *   el PR 357 un pedido no retiene comisión de plataforma (no queda una retención sin asiento).
 * - `acreditarPagoMp`: lo que comparten el webhook y la vuelta del comprador. Acredita un pago
 *   `approved` con `registrarCobroDelSistema`; si no se puede (pago de más, pedido cancelado, sin
 *   Caja…), NO acredita y deja una tarea para el responsable. Nunca lanza.
 * - `verificarPagoCuota`: a la vuelta del comprador; la dirección no se cree, se le pregunta a
 *   Mercado Pago con el token de la organización.
 *
 * Nunca loguea datos personales: sólo códigos.
 */

export const MENSAJES_PAGO_CUOTA = {
  noExiste: "No encontramos esa cuota.",
  cancelado: "El pedido está cancelado: no admite pagos.",
  sinSaldo: "Esa cuota ya está paga.",
  sinCobros: "La organización todavía no tiene los cobros habilitados. Escribile para pagar de otra forma.",
  sinDireccion: "Falta configurar la dirección pública de la aplicación.",
  sinEnlace: "No pudimos armar la vuelta al pedido. Escribile a la organización.",
  fallo: "No pudimos abrir el pago. Probá de nuevo en unos minutos.",
} as const;

export type ResultadoIniciarPago = { ok: true; checkoutUrl: string } | { ok: false; error: string };

export async function iniciarPagoCuota(input: {
  workspaceId: string;
  pedidoId: string;
  cuotaId: string;
}): Promise<ResultadoIniciarPago> {
  const { workspaceId, pedidoId, cuotaId } = input;
  const pedido = await prisma.fotofficePedido.findFirst({
    where: { id: pedidoId, workspaceId },
    select: { id: true, number: true, status: true, totalArs: true, clientId: true },
  });
  if (!pedido) return { ok: false, error: MENSAJES_PAGO_CUOTA.noExiste };
  if (pedido.status === "CANCELADO") return { ok: false, error: MENSAJES_PAGO_CUOTA.cancelado };

  // La cuota tiene que ser de ESTE pedido y de esta organización (el llamador ya validó el token).
  const plan = (await planesDe(workspaceId, [pedido.id])).get(pedido.id) ?? { cuotas: [], imputaciones: [] };
  const cuota = plan.cuotas.find((c) => c.id === cuotaId);
  if (!cuota) return { ok: false, error: MENSAJES_PAGO_CUOTA.noExiste };

  // El saldo de la cuota, y nunca más que lo que falta del pedido (si el total bajó y el plan quedó
  // descuadrado, la acreditación rechazaría el excedente).
  const saldoCuota = aCentavos(cuota.amountArs) - (imputadoPorCuota(plan.imputaciones).get(cuota.id) ?? 0);
  const vigentes = await prisma.fotofficeCobro.findMany({ where: { workspaceId, pedidoId: pedido.id, voidedAt: null }, select: { amountArs: true } });
  const saldoPedido = decimalArsToMinor(pedido.totalArs) - vigentes.reduce((s, c) => s + decimalArsToMinor(c.amountArs), 0);
  const importeMinor = Math.min(saldoCuota, saldoPedido);
  if (importeMinor <= 0) return { ok: false, error: MENSAJES_PAGO_CUOTA.sinSaldo };

  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return { ok: false, error: MENSAJES_PAGO_CUOTA.sinCobros };
  const contacto = await prisma.client.findFirst({ where: { id: pedido.clientId, workspaceId }, select: { email: true } });

  // Las vueltas van a la página pública del pedido, con su token (dominio propio o /w/<slug>).
  const enlace = await enlaceDelPedidoDelSistema(workspaceId, pedido.id);
  if (!enlace.ok) return { ok: false, error: MENSAJES_PAGO_CUOTA.sinEnlace };
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
  if (!base) return { ok: false, error: MENSAJES_PAGO_CUOTA.sinDireccion };

  const vuelta = (pago: string) => `${enlace.url}?pago=${pago}&cuota=${encodeURIComponent(cuota.id)}`;
  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: importeMinor,
      currency: "ARS",
      description: `Cuota ${cuota.position} del pedido N° ${pedido.number}`,
      externalReference: referenciaCuota(cuota.id),
      idempotencyKey: randomUUID(),
      successUrl: vuelta("ok"),
      pendingUrl: vuelta("pendiente"),
      failureUrl: vuelta("error"),
      notificationUrl: `${base}/api/payments/mp/pedidos-webhook`,
      accessTokenOverride: collector.collector.accessToken,
      itemId: `pedcuota-${cuota.id}`,
      sourceApp: "FOTOFFICE",
      metadata: { pedidoId: pedido.id, cuotaId: cuota.id, workspaceId },
      ...(contacto?.email ? { payerEmail: contacto.email } : {}),
    });
    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    console.error("[fotoffice][pedidos] MercadoPago rechazó la preferencia", { cuotaId: cuota.id, detalle: sanitizeError(error) });
    return { ok: false, error: MENSAJES_PAGO_CUOTA.fallo };
  }
}

// --- Acreditar --------------------------------------------------------------------------------

/** Un pago leído en Mercado Pago (lo que devuelve `getPayment` del adaptador). */
export type PagoMp = {
  providerPaymentId: string;
  status: string;
  amountMinor: number;
  currency: string;
  externalReference: string | null;
  rawSanitized: Record<string, unknown>;
};

/** ¿Mercado Pago dice que el pago está aprobado? Igual que en la tienda. */
export function pagoAprobado(pago: Pick<PagoMp, "status" | "rawSanitized">): boolean {
  const crudo = pago.rawSanitized.status;
  if (typeof crudo === "string") return crudo === "approved";
  return pago.status === "APPROVED";
}

export type ResultadoAcreditar =
  | { resultado: "acreditado"; pedidoId: string }
  /** El aviso se repite: ese pago ya estaba acreditado. */
  | { resultado: "ya_acreditado"; pedidoId: string }
  | { resultado: "no_aprobado" }
  /** La referencia no es de una cuota, o la cuota no es de esta organización. */
  | { resultado: "no_es_de_esta_organizacion" }
  /** Aprobado pero NO acreditado (pago de más, pedido cancelado…): quedó la tarea para el responsable. */
  | { resultado: "sin_aplicar"; motivo: MotivoSinAcreditar; pedidoId: string }
  | { resultado: "fallo" };

export type DepsAcreditar = {
  /** Para las pruebas: ejecuta el envío del recibo (por omisión, `after()` de Next). */
  luego?: (tarea: () => Promise<unknown>) => void;
};

/**
 * Acredita un pago de Mercado Pago ya leído con el token de `workspaceId`. El pago tiene que ser
 * `approved` y su referencia tiene que nombrar una cuota de ESTA organización. No lanza.
 */
export async function acreditarPagoMp(workspaceId: string, pago: PagoMp, deps: DepsAcreditar = {}): Promise<ResultadoAcreditar> {
  try {
    const cuotaId = cuotaDeReferencia(pago.externalReference);
    if (!cuotaId) return { resultado: "no_es_de_esta_organizacion" };
    // El pago se leyó con el token de ESTA organización: la cuota (y su pedido) tienen que ser suyos.
    const cuota = await prisma.fotofficePedidoCuota.findFirst({ where: { id: cuotaId, workspaceId }, select: { id: true, pedidoId: true } });
    if (!cuota) {
      console.warn("[fotoffice][pedidos] aviso de un pago cuya cuota no es de la organización que lo cobró");
      return { resultado: "no_es_de_esta_organizacion" };
    }
    if (!pagoAprobado(pago)) return { resultado: "no_aprobado" };

    const hechos = hechosDelPago(pago);
    // Sólo pesos: otra moneda no se puede imputar a un pedido en pesos.
    const r =
      hechos.currency !== "ARS" || hechos.amountMinor <= 0
        ? ({ ok: false, motivo: "DATOS", error: "pago no imputable" } as const)
        : await registrarCobroDelSistema({
            workspaceId,
            pedidoId: cuota.pedidoId,
            importe: desdeCentavos(hechos.amountMinor),
            paidAt: hechos.paidAt,
            cuotaPreferidaId: cuota.id,
            providerPaymentRef: hechos.providerPaymentId,
            feeArs: hechos.feeMinor === null ? null : desdeCentavos(hechos.feeMinor),
            netArs: hechos.feeMinor === null ? null : desdeCentavos(hechos.amountMinor - hechos.feeMinor),
          });

    if (r.ok) {
      if (!r.creado) return { resultado: "ya_acreditado", pedidoId: r.pedidoId };
      programarRecibo(workspaceId, r.cobroId, deps);
      return { resultado: "acreditado", pedidoId: r.pedidoId };
    }
    console.warn("[fotoffice][pedidos] pago aprobado sin acreditar", { motivo: r.motivo });
    await avisarPagoSinAplicar(workspaceId, cuota.pedidoId);
    return { resultado: "sin_aplicar", motivo: r.motivo, pedidoId: cuota.pedidoId };
  } catch (error) {
    console.error("[fotoffice][pedidos] falló la acreditación de un pago", { detalle: sanitizeError(error) });
    return { resultado: "fallo" };
  }
}

/** Manda el recibo automático sin demorar la respuesta; si no hay solicitud (cron, pruebas), lo manda ya. */
function programarRecibo(workspaceId: string, cobroId: string, deps: DepsAcreditar): void {
  const tarea = () => enviarReciboAutomatico(workspaceId, cobroId).catch(() => undefined);
  if (deps.luego) return deps.luego(tarea);
  try {
    after(tarea);
  } catch {
    void tarea();
  }
}

/**
 * Una tarea para el responsable del pedido: hay plata cobrada que el sistema no pudo aplicar. Va a
 * la consulta del pedido (como la del presupuesto aceptado); sin consulta, queda sólo el aviso en el
 * registro, con códigos. No lanza.
 */
export async function avisarPagoSinAplicar(workspaceId: string, pedidoId: string): Promise<void> {
  try {
    const p = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { consultaLeadId: true, ownerUserId: true } });
    if (!p?.consultaLeadId) {
      console.warn("[fotoffice][pedidos] pago sin aplicar en un pedido sin consulta: no hay dónde dejar la tarea");
      return;
    }
    const para = await destinatarioDelPresupuesto(workspaceId, p.ownerUserId);
    await crearTareaDeConsulta(workspaceId, p.consultaLeadId, TITULO_TAREA_PAGO_SIN_APLICAR, para, new Date(), { unaSolaAbierta: true });
  } catch (error) {
    console.error("[fotoffice][pedidos] no se pudo dejar la tarea del pago sin aplicar", { detalle: sanitizeError(error) });
  }
}

// --- Vuelta del comprador ---------------------------------------------------------------------

export type VerificacionPago =
  | { resultado: "acreditado" | "ya_acreditado" }
  | { resultado: "no_aprobado" }
  | { resultado: "sin_pago" }
  | { resultado: "sin_cobros" }
  /** Mercado Pago no respondió o no reconoce el pago con el token de esta organización. */
  | { resultado: "no_disponible" }
  /** El dinero entró pero no se pudo aplicar al pedido; ya hay una tarea para el equipo. */
  | { resultado: "sin_aplicar" }
  | { resultado: "fallo" };

/**
 * A la vuelta del comprador: le pregunta a Mercado Pago por el pago (el `payment_id` de la
 * dirección, o la búsqueda por la referencia de la cuota) y, si está aprobado y es de una cuota de
 * ESTE pedido, lo acredita. Como `checkStoreOrderPayment`. Nunca lanza.
 */
export async function verificarPagoCuota(input: {
  workspaceId: string;
  pedidoId: string;
  cuotaId: string;
  providerPaymentId?: string | null;
}): Promise<VerificacionPago> {
  const { workspaceId, pedidoId, cuotaId } = input;
  const cuota = await prisma.fotofficePedidoCuota.findFirst({ where: { id: cuotaId, pedidoId, workspaceId }, select: { id: true } });
  if (!cuota) return { resultado: "sin_pago" };

  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return { resultado: "sin_cobros" };

  const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
  let pago;
  try {
    pago = input.providerPaymentId
      ? await adapter.getPayment(input.providerPaymentId)
      : await adapter.searchPaymentsByExternalReference(referenciaCuota(cuota.id));
  } catch (error) {
    // Un `payment_id` inventado, o de otra organización, también cae acá: no es un error nuestro.
    console.warn("[fotoffice][pedidos] no se pudo consultar el pago en Mercado Pago", { detalle: sanitizeError(error) });
    return { resultado: "no_disponible" };
  }
  if (!pago) return { resultado: "sin_pago" };
  // Tiene que ser un pago de ESTA cuota (la dirección no se cree).
  if (cuotaDeReferencia(pago.externalReference) !== cuota.id) return { resultado: "sin_pago" };

  const r = await acreditarPagoMp(workspaceId, pago);
  switch (r.resultado) {
    case "acreditado":
    case "ya_acreditado":
    case "sin_aplicar":
    case "no_aprobado":
    case "fallo":
      return { resultado: r.resultado };
    default:
      return { resultado: "sin_pago" };
  }
}
