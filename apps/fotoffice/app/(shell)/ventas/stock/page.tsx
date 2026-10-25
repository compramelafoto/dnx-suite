import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { listProducts } from "@/lib/sales/repository";
import {
  consumoDiario,
  diasDeCobertura,
  listaPorProveedor,
  paraComprar,
  textoCobertura,
} from "@/lib/stock/avisos";
import { itemsDeStock } from "@/lib/stock/avisos-servidor";
import { kodak305Pendiente } from "@/lib/stock/kodak305";
import { configurarKodak305Action } from "../actions";
import { StockForm } from "../stock-form";
import { CopiarLista } from "./copiar-lista";

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
  searchParams: Promise<{ error?: string; ok?: string; kodak?: string }>;
}) {
  const { workspace } = await requireSalesStaff();
  const sp = await searchParams;

  const [productos, items, kodakPendiente] = await Promise.all([
    listProducts(workspace.id, { onlyActive: true, tracksStock: true }),
    itemsDeStock(workspace.id),
    kodak305Pendiente(workspace.id),
  ]);
  // Qué comprar sale de `lib/stock/avisos.ts`, la misma regla que usa la tarjeta del inicio:
  // negativo, debajo del mínimo, o una semana de consumo o menos.
  const compras = paraComprar(items);
  const porProveedor = listaPorProveedor(items);
  const productoPorId = new Map(productos.map((p) => [p.id, p]));
  const enCompras = new Set(compras.map((i) => i.productId));
  const cobertura = new Map(
    items.map((i) => [i.productId, textoCobertura(diasDeCobertura(i.stockQty, consumoDiario(i.consumo30)), i.stockQty)]),
  );
  const insumos = productos.filter((p) => p.kind === "INSUMO" && !enCompras.has(p.id));
  const resto = productos.filter((p) => p.kind !== "INSUMO" && !enCompras.has(p.id));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stock"
        description="Qué queda, cuánto te dura y qué hay que comprar."
        actions={
          <Link href="/ventas/stock/recepcion" className="fo-btn fo-btn-primary text-sm">
            Recibir pedido
          </Link>
        }
      />

      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}
      {sp.kodak ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
          Listo, la Kodak 305 quedó configurada. Ahora contá cuántas copias le quedan al ribbon y
          cargalo con &quot;Ajustar por conteo&quot; en el kit.
        </p>
      ) : null}

      {kodakPendiente ? (
        <section className="fo-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">
              Controlá el ribbon de la Kodak 305
            </h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Armamos el kit como insumo y le descontamos las copias que se imprimen. Arranca en
              cero: después lo ajustás por conteo.
            </p>
          </div>
          <form action={configurarKodak305Action}>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Configurar
            </button>
          </form>
        </section>
      ) : null}

      {productos.length === 0 && !kodakPendiente ? (
        <div className="fo-card px-6 py-16 text-center text-sm text-[var(--fo-muted)]">
          Ningún producto activo controla existencia todavía. Se configura desde la ficha del
          producto, en el catálogo.
        </div>
      ) : (
        <>
          {compras.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fo-danger)]">
                Para comprar ({compras.length})
              </h2>
              <p className="text-sm text-[var(--fo-muted)]">
                Lo que está en negativo, debajo del mínimo o que alcanza para una semana o menos,
                según lo que salió en los últimos 30 días.
              </p>
              <div className="space-y-3">
                {compras.map((i) => {
                  const p = productoPorId.get(i.productId);
                  if (!p) return null;
                  const debajo =
                    i.minStockQty !== null && i.stockQty < i.minStockQty
                      ? `Debajo del mínimo (${i.minStockQty})`
                      : null;
                  return (
                    <StockForm
                      key={p.id}
                      product={p}
                      destacado
                      cobertura={textoCobertura(i.dias, i.stockQty)}
                      aviso={debajo}
                    />
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
              Nada para comprar por ahora: nada debajo del mínimo ni por terminarse esta semana.
            </p>
          )}

          {porProveedor.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fo-text)]">Lista para el proveedor</h2>
              <p className="text-sm text-[var(--fo-muted)]">
                Cantidades sugeridas para llegar al mínimo o cubrir un mes de consumo. Copiala y
                mandásela tal cual, o ajustala antes.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {porProveedor.map((g) => (
                  <div key={g.proveedor} className="fo-card space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-[var(--fo-text)]">{g.proveedor}</p>
                      <CopiarLista texto={g.textoCopiable} />
                    </div>
                    <ul className="space-y-1 text-sm text-[var(--fo-text)]">
                      {g.renglones.map((r, idx) => (
                        <li key={`${idx}-${r.texto}`}>- {r.texto}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {insumos.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fo-muted)]">Insumos</h2>
              <div className="space-y-3">
                {insumos.map((p) => (
                  <StockForm
                    key={p.id}
                    product={p}
                    destacado={false}
                    cobertura={cobertura.get(p.id) ?? null}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {resto.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--fo-muted)]">Productos</h2>
              <div className="space-y-3">
                {resto.map((p) => (
                  <StockForm
                    key={p.id}
                    product={p}
                    destacado={false}
                    cobertura={cobertura.get(p.id) ?? null}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
