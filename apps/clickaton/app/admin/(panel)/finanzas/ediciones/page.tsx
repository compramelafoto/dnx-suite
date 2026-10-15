import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Money } from "@/components/admin/edition-result/Money";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getEditionsComparison } from "@/lib/edition-result/application/queries";

export const dynamic = "force-dynamic";

const ROWS = [
  { key: "paid", label: "Inscripciones pagas" },
  { key: "net", label: "Entró" },
  { key: "fees", label: "Mercado Pago" },
  { key: "expenses", label: "Gastos" },
  { key: "cash", label: "Resultado en plata" },
  { key: "leftover", label: "Sobrante que queda" },
  { key: "received", label: "Mercadería recibida" },
  { key: "economic", label: "Resultado contando sobrante" },
] as const;

export default async function EditionsComparisonPage() {
  await requireClickatonAdmin();
  const rows = await getEditionsComparison();

  const total = rows.reduce(
    (acc, r) => ({
      cash: acc.cash + r.result.cashResultMinor,
      economic: acc.economic + r.result.economicResultMinor,
    }),
    { cash: 0, economic: 0 },
  );

  function cell(key: (typeof ROWS)[number]["key"], r: (typeof rows)[number]) {
    const x = r.result;
    switch (key) {
      case "paid":
        return <span className="tabular-nums">{x.paidRegistrations}</span>;
      case "net":
        return <Money minor={x.netCollectedMinor} />;
      case "fees":
        return <Money minor={-x.mpFeesTotalMinor} />;
      case "expenses":
        return <Money minor={-x.expensesTotalMinor} />;
      case "cash":
        return <Money minor={x.cashResultMinor} signed className="font-semibold" />;
      case "leftover":
        return <Money minor={x.leftoverValueMinor} />;
      case "received":
        return <Money minor={-x.receivedStockValueMinor} />;
      case "economic":
        return <Money minor={x.economicResultMinor} signed className="font-semibold" />;
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Números por edición"
        description="Cada edición con sus números reales, una al lado de la otra. Los ingresos salen de las ventas; gastos, sobrante y comisiones se cargan en cada edición."
        breadcrumbs={[{ label: "Números por edición" }]}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card variant="outlined" className="p-4">
          <p className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Acumulado en plata</p>
          <p className="mt-1 text-2xl font-semibold">
            <Money minor={total.cash} signed />
          </p>
        </Card>
        <Card variant="outlined" className="p-4">
          <p className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">Acumulado contando sobrante</p>
          <p className="mt-1 text-2xl font-semibold">
            <Money minor={total.economic} signed />
          </p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-[var(--ck-radius-sm)] border border-ck-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-ck-border text-left">
              <th scope="col" className="p-3 font-normal text-ck-text-muted" />
              {rows.map((r) => (
                <th key={r.editionId} scope="col" className="p-3 align-bottom font-semibold text-ck-text">
                  <a
                    href={`${adminRoutes.editions}/${r.editionId}/numeros`}
                    className="hover:text-ck-yellow hover:underline"
                  >
                    {r.name}
                  </a>
                  {r.startAt && r.startAt > new Date() ? (
                    <div className="mt-1">
                      <Badge variant="brand">En venta</Badge>
                    </div>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-b border-ck-border last:border-b-0">
                <th scope="row" className="p-3 text-left font-normal text-ck-text-secondary">
                  {row.label}
                </th>
                {rows.map((r) => (
                  <td key={r.editionId} className="p-3 text-right">
                    {cell(row.key, r)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="p-3 text-left font-normal text-ck-text-secondary">
                Falta cargar
              </th>
              {rows.map((r) => (
                <td key={r.editionId} className="p-3 text-right text-xs text-ck-text-muted">
                  {r.result.warnings.length === 0 ? "Nada" : `${r.result.warnings.length} cosas`}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ck-text-muted">
        Una edición que todavía está en venta muestra lo que ya ingresó hasta hoy.
      </p>
    </div>
  );
}
