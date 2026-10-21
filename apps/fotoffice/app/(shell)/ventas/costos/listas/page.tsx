import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { listarProveedores } from "@/lib/proveedores/repositorio";
import { listarListas } from "@/lib/precios-proveedor/repositorio";
import { NuevaLista } from "./nueva-lista";

export const dynamic = "force-dynamic";

const ESTADO: Record<string, string> = { BORRADOR: "Sin aplicar", APLICADA: "Aplicada", DESCARTADA: "Descartada" };

function fecha(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ListasProveedoresPage() {
  const { workspace } = await requireSalesAdmin();
  const [listas, proveedores] = await Promise.all([listarListas(workspace.id), listarProveedores(workspace.id, { soloActivos: true })]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Listas de proveedores"
        description="Pasá el PDF del proveedor a CSV con ChatGPT, subilo y actualizá los costos (y los precios) de una vez."
        actions={
          <Link href="/ventas/costos" className="fo-btn fo-btn-ghost text-sm">
            Volver a Costos y márgenes
          </Link>
        }
      />

      {proveedores.length === 0 ? (
        <div className="fo-card p-5 text-sm">
          Primero cargá tus proveedores en{" "}
          <Link href="/workspace/configuracion/proveedores" className="font-medium text-[var(--fo-accent)] hover:underline">
            Configuración → Proveedores
          </Link>
          .
        </div>
      ) : (
        <NuevaLista proveedores={proveedores.map((p) => ({ id: p.id, name: p.name }))} />
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Listas cargadas</h2>
        {listas.length === 0 ? (
          <p className="fo-helper">Todavía no se cargó ninguna lista.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Proveedor</th>
                  <th className="px-4 py-3 font-semibold">Vigencia</th>
                  <th className="px-4 py-3 font-semibold">Renglones</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Cargada</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                {listas.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium">{l.proveedor}</td>
                    <td className="px-4 py-3">{l.vigencia}</td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">
                      {l.renglones} · {l.emparejados} con producto
                    </td>
                    <td className="px-4 py-3">{ESTADO[l.estado] ?? l.estado}</td>
                    <td className="px-4 py-3 text-[var(--fo-muted)]">{fecha(l.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/ventas/costos/listas/${l.id}`} className="font-medium text-[var(--fo-accent)] hover:underline">
                        {l.estado === "BORRADOR" ? "Seguir" : "Ver"}
                      </Link>
                    </td>
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
