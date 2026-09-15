import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { listProducts } from "@/lib/sales/repository";
import { needsRestock } from "@/lib/sales/stock";
import { StockForm } from "../stock-form";

export const dynamic = "force-dynamic";

/**
 * La existencia, para lo único que se abre esta pantalla: saber qué hay que reponer
 * (§regla 7 de la Tarea 8). Por eso los productos por debajo del mínimo —o en negativo—
 * van primero y destacados, y el resto del catálogo queda debajo, secundario.
 *
 * Sólo trae los productos ACTIVOS que controlan existencia (`tracksStock`): un producto
 * dado de baja ya no se vende, así que "reponerlo" no es una decisión que esta pantalla
 * tenga que ofrecer. Un servicio, que nunca controla stock, tampoco tiene nada que hacer
 * acá.
 */
export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireSalesStaff();
  const sp = await searchParams;

  const productos = await listProducts(workspace.id, { onlyActive: true, tracksStock: true });
  const aReponer = productos.filter((p) => needsRestock(p));
  const resto = productos.filter((p) => !needsRestock(p));

  return (
    <div className="space-y-8">
      <PageHeader title="Stock" description="Qué queda, qué entró y qué hay que reponer." />

      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}

      {productos.length === 0 ? (
        <div className="fo-card px-6 py-16 text-center text-sm text-[var(--fo-muted)]">
          Ningún producto activo controla existencia todavía. Se configura desde la ficha del
          producto, en el catálogo.
        </div>
      ) : (
        <>
          {aReponer.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fo-danger)]">
                Para reponer ({aReponer.length})
              </h2>
              <div className="space-y-3">
                {aReponer.map((p) => (
                  <StockForm key={p.id} product={p} destacado />
                ))}
              </div>
            </section>
          ) : (
            <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
              Nada por debajo del mínimo por ahora.
            </p>
          )}

          {resto.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fo-muted)]">Resto del catálogo</h2>
              <div className="space-y-3">
                {resto.map((p) => (
                  <StockForm key={p.id} product={p} destacado={false} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
