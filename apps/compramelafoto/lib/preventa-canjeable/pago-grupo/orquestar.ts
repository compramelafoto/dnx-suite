/**
 * Pasos del pago agrupado de preventa con sus dependencias inyectadas (sin base ni red), para
 * poder probarlos. `servicio.ts` los conecta con Prisma y Mercado Pago.
 */
import {
  decidirFinalizacionGrupo,
  grupoIdDesdeReferenciaPreventa,
  reversionDelGrupo,
  type PedidoDelGrupo,
} from "./reglas";

export type GrupoGuardado = {
  id: string;
  orderIds: number[];
  status: string;
  mpPaymentId: string | null;
};

export type PagoLeido = {
  externalReference: string | null | undefined;
  status: string;
  statusDetail?: string | null;
  monto: number;
  moneda?: string | null;
};

export type ResultadoFinalizarPedido = { ok: boolean; error?: string; skipped?: string };

export type DepsFinalizarGrupo = {
  cargarGrupo(grupoId: string): Promise<GrupoGuardado | null>;
  cargarPedidos(orderIds: number[]): Promise<PedidoDelGrupo[]>;
  /** Pago actual en Mercado Pago (no el del aviso: puede haber cambiado). */
  leerPago(paymentId: string): Promise<PagoLeido>;
  finalizarPedido(orderId: number, paymentId: string, grupo: GrupoGuardado): Promise<ResultadoFinalizarPedido>;
  marcarGrupoPagado(grupoId: string, paymentId: string): Promise<void>;
  /** Comprobante único a la familia (idempotente por grupo). */
  encolarComprobante(grupoId: string, paymentId: string): Promise<void>;
};

export type ResultadoFinalizarGrupo =
  | {
      ok: true;
      confirmados: number[];
      yaPagados: number[];
      fallidos: Array<{ orderId: number; error: string }>;
      /** Pedidos donde este pago resultó ser un segundo cobro (se avisa adentro de la finalización). */
      duplicados: number[];
      grupoPagado: boolean;
    }
  | { ok: false; error: string; detalle?: string };

/**
 * Confirma todos los pedidos de un grupo con UN pago aprobado. Cada pedido se finaliza con la
 * misma función que un pedido suelto (comisiones, referidos, organizador, entrega, avisos al
 * fotógrafo). Si uno falla, los demás siguen y el próximo aviso, la pantalla de pago exitoso o el
 * cron de conciliación lo completa (la finalización es idempotente por pedido).
 */
export async function finalizarGrupoConDeps(
  deps: DepsFinalizarGrupo,
  params: { grupoId: string; paymentId: string },
): Promise<ResultadoFinalizarGrupo> {
  const grupo = await deps.cargarGrupo(params.grupoId);
  if (!grupo) return { ok: false, error: "grupo_inexistente" };

  const pago = await deps.leerPago(params.paymentId);
  const pedidos = await deps.cargarPedidos(grupo.orderIds);
  const decision = decidirFinalizacionGrupo({
    grupoId: grupo.id,
    orderIds: grupo.orderIds,
    paymentId: params.paymentId,
    pago,
    pedidos,
  });
  if (decision.accion === "ignorar") {
    return { ok: false, error: decision.motivo, detalle: decision.detalle };
  }

  const confirmados: number[] = [];
  const fallidos: Array<{ orderId: number; error: string }> = [];
  const duplicados: number[] = [];
  for (const orderId of decision.aFinalizar) {
    try {
      const r = await deps.finalizarPedido(orderId, params.paymentId, grupo);
      if (!r.ok) fallidos.push({ orderId, error: r.error ?? "error" });
      else if (r.skipped === "duplicate_payment" || r.skipped === "payment_assigned_elsewhere") duplicados.push(orderId);
      else confirmados.push(orderId);
    } catch (err: unknown) {
      fallidos.push({ orderId, error: String((err as Error)?.message ?? err) });
    }
  }

  // El grupo queda pagado sólo si TODOS sus pedidos quedaron pagados con este pago.
  const despues = await deps.cargarPedidos(grupo.orderIds);
  const todosConEstePago =
    despues.length === grupo.orderIds.length &&
    despues.every((p) => p.status === "PAID" && String(p.mpPaymentId ?? "") === String(params.paymentId));
  if (todosConEstePago) {
    await deps.marcarGrupoPagado(grupo.id, params.paymentId);
    await deps.encolarComprobante(grupo.id, params.paymentId);
  }

  return {
    ok: true,
    confirmados,
    yaPagados: decision.yaPagados,
    fallidos,
    duplicados,
    grupoPagado: todosConEstePago,
  };
}

