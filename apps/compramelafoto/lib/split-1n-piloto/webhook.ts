import { idOrdenDelAviso } from "./aviso";
import { resolvePilotoConfig } from "./config";
import { pedidoIdDesdeReferencia } from "./decidir";
import { finalizarPedidoPiloto } from "./finalizar";
import { crearClientesPiloto, leerOrdenMp } from "./mp";

export type WebhookPilotoResult = { manejado: false } | { manejado: true; resultado: string };

/**
 * Aviso `order` de Mercado Pago para un pedido del piloto: confirma el pedido por si el
 * comprador cerró la página antes de tiempo.
 *
 * No depende de la firma del aviso: la orden se lee por GET con el token de la plataforma y
 * eso es la fuente de verdad. Un aviso falso, a lo sumo, provoca una lectura de más.
 * Si la orden no es del piloto, devuelve `manejado: false` y el receptor sigue como siempre
 * (homologación y Muestras no cambian).
 */
export async function intentarWebhookPiloto(params: {
  dataId: string | null;
  type: string | null;
}): Promise<WebhookPilotoResult> {
  const config = resolvePilotoConfig();
  const providerOrderId = idOrdenDelAviso({ enabled: config.enabled, ...params });
  if (!providerOrderId) return { manejado: false };

  try {
    const { http } = crearClientesPiloto(config);
    const mp = await leerOrdenMp(http, providerOrderId);
    const pedidoId = pedidoIdDesdeReferencia(mp.externalReference);
    if (pedidoId == null) return { manejado: false };

    const fin = await finalizarPedidoPiloto({ pedidoId, providerOrderId });
    const resultado = fin.ok ? fin.resultado : fin.error;
    console.info("[split-1n-piloto] aviso", { pedidoId, providerOrderId, resultado });
    return { manejado: true, resultado };
  } catch (err: unknown) {
    // Una orden que no es de esta cuenta (p. ej. de homologación) no se puede leer con el token
    // productivo: sigue el receptor de siempre.
    console.warn("[split-1n-piloto] aviso_no_leido", {
      providerOrderId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { manejado: false };
  }
}
