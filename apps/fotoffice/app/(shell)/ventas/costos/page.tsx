import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { listProductCategories } from "@/lib/sales/repository";
import { listarProveedores } from "@/lib/proveedores/repositorio";
import { leerTramosWorkspace, listarFilasCosto, sugerenciasUnionProveedores } from "@/lib/precios-proveedor/repositorio";
import { TablaCostos } from "./tabla-costos";
import { RedondeoForm } from "./redondeo-form";
import { UnionProveedores } from "./union-proveedores";

export const dynamic = "force-dynamic";

/**
 * Costos y márgenes: el costo de cada producto sale de su proveedor preferido y el precio, de
 * costo × (1 + margen) redondeado para la caja. Ver
 * `docs/superpowers/specs/2026-10-21-listas-de-precios-de-proveedores-design.md`.
 */
export default async function CostosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; proveedorId?: string; sinCosto?: string; ok?: string }>;
}) {
  const { workspace } = await requireSalesAdmin();
  const sp = await searchParams;
  const categoryId = sp.categoryId?.trim() || undefined;
  const proveedorId = sp.proveedorId?.trim() || undefined;
  const soloSinCosto = sp.sinCosto === "1";

  const [filas, categorias, proveedores, tramos, sugerencias] = await Promise.all([
    listarFilasCosto(workspace.id, { categoryId, proveedorId, soloSinCosto }),
    listProductCategories(workspace.id),
    listarProveedores(workspace.id, { soloActivos: true }),
    leerTramosWorkspace(workspace.id),
    sugerenciasUnionProveedores(workspace.id),
  ]);
  const opcionesProveedor = proveedores.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Costos y márgenes"
        description="El costo de cada producto según su proveedor preferido, el margen que le ponés y el precio que sale de ahí, redondeado para dar vuelto."
        actions={
          <Link href="/ventas/costos/listas" className="fo-btn fo-btn-primary text-sm">
            Listas de proveedores
          </Link>
        }
      />

      {sp.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se aplicó la lista: {sp.ok} productos con costo actualizado.</p>
      ) : null}

      {sugerencias.length > 0 ? <UnionProveedores sugerencias={sugerencias} proveedores={opcionesProveedor} /> : null}

      <form method="GET" className="fo-card flex flex-wrap items-end gap-3 !p-4">
        <div className="fo-field-stack min-w-[180px]">
          <label className="fo-label" htmlFor="categoryId">
            Categoría
          </label>
          <select id="categoryId" name="categoryId" defaultValue={categoryId ?? ""} className="fo-input">
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack min-w-[180px]">
          <label className="fo-label" htmlFor="proveedorId">
            Proveedor preferido
          </label>
          <select id="proveedorId" name="proveedorId" defaultValue={proveedorId ?? ""} className="fo-input">
            <option value="">Todos</option>
            <option value="ninguno">Sin proveedor</option>
            {opcionesProveedor.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="sinCosto" value="1" defaultChecked={soloSinCosto} />
          Sólo sin costo
        </label>
        <div className="flex gap-2">
          <button type="submit" className="fo-btn fo-btn-primary min-h-10 text-sm">
            Filtrar
          </button>
          {categoryId || proveedorId || soloSinCosto ? (
            <Link href="/ventas/costos" className="fo-btn fo-btn-ghost min-h-10 text-sm">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      <TablaCostos filasIniciales={filas} proveedores={opcionesProveedor} />

      <RedondeoForm tramos={tramos} />
    </div>
  );
}
