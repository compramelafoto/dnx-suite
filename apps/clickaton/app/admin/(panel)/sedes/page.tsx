import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { listVenues, type VenueListFilters } from "@/lib/admin/venues/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  searchParams: Promise<{ flash?: string; editionId?: string; active?: string }>;
};

export default async function AdminVenuesPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const filters: VenueListFilters = {
    editionId: params.editionId || undefined,
    active:
      params.active === "active" || params.active === "inactive" ? params.active : "all",
  };

  const [venuesResult, editionsResult] = await Promise.all([
    listVenues(filters),
    listEditionOptions(),
  ]);

  const editions = editionsResult.ok ? editionsResult.data : [];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Sedes"
        description="Las sedes pertenecen a una edición organizada por Clickatón. No hay un modelo de franquicias en esta etapa."
        breadcrumbs={[{ label: "Sedes" }]}
        actions={
          <Button href={`${adminRoutes.venues}/nueva`} variant="primary">
            Nueva sede
          </Button>
        }
      />

      <AdminFlashMessage flash={params.flash} />

      <form className="grid gap-3 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Edición</span>
          <Select name="editionId" defaultValue={params.editionId ?? ""}>
            <option value="">Todas</option>
            {editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {edition.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Estado</span>
          <Select name="active" defaultValue={params.active ?? "all"}>
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </Select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </div>
      </form>

      {!venuesResult.ok ? (
        <AdminMigrationNotice message={venuesResult.message} />
      ) : venuesResult.data.length === 0 ? (
        <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-10 text-center">
          <p className="text-lg text-ck-text">Sin sedes registradas</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Creá una edición y agregá sedes con ciudad, punto de encuentro y capacidad.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href={adminRoutes.editions} variant="secondary">
              Ir a ediciones
            </Button>
            <Button href={`${adminRoutes.venues}/nueva`} variant="primary">
              Nueva sede
            </Button>
          </div>
        </div>
      ) : (
        <AdminDataTable
          rows={venuesResult.data}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Sede",
              cell: (row) => (
                <AdminTableLink href={`${adminRoutes.venues}/${row.id}`}>{row.name}</AdminTableLink>
              ),
            },
            {
              key: "edition",
              header: "Edición",
              cell: (row) => row.edition?.name ?? "—",
            },
            {
              key: "city",
              header: "Ciudad",
              cell: (row) => row.city,
            },
            {
              key: "active",
              header: "Estado",
              cell: (row) => <AdminStatusBadge kind="venue" status="DRAFT" active={row.isActive} />,
            },
            {
              key: "capacity",
              header: "Capacidad",
              cell: (row) => row.capacity ?? "—",
            },
            {
              key: "actions",
              header: "",
              cell: (row) => (
                <AdminTableLink href={`${adminRoutes.venues}/${row.id}/editar`}>
                  Editar
                </AdminTableLink>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <AdminTableLink href={`${adminRoutes.venues}/${row.id}`}>{row.name}</AdminTableLink>
              <p className="text-sm text-ck-text-secondary">{row.edition?.name}</p>
              <p className="text-sm text-ck-text-muted">{row.city}</p>
              <AdminStatusBadge kind="venue" status="DRAFT" active={row.isActive} />
            </>
          )}
        />
      )}
    </div>
  );
}
