import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { resolvePilotoConfig } from "../split-1n-piloto/config";
import { confirmarPedidoPagado, registrarComisiones, type FinalizarPilotoResult } from "../split-1n-piloto/finalizar";
import { crearClientesPiloto, leerOrdenMp } from "../split-1n-piloto/mp";
import { cargarGrupo } from "./cargar";
import { encolarComprobanteGrupo } from "./correo";
import { decidirFinalizacionGrupo } from "./decidir-grupo";
import { grupoIdDesdeReferencia, marcaComoPiloto, marcarSnapshotGrupo } from "./marca";

/**
 * Confirma un carrito de evento cuando su orden de Mercado Pago quedó acreditada (D4).
 *
 * Primero se prepara la entrega de todos los pedidos que faltan; después cada uno pasa a pagado
 * por su cuenta (escritura condicionada) y corre sus efectos con las piezas del piloto, con el
 * mismo `mpPaymentId`. Un pedido que falla lo completa el próximo aviso o visita. Al final, si
 * todo el grupo quedó pagado, sale un solo comprobante al comprador.
 */
export async function finalizarGrupo(params: {
  grupoId: string;
  providerOrderId: string;
}): Promise<FinalizarPilotoResult> {
  const grupo = await cargarGrupo(params.grupoId);
  if (!grupo) return { ok: false, error: "grupo_inexistente" };

  const { http } = crearClientesPiloto(resolvePilotoConfig());
  const mp = await leerOrdenMp(http, params.providerOrderId);
  const decision = decidirFinalizacionGrupo({
    grupoId: grupo.grupoId,
    refGrupoId: grupoIdDesdeReferencia(mp.externalReference),
    mpStatus: mp.status,
    mpStatusDetail: mp.statusDetail,
    pedidos: grupo.pedidos.map((p) => ({ id: p.order.id, status: p.order.status })),
  });
  if (decision.accion !== "confirmar") return { ok: false, error: decision.accion };

  const paymentRef = mp.paymentId ?? mp.id;
  const porId = new Map(grupo.pedidos.map((p) => [p.order.id, p]));

  // Los ya pagados: se re-aseguran sus comisiones (idempotente), como en el piloto.
  for (const id of decision.yaPagados) {
    const p = porId.get(id);
    if (!p || p.marca.estado !== "PAGADO") continue;
    await registrarComisiones({
      order: p.order,
      marca: marcaComoPiloto(p.marca),
      feePesos: p.feePesos,
      paymentRef: p.order.mpPaymentId ?? paymentRef,
    });
  }

  // Como Checkout Pro: la entrega se prepara antes de marcar pagado. Si falla, ningún pedido
  // pendiente pasa a pagado y el próximo intento lo retoma.
  for (const id of decision.aConfirmar) await ensureDigitalDelivery(id);

  let aplicados = 0;
  const fallidos: number[] = [];
  for (const id of decision.aConfirmar) {
    const p = porId.get(id);
    if (!p) continue;
    if (!p.marca.cobro) {
      console.error("[carrito-evento] pedido_sin_reparto", { grupoId: grupo.grupoId, pedidoId: id });
    }
    try {
      const aplicado = await confirmarPedidoPagado({
        order: p.order,
        marca: marcaComoPiloto(p.marca),
        feePesos: p.feePesos,
        paymentRef,
        providerOrderId: mp.id,
        externalReference: mp.externalReference,
        snapshotPagado: marcarSnapshotGrupo(p.order.pricingSnapshot, { estado: "PAGADO", providerOrderId: mp.id }),
        canal: "split-1n-carrito-evento",
        omitirComprobanteComprador: true,
      });
      if (aplicado) aplicados++;
    } catch (err: unknown) {
      fallidos.push(id);
      console.error("[carrito-evento] confirmar_pedido_fallido", {
        grupoId: grupo.grupoId,
        pedidoId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (fallidos.length > 0) return { ok: false, error: `pedidos_sin_confirmar_${fallidos.join("_")}` };

  try {
    await encolarComprobanteGrupo(grupo.grupoId);
  } catch (err: unknown) {
    // Lo retoma la red de seguridad de comprobantes (cron) o el próximo aviso.
    console.error("[carrito-evento] comprobante_no_encolado", { grupoId: grupo.grupoId, err });
  }
  console.info("[carrito-evento] grupo_confirmado", { grupoId: grupo.grupoId, providerOrderId: mp.id, aplicados });
  return { ok: true, resultado: aplicados > 0 ? "aplicado" : "ya_pagado" };
}
