import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { finalizarPedidoPiloto } from "./finalizar";
import { crearClientesPiloto, leerOrdenMp } from "./mp";
import { cargarPedidoPiloto } from "./pedido";
import { resolverCheckoutSplit, type ResultadoCheckoutSplit } from "./plan-b-split";
import { prepararCobroPedidoPiloto } from "./preparar";
import { cargarConfigPiloto } from "./receptores-clf";
import { marcarSnapshotPiloto } from "./snapshot";

function respuesta(body: unknown): { id: string | null; url: string | null } {
  const b = (body ?? {}) as { id?: unknown; checkout_url?: unknown };
  return {
    id: typeof b.id === "string" && b.id ? b.id : null,
    url: typeof b.checkout_url === "string" && b.checkout_url.startsWith("https://") ? b.checkout_url : null,
  };
}

/** Dependencias reales: la base de CLF y Mercado Pago con el token de la plataforma. */
export async function intentarCheckoutSplit(pedidoId: number): Promise<ResultadoCheckoutSplit> {
  const config = await cargarConfigPiloto();
  return resolverCheckoutSplit(
    {
      config,
      baseUrl: process.env.APP_URL || "https://www.compramelafoto.com",
      ahora: () => new Date(),
      cargar: () => cargarPedidoPiloto(pedidoId),
      async cambiarMarca(snapshot, leida, cambios) {
        const r = await prisma.order.updateMany({
          where: {
            id: pedidoId,
            status: { in: ["PENDING", "FAILED"] },
            pricingSnapshot: { path: ["split1nPiloto"], equals: leida as unknown as Prisma.InputJsonValue },
          },
          data: { pricingSnapshot: marcarSnapshotPiloto(snapshot, cambios) as Prisma.InputJsonValue },
        });
        return r.count === 1;
      },
      async estadoOrden(providerOrderId) {
        const { http } = crearClientesPiloto(config);
        return (await leerOrdenMp(http, providerOrderId)).status;
      },
      async confirmar(providerOrderId) {
        const r = await finalizarPedidoPiloto({ pedidoId, providerOrderId });
        return r.ok;
      },
      async cancelarOrden(providerOrderId) {
        const { http } = crearClientesPiloto(config);
        await http.request<unknown>({
          method: "POST",
          path: `/v1/orders/${encodeURIComponent(providerOrderId)}/cancel`,
          idempotencyKey: `cancelar-${providerOrderId}`,
        });
      },
      preparar: (cargado, marca) => prepararCobroPedidoPiloto({ config, cargado, marca }),
      async crearOrden(clientes, body, idempotencyKey) {
        const res = await clientes.http.request<unknown>({ method: "POST", path: "/v1/orders", body, idempotencyKey });
        return respuesta(res.body);
      },
    },
    pedidoId,
  );
}
