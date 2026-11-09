import { idOrdenDelAviso } from "./aviso";
import { resolvePilotoConfig } from "./config";
import { pedidoIdDesdeReferencia } from "./decidir";
import { finalizarPedidoPiloto } from "./finalizar";
import { crearClientesPiloto, leerOrdenMp } from "./mp";
import { finalizarGrupo } from "../split-1n-carrito-evento/finalizar-grupo";
import { grupoIdDesdeReferencia } from "../split-1n-carrito-evento/marca";

export type WebhookPilotoResult =
  | { manejado: false }
  /** `reintentar`: no se pudo confirmar algo cobrado; se responde error para que Mercado Pago reintente. */
  | { manejado: true; resultado: string; reintentar?: boolean };

/** Resultados de un grupo que no necesitan reintento: la orden no está acreditada o no es del grupo. */
const GRUPO_SIN_REINTENTO = new Set(["aplicado", "ya_pagado", "no_acreditada", "referencia_distinta"]);

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
    // Carrito de evento: una orden para varios pedidos, con su propia referencia.
    const grupoId = grupoIdDesdeReferencia(mp.externalReference);
    if (grupoId != null) {
      const fin = await finalizarGrupo({ grupoId, providerOrderId }).catch((err: unknown) => ({
        ok: false as const,
        error: `excepcion: ${err instanceof Error ? err.message : String(err)}`,
      }));
      const resultado = fin.ok ? fin.resultado : fin.error;
      const reintentar = !GRUPO_SIN_REINTENTO.has(resultado);
      console.info("[carrito-evento] aviso", { grupoId, providerOrderId, resultado, reintentar });
      return { manejado: true, resultado, reintentar };
    }

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
