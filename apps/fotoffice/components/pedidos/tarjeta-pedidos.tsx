import Link from "next/link";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import { ETIQUETA_ESTADO_PEDIDO, type EstadoPedido } from "@/lib/pedidos/constantes";
import { fechaCorta, pesosPedido } from "@/lib/pedidos/pantalla";

/** Lo que muestra la tarjeta de cada pedido: precio al cliente, cobrado y saldo. Nunca costos. */
export type PedidoDeTarjeta = {
  id: string;
  numero: string;
  estado: EstadoPedido;
  total: number;
  aCobrar: number;
  vencido: number;
  eventDate: string | null;
  proximoVencimiento: string | null;
};

const COLOR: Record<EstadoPedido, string> = {
  CONFIRMADO: "azul",
  EN_CURSO: "violeta",
  COMPLETADO: "verde",
  CANCELADO: "gris",
};

/** Puro: de una fila de `listarPedidos` a la tarjeta (sólo lo que se muestra). */
export function aTarjetaPedido(f: PedidoDeTarjeta): PedidoDeTarjeta {
  return {
    id: f.id,
    numero: f.numero,
    estado: f.estado,
    total: f.total,
    aCobrar: f.aCobrar,
    vencido: f.vencido,
    eventDate: f.eventDate,
    proximoVencimiento: f.proximoVencimiento,
  };
}

/**
 * Tarjeta "Pedidos" de la ficha del contacto y de la consulta: número, estado, total, saldo y
 * próximo vencimiento, con enlace al pedido. "Nuevo pedido" (sólo en el contacto) con "Gestionar"
 * en Pedidos (lo decide el servidor).
 */
export function TarjetaPedidos({
  pedidos,
  hrefNuevo = null,
  vacio = "Todavía no hay pedidos.",
}: {
  pedidos: PedidoDeTarjeta[];
  /** null: sin botón "Nuevo pedido". */
  hrefNuevo?: string | null;
  vacio?: string;
}) {
  return (
    <section aria-labelledby="tarjeta-pedidos-titulo" className="fo-card space-y-3 p-4">
      <h2 id="tarjeta-pedidos-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Pedidos
      </h2>
      {pedidos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">{vacio}</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {pedidos.map((p) => (
            <li key={p.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/pedidos/${encodeURIComponent(p.id)}`} className="block rounded-[var(--fo-radius-sm)] hover:bg-[var(--fo-surface-hover)]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--fo-text)]">N° {p.numero}</span>
                  <span className="shrink-0 tabular-nums text-[var(--fo-text)]">{pesosPedido(p.total)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fo-muted)]">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${claseDeColorEtiqueta(COLOR[p.estado])}`}>
                    {ETIQUETA_ESTADO_PEDIDO[p.estado]}
                  </span>
                  {p.eventDate ? <span>Evento {fechaCorta(p.eventDate)}</span> : null}
                  {p.aCobrar > 0 ? (
                    <span className={p.vencido > 0 ? "font-medium text-[var(--fo-danger)]" : undefined}>Saldo {pesosPedido(p.aCobrar)}</span>
                  ) : null}
                  {p.proximoVencimiento ? <span>Vence {fechaCorta(p.proximoVencimiento)}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hrefNuevo ? (
        <Link href={hrefNuevo} className="fo-btn fo-btn-secondary w-full justify-center text-sm">
          Nuevo pedido
        </Link>
      ) : null}
    </section>
  );
}
