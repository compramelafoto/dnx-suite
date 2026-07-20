import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { TicketActiveToggle } from "@/components/admin/catalog/TicketActiveToggle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import {
  getCatalogAvailabilityAction,
  listTicketTypesAction,
} from "@/lib/admin-catalog/actions/tickets";
import { displayTicketPrice } from "@/lib/admin-catalog/ui/money-ui";
import { enrichAndFilterTickets } from "@/lib/admin-catalog/ui/ticket-list-filters";
import {
  commercialStatuses,
  formatArDateTime,
  kitKindLabel,
  kitKindOf,
} from "@/lib/admin-catalog/ui/ticket-status";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  searchParams: Promise<{
    flash?: string;
    editionId?: string;
    active?: string;
    q?: string;
    capacity?: string;
    products?: string;
    sale?: string;
    config?: string;
  }>;
};

export default async function AdminTicketTypesPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const editionsResult = await listEditionOptions();
  const editions = editionsResult.ok ? editionsResult.data : [];

  if (!editionsResult.ok) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Entradas y kits"
          breadcrumbs={[
            { label: "Catálogo", href: catalogAdminRoutes.hub },
            { label: "Entradas" },
          ]}
        />
        <AdminMigrationNotice message={editionsResult.message} />
      </div>
    );
  }

  if (editions.length === 0) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Entradas y kits"
          breadcrumbs={[
            { label: "Catálogo", href: catalogAdminRoutes.hub },
            { label: "Entradas" },
          ]}
        />
        <AdminEmptyState
          title="Sin ediciones"
          description="Necesitás una edición para crear tipos de entrada."
          action={
            <Button href={adminRoutes.editions} variant="primary">
              Ir a ediciones
            </Button>
          }
        />
      </div>
    );
  }

  const editionId = params.editionId || editions[0]!.id;
  const edition = editions.find((e) => e.id === editionId);
  const activeFilter =
    params.active === "active" ? true : params.active === "inactive" ? false : undefined;

  const [listResult, availResult] = await Promise.all([
    listTicketTypesAction({
      editionId,
      isActive: activeFilter,
      query: params.q?.trim() || undefined,
    }),
    getCatalogAvailabilityAction(editionId),
  ]);

  const availabilityById = new Map(
    (availResult.ok ? availResult.data ?? [] : []).map((a) => [a.ticketTypeId, a]),
  );

  const rows =
    listResult.ok && listResult.data
      ? enrichAndFilterTickets(listResult.data, availabilityById, {
          capacity:
            params.capacity === "with" ||
            params.capacity === "without" ||
            params.capacity === "unlimited"
              ? params.capacity
              : undefined,
          products:
            params.products === "with" || params.products === "without"
              ? params.products
              : undefined,
          sale:
            params.sale === "future" ||
            params.sale === "open" ||
            params.sale === "ended" ||
            params.sale === "none"
              ? params.sale
              : undefined,
          config:
            params.config === "complete" ||
            params.config === "incomplete" ||
            params.config === "warnings"
              ? params.config
              : undefined,
        })
      : [];

  const hasFilters = Boolean(
    params.q ||
      params.active === "active" ||
      params.active === "inactive" ||
      params.capacity ||
      params.products ||
      params.sale ||
      params.config,
  );
  const newHref = `${catalogAdminRoutes.ticketNew}?editionId=${encodeURIComponent(editionId)}`;
  const clearHref = `${catalogAdminRoutes.tickets}?editionId=${encodeURIComponent(editionId)}`;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Entradas y kits"
        description={`Tipos de entrada de ${edition?.name ?? "la edición"}. Cupo de entradas ≠ stock de productos.`}
        breadcrumbs={[
          { label: "Catálogo", href: catalogAdminRoutes.hub },
          { label: "Entradas" },
        ]}
        actions={
          <Button href={newHref} variant="primary">
            Nueva entrada
          </Button>
        }
      />

      <AdminFlashMessage flash={params.flash} />

      <form
        method="get"
        className="grid gap-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Edición</span>
          <Select name="editionId" defaultValue={editionId}>
            {editions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} (
                {EDITION_STATUS_LABELS[e.status as ClickatonEditionStatus] ?? e.status})
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
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Búsqueda</span>
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Nombre o código" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Cupo</span>
          <Select name="capacity" defaultValue={params.capacity ?? "all"}>
            <option value="all">Todos</option>
            <option value="with">Con cupo numérico</option>
            <option value="unlimited">Ilimitado</option>
            <option value="without">Sin cupo numérico</option>
          </Select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Productos</span>
          <Select name="products" defaultValue={params.products ?? "all"}>
            <option value="all">Todas</option>
            <option value="with">Con productos / kit</option>
            <option value="without">Sin productos</option>
          </Select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Venta</span>
          <Select name="sale" defaultValue={params.sale ?? "all"}>
            <option value="all">Todas</option>
            <option value="future">Venta futura</option>
            <option value="open">En venta</option>
            <option value="ended">Venta finalizada</option>
            <option value="none">Sin período</option>
          </Select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Configuración</span>
          <Select name="config" defaultValue={params.config ?? "all"}>
            <option value="all">Todas</option>
            <option value="complete">Completa</option>
            <option value="warnings">Con advertencias</option>
            <option value="incomplete">Incompleta</option>
          </Select>
        </label>
        <div className="flex items-end gap-3">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {hasFilters ? (
            <Button href={clearHref} variant="outline">
              Limpiar
            </Button>
          ) : null}
        </div>
      </form>

      {!listResult.ok ? (
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm" role="alert">
          {listResult.message ?? "No se pudo cargar el listado."}
        </p>
      ) : rows.length === 0 && !hasFilters ? (
        <AdminEmptyState
          title="Sin entradas en esta edición"
          description="Un tipo de entrada define precio, cupo y período de venta. Podés incluir productos para armar un kit."
          action={
            <Button href={newHref} variant="primary">
              Crear primera entrada
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="Filtros sin resultados"
          description="No hay entradas que coincidan con los filtros."
          action={
            <Button href={clearHref} variant="secondary">
              Quitar filtros
            </Button>
          }
        />
      ) : (
        <AdminDataTable
          rows={rows}
          rowKey={(row) => row.ticket.id}
          columns={[
            {
              key: "name",
              header: "Entrada",
              cell: (row) => (
                <AdminTableLink href={catalogAdminRoutes.ticketDetail(row.ticket.id)}>
                  {row.ticket.name}
                </AdminTableLink>
              ),
            },
            {
              key: "code",
              header: "Código",
              cell: (row) => <span className="font-mono text-xs">{row.ticket.code}</span>,
            },
            {
              key: "price",
              header: "Precio",
              cell: (row) =>
                displayTicketPrice(row.ticket.priceAmount, row.ticket.currency),
            },
            {
              key: "capacity",
              header: "Cupo / disp.",
              cell: (row) => {
                if (row.availability?.isUnlimited || row.ticket.capacity === null) {
                  return "Ilimitado";
                }
                const used =
                  (row.availability?.confirmedCount ?? 0) +
                  (row.availability?.activeHoldCount ?? 0);
                const available = row.availability?.available ?? row.ticket.capacity;
                return `${row.ticket.capacity} · usados ${used} · disp. ${available}`;
              },
            },
            {
              key: "sales",
              header: "Período",
              cell: (row) => (
                <span className="text-xs">
                  {formatArDateTime(row.ticket.salesStartAt)} →{" "}
                  {formatArDateTime(row.ticket.salesEndAt)}
                </span>
              ),
            },
            {
              key: "kit",
              header: "Kit",
              cell: (row) => (
                <span>
                  {kitKindLabel(kitKindOf(row.ticket.items))} ({row.ticket.items.length})
                </span>
              ),
            },
            {
              key: "status",
              header: "Estados",
              cell: (row) => (
                <div className="flex max-w-xs flex-wrap gap-1">
                  {commercialStatuses({
                    ticket: row.ticket,
                    availability: row.availability,
                    config: row.config,
                  }).map((label) => (
                    <Badge
                      key={label}
                      variant={
                        label.includes("incompleta") || label === "Agotada"
                          ? "danger"
                          : label.includes("advert") || label === "Venta finalizada"
                            ? "warning"
                            : label === "Activa" || label === "En venta"
                              ? "success"
                              : "neutral"
                      }
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              key: "updated",
              header: "Actualizado",
              cell: (row) => formatArDateTime(row.ticket.updatedAt),
            },
            {
              key: "actions",
              header: "Acciones",
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button
                    href={catalogAdminRoutes.ticketDetail(row.ticket.id)}
                    variant="secondary"
                  >
                    Abrir
                  </Button>
                  <TicketActiveToggle
                    ticketTypeId={row.ticket.id}
                    isActive={row.ticket.isActive}
                    redirectTo="list"
                  />
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
