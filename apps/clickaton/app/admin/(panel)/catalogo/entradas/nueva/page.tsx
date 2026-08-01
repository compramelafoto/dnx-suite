import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { TicketTypeForm } from "@/components/admin/catalog/TicketTypeForm";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { createTicketTypeFormAction } from "@/lib/admin-catalog/actions/ticket-forms";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  searchParams: Promise<{ editionId?: string }>;
};

export default async function AdminNewTicketTypePage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const editionsResult = await listEditionOptions();

  if (!editionsResult.ok) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Nueva entrada"
          breadcrumbs={[
            { label: "Productos y kits", href: catalogAdminRoutes.hub },
            { label: "Entradas", href: catalogAdminRoutes.tickets },
            { label: "Nueva" },
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
        <AdminPageHeader title="Nueva entrada" />
        <AdminEmptyState
          title="Sin ediciones"
          description="Creá una edición antes de dar de alta entradas."
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
    ? `${catalogAdminRoutes.tickets}?editionId=${encodeURIComponent(params.editionId)}`
    : catalogAdminRoutes.tickets;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Nueva entrada"
        description="Creá la entrada y configurá productos del kit en el detalle."
        breadcrumbs={[
          { label: "Productos y kits", href: catalogAdminRoutes.hub },
          { label: "Entradas", href: catalogAdminRoutes.tickets },
          { label: "Nueva" },
        ]}
      />
      <TicketTypeForm
        mode="create"
        action={createTicketTypeFormAction}
        editions={editions}
        initialValues={{ editionId: params.editionId ?? "", isActive: true, priceAmount: 0 }}
        cancelHref={cancelHref}
      />
    </div>
  );
}
