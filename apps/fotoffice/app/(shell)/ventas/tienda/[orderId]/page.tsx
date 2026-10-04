import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { requireStoreOperator } from "@/lib/store/access";
import { STORE_ORDER_STATUS_LABELS } from "@/lib/store/constants";
import { cancelNeedsNote, loadStoreOrderDetail, staffTargets } from "@/lib/store/order-admin";
import { OrderActions } from "./order-actions";

export const dynamic = "force-dynamic";

function fecha(d: Date) {
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** El detalle de un pedido online: qué se compró, quién, su venta, su historia y qué se puede hacer. */
export default async function PedidoOnlinePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { workspace } = await requireStoreOperator();
  const { orderId } = await params;
  const pedido = await loadStoreOrderDetail(workspace.id, orderId);
  if (!pedido) notFound();

  const targets = staffTargets(pedido.status, { amountMismatch: pedido.amountMismatch });
  const entroPlata = pedido.status === "PAID" || pedido.status === "READY" || pedido.status === "PAID_NO_STOCK";

  return (
    <div className="space-y-6">
      <Link href="/ventas/tienda" className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Pedidos online
      </Link>
      <PageHeader
        title={`Pedido #${pedido.orderNumber}`}
        description={`${STORE_ORDER_STATUS_LABELS[pedido.status]} · hecho el ${fecha(pedido.createdAt)}`}
      />

      {pedido.amountMismatch ? (
        <p className="fo-card border-[var(--fo-danger)] p-4 text-sm text-[var(--fo-danger)]" role="alert">
          Mercado Pago cobró un monto distinto al total de este pedido, así que no se puede dar por pagado. Cancelalo y
          devolvé el dinero desde Mercado Pago.
        </p>
      ) : pedido.status === "PAID_NO_STOCK" ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          Este pedido se pagó pero no había stock. Cuando repongas, confirmá la venta; si no vas a reponer, cancelalo y
          devolvé el dinero desde Mercado Pago.
        </p>
      ) : pedido.problem ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          Hay algo para revisar —un pago o un pedido de arrepentimiento del comprador—: mirá el historial. Cuando lo resuelvas, marcalo como revisado.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="fo-card space-y-3 p-5 lg:col-span-2">
          <h2 className="text-base font-semibold">Qué compró</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-[var(--fo-muted)]">
                <tr>
                  <th className="py-1 font-semibold">Producto</th>
                  <th className="py-1 text-right font-semibold">Cant.</th>
                  <th className="py-1 text-right font-semibold">Precio</th>
                  <th className="py-1 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)]">
                {pedido.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-1">
                      {i.productName}
                      {i.variantName ? <span className="text-[var(--fo-muted)]"> — {i.variantName}</span> : null}
                    </td>
                    <td className="py-1 text-right">{i.qty}</td>
                    <td className="py-1 text-right">{formatMinorArs(decimalArsToMinor(i.unitPriceArs))}</td>
                    <td className="py-1 text-right">{formatMinorArs(decimalArsToMinor(i.lineTotalArs))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--fo-border)] font-semibold">
                  <td className="py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="py-2 text-right">{formatMinorArs(decimalArsToMinor(pedido.totalArs))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="fo-card space-y-2 p-5 text-sm">
          <h2 className="text-base font-semibold">Quién compró</h2>
          <p>
            {pedido.clientId ? (
              <Link href={`/clientes/${pedido.clientId}`} className="underline">
                {pedido.buyerName}
              </Link>
            ) : (
              pedido.buyerName
            )}
          </p>
          <p className="text-[var(--fo-muted)]">{pedido.buyerEmail}</p>
          {pedido.buyerPhone ? <p className="text-[var(--fo-muted)]">{pedido.buyerPhone}</p> : null}

          <h2 className="pt-3 text-base font-semibold">Venta</h2>
          {pedido.sale ? (
            <p>
              <Link href="/ventas/historial" className="underline">
                Venta #{pedido.sale.saleNumber}
              </Link>
              {pedido.sale.status === "ANULADA" ? <span className="text-[var(--fo-danger)]"> · anulada</span> : null}
            </p>
          ) : (
            <p className="text-[var(--fo-muted)]">Sin venta registrada.</p>
          )}
          {pedido.mpPaymentId ? (
            <p className="text-[var(--fo-muted)]">Operación de Mercado Pago: {pedido.mpPaymentId}</p>
          ) : null}
        </section>
      </div>

      <OrderActions
        orderId={pedido.id}
        targets={targets}
        cancelNeedsNote={cancelNeedsNote(pedido.status)}
        moneyIn={entroPlata}
        hasSale={Boolean(pedido.sale && pedido.sale.status !== "ANULADA")}
        canMarkReviewed={pedido.problem && pedido.status !== "PAID_NO_STOCK"}
      />

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Historial</h2>
        <ol className="space-y-2 text-sm">
          {pedido.events.map((e) => (
            <li key={e.id} className="border-l-2 border-[var(--fo-border)] pl-3">
              <div className="text-[var(--fo-muted)]">
                {fecha(e.createdAt)} ·{" "}
                {e.actorUserId !== null ? (pedido.actorNames[e.actorUserId] ?? "Alguien del equipo") : "Automático"}
              </div>
              <div>
                {e.fromStatus && e.fromStatus !== e.toStatus
                  ? `${STORE_ORDER_STATUS_LABELS[e.fromStatus]} → ${STORE_ORDER_STATUS_LABELS[e.toStatus]}`
                  : STORE_ORDER_STATUS_LABELS[e.toStatus]}
              </div>
              {e.note ? <div className="text-[var(--fo-muted)]">{e.note}</div> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
