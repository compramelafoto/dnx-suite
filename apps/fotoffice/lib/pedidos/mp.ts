import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { decimalArsToMinor } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { registrarCobroDelSistema, type MotivoSinAcreditar } from "./cobros";
import { enlaceDelPedidoDelSistema } from "./enlace";
import { imputadoPorCuota } from "./estado";
import { planesDe } from "./plan";
import { aCentavos, desdeCentavos } from "./plan-cuotas";
import { enviarReciboAutomatico } from "./recibos";
import {
  cuotaDeReferencia,
  hechosDelPago,
  leerReferenciaCuota,
  referenciaCuota,
  reversoDelPago,
  TITULO_TAREA_PAGO_DEVUELTO,
  TITULO_TAREA_PAGO_SIN_APLICAR,
  tituloPagoCuotaInexistente,
  tituloPagoDevuelto,
  tituloPagoSinAplicar,
} from "./mp-puro";
import { dejarRastroDePago, type DepsRastro } from "./mp-rastro";
import { leerRetencionDelPago, metadatosDeRetencion, retencionParaPago, retenidoPorMp, type Retencion } from "@/lib/digitalizacion/comision";
import { esPedidoDeDigitalizacion, retenerEnTx, revertirRetencionDelCobro, tasaDeDigitalizacion } from "@/lib/digitalizacion/servidor/comision";
import { pendingFeeDebtMinor } from "@/lib/platform-fee/ledger";

export { cuotaDeReferencia, hechosDelPago, referenciaCuota, TITULO_TAREA_PAGO_SIN_APLICAR };

/**
 * Pagar una cuota de un pedido con Mercado Pago (etapa 3, Entrega B2). Es el mismo circuito que
 * la tienda (`lib/store/payment.ts` y `mp-payment.ts`): Checkout Pro con el token de la
 * organización; el dinero no pasa por DNX.
 *
 * - `iniciarPagoCuota`: abre la preferencia por el saldo de la cuota. Sólo los pedidos de
 *   digitalización de un negocio con tasa mayor que 0 llevan `marketplace_fee` (F1): la comisión
 *   propia más la deuda arrastrada, como socios y reservas. Los demás pedidos no retienen nada.
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
  // F1: un pedido de digitalización de otro negocio retiene la comisión de plataforma (y la deuda).
  const retencion = await retencionDelPedido(workspaceId, pedido.id, importeMinor);
  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: importeMinor,
      currency: "ARS",
      description: `Cuota ${cuota.position} del pedido N° ${pedido.number}`,
      // Con el pedido: si la cuota se borra antes de que llegue el pago, igual se sabe de qué pedido es (B2-2).
      externalReference: referenciaCuota(cuota.id, pedido.id),
      idempotencyKey: randomUUID(),
      successUrl: vuelta("ok"),
      pendingUrl: vuelta("pendiente"),
      failureUrl: vuelta("error"),
      // `ws`: el aviso lee el pago directo con el token de esta organización, sin adivinar (B2-3).
      notificationUrl: `${base}/api/payments/mp/pedidos-webhook?ws=${encodeURIComponent(workspaceId)}`,
      accessTokenOverride: collector.collector.accessToken,
      itemId: `pedcuota-${cuota.id}`,
      sourceApp: "FOTOFFICE",
      metadata: { pedidoId: pedido.id, cuotaId: cuota.id, workspaceId, ...(retencion ? metadatosDeRetencion(retencion) : {}) },
      ...(retencion && retencion.retenidoMinor > 0 ? { marketplaceFeeMinor: retencion.retenidoMinor } : {}),
      ...(contacto?.email ? { payerEmail: contacto.email } : {}),
    });
    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    console.error("[fotoffice][pedidos] MercadoPago rechazó la preferencia", { cuotaId: cuota.id, detalle: sanitizeError(error) });
    return { ok: false, error: MENSAJES_PAGO_CUOTA.fallo };
  }
}

/**
 * La retención de plataforma de un pago de este pedido: null si no es de digitalización o la tasa es
 * 0 (DNX). Si la base falla (también al leer la tasa), no se retiene: el cobro llega sin marca y lo
 * devenga el camino de siempre (o el cron), no se pierde.
 */
