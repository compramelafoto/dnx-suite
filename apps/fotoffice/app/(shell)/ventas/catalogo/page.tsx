import Link from "next/link";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { listProducts, listProductCategories } from "@/lib/sales/repository";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { PRODUCT_KIND_LABELS, type ProductKind } from "@/lib/sales/constants";
import { formatMinorArs } from "@/lib/membership/money";
import { CategoryForm } from "../category-form";

export const dynamic = "force-dynamic";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; inactivos?: string; error?: string; ok?: string }>;
}) {
  const { workspace, role } = await requireSalesStaff();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const categoryId = sp.categoryId?.trim() || undefined;
  const verInactivos = sp.inactivos === "1";
  // Editar el catálogo es ADMIN+: esconder acá el alta y la administración de categorías es
  // sólo cosmético, el control de verdad vuelve a pedirse en cada pantalla y cada acción.
  const puedeEditar = canManageWorkspaceSettings(role);

  const [productos, categorias] = await Promise.all([
    listProducts(workspace.id, { search: q, categoryId, onlyActive: !verInactivos }),
    listProductCategories(workspace.id, { includeInactive: puedeEditar }),
  ]);

  const sinProductos = productos.length === 0 && !q && !categoryId && !verInactivos;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Catálogo"
        description="Lo que el negocio vende: productos y servicios, con su precio y su existencia."
        actions={
          puedeEditar ? (
            <Link href="/ventas/catalogo/nuevo" className="fo-btn fo-btn-primary text-sm">
              Nuevo producto
            </Link>
          ) : null
        }
      />

      {sp.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {sp.error}
        </p>
      ) : null}
      {sp.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}

      {sinProductos ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Package className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay nada cargado</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              {puedeEditar
                ? "Cargá el primer producto con su precio y, si corresponde, su código de barras."
                : "Todavía no hay productos ni servicios cargados en este catálogo."}
            </p>
          </div>
          {puedeEditar ? (
            <Link href="/ventas/catalogo/nuevo" className="fo-btn fo-btn-primary text-sm">
              Crear el primer producto
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <form method="GET" className="fo-card flex flex-wrap items-end gap-3 !p-4">
            <div className="fo-field-stack min-w-[240px] flex-1">
              <label className="fo-label" htmlFor="q">
                Buscar
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q ?? ""}
                className="fo-input"
                placeholder="Nombre, código interno o código de barras"
              />
            </div>
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
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="inactivos" value="1" defaultChecked={verInactivos} />
              Mostrar inactivos
            </label>
            <div className="flex gap-2">
              <button type="submit" className="fo-btn fo-btn-primary min-h-10 text-sm">
                Buscar
              </button>
              {q || categoryId || verInactivos ? (
                <Link href="/ventas/catalogo" className="fo-btn fo-btn-ghost min-h-10 text-sm">
                  Limpiar
                </Link>
              ) : null}
            </div>
          </form>

          {productos.length === 0 ? (
            <div className="fo-card flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="text-sm font-medium">Ningún producto coincide con esa búsqueda.</p>
              <Link href="/ventas/catalogo" className="fo-btn fo-btn-secondary text-sm">
                Ver todo el catálogo
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold" />
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Precio</th>
                    <th className="px-4 py-3 font-semibold">Existencia</th>
                    <th className="w-16 px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
                  {productos.map((p) => {
                    const bajoMinimo =
                      p.tracksStock && (p.stockQty < 0 || (p.minStockQty !== null && p.stockQty < p.minStockQty));
                    return (
                      <tr key={p.id} className={`hover:bg-[var(--fo-surface-hover)]/60 ${p.isActive ? "" : "opacity-60"}`}>
                        <td className="px-4 py-3">
                          <div className="size-10 overflow-hidden rounded-md border border-[var(--fo-border)] bg-[var(--fo-bg)]">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--fo-text)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{p.name}</span>
                            {!p.isActive ? (
                              <span className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">
                                Inactivo
                              </span>
                            ) : null}
                          </div>
                          {p.categoryName ? (
                            <p className="text-xs text-[var(--fo-muted)]">{p.categoryName}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[var(--fo-muted)]">
                          {PRODUCT_KIND_LABELS[p.kind as ProductKind] ?? p.kind}
                        </td>
                        <td className="px-4 py-3 text-[var(--fo-text)]">{formatMinorArs(p.priceMinor)}</td>
                        <td className={`px-4 py-3 ${bajoMinimo ? "font-semibold text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}>
                          {p.tracksStock ? p.stockQty : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/ventas/catalogo/${p.id}`}
                            className="font-medium text-[var(--fo-accent)] hover:underline"
                          >
                            {puedeEditar ? "Editar" : "Ver"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {puedeEditar ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Categorías</h2>
          <p className="fo-helper">Sirven para agrupar el catálogo y para filtrar la lista de arriba.</p>
          <div className="fo-card space-y-3 p-5">
            {categorias.map((c) => (
              <div key={c.id} className={`border-b border-[var(--fo-border)] pb-3 last:border-0 ${c.isActive ? "" : "opacity-60"}`}>
                <CategoryForm category={c} />
              </div>
            ))}
          </div>
          <div className="fo-card space-y-2 p-5">
            <h3 className="text-sm font-semibold">Nueva categoría</h3>
            <CategoryForm category={null} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
