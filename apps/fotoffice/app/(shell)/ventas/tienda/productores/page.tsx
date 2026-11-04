import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { appUrl } from "@/lib/app-url";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { requireStoreOperator } from "@/lib/store/access";
import { feedPath, listProductores } from "@/lib/store/fulfillment/repository";
import { garmentName, splitVariantName } from "@/lib/store/fulfillment/feed";
import { CopyFormula } from "./copy-formula";
import { markSentAction, regenerateTokenAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Los productos que produce y despacha otro (dropshipping): la planilla en vivo para el
 * productor, la descarga del CSV y los pedidos que todavía no se le pasaron.
 * Spec: docs/superpowers/specs/2026-11-04-tienda-remeras-dreamful-design.md (sección 3).
 */
export default async function ProductoresPage() {
  const { workspace, canConfigure } = await requireStoreOperator();
  const productores = await listProductores(workspace.id);
  // Sin la dirección configurada (desarrollo local) se arma con la de esta visita.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const base = appUrl() || (host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productores"
        description="Lo que produce y despacha otro: la planilla de pedidos para compartirle y lo que todavía no le pasaste."
        actions={
          <Link href="/ventas/tienda" className="fo-btn fo-btn-ghost text-sm">
            Pedidos online
          </Link>
        }
      />

      {productores.length === 0 ? (
        <div className="fo-card px-6 py-12 text-center text-sm text-[var(--fo-muted)]">
          Ningún producto tiene productor. Elegilo en la ficha online del producto, en «Lo produce».
        </div>
      ) : null}

      {productores.map((p) => {
        const enlace = p.token ? `${base}${feedPath(p.token)}` : null;
        return (
          <section key={p.id} className="fo-card space-y-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">
                {p.name}
                {!p.active ? <span className="ml-2 text-xs font-normal text-[var(--fo-muted)]">(inactivo: la planilla no responde)</span> : null}
              </h2>
              <span className="text-xs text-[var(--fo-muted)]">
                {p.listingsCount === 1 ? "1 producto" : `${p.listingsCount} productos`}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Planilla en vivo</h3>
              {enlace ? (
                <>
                  <CopyFormula formula={`=IMPORTDATA("${enlace}")`} />
                  <p className="fo-helper">
                    Abrí una planilla de Google nueva, pegá esta fórmula en la celda A1 y compartila con el productor. Se
                    actualiza sola, más o menos cada una hora. Trae los pedidos pagados de los últimos 60 días.
                  </p>
                  <a href={`${feedPath(p.token!)}?descargar=1`} className="fo-btn fo-btn-ghost text-sm">
                    Descargar CSV
                  </a>
                </>
              ) : (
                <p className="fo-helper">Todavía no tiene enlace. Generalo para armar la planilla.</p>
              )}
              {canConfigure ? (
                <form action={regenerateTokenAction}>
                  <input type="hidden" name="proveedorId" value={p.id} />
                  <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                    {enlace ? "Regenerar enlace (el anterior deja de funcionar)" : "Generar enlace"}
                  </button>
                </form>
              ) : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Pendientes de pasar</h3>
              {p.pending.length === 0 ? (
                <p className="text-sm text-[var(--fo-muted)]">No hay pedidos pagados pendientes para este productor.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-[var(--fo-muted)]">
                      <tr className="border-b border-[var(--fo-border)]">
                        <th className="px-2 py-2 font-semibold">Pedido</th>
                        <th className="px-2 py-2 font-semibold">Prendas</th>
                        <th className="px-2 py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--fo-border)]">
                      {p.pending.map((o) => (
                        <tr key={o.orderId} className="align-top">
                          <td className="px-2 py-2">
                            <Link href={`/ventas/tienda/${o.orderId}`} className="font-semibold underline-offset-2 hover:underline">
                              #{o.orderNumber}
                            </Link>
                            <div className="text-xs text-[var(--fo-muted)]">{o.buyerName}</div>
                            {o.paidAt ? <div className="text-xs text-[var(--fo-muted)]">Pagado {fechaHoraBA(o.paidAt)}</div> : null}
                          </td>
                          <td className="px-2 py-2">
                            <ul className="space-y-1">
                              {o.lines.map((l) => {
                                const talle = splitVariantName(l.variantName).size;
                                return (
                                  <li key={l.id}>
                                    {l.qty} × {garmentName(l.productName, l.variantName)}
                                    {talle ? ` · talle ${talle}` : ""}
                                    {l.sku ? <span className="text-xs text-[var(--fo-muted)]"> · {l.sku}</span> : null}
                                    {l.printFileUrl ? (
                                      <>
                                        {" · "}
                                        <a href={l.printFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--fo-accent)] hover:underline">
                                          archivo
                                        </a>
                                      </>
                                    ) : (
                                      <span className="text-xs text-[var(--fo-danger)]"> · sin archivo</span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <form action={markSentAction}>
                              <input type="hidden" name="orderId" value={o.orderId} />
                              <input type="hidden" name="proveedorId" value={p.id} />
                              <button type="submit" className="fo-btn fo-btn-secondary text-sm whitespace-nowrap">
                                Ya se lo pasé al productor
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
