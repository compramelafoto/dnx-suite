import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { fechaBA } from "@/lib/ficha/formato";
import { formatMinorArs } from "@/lib/membership/money";
import { requireSalesStaff } from "@/lib/sales/access";
import { listarRecepciones } from "@/lib/stock/recepcion-servidor";
import { crearRecepcionAction } from "./actions";
import { BotonRecibirPedido } from "./boton-recibir-pedido";
import { nombresDeUsuarios } from "./usuarios";

export const dynamic = "force-dynamic";

/**
 * Historial de recepciones de pedidos: los borradores que quedaron abiertos (llegan muchas
 * cajas, se sigue después) y las confirmadas. Las descartadas no se listan.
 */
export default async function RecepcionesPage() {
  const { workspace } = await requireSalesStaff();
  const filas = await listarRecepciones(workspace.id);
  const nombres = await nombresDeUsuarios(filas.flatMap((f) => [f.createdByUserId, f.confirmedByUserId]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recepción de pedidos"
        description="Lo que llega del proveedor: escaneás las cajas, revisás costos y, al confirmar, se suma al stock."
        actions={
          <>
            <Link href="/ventas/stock" className="fo-btn fo-btn-ghost text-sm">
              Volver a Stock
            </Link>
            <form action={crearRecepcionAction}>
              <BotonRecibirPedido />
            </form>
          </>
        }
      />

      {filas.length === 0 ? (
        <div className="fo-card px-6 py-16 text-center text-sm text-[var(--fo-muted)]">
          Todavía no recibiste ningún pedido. Tocá &quot;Recibir pedido&quot; cuando llegue la mercadería.
        </div>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-4 py-2 font-medium">N°</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Proveedor</th>
                <th className="px-4 py-2 font-medium">Comprobante</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Quién</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const quien = f.confirmedByUserId ?? f.createdByUserId;
                return (
                  <tr key={f.id} className="border-b border-[var(--fo-border)] last:border-0">
                    <td className="px-4 py-2">
                      <Link
                        href={`/ventas/stock/recepcion/${f.id}`}
                        className="font-medium text-[var(--fo-accent)] hover:underline"
                      >
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{fechaBA(f.fecha)}</td>
                    <td className="px-4 py-2">{f.proveedorNombre ?? "—"}</td>
                    <td className="px-4 py-2">{f.comprobante ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMinorArs(f.totalMinor)}</td>
                    <td className="px-4 py-2">
                      {f.estado === "BORRADOR" ? (
                        <span className="text-[var(--fo-warning)]">Sin confirmar</span>
                      ) : (
                        <span className="text-[var(--fo-success)]">Confirmada</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[var(--fo-muted)]">
                      {quien === null ? "—" : (nombres.get(quien) ?? `Usuario ${quien}`)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