async function retencionDelPedido(workspaceId: string, pedidoId: string, importeMinor: number): Promise<Retencion | null> {
  try {
    if (!(await esPedidoDeDigitalizacion(workspaceId, pedidoId))) return null;
    const bps = await tasaDeDigitalizacion(workspaceId);
    if (bps === null || bps <= 0) return null;
    return retencionParaPago({ paymentMinor: importeMinor, bps, pendingDebtMinor: await pendingFeeDebtMinor(workspaceId) });
  } catch (error) {
    console.error("[fotoffice][pedidos] no se pudo calcular la comisión de plataforma", { detalle: sanitizeError(error) });
    return null;
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
  /** Aprobado pero NO acreditado (pago de más, pedido cancelado, cuota borrada…): quedó el rastro para el estudio. */
  | { resultado: "sin_aplicar"; motivo: MotivoSinAcreditar | "CUOTA_INEXISTENTE"; pedidoId: string | null }
  | { resultado: "fallo" };

export type DepsAcreditar = DepsRastro;

/**
 * Acredita un pago de Mercado Pago ya leído con el token de `workspaceId`. El pago tiene que ser
 * `approved` y su referencia tiene que nombrar una cuota de ESTA organización. No lanza.
 */
export async function acreditarPagoMp(workspaceId: string, pago: PagoMp, deps: DepsAcreditar = {}): Promise<ResultadoAcreditar> {
  try {
    const ref = leerReferenciaCuota(pago.externalReference);
    if (!ref) return { resultado: "no_es_de_esta_organizacion" };
    // El pago se leyó con el token de ESTA organización: la cuota (y su pedido) tienen que ser suyos.
    const cuota = await prisma.fotofficePedidoCuota.findFirst({ where: { id: ref.cuotaId, workspaceId }, select: { id: true, pedidoId: true } });
    if (!cuota) return cuotaQueNoEsta(workspaceId, pago, ref.pedidoId, ref.cuotaId, deps);
    // La referencia nueva nombra el pedido: tiene que ser el de la cuota.
    if (ref.pedidoId && ref.pedidoId !== cuota.pedidoId) {
      console.warn("[fotoffice][pedidos] aviso de un pago cuya referencia no coincide con su pedido");
      return { resultado: "no_es_de_esta_organizacion" };
    }
    if (!pagoAprobado(pago)) return { resultado: "no_aprobado" };

    const hechos = hechosDelPago(pago);
    // F1: si la plataforma retuvo (marketplace_fee), el asiento y la marca van con el cobro.
    const retencion = await retencionDeUnPago(workspaceId, pago.rawSanitized, hechos.amountMinor);
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
            conPlataforma: hechos.conPlataforma,
            ...(retencion
              ? {
                  enLaTransaccion: (tx, c) =>
                    retenerEnTx(tx, { workspaceId, pedidoId: cuota.pedidoId, cobroId: c.cobroId, reciboNumero: c.reciboNumero, retencion: retencion.retencion, bps: retencion.bps }),
                }
              : {}),
          });

    if (r.ok) {
      if (!r.creado) return { resultado: "ya_acreditado", pedidoId: r.pedidoId };
      programarRecibo(workspaceId, r.cobroId, deps);
      return { resultado: "acreditado", pedidoId: r.pedidoId };
    }
    console.warn("[fotoffice][pedidos] pago aprobado sin acreditar", { motivo: r.motivo });
    await avisarPagoSinAplicar(
      workspaceId,
      cuota.pedidoId,
      { providerPaymentId: hechos.providerPaymentId, centavos: hechos.amountMinor, motivo: r.motivo, retenidoPlataforma: retencion?.retencion.retenidoMinor ?? 0 },
      deps,
    );
    return { resultado: "sin_aplicar", motivo: r.motivo, pedidoId: cuota.pedidoId };
  } catch (error) {
    console.error("[fotoffice][pedidos] falló la acreditación de un pago", { detalle: sanitizeError(error) });
    return { resultado: "fallo" };
  }
}

/**
 * Lo que retuvo la plataforma de un pago leído (sólo el `application_fee` que informa Mercado Pago),
 * con la tasa de hoy para la nota (null si no se pudo leer). null si no retuvo. Aunque la tasa no se
 * pueda leer, un pago que retuvo se marca igual: si no, se devengaría encima de lo retenido.
 */
async function retencionDeUnPago(workspaceId: string, raw: Record<string, unknown>, montoMinor: number): Promise<{ retencion: Retencion; bps: number | null } | null> {
  if (!retenidoPorMp(raw)) return null;
  const bps = await tasaDeDigitalizacion(workspaceId);
  const retencion = leerRetencionDelPago(raw, montoMinor, bps);
  return retencion ? { retencion, bps } : null;
}

/**
 * La cuota de la referencia no está en esta organización. Si es de otra, el pago no es de acá. Si no existe
 * en ningún lado, se borró al editar el plan después de abrir el pago (B2-2): el dinero igual entró en la
 * cuenta de esta organización (su token leyó el pago), así que queda el rastro en el pedido de la referencia
 * nueva (o, con la vieja, sólo el correo al dueño). No acredita: lo decide una persona.
 */
