import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { requireStoreOperator } from "@/lib/store/access";
import { STORE_ORDER_STATUS_LABELS } from "@/lib/store/constants";
import { listStoreOrders, parseStoreOrderTab, type StoreOrderTab } from "@/lib/store/order-admin";

export const dynamic = "force-dynamic";

const PESTANAS: { tab: StoreOrderTab; label: string }[] = [
  { tab: "preparar", label: "Por preparar" },
  { tab: "listos", label: "Listos" },
  { tab: "entregados", label: "Entregados" },
  { tab: "esperando", label: "Esperando pago" },
  { tab: "problemas", label: "Problemas" },
  { tab: "todos", label: "Todos" },
];

const VACIO: Record<StoreOrderTab, string> = {
  preparar: "No hay pedidos pagados esperando que los prepares.",
  listos: "No hay pedidos listos esperando que los retiren.",
  entregados: "Todavía no se entregó ningún pedido.",
  esperando: "No hay pedidos esperando el pago.",
  problemas: "No hay pedidos con problemas.",
  todos: "Todavía no entró ningún pedido por la tienda online.",
};

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

/**
 * Los pedidos de la tienda online, por pestañas. "Problemas" junta lo que necesita que una
 * persona lo mire: pagos sin stock, pagos duplicados y pagos que no se pudieron registrar.
 */
export default async function PedidosOnlinePage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { workspace, canConfigure } = await requireStoreOperator();
  const sp = await searchParams;
  const tab = parseStoreOrderTab(sp.estado);
  const { rows, counts } = await listStoreOrders(workspace.id, tab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos online"
        description="Lo que entró por la tienda online: qué hay que preparar, qué está listo para retirar y qué hay que resolver."
        actions={
          canConfigure ? (
            <Link href="/ventas/tienda/configuracion" className="fo-btn fo-btn-ghost text-sm">
              Configurar la tienda
            </Link>
          ) : null
        }
      />

      <nav className="flex flex-wrap gap-2" aria-label="Estados">
        {PESTANAS.map((p) => {
          const activa = p.tab === tab;
          const problemas = p.tab === "problemas" && counts.problemas > 0;
          return (
            <Link
              key={p.tab}
              href={`/ventas/tienda?estado=${p.tab}`}
              aria-current={activa ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                activa
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] font-medium text-[var(--fo-text)]"
                  : "border-[var(--fo-border)] text-[var(--fo-text)]"
              }`}
            >
              {p.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  problemas ? "bg-[var(--fo-danger)] font-semibold text-white" : "opacity-70"
                }`}
              >
                {counts[p.tab]}
              </span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="fo-card px-6 py-16 text-center text-sm text-[var(--fo-muted)]">{VACIO[tab]}</div>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-4 py-2 font-semibold">Pedido</th>
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 font-semibold">Comprador</th>
                <th className="px-4 py-2 text-right font-semibold">Total</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--fo-surface-hover)]">
                  <td className="px-4 py-2 font-semibold">
                    <Link href={`/ventas/tienda/${r.id}`} className="underline-offset-2 hover:underline">
                      #{r.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-[var(--fo-muted)]">{fecha(r.createdAt)}</td>
                  <td className="px-4 py-2">
                    <div>{r.buyerName}</div>
                    <div className="text-xs text-[var(--fo-muted)]">{r.buyerEmail}</div>
                  </td>
                  <td className="px-4 py-2 text-right">{formatMinorArs(decimalArsToMinor(r.totalArs))}</td>
                  <td className="px-4 py-2">
                    <span className={r.problem ? "font-medium text-[var(--fo-danger)]" : ""}>
                      {STORE_ORDER_STATUS_LABELS[r.status]}
                    </span>
                    {r.problem && r.status !== "PAID_NO_STOCK" ? (
                      <span className="ml-2 text-xs text-[var(--fo-danger)]">· hay algo para revisar</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
