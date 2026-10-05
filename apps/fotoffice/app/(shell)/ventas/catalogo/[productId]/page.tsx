import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { getProduct, listProductCategories } from "@/lib/sales/repository";
import { ProductForm } from "../../product-form";
import { toggleProductActiveAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireSalesAdmin();
  const { productId } = await params;
  const query = await searchParams;

  const [producto, categorias] = await Promise.all([
    getProduct(workspace.id, productId),
    listProductCategories(workspace.id),
  ]);
  if (!producto) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={producto.name}
        description={producto.sku ? `Código interno ${producto.sku}.` : "Sin código interno."}
        actions={
          <form action={toggleProductActiveAction}>
            <input type="hidden" name="productId" value={producto.id} />
            <input type="hidden" name="active" value={producto.isActive ? "off" : "on"} />
            <button
              type="submit"
              className={producto.isActive ? "fo-btn fo-btn-ghost text-sm" : "fo-btn fo-btn-secondary text-sm"}
            >
              {producto.isActive ? "Desactivar" : "Activar"}
            </button>
          </form>
        }
      />

      {query.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}
      {!producto.isActive ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Este producto está inactivo: no aparece para vender, pero las ventas viejas lo siguen nombrando.
        </p>
      ) : null}

      <ProductForm product={producto} categories={categorias} error={query.error} />
    </div>
  );
}
