import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatMinorArs } from "@/lib/membership/money";
import { requireStoreConfigurer } from "@/lib/store/access";
import { loadRoyaltiesToRecover, loadRoyaltyMonth } from "@/lib/store/artworks/royalties";
import {
  arDate,
  arMonthOf,
  monthLabel,
  parseRoyaltyMonth,
  royaltyRowLabel,
  shiftMonth,
} from "@/lib/store/artworks/royalty-report";
import { MarkPaidForm } from "./mark-paid-form";

export const dynamic = "force-dynamic";

/**
 * Regalías de los autores (spec O11, §5.9): resumen mensual por autor en hora argentina,
 * "Marcar pagado" con referencia, CSV y las pagadas de pedidos cancelados ("a recuperar").
 */
export default async function RegaliasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { workspace } = await requireStoreConfigurer();
  const sp = await searchParams;
  const mes = parseRoyaltyMonth(sp.mes);
  const [autores, aRecuperar] = await Promise.all([
    loadRoyaltyMonth(workspace.id, mes),
    loadRoyaltiesToRecover(workspace.id),
  ]);
  // "AAAA-MM" compara bien como texto.
  const hayMesSiguiente = mes < arMonthOf(new Date());
  const totalAPagar = autores.reduce((s, a) => s + a.accruedMinor, 0);
  const totalPagado = autores.reduce((s, a) => s + a.paidMinor, 0);

  return (
    <div className="space-y-6">
      <Link href="/ventas/tienda/obras" className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Obras
      </Link>
      <PageHeader
        title="Regalías"
        description="Lo que le corresponde a cada autor por las copias vendidas de sus obras. Cuenta el mes en que entró el pago, en hora argentina."
        actions={
          <a href={`/ventas/tienda/obras/regalias/csv?mes=${mes}`} className="fo-btn fo-btn-secondary text-sm">
            Exportar CSV
          </a>
        }
      />

      <nav className="flex flex-wrap items-center gap-3 text-sm" aria-label="Mes">
        <Link href={`?mes=${shiftMonth(mes, -1)}`} className="underline">
          ← Mes anterior
        </Link>
        <span className="font-semibold capitalize">{monthLabel(mes)}</span>
        {!hayMesSiguiente ? null : (
          <Link href={`?mes=${shiftMonth(mes, 1)}`} className="underline">
            Mes siguiente →
          </Link>
        )}
      </nav>

      {autores.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">No hay regalías en este mes.</p>
      ) : (
        <>
          <p className="text-sm">
            A pagar: <span className="font-semibold">{formatMinorArs(totalAPagar)}</span> · Pagado:{" "}
            <span className="font-semibold">{formatMinorArs(totalPagado)}</span>
          </p>
          {autores.map((a) => (
            <section key={a.authorUserId} className="fo-card space-y-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{a.name}</h2>
                  {a.email ? <p className="text-sm text-[var(--fo-muted)]">{a.email}</p> : null}
                </div>
                <p className="text-sm">
                  {a.copies === 1 ? "1 copia" : `${a.copies} copias`} · A pagar{" "}
                  <span className="font-semibold">{formatMinorArs(a.accruedMinor)}</span> · Pagado{" "}
                  <span className="font-semibold">{formatMinorArs(a.paidMinor)}</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[var(--fo-muted)]">
                    <tr>
                      <th className="py-1 font-semibold">Pedido</th>
                      <th className="py-1 font-semibold">Obra</th>
                      <th className="py-1 font-semibold">Formato</th>
                      <th className="py-1 text-right font-semibold">Regalía</th>
                      <th className="py-1 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fo-border)]">
                    {a.items.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1">
                          <Link href={`/ventas/tienda/${r.orderId}`} className="underline">
                            #{r.orderNumber}
                          </Link>
                        </td>
                        <td className="py-1">{r.workTitle}</td>
                        <td className="py-1">
                          {r.formatName ?? "—"}
                          {r.qty > 1 ? ` × ${r.qty}` : ""}
                        </td>
                        <td className="py-1 text-right">{formatMinorArs(r.amountMinor)}</td>
                        <td className="py-1">
                          {royaltyRowLabel(r)}
                          {r.status === "PAID" && r.paidAt ? (
                            <span className="text-[var(--fo-muted)]">
                              {" "}
                              · {arDate(r.paidAt)}
                              {r.paidReference ? ` · ${r.paidReference}` : ""}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {a.accruedMinor > 0 ? (
                <MarkPaidForm
                  authorUserId={a.authorUserId}
                  month={mes}
                  royaltyIds={a.items.filter((r) => r.status === "ACCRUED").map((r) => r.id)}
                  amountLabel={formatMinorArs(a.accruedMinor)}
                />
              ) : null}
            </section>
          ))}
        </>
      )}

      {aRecuperar.length > 0 ? (
        <section className="fo-card space-y-3 border-[var(--fo-danger)] p-5">
          <h2 className="text-base font-semibold">A recuperar</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Regalías que ya le pagaste al autor de pedidos que después se cancelaron. Arreglalo con cada autor.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[var(--fo-muted)]">
                <tr>
                  <th className="py-1 font-semibold">Autor</th>
                  <th className="py-1 font-semibold">Pedido</th>
                  <th className="py-1 font-semibold">Obra</th>
                  <th className="py-1 text-right font-semibold">Regalía</th>
                  <th className="py-1 font-semibold">Pagada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)]">
                {aRecuperar.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1">
                      {r.authorName}
                      {r.authorEmail ? <span className="text-[var(--fo-muted)]"> · {r.authorEmail}</span> : null}
                    </td>
                    <td className="py-1">
                      <Link href={`/ventas/tienda/${r.orderId}`} className="underline">
                        #{r.orderNumber}
                      </Link>
                    </td>
                    <td className="py-1">{r.workTitle}</td>
                    <td className="py-1 text-right">{formatMinorArs(r.amountMinor)}</td>
                    <td className="py-1">
                      {r.paidAt ? arDate(r.paidAt) : "—"}
                      {r.paidReference ? <span className="text-[var(--fo-muted)]"> · {r.paidReference}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
