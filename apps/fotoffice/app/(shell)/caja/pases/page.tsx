import { PageHeader } from "@/components/page-header";
import { requireCashStaff } from "@/lib/cash/access";
import { listAccounts, listTransfers, userDisplayNames } from "@/lib/cash/repository";
import { formatMinorArs } from "@/lib/membership/money";
import { transferAction } from "../actions";

export const dynamic = "force-dynamic";

function fecha(d: Date) {
  return d.toLocaleString("es-AR");
}

/**
 * El historial de pases entre cuentas.
 *
 * La mayoría nace en el cierre del turno (`/caja/turnos` los propone con la cuenta ya
 * hecha), pero acá se puede cargar uno suelto — por ejemplo, sacar plata de la caja fuerte
 * para volver a poner fondo en el mostrador.
 */
export default async function PasesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireCashStaff();
  const params = await searchParams;

  const [cuentas, pases] = await Promise.all([listAccounts(workspace.id), listTransfers(workspace.id)]);
  const nombres = await userDisplayNames(pases.map((p) => p.createdByUserId));

  return (
    <div className="space-y-8">
      <PageHeader title="Pases" description="Los pases de plata entre cuentas: de la caja del mostrador a la caja fuerte, o al revés." />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Pase hecho.</p> : null}

      {cuentas.length >= 2 ? (
        <form action={transferAction} className="fo-card grid gap-4 p-5 sm:grid-cols-4">
          <input type="hidden" name="returnTo" value="/caja/pases" />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="fromAccountId">
              De
            </label>
            <select id="fromAccountId" name="fromAccountId" className="fo-input" required>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="toAccountId">
              A
            </label>
            <select id="toAccountId" name="toAccountId" className="fo-input" required defaultValue={cuentas[1]?.id}>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="amountArs">
              Importe
            </label>
            <input id="amountArs" name="amountArs" className="fo-input" placeholder="10.000" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="note">
              Nota
            </label>
            <input id="note" name="note" className="fo-input" placeholder="Motivo del pase" />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Pasar
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-[var(--fo-muted-soft)]">
          Hacen falta al menos dos cuentas para pasar plata de una a otra.
        </p>
      )}

      {pases.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted-soft)]">Todavía no se hizo ningún pase.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">De</th>
                <th className="px-4 py-3 font-semibold">A</th>
                <th className="px-4 py-3 text-right font-semibold">Importe</th>
                <th className="px-4 py-3 font-semibold">Quién</th>
                <th className="px-4 py-3 font-semibold">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {pases.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--fo-muted)]">{fecha(p.occurredAt)}</td>
                  <td className="px-4 py-3">{p.fromAccountName}</td>
                  <td className="px-4 py-3">{p.toAccountName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                    {formatMinorArs(p.amountMinor)}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">
                    {p.createdByUserId ? (nombres.get(p.createdByUserId) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
