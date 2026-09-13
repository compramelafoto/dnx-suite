import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCashStaff } from "@/lib/cash/access";
import { listAccounts, listCategories, movementsForReport } from "@/lib/cash/repository";
import { accountBalanceMinor, periodSummary, topClients, totalsByCategory } from "@/lib/cash/balance";
import { categoryReportRows, type CategoryReportRow } from "@/lib/cash/category-report";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { esPeriodShortcut, resolvePeriodShortcut, type PeriodShortcut } from "@/lib/cash/period";
import { PeriodFilter } from "./period-filter";

export const dynamic = "force-dynamic";

/** El fin del día incluido: "hasta el 10" tiene que traer también lo cargado el 10. */
function finDelDia(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999`);
}

function inicioDelDia(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

/** "Hoy" en la hora del servidor, como "YYYY-MM-DD". Es la misma referencia que usan los atajos. */
function hoyYmd(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function CategoryTable({ title, rows }: { title: string; rows: CategoryReportRow[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--fo-text)]">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no hay categorías configuradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-2 font-semibold">Categoría</th>
                <th className="px-4 py-2 text-right font-semibold">Movimientos</th>
                <th className="px-4 py-2 text-right font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {rows.map((r) => (
                <tr key={r.categoryId ?? "sin-categoria"}>
                  <td className="px-4 py-2">{r.categoryName}</td>
                  <td className="px-4 py-2 text-right text-[var(--fo-muted)]">{r.count}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatMinorArs(r.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ shortcut?: string; from?: string; to?: string; accountId?: string }>;
}) {
  const { workspace } = await requireCashStaff();
  const sp = await searchParams;

  // Un rango libre (`from` y `to` en la URL) manda por sobre cualquier atajo: es lo que la
  // Secretaría acaba de elegir a mano. Sin los dos, se resuelve un atajo — el de la URL si es
  // válido, si no "este-mes" por omisión.
  let activeShortcut: PeriodShortcut | null = null;
  let range: { from: string; to: string };
  if (sp.from && sp.to) {
    range = { from: sp.from, to: sp.to };
  } else {
    activeShortcut = esPeriodShortcut(sp.shortcut) ? sp.shortcut : "este-mes";
    range = resolvePeriodShortcut(activeShortcut, hoyYmd());
  }

  const accountId = sp.accountId || undefined;

  const [cuentas, categoriasIngreso, categoriasEgreso, movimientosPeriodo, movimientosDeTodaLaHistoria] =
    await Promise.all([
      listAccounts(workspace.id),
      listCategories(workspace.id, "INGRESO"),
      listCategories(workspace.id, "EGRESO"),
      movementsForReport(workspace.id, {
        from: inicioDelDia(range.from),
        to: finDelDia(range.to),
        accountId,
      }),
      // El saldo es una foto de HOY, no del período elegido: por eso esta consulta no lleva
      // fecha ni el filtro de cuenta del selector, y por eso es una consulta aparte de la de
      // arriba en vez de reutilizar `movimientosPeriodo`.
      prisma.cashMovement.findMany({
        where: { workspaceId: workspace.id },
        select: { accountId: true, kind: true, amountArs: true },
      }),
    ]);

  const saldosPorCuenta = cuentas.map((cuenta) => {
    const propios = movimientosDeTodaLaHistoria
      .filter((m) => m.accountId === cuenta.id)
      .map((m) => ({ kind: m.kind as "INGRESO" | "EGRESO", amountMinor: decimalArsToMinor(m.amountArs) }));
    return { id: cuenta.id, name: cuenta.name, balanceMinor: accountBalanceMinor(propios) };
  });

  // Ninguna cuenta de las de acá para abajo filtra transferencias a mano: `periodSummary`,
  // `totalsByCategory` y `topClients` ya las excluyen (o no, según corresponda) adentro. Si
  // este archivo les sacara las transferencias antes de llamarlas, las estaría contando dos
  // veces afuera y adentro, con un signo distinto cada vez.
  const resumen = periodSummary(movimientosPeriodo);
  const totalesPorCategoria = totalsByCategory(movimientosPeriodo);
  const filasIngresos = categoryReportRows(categoriasIngreso, totalesPorCategoria, "INGRESO");
  const filasEgresos = categoryReportRows(categoriasEgreso, totalesPorCategoria, "EGRESO");
  const clientesTop = topClients(movimientosPeriodo, 10);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reportes"
        description="Saldo por cuenta, lo que entró y salió del período, y quiénes compraron más."
      />

      <PeriodFilter accounts={cuentas} accountId={accountId} from={range.from} to={range.to} activeShortcut={activeShortcut} />

      <section className="fo-card space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Saldo actual por cuenta</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Cuánto hay ahora en cada cuenta, sin importar el período de arriba: un saldo es una foto de hoy, no de
            un rango de fechas. Incluye los pases entre cuentas.
          </p>
        </div>
        {saldosPorCuenta.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no hay ninguna cuenta configurada.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saldosPorCuenta.map((c) => (
              <div key={c.id} className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-4">
                <p className="text-sm text-[var(--fo-muted)]">{c.name}</p>
                <p className="text-lg font-semibold">{formatMinorArs(c.balanceMinor)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Resumen del período</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-4">
            <p className="text-sm text-[var(--fo-muted)]">Entró</p>
            <p className="text-lg font-semibold text-[var(--fo-success)]">{formatMinorArs(resumen.incomeMinor)}</p>
          </div>
          <div className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-4">
            <p className="text-sm text-[var(--fo-muted)]">Salió</p>
            <p className="text-lg font-semibold text-[var(--fo-danger)]">{formatMinorArs(resumen.expenseMinor)}</p>
          </div>
          <div className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-4">
            <p className="text-sm text-[var(--fo-muted)]">Neto</p>
            <p className="text-lg font-semibold">{formatMinorArs(resumen.netMinor)}</p>
          </div>
        </div>
        <p className="text-xs text-[var(--fo-muted-soft)]">
          No incluye los pases entre cuentas —como el que va del mostrador a la caja fuerte—: esa plata no salió del
          negocio, cambió de lugar. Si se contara, los gastos del período incluirían cada pase del día.
        </p>
      </section>

      <section className="fo-card space-y-5 p-5">
        <h2 className="text-base font-semibold">Ingresos y egresos por categoría</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryTable title="Ingresos" rows={filasIngresos} />
          <CategoryTable title="Egresos" rows={filasEgresos} />
        </div>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Los clientes que más compraron</h2>
        {clientesTop.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no hay compras de clientes en este período.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th className="px-4 py-2 font-semibold">Cliente</th>
                  <th className="px-4 py-2 text-right font-semibold">Comprado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                {clientesTop.map((c) => (
                  <tr key={c.clientId}>
                    <td className="px-4 py-2">{c.clientName}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatMinorArs(c.totalMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
