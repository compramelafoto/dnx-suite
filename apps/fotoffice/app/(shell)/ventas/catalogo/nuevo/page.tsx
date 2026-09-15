import { PageHeader } from "@/components/page-header";
import { requireSalesAdmin } from "@/lib/sales/access";
import { listProductCategories } from "@/lib/sales/repository";
import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireSalesAdmin();
  const params = await searchParams;
  const categorias = await listProductCategories(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nuevo producto"
        description="Escaneá el código de barras si lo tiene: si ya está en el catálogo compartido, se precarga solo."
      />
      <ProductForm product={null} categories={categorias} error={params.error} />
    </div>
  );
}
