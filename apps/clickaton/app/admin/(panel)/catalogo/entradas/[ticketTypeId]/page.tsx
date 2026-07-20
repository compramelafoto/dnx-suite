import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TicketActiveToggle } from "@/components/admin/catalog/TicketActiveToggle";
import { TicketCompositionPanel } from "@/components/admin/catalog/TicketCompositionPanel";
import { TicketTypeForm } from "@/components/admin/catalog/TicketTypeForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { listProductsAction } from "@/lib/admin-catalog/actions/products";
import { updateTicketTypeFormAction } from "@/lib/admin-catalog/actions/ticket-forms";
import {
  getCatalogAvailabilityAction,
  getTicketTypeAction,
} from "@/lib/admin-catalog/actions/tickets";
import { displayTicketPrice, minorUnitsToPesosInput } from "@/lib/admin-catalog/ui/money-ui";
import {
  commercialStatuses,
  evaluateTicketConfiguration,
  formatArDateTime,
  kitKindLabel,
  kitKindOf,
} from "@/lib/admin-catalog/ui/ticket-status";
import { getEditionById, listEditionOptions } from "@/lib/admin/editions/queries";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";

type Props = {
  params: Promise<{ ticketTypeId: string }>;
  searchParams: Promise<{ flash?: string }>;
};

export default async function AdminTicketTypeDetailPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { ticketTypeId } = await params;
  const { flash } = await searchParams;

  const ticketResult = await getTicketTypeAction(ticketTypeId);
  if (!ticketResult.ok || !ticketResult.data) {
    if (ticketResult.code === "NOT_FOUND") notFound();
    return (
      <div className="space-y-8">
        <AdminPageHeader title="Entrada" />
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {ticketResult.message ?? "No se pudo cargar la entrada."}
        </p>
        <Button href={catalogAdminRoutes.tickets} variant="secondary">
          Volver al listado
        </Button>
      </div>
    );
  }

  const ticket = ticketResult.data;
  const [editionResult, editionsResult, productsResult, availResult] = await Promise.all([
    getEditionById(ticket.editionId),
    listEditionOptions(),
    listProductsAction({ editionId: ticket.editionId }),
    getCatalogAvailabilityAction(ticket.editionId, [ticket.id]),
  ]);

  const edition = editionResult.ok ? editionResult.data : null;
  const editions = editionsResult.ok ? editionsResult.data : [];
  const products = productsResult.ok ? productsResult.data ?? [] : [];
  const availability = availResult.ok
    ? (availResult.data ?? []).find((a) => a.ticketTypeId === ticket.id) ?? null
    : null;

  const productsById = new Map(products.map((p) => [p.id, p]));
  const config = evaluateTicketConfiguration(ticket, productsById);
  const statuses = commercialStatuses({
    ticket,
    availability,
    config: config.status,
  });
  const listHref = `${catalogAdminRoutes.tickets}?editionId=${encodeURIComponent(ticket.editionId)}`;
  const editionLabel = edition
    ? `${edition.name} (${EDITION_STATUS_LABELS[edition.status as ClickatonEditionStatus] ?? edition.status})`
    : ticket.editionId;

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title={ticket.name}
        description={`Código ${ticket.code} · ${editionLabel} · ${kitKindLabel(kitKindOf(ticket.items))}`}
        breadcrumbs={[
          { label: "Catálogo", href: catalogAdminRoutes.hub },
          { label: "Entradas", href: listHref },
          { label: ticket.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {statuses.map((label) => (
              <Badge key={label} variant={label === "Activa" || label === "En venta" ? "success" : "neutral"}>
                {label}
              </Badge>
            ))}
            <TicketActiveToggle ticketTypeId={ticket.id} isActive={ticket.isActive} />
            <Button href={listHref} variant="secondary">
              Volver al listado
            </Button>
          </div>
        }
      />

      <AdminFlashMessage flash={flash} />

      <dl className="grid gap-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-ck-text-secondary">Precio</dt>
          <dd className="text-lg font-semibold text-ck-text">
            {displayTicketPrice(ticket.priceAmount, ticket.currency)}
          </dd>
          <dd className="text-xs text-ck-text-muted">
            {ticket.priceAmount} centavos · input {minorUnitsToPesosInput(ticket.priceAmount)} pesos
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ck-text-secondary">Cupo</dt>
          <dd className="text-lg font-semibold text-ck-text">
            {availability?.isUnlimited || ticket.capacity === null
              ? "Ilimitado"
              : ticket.capacity}
          </dd>
          <dd className="text-xs text-ck-text-muted">
            Confirmados {availability?.confirmedCount ?? 0} · Holds{" "}
            {availability?.activeHoldCount ?? 0} · Disp.{" "}
            {availability?.isUnlimited ? "∞" : (availability?.available ?? "—")}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ck-text-secondary">Período</dt>
          <dd className="text-sm text-ck-text">
            {formatArDateTime(ticket.salesStartAt)} → {formatArDateTime(ticket.salesEndAt)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ck-text-secondary">Configuración</dt>
          <dd className="text-lg font-semibold text-ck-text">
            {config.status === "complete"
              ? "Completa"
              : config.status === "warnings"
                ? "Con advertencias"
                : "Incompleta"}
          </dd>
        </div>
      </dl>

      {config.warnings.length || config.reasons.length ? (
        <ul className="list-disc space-y-1 rounded-[var(--ck-radius-card)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] px-6 py-4 text-sm" role="status">
          {[...config.reasons, ...config.warnings].map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <TicketTypeForm
        mode="edit"
        lockEdition
        action={updateTicketTypeFormAction.bind(null, ticket.id)}
        editions={
          editions.length
            ? editions
            : [
                {
                  id: ticket.editionId,
                  name: edition?.name ?? "Edición",
                  status: edition?.status ?? "DRAFT",
                },
              ]
        }
        initialValues={{
          editionId: ticket.editionId,
          name: ticket.name,
          description: ticket.description ?? "",
          code: ticket.code,
          priceAmount: ticket.priceAmount,
          currency: ticket.currency,
          capacity: ticket.capacity,
          holdMinutes: ticket.holdMinutes,
          salesStartAt: ticket.salesStartAt,
          salesEndAt: ticket.salesEndAt,
          isActive: ticket.isActive,
          venueId: ticket.venueId,
        }}
        cancelHref={listHref}
        submitLabel="Guardar cambios"
      />

      <TicketCompositionPanel
        ticketTypeId={ticket.id}
        items={ticket.items}
        products={products}
      />
    </div>
  );
}
