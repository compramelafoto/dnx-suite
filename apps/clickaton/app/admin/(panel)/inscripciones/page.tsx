import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { filtersFromSearchParams } from "@/lib/admin-registration/actions/filters";
import { listRegistrationsAction } from "@/lib/admin-registration/actions/registrations";
import {
  displayRegistrationAmount,
  formatArDateTime,
  maskDocument,
  paymentStatusLabel,
  registrationStatusLabel,
  registrationStatusTone,
} from "@/lib/admin-registration/ui/status-labels";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { listVenues } from "@/lib/admin/venues/queries";
import { listTicketTypesAction } from "@/lib/admin-catalog/actions/tickets";
import { ARGENTINA_2026_SHIRT_SIZES } from "@/config/editions/argentina-2026";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  searchParams: Promise<{
    flash?: string;
    editionId?: string;
    venueId?: string;
    ticketTypeId?: string;
    status?: string;
    paymentStatus?: string;
    q?: string;
    from?: string;
    to?: string;
    paymentOrder?: string;
    notes?: string;
    shirtSize?: string;
    fulfillmentStatus?: string;
  }>;
};

export default async function AdminRegistrationsPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const editionsResult = await listEditionOptions();
  const editions = editionsResult.ok ? editionsResult.data : [];

  if (!editionsResult.ok) {
    return (
      <div className="space-y-8">
        <AdminPageHeader title="Inscripciones" breadcrumbs={[{ label: "Inscripciones" }]} />
        <AdminMigrationNotice message={editionsResult.message} />
      </div>
    );
  }

  const editionId = params.editionId || editions[0]?.id || "";
  const filters = filtersFromSearchParams({ ...params, editionId: editionId || undefined });

  const [listResult, venuesResult, ticketsResult] = await Promise.all([
    editionId
      ? listRegistrationsAction(filters)
      : Promise.resolve({ ok: true as const, data: [] }),
    editionId
      ? listVenues({ editionId, active: "all" })
      : Promise.resolve({ ok: true as const, data: [] }),
    editionId
      ? listTicketTypesAction({ editionId })
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  const venues = venuesResult.ok ? venuesResult.data ?? [] : [];
  const tickets = ticketsResult.ok ? ticketsResult.data ?? [] : [];
  const rows = listResult.ok ? listResult.data ?? [] : [];
  const hasFilters = Boolean(
    params.q ||
      params.status ||
      params.paymentStatus ||
      params.venueId ||
      params.ticketTypeId ||
      params.from ||
      params.to ||
      params.paymentOrder ||
      params.notes ||
      params.shirtSize ||
      params.fulfillmentStatus,
  );

  const exportQs = new URLSearchParams();
  if (editionId) exportQs.set("editionId", editionId);
  for (const key of [
    "venueId",
    "ticketTypeId",
    "status",
    "paymentStatus",
    "q",
    "from",
    "to",
    "paymentOrder",
    "notes",
    "shirtSize",
    "fulfillmentStatus",
  ] as const) {
    const value = params[key];
    if (value) exportQs.set(key, value);
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Inscripciones"
        description="Consulta y gestión administrativa de ClickatonRegistration. El cobro real vive en DNX Payments (refs soft); no hay entidad Order local de Clickatón."
        breadcrumbs={[{ label: "Inscripciones" }]}
      />

      <AdminFlashMessage flash={params.flash} />

      <Card variant="outlined" className="space-y-2 border-ck-yellow/40">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
          Modelo operativo
        </p>
        <p className="text-sm text-ck-text-secondary">
          Agregado único: <strong>ClickatonRegistration</strong>. No existe{" "}
          <code>/admin/ordenes</code> porque no hay Order Clickatón en Prisma. La sección comercial
          del detalle muestra refs a DNX Payments.
        </p>
      </Card>

      {editions.length === 0 ? (
        <AdminEmptyState
          title="Sin ediciones"
          description="Creá una edición para operar inscripciones."
          action={
            <Button href={adminRoutes.editions} variant="primary">
              Ir a ediciones
            </Button>
          }
        />
      ) : (
        <>
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
              <span className="text-ck-text-secondary">Sede</span>
              <Select name="venueId" defaultValue={params.venueId ?? ""}>
                <option value="">Todas</option>
                <option value="__none__">Sin sede</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Entrada</span>
              <Select name="ticketTypeId" defaultValue={params.ticketTypeId ?? ""}>
                <option value="">Todas</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Estado inscripción</span>
              <Select name="status" defaultValue={params.status ?? ""}>
                <option value="">Todos</option>
                {[
                  "DRAFT",
                  "PENDING_PAYMENT",
                  "CONFIRMED",
                  "WAITLISTED",
                  "CANCELLED",
                  "REFUNDED",
                  "DISQUALIFIED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {registrationStatusLabel(s as never)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Estado de cobro</span>
              <Select name="paymentStatus" defaultValue={params.paymentStatus ?? ""}>
                <option value="">Todos</option>
                {[
                  "NOT_REQUIRED",
                  "PENDING",
                  "PROCESSING",
                  "APPROVED",
                  "FAILED",
                  "EXPIRED",
                  "CANCELLED",
                  "REFUNDED",
                  "MANUAL_REVIEW",
                ].map((s) => (
                  <option key={s} value={s}>
                    {paymentStatusLabel(s as never)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Búsqueda</span>
              <Input name="q" defaultValue={params.q ?? ""} placeholder="Nombre, email o código" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Desde</span>
              <Input type="date" name="from" defaultValue={params.from ?? ""} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Hasta</span>
              <Input type="date" name="to" defaultValue={params.to ?? ""} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Orden DNX</span>
              <Select name="paymentOrder" defaultValue={params.paymentOrder ?? ""}>
                <option value="">Todas</option>
                <option value="with">Con paymentOrderId</option>
                <option value="without">Sin paymentOrderId</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Observaciones</span>
              <Select name="notes" defaultValue={params.notes ?? ""}>
                <option value="">Todas</option>
                <option value="with">Con notas internas</option>
                <option value="without">Sin notas</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Talle</span>
              <Select name="shirtSize" defaultValue={params.shirtSize ?? ""}>
                <option value="">Todos</option>
                {ARGENTINA_2026_SHIRT_SIZES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-ck-text-secondary">Entrega artículo</span>
              <Select name="fulfillmentStatus" defaultValue={params.fulfillmentStatus ?? ""}>
                <option value="">Todos</option>
                {["PENDING", "READY", "DELIVERED", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <Button type="submit" variant="secondary">
                Filtrar
              </Button>
              {hasFilters ? (
                <Button
                  href={`${adminRoutes.registrations}?editionId=${encodeURIComponent(editionId)}`}
                  variant="outline"
                >
                  Limpiar
                </Button>
              ) : null}
              {editionId ? (
                <>
                  <Button
                    href={`${adminRoutes.registrations}/export?${exportQs.toString()}`}
                    variant="outline"
                  >
                    Exportar CSV
                  </Button>
                  <Button
                    href={`${adminRoutes.registrations}/export?${exportQs.toString()}&kind=sizes`}
                    variant="outline"
                  >
                    Resumen talles
                  </Button>
                </>
              ) : null}
            </div>
          </form>

          {!listResult.ok ? (
            <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm" role="alert">
              {listResult.message ?? "No se pudo cargar el listado."}
            </p>
          ) : rows.length === 0 && !hasFilters ? (
            <AdminEmptyState
              title="Sin inscripciones en esta edición"
              description="Cuando existan registros en ClickatonRegistration aparecerán aquí. No se muestran datos simulados."
            />
          ) : rows.length === 0 ? (
            <AdminEmptyState
              title="Filtros sin resultados"
              description="No hay inscripciones que coincidan con los filtros."
            />
          ) : (
            <AdminDataTable
              rows={rows}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "participant",
                  header: "Participante",
                  cell: (row) => (
                    <AdminTableLink href={`${adminRoutes.registrations}/${row.id}`}>
                      {row.firstName} {row.lastName}
                    </AdminTableLink>
                  ),
                },
                {
                  key: "email",
                  header: "Email",
                  cell: (row) => row.email,
                },
                {
                  key: "doc",
                  header: "Documento",
                  cell: (row) => maskDocument(row.documentNumber),
                },
                {
                  key: "code",
                  header: "Código",
                  cell: (row) => (
                    <span className="font-mono text-xs">{row.visibleCode ?? "—"}</span>
                  ),
                },
                {
                  key: "status",
                  header: "Estado",
                  cell: (row) => (
                    <div className="flex flex-col gap-1">
                      <Badge variant={registrationStatusTone(row.status)}>
                        {registrationStatusLabel(row.status)}
                      </Badge>
                      <span className="text-xs text-ck-text-muted">
                        {paymentStatusLabel(row.paymentStatus)}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "amount",
                  header: "Importe",
                  cell: (row) => displayRegistrationAmount(row.totalAmount, row.currency),
                },
                {
                  key: "shirt",
                  header: "Talle",
                  cell: (row) => row.shirtSizeLabel ?? "—",
                },
                {
                  key: "fotorank",
                  header: "FotoRank",
                  cell: (row) => (
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span>{row.fotoRankSyncStatus ?? "—"}</span>
                      {row.fotoRankParticipantId ? (
                        <span className="font-mono text-ck-text-muted">
                          {row.fotoRankParticipantId.slice(0, 10)}…
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "welcome",
                  header: "Placa",
                  cell: (row) => (
                    <div className="flex flex-col gap-0.5 text-xs">
                      <span>{row.welcomeCardStatus ?? "—"}</span>
                      <span className="text-ck-text-muted">
                        {row.instagramHandle ? `@${row.instagramHandle}` : "sin IG"}
                      </span>
                    </div>
                  ),
                },
                {
                  key: "fulfillment",
                  header: "Entrega",
                  cell: (row) => row.itemFulfillmentStatus ?? "—",
                },
                {
                  key: "items",
                  header: "Ítems",
                  cell: (row) => String(row.itemCount),
                },
                {
                  key: "created",
                  header: "Creada",
                  cell: (row) => formatArDateTime(row.createdAt),
                },
                {
                  key: "actions",
                  header: "Acciones",
                  cell: (row) => (
                    <Button href={`${adminRoutes.registrations}/${row.id}`} variant="secondary">
                      Abrir
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </>
      )}
    </div>
  );
}
