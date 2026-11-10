import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolvePilotoConfig } from "@/lib/split-1n-piloto/config";
import { finalizarPedidoPiloto } from "@/lib/split-1n-piloto/finalizar";
import { ocultarCorreo } from "@/lib/split-1n-piloto/mensajes";
import { leerMarcaPiloto } from "@/lib/split-1n-piloto/snapshot";
import PagarClient from "./PagarClient";
import PlanBMercadoPago from "./PlanBMercadoPago";

export const dynamic = "force-dynamic";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

/**
 * Pago con tarjeta de un pedido del piloto Split 1:N. Sólo existe para pedidos que la ruta de
 * pedidos desvió hacia acá (los que llevan la marca del piloto); cualquier otro da 404.
 */
export default async function PagarPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId: raw } = await params;
  const orderId = Number(raw);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const config = resolvePilotoConfig();
  // Con el piloto apagado (o sin clave pública) la página sigue atendiendo los pedidos que ya
  // tienen la marca: sin tarjeta, su única salida es «Pagar con Mercado Pago».
  const conTarjeta = config.enabled && config.publicKey != null;
  const conPlanB = config.planB || !conTarjeta;

  const cargarPedido = () => prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      albumId: true,
      buyerEmail: true,
      totalCents: true,
      pricingSnapshot: true,
      album: { select: { title: true } },
      _count: { select: { items: true } },
    },
  });
  let order = await cargarPedido();
  const marcaInicial = order ? leerMarcaPiloto(order.pricingSnapshot) : null;
  if (!order || !marcaInicial) notFound();

  // Conciliación al visitar: si ya hay una orden de Mercado Pago y el pedido no figura pagado
  // (el comprador cerró la página o el aviso no llegó), se verifica y se confirma acá.
  if (order.status !== "PAID" && marcaInicial.providerOrderId) {
    try {
      await finalizarPedidoPiloto({ pedidoId: order.id, providerOrderId: marcaInicial.providerOrderId });
      order = (await cargarPedido()) ?? order;
    } catch (err: unknown) {
      console.error("[split-1n-piloto] conciliacion_visita_fallida", { orderId, err });
    }
  }
  const marca = leerMarcaPiloto(order.pricingSnapshot) ?? marcaInicial;

  const titulo = order.album?.title ?? "tu álbum";
  const fotos = order._count.items;

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {marca.estado === "CHECKOUT_PRO" || !conTarjeta ? "Pagar con Mercado Pago" : "Pagar con tarjeta"}
      </h1>
      <p className="mt-2 text-neutral-700">
        {fotos === 1 ? "1 foto" : `${fotos} fotos`} de «{titulo}» · Total{" "}
        <strong>{pesos.format(order.totalCents)}</strong>
      </p>
      <div className="mt-6">
        {order.status === "PAID" ? (
          <p className="text-emerald-700">
            Esta compra ya está pagada. Revisá tu correo ({ocultarCorreo(order.buyerEmail)}) para descargar las fotos.
          </p>
        ) : marca.estado === "CHECKOUT_PRO" ? (
          <div className="space-y-4">
            <p className="text-neutral-700">
              Elegiste pagar esta compra con Mercado Pago. Si ya pagaste, no pagues de nuevo: te avisamos por
              correo a {ocultarCorreo(order.buyerEmail)} apenas se confirme.
            </p>
            <PlanBMercadoPago pedidoId={order.id} destacado texto="Continuar con Mercado Pago" />
          </div>
        ) : marca.estado !== "PENDIENTE" ? (
          <p className="text-neutral-700">
            Estamos verificando tu pago con Mercado Pago. Te avisamos por correo a {ocultarCorreo(order.buyerEmail)}{" "}
            apenas se confirme. <strong>No pagues de nuevo.</strong>
          </p>
        ) : conTarjeta && config.publicKey ? (
          <PagarClient
            publicKey={config.publicKey}
            orderId={order.id}
            totalPesos={order.totalCents}
            correoVisible={ocultarCorreo(order.buyerEmail)}
            volverA={`/a/${order.albumId}/comprar/resumen`}
            planB={conPlanB}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-700">El pago con tarjeta no está disponible en este momento.</p>
            <PlanBMercadoPago pedidoId={order.id} destacado />
          </div>
        )}
      </div>
    </main>
  );
}
