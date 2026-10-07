import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { getProduct, listProductCategories } from "@/lib/sales/repository";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { ProductForm } from "../../product-form";
import { toggleProductActiveAction } from "../../actions";
import { StoreSections } from "./store-sections";
import { PresupuestoSections } from "./presupuesto-sections";
import { leerPerfil, rubrosUsados } from "@/lib/catalogo/perfil";
import { leerCombo, productosParaCombo } from "@/lib/catalogo/combos";
import { leerCostos, proveedoresDelWorkspace } from "@/lib/catalogo/costos";

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

  const [producto, categorias, storeEnabled, publicSlug] = await Promise.all([
    getProduct(workspace.id, productId),
    listProductCategories(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, STORE_MODULE_KEY),
    loadPublicSlug(workspace.id),
  ]);
  if (!producto) notFound();

  // Etapa 2: combo, costos-plantilla y datos para presupuestos. Esta ficha ya exige
  // `sales.catalog` (`requireSalesAdmin`), que es el permiso para ver costos y margen.
  const [perfil, rubros, combo, productosCombo, costos, proveedores] = await Promise.all([
    leerPerfil(workspace.id, producto.id),
    rubrosUsados(workspace.id),
    leerCombo(workspace.id, producto.id, producto.priceMinor),
    productosParaCombo(workspace.id, producto.id),
    leerCostos(workspace.id, producto.id),
    proveedoresDelWorkspace(workspace.id),
  ]);

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

      <PresupuestoSections
        productId={producto.id}
        priceMinor={producto.priceMinor}
        perfil={perfil}
        rubros={rubros}
        combo={combo}
        productosCombo={productosCombo}
        costos={costos}
        proveedores={proveedores}
      />

      <StoreSections product={producto} publicSlug={publicSlug} storeEnabled={storeEnabled} />
    </div>
  );
}
