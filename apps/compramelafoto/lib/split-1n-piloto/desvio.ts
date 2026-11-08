import { OrderOrigin, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePilotoConfig } from "./config";
import { evaluarElegibilidadPiloto } from "./elegibilidad";
import { buscarReferidorActivo } from "./referidor";
import { marcarSnapshotPiloto } from "./snapshot";

/** Página de pago del piloto: reemplaza al `init_point` de Checkout Pro. */
export function urlPagoPiloto(orderId: number): string {
  return `/pagar/${orderId}`;
}

/**
 * Si el pedido recién creado entra en el piloto, lo marca y devuelve la URL de pago con
 * tarjeta. Si no entra, o si algo falla, devuelve null y la ruta sigue con Checkout Pro:
 * un problema del piloto nunca puede impedir una venta.
 */
export async function desviarAlPilotoSiCorresponde(params: {
  order: { id: number; albumId: number; origin: OrderOrigin | null; pricingSnapshot: unknown };
  photographerUserId: number | null;
  items: Array<{ productType: string }>;
  tieneVideos: boolean;
  esCanje: boolean;
  esPagoSimulado: boolean;
}): Promise<string | null> {
  try {
    const config = resolvePilotoConfig();
    if (!config.enabled || !config.albumIds.has(params.order.albumId)) return null;

    const referrerUserId =
      params.photographerUserId != null
        ? await buscarReferidorActivo(params.photographerUserId)
        : null;
    const elegibilidad = evaluarElegibilidadPiloto({
      config,
      albumId: params.order.albumId,
      photographerUserId: params.photographerUserId,
      referrerUserId,
      items: params.items,
      tieneVideos: params.tieneVideos,
      esCanje: params.esCanje,
      esPagoSimulado: params.esPagoSimulado,
      origenEstandar: (params.order.origin ?? OrderOrigin.STANDARD_CHECKOUT) === OrderOrigin.STANDARD_CHECKOUT,
    });
    if (!elegibilidad.ok) {
      console.info("[split-1n-piloto] sin_desvio", {
        orderId: params.order.id,
        motivo: elegibilidad.motivo,
      });
      return null;
    }

    await prisma.order.update({
      where: { id: params.order.id },
      data: {
        pricingSnapshot: marcarSnapshotPiloto(params.order.pricingSnapshot, {
          estado: "PENDIENTE",
        }) as Prisma.InputJsonValue,
      },
    });
    console.info("[split-1n-piloto] desvio", { orderId: params.order.id });
    return urlPagoPiloto(params.order.id);
  } catch (err: unknown) {
    console.error("[split-1n-piloto] desvio_fallido", {
      orderId: params.order.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
