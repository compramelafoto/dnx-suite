import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { RegistrationFiltersPanel } from "@/components/admin/registrations/RegistrationFiltersPanel";
import { RegistrationListMobileCard } from "@/components/admin/registrations/RegistrationListMobileCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import { filtersFromSearchParams } from "@/lib/admin-registration/actions/filters";
import { listRegistrationsAction } from "@/lib/admin-registration/actions/registrations";
import {
  adminToneToBadgeVariant,
  FULFILLMENT_FILTER_OPTIONS,
  presentAdminFulfillmentStatus,
  presentAdminOperationalSummary,
  presentAdminPaymentStatus,
  presentAdminRegistrationStatus,
} from "@/lib/admin-registration/ui/admin-status-presentation";
import {
  displayRegistrationAmount,
  formatArDateTime,
  paymentStatusLabel,
  registrationStatusLabel,
} from "@/lib/admin-registration/ui/status-labels";
import { presentAdminRefundBadge } from "@/lib/admin-registration/ui/admin-refund-presentation";
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
        <AdminPageHeader
          title="Inscripciones"
          description="No pudimos cargar las ediciones. Revisá la conexión e intentá nuevamente."
          breadcrumbs={[{ label: "Inscripciones" }]}
        />
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

  const activeChips: Array<{ label: string }> = [];
  if (params.q) activeChips.push({ label: `Búsqueda: ${params.q}` });
  if (params.status) {
    activeChips.push({
      label: presentAdminRegistrationStatus(params.status).label,
    });
  }
  if (params.paymentStatus) {
    activeChips.push({
      label: presentAdminPaymentStatus(params.paymentStatus).label,
    });
  }
  if (params.fulfillmentStatus) {
    activeChips.push({
      label: presentAdminFulfillmentStatus(params.fulfillmentStatus).label,
    });
  }
  if (params.shirtSize) activeChips.push({ label: `Talle ${params.shirtSize}` });
  if (params.venueId === "__none__") activeChips.push({ label: "Sin sede" });
  else if (params.venueId) {
    const v = venues.find((x) => x.id === params.venueId);
    activeChips.push({ label: `Sede: ${v?.name ?? "Seleccionada"}` });
  }
  if (params.ticketTypeId) {
    const t = tickets.find((x) => x.id === params.ticketTypeId);
    activeChips.push({ label: `Entrada: ${t?.name ?? "Seleccionada"}` });
  }
  if (params.paymentOrder === "with") activeChips.push({ label: "Con cobro vinculado" });
  if (params.paymentOrder === "without") activeChips.push({ label: "Sin cobro vinculado" });
  if (params.notes === "with") activeChips.push({ label: "Con observaciones" });
  if (params.notes === "without") activeChips.push({ label: "Sin observaciones" });
  if (params.from || params.to) {
    activeChips.push({
      label: `Fecha ${params.from ?? "…"} – ${params.to ?? "…"}`,
    });
  }

  const clearHref = hasFilters
    ? `${adminRoutes.registrations}?editionId=${encodeURIComponent(editionId)}`
    : null;

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Inscripciones"
        description="Buscá participantes, revisá el estado del pago y del kit, y abrí el detalle para operar. La acreditación en sede se gestiona desde el módulo de acreditación de la edición."
        breadcrumbs={[{ label: "Inscripciones" }]}
      />

      <AdminFlashMessage flash={params.flash} />

      {editions.length === 0 ? (
        <AdminEmptyState
          title="No hay ediciones todavía"
          description="Creá una edición para empezar a ver inscripciones."
          action={
            <Button href={adminRoutes.editions} variant="primary" className="min-h-11">
              Ir a ediciones
            </Button>
          }
        />
      ) : (
        <>
          <form method="get" id="admin-registrations-filters" className="min-w-0">
            <RegistrationFiltersPanel
              clearHref={clearHref}
              activeChips={activeChips}
              primaryFields={
                <>
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
                    <span className="text-ck-text-secondary">Buscar participante</span>
                    <Input
                      name="q"
                      defaultValue={params.q ?? ""}
                      placeholder="Nombre, email, Instagram o código"
                      aria-label="Buscar por nombre, email, Instagram o código"
                    />
                  </label>
                </>
              }
              secondaryFields={
                <>
                  <label className="space-y-2 text-sm">
                    <span className="text-ck-text-secondary">Estado de inscripción</span>
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
                    <span className="text-ck-text-secondary">Estado del pago</span>
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
                        "PARTIALLY_REFUNDED",
                        "MANUAL_REVIEW",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {paymentStatusLabel(s as never)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-ck-text-secondary">Entrega del kit</span>
                    <Select name="fulfillmentStatus" defaultValue={params.fulfillmentStatus ?? ""}>
                      <option value="">Todas</option>
                      {FULFILLMENT_FILTER_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
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
                          {t.name}
                        </option>
                      ))}
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
                    <span className="text-ck-text-secondary">Desde</span>
                    <Input type="date" name="from" defaultValue={params.from ?? ""} />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-ck-text-secondary">Hasta</span>
                    <Input type="date" name="to" defaultValue={params.to ?? ""} />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-ck-text-secondary">Cobro vinculado</span>
                    <Select name="paymentOrder" defaultValue={params.paymentOrder ?? ""}>
                      <option value="">Todos</option>
                      <option value="with">Con cobro vinculado</option>
                      <option value="without">Sin cobro vinculado</option>
                    </Select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-ck-text-secondary">Observaciones internas</span>
                    <Select name="notes" defaultValue={params.notes ?? ""}>
                      <option value="">Todas</option>
                      <option value="with">Con observaciones</option>
                      <option value="without">Sin observaciones</option>
                    </Select>
                  </label>
                </>
              }
              actions={
                <>
                  <Button type="submit" variant="primary" className="min-h-11 w-full sm:w-auto">
                    Aplicar filtros
                  </Button>
                  {editionId ? (
                    <>
                      <Button
                        href={`${adminRoutes.registrations}/export?${exportQs.toString()}`}
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto"
                      >
                        Exportar CSV
                      </Button>
                      <Button
                        href={`${adminRoutes.registrations}/export?${exportQs.toString()}&kind=sizes`}
                        variant="outline"
                        className="min-h-11 w-full sm:w-auto"
                      >
                        Resumen de talles
                      </Button>
                    </>
                  ) : null}
                </>
              }
            />
          </form>

          {!listResult.ok ? (
            <p
              className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm"
              role="alert"
            >
              No pudimos cargar las inscripciones. Revisá la conexión e intentá nuevamente.
              {listResult.message ? (
                <span className="mt-2 block text-xs text-ck-text-muted">{listResult.message}</span>
              ) : null}
            </p>
          ) : rows.length === 0 && !hasFilters ? (
            <AdminEmptyState
              title="No hay inscripciones todavía"
              description="Cuando una persona complete el registro, aparecerá en este listado."
            />
          ) : rows.length === 0 ? (
            <AdminEmptyState
              title="No encontramos resultados"
              description="Probá quitar algunos filtros o buscar por otro dato."
              action={
                clearHref ? (
                  <Button href={clearHref} variant="secondary" className="min-h-11">
                    Limpiar filtros
                  </Button>
                ) : null
              }
            />
          ) : (
            <AdminDataTable
              rows={rows}
              rowKey={(row) => row.id}
              mobileCard={(row) => <RegistrationListMobileCard row={row} />}
              columns={[
                {
                  key: "participant",
                  header: "Participante",
                  cell: (row) => (
                    <div className="min-w-0 space-y-1">
                      <AdminTableLink href={`${adminRoutes.registrations}/${row.id}`}>
                        {row.firstName} {row.lastName}
                      </AdminTableLink>
                      <p className="break-all text-xs text-ck-text-muted">{row.email}</p>
                      {row.instagramHandle ? (
                        <p className="text-xs text-ck-text-muted">
                          @{row.instagramHandle.replace(/^@/, "")}
                        </p>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "summary",
                  header: "Estado general",
                  cell: (row) => {
                    const summary = presentAdminOperationalSummary({
                      registrationStatus: row.status,
                      paymentStatus: row.paymentStatus,
                      fulfillmentStatus: row.itemFulfillmentStatus,
                    });
                    return (
                      <Badge variant={adminToneToBadgeVariant(summary.tone)}>
                        {summary.label}
                      </Badge>
                    );
                  },
                },
                {
                  key: "payment",
                  header: "Pago",
                  cell: (row) => {
                    const payment = presentAdminPaymentStatus(row.paymentStatus);
                    const refund = presentAdminRefundBadge({
                      registrationStatus: row.status,
                      paymentStatus: row.paymentStatus,
                    });
                    return (
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={adminToneToBadgeVariant(payment.tone)}>
                            {payment.label}
                          </Badge>
                          {refund.kind !== "none" ? (
                            <Badge variant={refund.tone === "danger" ? "danger" : "warning"}>
                              {refund.label}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-ck-text-muted">
                          {displayRegistrationAmount(row.totalAmount, row.currency)}
                        </p>
                      </div>
                    );
                  },
                },
                {
                  key: "kit",
                  header: "Kit",
                  cell: (row) => {
                    const kit = presentAdminFulfillmentStatus(row.itemFulfillmentStatus);
                    return (
                      <div className="space-y-1">
                        <span className="text-sm">{kit.label}</span>
                        {row.shirtSizeLabel ? (
                          <p className="text-xs text-ck-text-muted">Talle {row.shirtSizeLabel}</p>
                        ) : null}
                      </div>
                    );
                  },
                },
                {
                  key: "next",
                  header: "Próxima acción",
                  cell: (row) => {
                    const summary = presentAdminOperationalSummary({
                      registrationStatus: row.status,
                      paymentStatus: row.paymentStatus,
                      fulfillmentStatus: row.itemFulfillmentStatus,
                    });
                    return (
                      <span className="text-sm text-ck-text-secondary">
                        {summary.nextAction ?? "Abrí el detalle"}
                      </span>
                    );
                  },
                },
                {
                  key: "created",
                  header: "Fecha",
                  cell: (row) => formatArDateTime(row.createdAt),
                },
                {
                  key: "actions",
                  header: "Acciones",
                  cell: (row) => (
                    <Button
                      href={`${adminRoutes.registrations}/${row.id}`}
                      variant="secondary"
                      className="min-h-11"
                    >
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
