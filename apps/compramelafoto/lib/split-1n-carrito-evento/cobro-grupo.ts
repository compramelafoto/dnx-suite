import { pagadorTambienRecibe } from "@/lib/cierre-split-1n/config";
import {
  armarDistribucion,
  partesDelPedido,
  repartoDelPedido,
  type ReceptoresCobro,
} from "../split-1n-piloto/cobro";
import type { RepartoPiloto } from "../split-1n-piloto/reparto";
import type { EstadoPiloto } from "../split-1n-piloto/snapshot";

/** Un pedido (un álbum) del carrito, con lo que hace falta para repartirlo. Montos en pesos. */
export type PedidoDelGrupo = {
  pedidoId: number;
  estadoPedido: string;
  totalPesos: number;
  feePesos: number;
  basePesos?: number;
  porcentajeOrganizador: number;
  receivers: ReceptoresCobro;
};

export type CobroGrupoPreparado =
  | {
      ok: true;
      /** Reparto de cada pedido, idéntico al que haría el piloto con ese pedido solo. */
      repartos: Map<number, RepartoPiloto>;
      total: ReturnType<typeof armarDistribucion>["total"];
      distribution: ReturnType<typeof armarDistribucion>["distribution"];
      partnerReceiverIds: Map<string, string>;
      /** Cuentas en la orden, contando la plataforma. */
      receptores: number;
    }
  | {
      ok: false;
      codigo: "GRUPO_VACIO" | "YA_PAGADO" | "ORDEN_EN_CURSO" | "PAGADOR_ES_RECEPTOR" | "DEMASIADOS_RECEPTORES";
    };

/**
 * Todo lo que se decide antes de cobrar un carrito de evento, sin red. Cada pedido se reparte
 * con las mismas cuentas que el piloto (`repartoDelPedido`) y después se suma por cuenta: el
 * organizador, un fotógrafo con dos álbumes o una cuenta con dos roles van una sola vez con la
 * suma. La plataforma cobra la suma de sus restos. Así cada parte recibe exactamente lo que
 * habría recibido si cada álbum se vendía por separado.
 */
export function prepararCobroGrupo(params: {
  pedidos: PedidoDelGrupo[];
  /** Estado del cobro del grupo (marca); null si todavía no tiene. */
  estadoGrupo: EstadoPiloto | null;
  payerEmail: string;
  correosReceptores: string[];
  maxReceptores: number;
}): CobroGrupoPreparado {
  if (params.pedidos.length === 0) return { ok: false, codigo: "GRUPO_VACIO" };
  if (params.pedidos.some((p) => p.estadoPedido !== "PENDING" && p.estadoPedido !== "FAILED")) {
    return { ok: false, codigo: "YA_PAGADO" };
  }
  if (params.estadoGrupo && params.estadoGrupo !== "PENDIENTE") {
    return { ok: false, codigo: "ORDEN_EN_CURSO" };
  }
  if (pagadorTambienRecibe(params.payerEmail, params.correosReceptores)) {
    return { ok: false, codigo: "PAGADOR_ES_RECEPTOR" };
  }

  const repartos = new Map<number, RepartoPiloto>();
  const partes: ReturnType<typeof partesDelPedido> = [];
  let totalPesos = 0;
  let plataformaPesos = 0;
  for (const pedido of params.pedidos) {
    const reparto = repartoDelPedido(pedido);
    repartos.set(pedido.pedidoId, reparto);
    partes.push(...partesDelPedido(reparto, pedido.receivers));
    totalPesos += Math.round(pedido.totalPesos);
    plataformaPesos += reparto.plataforma;
  }

  const { total, distribution, partnerReceiverIds } = armarDistribucion({ totalPesos, plataformaPesos, partes });
  const receptores = partnerReceiverIds.size + 1;
  if (receptores > params.maxReceptores) return { ok: false, codigo: "DEMASIADOS_RECEPTORES" };
  return { ok: true, repartos, total, distribution, partnerReceiverIds, receptores };
}
