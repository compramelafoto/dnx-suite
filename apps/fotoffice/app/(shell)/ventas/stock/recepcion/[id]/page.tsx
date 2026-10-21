import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { fechaBA, fechaHoraBA } from "@/lib/ficha/formato";
import { formatMinorArs } from "@/lib/membership/money";
import { listarProveedores } from "@/lib/proveedores/repositorio";
import { requireSalesStaff } from "@/lib/sales/access";
import { diaParaInput } from "@/lib/stock/recepcion-pantalla";
import { leerRecepcion } from "@/lib/stock/recepcion-servidor";
import { nombresDeUsuarios } from "../usuarios";
import { RecepcionEditor } from "./recepcion-editor";

export const dynamic = "force-dynamic";

/**
 * Una recepción. En BORRADOR se edita (`RecepcionEditor`); confirmada o descartada queda de
 * sólo lectura, con quién la cargó y quién la confirmó: una recepción confirmada no se toca,
 * se corrige con un ajuste desde Stock.
 */
export default async function RecepcionPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireSalesStaff();
  const { id } = await params;
  const r = await leerRecepcion(workspace.id, id);
  if (!r) notFound();

  if (r.estado === "BORRADOR") {
    const activos = await listarProveedores(workspace.id, { soloActivos: true });
    const proveedores = activos.map((p) => ({ id: p.id, nombre: p.name }));
    // Si el proveedor elegido se desactivó después, igual tiene que verse elegido.
    if (r.proveedorId && !proveedores.some((p) => p.id === r.proveedorId)) {
      proveedores.unshift({ id: r.proveedorId, nombre: r.proveedorNombre ?? "Proveedor dado de baja" });
    }
    return (
      <RecepcionEditor
        recepcion={{
          id: r.id,
          numero: r.numero,
          proveedorId: r.proveedorId,
          fecha: diaParaInput(r.fecha),
          comprobante: r.comprobante ?? "",
          preciosConIva: r.preciosConIva,
          lineas: r.lineas,
          totalMinor: r.totalMinor,
        }}
        proveedores={proveedores}
      />
    );
  }

  const nombres = await nombresDeUsuarios([r.createdByUserId, r.confirmedByUserId]);
  const nombre = (uid: number | null) => (uid === null ? "—" : (nombres.get(uid) ?? `Usuario ${uid}`));
  const confirmada = r.estado === "CONFIRMADA";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Recepción ${r.numero}`}
        description={confirmada ? "Confirmada: ya se sumó al stock. Si algo no cierra, corregilo con un ajuste en Stock." : "Descartada: no movió stock."}
        actions={
          <Link href="/ventas/stock/recepcion" className="fo-btn fo-btn-ghost text-sm">
            Volver al historial
          </Link>
        }
      />

      <section className="fo-card grid gap-3 p-4 text-sm sm:grid-cols-2">
        <Dato titulo="Proveedor" valor={r.proveedorNombre ?? "—"} />
        <Dato titulo="Fecha" valor={fechaBA(r.fecha)} />
        <Dato titulo="Comprobante" valor={r.comprobante ?? "—"} />
        <Dato titulo="Los costos incluyen IVA" valor={r.preciosConIva ? "Sí" : "No"} />
        <Dato titulo="La cargó" valor={nombre(r.createdByUserId)} />
        {confirmada ? (
          <Dato
            titulo="La confirmó"
            valor={`${nombre(r.confirmedByUserId)}${r.confirmedAt ? `, el ${fechaHoraBA(r.confirmedAt)}` : ""}`}
          />
        ) : (
          <Dato titulo="Estado" valor="Descartada" />
        )}
      </section>

      <div className="fo-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--fo-muted)]">
            <tr className="border-b border-[var(--fo-border)]">
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 text-right font-medium">Cantidad</th>
              <th className="px-4 py-2 text-right font-medium">Costo</th>
            </tr>
          </thead>
          <tbody>
            {r.lineas.map((l) => (
                <tr key={l.id} className="border-b border-[var(--fo-border)] last:border-0">
                  <td className="px-4 py-2">{l.producto?.nombre ?? l.descripcionOriginal}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.cantidad}
                    {l.enUnidadDeCompra && l.unidadesPorCompra ? ` bultos de ${l.unidadesPorCompra}` : ""}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.costoUnitarioMinor === null ? "—" : formatMinorArs(l.costoUnitarioMinor)}
                    {l.enUnidadDeCompra && l.costoUnitarioMinor !== null ? " por bulto" : ""}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-4 py-3 font-semibold" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMinorArs(r.totalMinor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--fo-muted)]">{titulo}</p>
      <p className="text-[var(--fo-text)]">{valor}</p>
    </div>
  );
}
