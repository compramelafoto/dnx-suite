import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductForm } from "@/components/admin/catalog/ProductForm";
import { ProductActiveToggle } from "@/components/admin/catalog/ProductActiveToggle";
import { ProductVariantsPanel } from "@/components/admin/catalog/ProductVariantsPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { getProductAction } from "@/lib/admin-catalog/actions/products";
import { updateProductFormAction } from "@/lib/admin-catalog/actions/product-forms";
import { getEditionById, listEditionOptions } from "@/lib/admin/editions/queries";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ flash?: string }>;
};

export default async function AdminProductDetailPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { productId } = await params;
  const { flash } = await searchParams;

  const productResult = await getProductAction(productId);
  if (!productResult.ok || !productResult.data) {
    if (productResult.code === "NOT_FOUND") notFound();
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Producto"
          breadcrumbs={[
            { label: "Catálogo", href: catalogAdminRoutes.hub },
            { label: "Productos", href: catalogAdminRoutes.products },
          ]}
        />
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm" role="alert">
          {productResult.message ?? "No se pudo cargar el producto."}
        </p>
        <Button href={catalogAdminRoutes.products} variant="secondary">
          Volver al listado
        </Button>
      </div>
    );
  }

  const product = productResult.data;
  const [editionResult, editionsResult] = await Promise.all([
    getEditionById(product.editionId),
    listEditionOptions(),
  ]);
  const edition = editionResult.ok ? editionResult.data : null;
  const editions = editionsResult.ok ? editionsResult.data : [];
  const editionLabel = edition
    ? `${edition.name} (${EDITION_STATUS_LABELS[edition.status as ClickatonEditionStatus] ?? edition.status})`
    : product.editionId;

  const listHref = `${catalogAdminRoutes.products}?editionId=${encodeURIComponent(product.editionId)}`;

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title={product.name}
        description={`Código ${product.code} · Edición ${editionLabel}`}
        breadcrumbs={[
          { label: "Catálogo", href: catalogAdminRoutes.hub },
          { label: "Productos", href: listHref },
          { label: product.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={product.isActive ? "success" : "neutral"}>
              {product.isActive ? "Activo" : "Inactivo"}
            </Badge>
            <ProductActiveToggle productId={product.id} isActive={product.isActive} />
            <Button href={listHref} variant="secondary">
              Volver al listado
            </Button>
          </div>
        }
      />

      <AdminFlashMessage flash={flash} />

      <ProductForm
        mode="edit"
        lockEdition
        action={updateProductFormAction.bind(null, product.id)}
        editions={
          editions.length
            ? editions
            : [{ id: product.editionId, name: edition?.name ?? "Edición", status: edition?.status ?? "DRAFT" }]
        }
        initialValues={{
          editionId: product.editionId,
          name: product.name,
          description: product.description ?? "",
          code: product.code,
          isActive: product.isActive,
        }}
        cancelHref={listHref}
        submitLabel="Guardar cambios"
      />

      <ProductVariantsPanel productId={product.id} variants={product.variants} />
    </div>
  );
}
