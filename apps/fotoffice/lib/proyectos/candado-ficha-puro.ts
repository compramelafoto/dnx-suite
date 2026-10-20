import { importeSinCentavos, mensajeCandado } from "@/lib/pedidos/candado-saldo-puro";
import { esEtapaDeEntrega, faseDeEtapa, retenido } from "./en-curso-puro";

/**
 * El candado del saldo visto desde la ficha del trabajo (módulo PURO). El motor de recorridos ya
 * rechaza entregar con deuda (`lib/pedidos/candado-saldo`); esto es para que la ficha lo diga
 * antes, con las mismas reglas: qué etapas son de entrega (`esEtapaDeEntrega`) y cuándo está
 * retenido (`retenido`, como la tarjeta del tablero «En curso»).
 */
export type CandadoFicha = {
  /** El texto del rechazo, exacto: va de `title` en lo que queda bloqueado. */
  mensaje: string;
  /** «Retenido · debe $ X» si está listo para retirar; si no, «Debe $ X». */
  etiqueta: string;
  /** Etapas a las que no se puede mover (las de entrega, salvo la actual). */
  etapasBloqueadas: string[];
};

export function candadoDeLaFicha(d: {
  pedido: { numero: string; saldoMinor: number } | null;
  etapas: readonly { id: string; name: string; color: string; order: number; archivada: boolean }[];
  etapaActualId: string | null;
}): CandadoFicha | null {
  if (!d.pedido || d.pedido.saldoMinor <= 0) return null;
  const activas = d.etapas.filter((e) => !e.archivada);
  const ultima = activas.length > 0 ? Math.max(...activas.map((e) => e.order)) : null;
  const actual = d.etapas.find((e) => e.id === d.etapaActualId) ?? null;
  const fase = actual ? faseDeEtapa({ ...actual, esUltima: actual.order === ultima }) : null;
  const retiene = fase !== null && retenido({ fase, pedido: d.pedido });
  return {
    mensaje: mensajeCandado(d.pedido.numero, d.pedido.saldoMinor),
    etiqueta: `${retiene ? "Retenido · debe" : "Debe"} ${importeSinCentavos(d.pedido.saldoMinor)}`,
    etapasBloqueadas: activas.filter((e) => e.id !== d.etapaActualId && esEtapaDeEntrega(e, activas)).map((e) => e.id),
  };
}
