import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { ProductForm } from "@/components/admin/catalog/ProductForm";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { createProductFormAction } from "@/lib/admin-catalog/actions/product-forms";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  searchParams: Promise<{ editionId?: string }>;
};

export default async function AdminNewProductPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const editionsResult = await listEditionOptions();

  if (!editionsResult.ok) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Nuevo producto"
          breadcrumbs={[
            { label: "Productos y kits", href: catalogAdminRoutes.hub },
            { label: "Productos", href: catalogAdminRoutes.products },
            { label: "Nuevo" },
          ]}
        />
        <AdminMigrationNotice message={editionsResult.message} />
      </div>
    );
  }

  const editions = editionsResult.data;
  if (editions.length === 0) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Nuevo producto"
          breadcrumbs={[
            { label: "Productos y kits", href: catalogAdminRoutes.hub },
            { label: "Productos", href: catalogAdminRoutes.products },
            { label: "Nuevo" },
          ]}
        />
        <AdminEmptyState
          title="Sin ediciones"
          description="Creá una edición antes de dar de alta productos."
          action={
            <Button href={adminRoutes.editions} variant="primary">
              Ir a ediciones
            </Button>
          }
        />
      </div>
    );
  }

  const cancelHref = params.editionId
    ? `${catalogAdminRoutes.products}?editionId=${encodeURIComponent(params.editionId)}`
    : catalogAdminRoutes.products;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Nuevo producto"
        description="Creá el producto y después agregá variantes desde el detalle."
        breadcrumbs={[
          { label: "Productos y kits", href: catalogAdminRoutes.hub },
          { label: "Productos", href: catalogAdminRoutes.products },
          { label: "Nuevo" },
        ]}
      />

      <ProductForm
        mode="create"
        action={createProductFormAction}
        editions={editions}
        initialValues={{ editionId: params.editionId ?? "", isActive: true }}
        cancelHref={cancelHref}
        submitLabel="Crear producto"
      />
    </div>
  );
}
