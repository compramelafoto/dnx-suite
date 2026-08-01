import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { formatAdminDateTime } from "@/lib/admin/datetime-input";
import { listEditions } from "@/lib/admin/editions/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  searchParams: Promise<{ flash?: string }>;
};

export default async function AdminEditionsPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const { flash } = await searchParams;
  const result = await listEditions();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Ediciones"
        description="Cada edición de Clickatón puede tener una o varias sedes. Aquí se administrará el producto de marca; la competencia asociada se ejecutará en FotoRank."
        breadcrumbs={[{ label: "Ediciones" }]}
        actions={
          <Button href={`${adminRoutes.editions}/nueva`} variant="primary">
            Crear edición
          </Button>
        }
      />

      <AdminFlashMessage flash={flash} />

      {!result.ok ? (
        <AdminMigrationNotice message={result.message} />
      ) : result.data.length === 0 ? (
        <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-10 text-center">
          <p className="text-lg text-ck-text">No hay ediciones todavía</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Creá la primera edición para definir fechas, estado operativo y sedes.
          </p>
          <div className="mt-6">
            <Button href={`${adminRoutes.editions}/nueva`} variant="primary">
              Crear edición
            </Button>
          </div>
        </div>
      ) : (
        <AdminDataTable
          rows={result.data}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Edición",
              cell: (row) => (
                <AdminTableLink href={`${adminRoutes.editions}/${row.id}`}>{row.name}</AdminTableLink>
              ),
            },
            {
              key: "status",
              header: "Estado",
              cell: (row) => (
                <AdminStatusBadge status={row.status} published={row.isPublished} />
              ),
            },
            {
              key: "dates",
              header: "Inicio",
              hideOnMobile: true,
              cell: (row) => formatAdminDateTime(row.startAt, row.timezone ?? undefined),
            },
            {
              key: "venues",
              header: "Sedes",
              cell: (row) => String(row.venueCount ?? 0),
            },
            {
              key: "actions",
              header: "",
              cell: (row) => (
                <AdminTableLink href={`${adminRoutes.editions}/${row.id}/editar`}>
                  Editar
                </AdminTableLink>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <AdminTableLink href={`${adminRoutes.editions}/${row.id}`}>{row.name}</AdminTableLink>
              <AdminStatusBadge status={row.status} published={row.isPublished} />
              <p className="text-sm text-ck-text-secondary">
                Inicio: {formatAdminDateTime(row.startAt, row.timezone ?? undefined)}
              </p>
              <p className="text-sm text-ck-text-muted">Sedes: {row.venueCount ?? 0}</p>
              <div className="pt-2">
                <AdminTableLink href={`${adminRoutes.editions}/${row.id}/editar`}>
                  Editar
                </AdminTableLink>
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}