export type MotivoReversion = "REFUNDED" | "CHARGED_BACK" | "REJECTED" | "CANCELLED";

export type DepsRevertirGrupo = {
  cargarGrupo(grupoId: string): Promise<GrupoGuardado | null>;
  /** Anula un pedido pagado con ESTE pago (no hace nada si se pagó con otro). */
  revertirPedido(params: {
    orderId: number;
    mpPaymentId: string;
    mpStatus: string;
    statusDetail?: string;
    auditReason: MotivoReversion;
  }): Promise<{ applied: boolean }>;
  /** Pedido que todavía esperaba el pago: queda FAILED (se puede volver a pagar). */
  marcarFallidoSiPendiente(orderId: number, mpPaymentId: string): Promise<void>;
  marcarGrupo(grupoId: string, status: "REFUNDED" | "FAILED"): Promise<void>;
};

/**
 * Devolución total o contracargo del pago: se anulan TODOS los pedidos del grupo. Un rechazo o
 * cancelación deja como fallidos los que esperaban. La devolución de un solo pack (parcial) no
 * llega acá: Mercado Pago deja el pago en "approved", y se resuelve a mano.
 */
export async function revertirGrupoConDeps(
  deps: DepsRevertirGrupo,
  params: { grupoId: string; paymentId: string; mpStatus: string; statusDetail?: string },
): Promise<{ ok: boolean; revertidos: number[]; error?: string }> {
  const motivo = reversionDelGrupo(params.mpStatus);
  if (!motivo) return { ok: false, revertidos: [], error: "estado_sin_reversion" };
  const grupo = await deps.cargarGrupo(params.grupoId);
  if (!grupo) return { ok: false, revertidos: [], error: "grupo_inexistente" };

  const revertidos: number[] = [];
  for (const orderId of [...grupo.orderIds].sort((a, b) => a - b)) {
    const r = await deps.revertirPedido({
      orderId,
      mpPaymentId: params.paymentId,
      mpStatus: params.mpStatus,
      statusDetail: params.statusDetail,
      auditReason: motivo,
    });
    if (r.applied) revertidos.push(orderId);
    else if (motivo === "REJECTED" || motivo === "CANCELLED") {
      await deps.marcarFallidoSiPendiente(orderId, params.paymentId);
    }
  }

  if (motivo === "REFUNDED" || motivo === "CHARGED_BACK") {
    // Sólo si es el pago con el que se pagó el grupo (no la devolución de un segundo cobro).
    if (String(grupo.mpPaymentId ?? "") === String(params.paymentId)) await deps.marcarGrupo(grupo.id, "REFUNDED");
  } else if (grupo.status === "PENDING") {
    await deps.marcarGrupo(grupo.id, "FAILED");
  }
  return { ok: true, revertidos };
}

export type DepsAvisoGrupo = {
  leerPago(paymentId: string): Promise<PagoLeido>;
  /** Registra el aviso (pago + estado). `true` si ya se había procesado. */
  yaProcesado(paymentId: string, pago: PagoLeido, grupoId: string): Promise<boolean>;
  finalizar(grupoId: string, paymentId: string): Promise<ResultadoFinalizarGrupo>;
  revertir(params: { grupoId: string; paymentId: string; mpStatus: string; statusDetail?: string }): Promise<unknown>;
};

/** Aviso (webhook) de Mercado Pago de un pago cuya referencia es un grupo de preventa. */
export async function procesarAvisoGrupoConDeps(
  deps: DepsAvisoGrupo,
  params: { paymentId: string },
): Promise<{ ok: true; grupoId: string | null; status: string; note: string }> {
  const pago = await deps.leerPago(params.paymentId);
  const grupoId = grupoIdDesdeReferenciaPreventa(pago.externalReference);
  if (!grupoId) return { ok: true, grupoId: null, status: pago.status, note: "no_es_grupo_preventa" };
  if (await deps.yaProcesado(params.paymentId, pago, grupoId)) {
    return { ok: true, grupoId, status: pago.status, note: "already_processed" };
  }
  if (pago.status === "approved") {
    const r = await deps.finalizar(grupoId, params.paymentId);
    return { ok: true, grupoId, status: pago.status, note: r.ok ? "grupo_finalizado" : `grupo_no_finalizado:${r.error}` };
  }
  if (reversionDelGrupo(pago.status)) {
    await deps.revertir({
      grupoId,
      paymentId: params.paymentId,
      mpStatus: pago.status,
      statusDetail: pago.statusDetail ?? undefined,
    });
    return { ok: true, grupoId, status: pago.status, note: "grupo_revertido" };
  }
  return { ok: true, grupoId, status: pago.status, note: "sin_cambios" };
}
