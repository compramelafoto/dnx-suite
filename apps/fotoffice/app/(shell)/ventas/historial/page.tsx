import { PageHeader } from "@/components/page-header";
import { formatMinorArs } from "@/lib/membership/money";
import { requireSalesStaff } from "@/lib/sales/access";
import { listSales, type SaleRow } from "@/lib/sales/repository";
import { voidSaleAction } from "../actions";

export const dynamic = "force-dynamic";

const ETIQUETA_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  MERCADO_PAGO: "Mercado Pago",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

function fecha(d: Date) {
  return d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * El historial de ventas: de la más nueva a la más vieja, con el detalle de renglones y —si
 * está completada— el botón de anular.
 *
 * Las anuladas se muestran igual que las demás, nunca se esconden: es lo que hace que el
 * historial sea creíble. Se marcan con una etiqueta y el importe tachado, y no llevan botón de
 * anular —una venta anulada no se vuelve a anular, y ofrecer el botón igual sólo invitaría un
 * segundo intento que `voidSale` va a rechazar en el servidor.
 *
 * Cada fila es un `<details>`: el detalle de renglones (y el formulario de anulación) se abre
 * sin JavaScript ni un viaje al servidor, y `listSales` ya trajo todo de una sola consulta.
 */
export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireSalesStaff();
  const sp = await searchParams;

  const ventas = await listSales(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader title="Ventas hechas" description="Lo vendido, con su detalle y su anulación." />

      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}

      {ventas.length === 0 ? (
        <div className="fo-card px-6 py-16 text-center text-sm text-[var(--fo-muted)]">
          Todavía no se cargó ninguna venta.
        </div>
      ) : (
        <div className="space-y-3">
          {ventas.map((venta) => (
            <SaleCard key={venta.id} venta={venta} />
          ))}
        </div>
      )}
    </div>
  );
}

function SaleCard({ venta }: { venta: SaleRow }) {
  const anulada = venta.status === "ANULADA";

  return (
    <details className="fo-card group overflow-hidden">
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-sm marker:content-none">
        <span className="font-semibold text-[var(--fo-text)]">Venta #{venta.saleNumber}</span>
        <span className="text-[var(--fo-muted)]">{fecha(venta.occurredAt)}</span>
        <span className="text-[var(--fo-muted)]">{venta.clientName ?? "Sin cliente"}</span>
        <span className="text-[var(--fo-muted)]">{ETIQUETA_PAGO[venta.paymentMethod] ?? venta.paymentMethod}</span>
        {anulada ? (
          <span className="rounded-full border border-[var(--fo-danger)] px-2 py-0.5 text-xs text-[var(--fo-danger)]">
            Anulada
          </span>
        ) : null}
        <span
          className={`ml-auto font-medium ${anulada ? "text-[var(--fo-muted-soft)] line-through" : "text-[var(--fo-text)]"}`}
        >
          {formatMinorArs(venta.totalMinor)}
        </span>
      </summary>

      <div className="space-y-4 border-t border-[var(--fo-border)] px-4 py-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-[var(--fo-muted)]">
              <tr>
                <th className="py-1 font-semibold">Renglón</th>
                <th className="py-1 text-right font-semibold">Cant.</th>
                <th className="py-1 text-right font-semibold">Precio</th>
                <th className="py-1 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)]">
              {venta.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1">{item.description}</td>
                  <td className="py-1 text-right">{item.qty}</td>
                  <td className="py-1 text-right">{formatMinorArs(item.unitPriceMinor)}</td>
                  <td className="py-1 text-right">{formatMinorArs(item.lineTotalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {anulada ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Anulada el {venta.voidedAt ? fecha(venta.voidedAt) : "—"}. Motivo: {venta.voidReason ?? "—"}
          </p>
        ) : (
          <form action={voidSaleAction} className="flex flex-wrap items-end gap-2 border-t border-[var(--fo-border)] pt-4">
            <input type="hidden" name="saleId" value={venta.id} />
            <label className="flex-1 min-w-[220px] space-y-1 text-sm">
              <span className="text-[var(--fo-muted)]">Motivo de la anulación</span>
              <input name="reason" className="fo-input w-full" placeholder="Por qué se anula esta venta" required />
            </label>
            <button type="submit" className="fo-btn fo-btn-danger-outline shrink-0 text-sm">
              Anular venta
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
