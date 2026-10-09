import Link from "next/link";
import { fechaLarga } from "@/lib/informes/detalle";
import type { FilaDetalleVentas } from "@/lib/informes/ventas";
import { formatMinorArs } from "@/lib/membership/money";

/** Lo que forma una celda de Ventas: un renglón por pedido. */
export function TablaDetalleVentas({ filas, total, cantidad, truncado }: { filas: readonly FilaDetalleVentas[]; total: number; cantidad: number; truncado: boolean }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Pedido</th>
              <th scope="col" className="px-3 py-2 font-semibold">Confirmado</th>
              <th scope="col" className="px-3 py-2 font-semibold">Cliente</th>
              <th scope="col" className="px-3 py-2 font-semibold">Evento</th>
              <th scope="col" className="px-3 py-2 font-semibold">Categoría</th>
              <th scope="col" className="px-3 py-2 font-semibold">Vendedor</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
            {filas.map((f) => (
              <tr key={f.clave}>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link href={`/pedidos/${f.pedidoId}`} className="text-[var(--fo-accent)] hover:underline">
                    {f.numero}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{fechaLarga(f.confirmado)}</td>
                <td className="px-3 py-2">{f.cliente}</td>
                <td className="whitespace-nowrap px-3 py-2 text-[var(--fo-muted)]">{f.fechaEvento ? fechaLarga(f.fechaEvento) : "–"}</td>
                <td className="px-3 py-2">{f.categoria}</td>
                <td className="px-3 py-2">{f.vendedor}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatMinorArs(f.centavos)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] font-semibold">
            <tr>
              <td colSpan={6} className="px-3 py-2">Total ({cantidad} {cantidad === 1 ? "pedido" : "pedidos"})</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatMinorArs(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {truncado ? (
        <p className="text-xs text-[var(--fo-muted)]">Mostramos los primeros {filas.length} pedidos; el total suma todos. El CSV trae la lista completa.</p>
      ) : null}
    </div>
  );
}
