import { requireMembersManageContext } from "@/lib/members/access";
import { cargarRecorridos } from "@/lib/box-mensual/store";
import { etiquetaBox, prepararCajas } from "@/lib/box-mensual/secuencia";

export const dynamic = "force-dynamic";

/**
 * «Preparar»: cuántas cajas de cada BOX hacen falta ahora y el total de cada material
 * (cantidad por caja × cajas), para armar la compra. Cuenta todas las cajas que se deben: si
 * alguien tiene dos meses pagados sin caja, suma sus dos cajas siguientes.
 */
export default async function BoxPrepararPage() {
  const { workspace } = await requireMembersManageContext();
  const { socios, cajas } = await cargarRecorridos(workspace.id);
  const prep = prepararCajas(
    socios.map((s) => s.recorrido.porEnviar),
    cajas,
  );

  if (prep.totalCajas === 0) {
    return <p className="text-sm text-[var(--fo-muted)]">No hay cajas para preparar ahora.</p>;
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--fo-muted)]">
        {prep.totalCajas === 1 ? "Hace falta armar 1 caja." : `Hacen falta armar ${prep.totalCajas} cajas.`}
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Total de materiales para comprar</h2>
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Material</th>
                <th className="px-4 py-3 font-semibold text-right w-32">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {prep.totales.map((t) => (
                <tr key={t.material}>
                  <td className="px-4 py-2.5 text-[var(--fo-text)]">{t.material}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{t.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Por caja</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {prep.porCaja.map((f) => (
            <article key={f.caja.id} className="fo-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-[var(--fo-text)]">{etiquetaBox(f.caja)}</h3>
                <span className="shrink-0 rounded-full bg-[var(--fo-accent-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fo-accent)]">
                  {f.cantidad === 1 ? "1 caja" : `${f.cantidad} cajas`}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-[var(--fo-muted)]">
                  <tr>
                    <th className="py-1 text-left font-medium">Material</th>
                    <th className="py-1 text-right font-medium w-20">Por caja</th>
                    <th className="py-1 text-right font-medium w-24">{`Para ${f.cantidad}`}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fo-border)]">
                  {f.materiales.map((m) => (
                    <tr key={m.material}>
                      <td className="py-1.5 text-[var(--fo-text)]">{m.material}</td>
                      <td className="py-1.5 text-right tabular-nums text-[var(--fo-muted)]">{m.perBox}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{m.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