async function cuotaQueNoEsta(workspaceId: string, pago: PagoMp, pedidoId: string | null, cuotaId: string, deps: DepsAcreditar): Promise<ResultadoAcreditar> {
  const ajena = await prisma.fotofficePedidoCuota.findFirst({ where: { id: cuotaId }, select: { id: true } });
  if (ajena) {
    console.warn("[fotoffice][pedidos] aviso de un pago cuya cuota no es de la organización que lo cobró");
    return { resultado: "no_es_de_esta_organizacion" };
  }
  let pedido: { id: string } | null = null;
  if (pedidoId) {
    pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true } });
    if (!pedido) {
      console.warn("[fotoffice][pedidos] aviso de un pago cuyo pedido no es de la organización que lo cobró");
      return { resultado: "no_es_de_esta_organizacion" };
    }
  }
  if (!pagoAprobado(pago)) return { resultado: "no_aprobado" };
  const hechos = hechosDelPago(pago);
  console.warn("[fotoffice][pedidos] pago aprobado de una cuota que ya no existe", { conPedido: pedido !== null });
  await dejarRastroDePago(
    workspaceId,
    {
      pedidoId: pedido?.id ?? null,
      titulo: tituloPagoCuotaInexistente(hechos.providerPaymentId, hechos.amountMinor, retenidoPorMp(pago.rawSanitized) ?? 0),
      tituloConsulta: TITULO_TAREA_PAGO_SIN_APLICAR,
      asunto: "Llegó un pago de Mercado Pago por una cuota que ya no existe",
      pagoId: hechos.providerPaymentId,
    },
    deps,
  );
  return { resultado: "sin_aplicar", motivo: "CUOTA_INEXISTENTE", pedidoId: pedido?.id ?? null };
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
 * Hay dinero cobrado que el sistema no pudo aplicar (B2-1): tarea en el pedido (aunque no tenga consulta),
 * tarea de la consulta si tiene, y correo interno al responsable. No lanza.
 */
export async function avisarPagoSinAplicar(
  workspaceId: string,
  pedidoId: string,
  pago: { providerPaymentId: string; centavos: number; motivo: string; retenidoPlataforma?: number },
  deps: DepsRastro = {},
): Promise<void> {
  await dejarRastroDePago(
    workspaceId,
    {
      pedidoId,
      titulo: tituloPagoSinAplicar(pago.providerPaymentId, pago.centavos, pago.motivo, pago.retenidoPlataforma ?? 0),
      tituloConsulta: TITULO_TAREA_PAGO_SIN_APLICAR,
      asunto: "Llegó un pago de Mercado Pago que no se pudo aplicar",
    },
    deps,
  ).catch(() => undefined);
}

export type ResultadoDevolucion = "avisado" | "ya_avisado" | "sigue_aprobado" | "cobro_anulado" | "sin_cobro" | "fallo";

/**
 * Un aviso de un pago YA acreditado (B2-4): si Mercado Pago lo devolvió, hubo contracargo, está en reclamo o
 * se canceló, deja el rastro "anulá el cobro si corresponde" (una vez por pago y estado). NO anula el cobro ni
 * toca Caja: lo confirma una persona. Si el cobro ya está anulado, no hay nada que avisar. No lanza.
 */
export async function avisarDevolucionMp(workspaceId: string, pago: PagoMp, deps: DepsRastro = {}): Promise<ResultadoDevolucion> {
  try {
    const reverso = reversoDelPago(pago);
    if (!reverso) return "sigue_aprobado";
    const cobro = await prisma.fotofficeCobro.findFirst({
      where: { workspaceId, providerPaymentRef: pago.providerPaymentId },
      select: { id: true, pedidoId: true, amountArs: true, voidedAt: true },
    });
    if (!cobro) return "sin_cobro";
    // F1: si el pago canceló deuda de comisión y Mercado Pago lo devolvió (o hubo contracargo), esa
    // deuda vuelve a quedar pendiente. Idempotente y sin lanzar; aunque el cobro ya esté anulado.
    if (reverso === "refunded" || reverso === "charged_back") await revertirRetencionDelCobro(workspaceId, cobro.id, reverso);
    if (cobro.voidedAt) return "cobro_anulado";
    const r = await dejarRastroDePago(
      workspaceId,
      {
        pedidoId: cobro.pedidoId,
        titulo: tituloPagoDevuelto(pago.providerPaymentId, decimalArsToMinor(cobro.amountArs), reverso),
        tituloConsulta: TITULO_TAREA_PAGO_DEVUELTO,
        asunto: "Mercado Pago devolvió (o le reclamaron) un pago ya acreditado",
      },
      deps,
    );
    return r.tarea === "YA_EXISTIA" ? "ya_avisado" : "avisado";
  } catch (error) {
    console.error("[fotoffice][pedidos] falló el aviso de una devolución", { detalle: sanitizeError(error) });
    return "fallo";
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
  const cuota = await prisma.fotofficePedidoCuota.findFirst({ where: { id: cuotaId, pedidoId, workspaceId }, select: { id: true, pedidoId: true } });
  if (!cuota) return { resultado: "sin_pago" };

  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return { resultado: "sin_cobros" };

  const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
  let pago;
  try {
    pago = input.providerPaymentId
      ? await adapter.getPayment(input.providerPaymentId)
      : // Primero la referencia nueva (con el pedido); si no hay, la vieja (preferencias abiertas antes).
        ((await adapter.searchPaymentsByExternalReference(referenciaCuota(cuota.id, cuota.pedidoId))) ??
        (await adapter.searchPaymentsByExternalReference(referenciaCuota(cuota.id))));
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
