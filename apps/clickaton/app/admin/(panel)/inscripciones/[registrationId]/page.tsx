import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AssignmentForm } from "@/components/admin/registrations/AssignmentForm";
import { InternalNoteForm } from "@/components/admin/registrations/InternalNoteForm";
import { RegistrationTransitionButtons } from "@/components/admin/registrations/RegistrationTransitionButtons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { listTicketTypesAction } from "@/lib/admin-catalog/actions/tickets";
import { getCatalogAvailabilityAction } from "@/lib/admin-catalog/actions/tickets";
import { getRegistrationAction } from "@/lib/admin-registration/actions/registrations";
import {
  displayRegistrationAmount,
  formatArDateTime,
  holdStatusLabel,
  paymentStatusLabel,
  registrationStatusLabel,
  registrationStatusTone,
} from "@/lib/admin-registration/ui/status-labels";
import { getEditionById } from "@/lib/admin/editions/queries";
import { listVenues } from "@/lib/admin/venues/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getCheckoutService } from "@/lib/checkout/actions/runtime";

type Props = {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ flash?: string }>;
};

export default async function AdminRegistrationDetailPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { registrationId } = await params;
  const { flash } = await searchParams;

  const result = await getRegistrationAction(registrationId);
  if (!result.ok || !result.data) {
    if (result.code === "NOT_FOUND") notFound();
    return (
      <div className="space-y-8">
        <AdminPageHeader title="Inscripción" />
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {result.message ?? "No se pudo cargar."}
        </p>
        <Button href={adminRoutes.registrations} variant="secondary">
          Volver
        </Button>
      </div>
    );
  }

  const reg = result.data;
  const [editionResult, venuesResult, ticketsResult, availResult] = await Promise.all([
    getEditionById(reg.editionId),
    listVenues({ editionId: reg.editionId, active: "all" }),
    listTicketTypesAction({ editionId: reg.editionId }),
    getCatalogAvailabilityAction(reg.editionId, [reg.ticketTypeId]),
  ]);

  const edition = editionResult.ok ? editionResult.data : null;
  const venues = venuesResult.ok ? venuesResult.data ?? [] : [];
  const tickets = ticketsResult.ok ? ticketsResult.data ?? [] : [];
  const availability =
    availResult.ok
      ? (availResult.data ?? []).find((a) => a.ticketTypeId === reg.ticketTypeId) ?? null
      : null;
  const ticket = tickets.find((t) => t.id === reg.ticketTypeId);
  const venue = venues.find((v) => v.id === reg.venueId);
  const listHref = `${adminRoutes.registrations}?editionId=${encodeURIComponent(reg.editionId)}`;
  const canAssign = ["DRAFT", "PENDING_PAYMENT", "WAITLISTED"].includes(reg.status);
  const internalNotes = reg.audits.filter((a) => a.action === "INTERNAL_NOTE");

  let durableOrder: Awaited<
    ReturnType<ReturnType<typeof getCheckoutService>["getPaymentOrder"]>
  > = null;
  let reconcile:
    | Awaited<ReturnType<ReturnType<typeof getCheckoutService>["reconcileRegistration"]>>
    | null = null;
  try {
    if (reg.paymentOrderId) {
      durableOrder = await getCheckoutService().getPaymentOrder(reg.paymentOrderId);
    }
    reconcile = await getCheckoutService().reconcileRegistration(reg.id);
  } catch {
    durableOrder = null;
    reconcile = null;
  }

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title={`${reg.firstName} ${reg.lastName}`}
        description={`${reg.email} · ${edition?.name ?? reg.editionId} · ${ticket?.name ?? reg.ticketTypeId}`}
        breadcrumbs={[
          { label: "Inscripciones", href: listHref },
          { label: reg.visibleCode ?? reg.id.slice(0, 8) },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={registrationStatusTone(reg.status)}>
              {registrationStatusLabel(reg.status)}
            </Badge>
            <Badge variant="neutral">{paymentStatusLabel(reg.paymentStatus)}</Badge>
            <Button href={listHref} variant="secondary">
              Volver al listado
            </Button>
          </div>
        }
      />

      <AdminFlashMessage flash={flash} />

      <section className="grid gap-6 lg:grid-cols-2" aria-labelledby="identity-heading">
        <div className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border p-5">
          <h2 id="identity-heading" className="text-lg font-semibold">
            Identidad
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ck-text-secondary">Nombre</dt>
              <dd>
                {reg.firstName} {reg.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Email</dt>
              <dd>{reg.email}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Teléfono</dt>
              <dd>{reg.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Documento</dt>
              <dd className="font-mono">{reg.documentNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Localidad</dt>
              <dd>
                {[reg.city, reg.province, reg.country].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Emergencia</dt>
              <dd>
                {reg.emergencyContactName ?? "—"}
                {reg.emergencyContactPhone ? ` · ${reg.emergencyContactPhone}` : ""}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border p-5">
          <h2 className="text-lg font-semibold">Evento y cupo</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ck-text-secondary">Edición</dt>
              <dd>{edition?.name ?? reg.editionId}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Sede</dt>
              <dd>{venue?.name ?? (reg.venueId ? reg.venueId : "Sin sede")}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Entrada</dt>
              <dd>
                {ticket?.name ?? reg.ticketTypeId}
                {ticket ? ` (${ticket.code})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Código visible</dt>
              <dd className="font-mono">{reg.visibleCode ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Cupo entrada</dt>
              <dd>
                {availability?.isUnlimited
                  ? "Ilimitado"
                  : `Disp. ${availability?.available ?? "—"} · Conf. ${availability?.confirmedCount ?? 0} · Holds ${availability?.activeHoldCount ?? 0}`}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Hold de cupo</dt>
              <dd>
                {reg.capacityHold
                  ? `${holdStatusLabel(reg.capacityHold.status)} · vence ${formatArDateTime(reg.capacityHold.expiresAt)}`
                  : "Sin hold"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border p-5" aria-labelledby="commercial-heading">
        <h2 id="commercial-heading" className="text-lg font-semibold">
          Comercial (soft refs DNX Payments)
        </h2>
        <p className="text-sm text-ck-text-secondary">
          No es una orden Clickatón local. Referencias opacas a DNX Payments (sin access
          token, sin payload crudo del proveedor).
        </p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-ck-text-secondary">Importe</dt>
            <dd className="text-lg font-semibold">
              {displayRegistrationAmount(reg.totalAmount, reg.currency)}
            </dd>
            <dd className="text-xs text-ck-text-muted">
              {reg.totalAmount} centavos · subtotal {reg.subtotalAmount} · desc.{" "}
              {reg.discountAmount}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Orden (enmascarada)</dt>
            <dd className="break-all font-mono text-xs">
              {reg.paymentOrderId
                ? `${reg.paymentOrderId.slice(0, 6)}…${reg.paymentOrderId.slice(-4)}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Proveedor</dt>
            <dd className="text-xs">{reg.paymentProvider ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Ref. externa (enmascarada)</dt>
            <dd className="break-all font-mono text-xs">
              {reg.paymentExternalReference
                ? `${reg.paymentExternalReference.slice(0, 4)}…${reg.paymentExternalReference.slice(-4)}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Estado cobro normalizado</dt>
            <dd>{paymentStatusLabel(reg.paymentStatus)}</dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Confirmación / idempotency</dt>
            <dd className="text-xs">
              {formatArDateTime(reg.confirmedAt)}
              <br />
              <span className="font-mono">
                {reg.paymentIdempotencyKey
                  ? `${reg.paymentIdempotencyKey.slice(0, 8)}…`
                  : "—"}
              </span>
            </dd>
          </div>
        </dl>
        {durableOrder ? (
          <dl className="mt-4 grid gap-3 border-t border-ck-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-ck-text-secondary">Estado DNX (durable)</dt>
              <dd>{durableOrder.status}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Intento</dt>
              <dd>{durableOrder.attempt}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Eventos / último</dt>
              <dd>
                {durableOrder.lastEventId
                  ? `${durableOrder.lastEventId.slice(0, 8)}…`
                  : "—"}
                <br />
                <span className="text-xs text-ck-text-muted">
                  {durableOrder.lastEventAt
                    ? formatArDateTime(durableOrder.lastEventAt)
                    : "sin eventos"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Creada (DNX)</dt>
              <dd>{formatArDateTime(durableOrder.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Aprobación (DNX)</dt>
              <dd>
                {durableOrder.approvedAt
                  ? formatArDateTime(durableOrder.approvedAt)
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : null}
        {reconcile && reconcile.status !== "CONSISTENT" ? (
          <p className="text-sm text-amber-700" role="status">
            Reconciliación: {reconcile.status}. Hallazgos:{" "}
            {reconcile.findings.join(", ") || "—"}.
          </p>
        ) : null}
        {reg.paymentStatus === "MANUAL_REVIEW" ? (
          <p className="text-sm text-amber-700" role="status">
            Advertencia: pago en revisión manual (p. ej. aprobación con holds vencidos o
            inconsistencia). No forzar acciones peligrosas.
          </p>
        ) : null}
      </section>

      <section className="space-y-4" aria-labelledby="kit-heading">
        <h2 id="kit-heading" className="text-lg font-semibold">
          Productos (snapshot)
        </h2>
        <p className="text-sm text-ck-text-secondary">
          Líneas congeladas en la inscripción (`nameSnapshot` / `skuSnapshot`). No es la
          composición viva del ticket. La lectura no modifica stock.
        </p>
        {reg.items.length === 0 ? (
          <p className="text-sm text-ck-text-muted" role="status">
            Inscripción sin ítems de producto.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--ck-radius-card)] border border-ck-border">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="border-b border-ck-border bg-ck-bg/50 text-ck-text-secondary">
                <tr>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Cant.</th>
                  <th className="px-4 py-3">Incluido</th>
                  <th className="px-4 py-3">Importe</th>
                </tr>
              </thead>
              <tbody>
                {reg.items.map((item) => (
                  <tr key={item.id} className="border-b border-ck-border/70">
                    <td className="px-4 py-3">{item.nameSnapshot}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.skuSnapshot ?? "—"}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{item.isIncluded ? "Sí" : "No"}</td>
                    <td className="px-4 py-3">
                      {displayRegistrationAmount(item.totalPriceAmount, item.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reg.stockHolds.length > 0 ? (
          <div className="text-sm text-ck-text-secondary">
            Holds de stock:{" "}
            {reg.stockHolds
              .map((h) => `${h.productVariantId} ×${h.quantity} (${holdStatusLabel(h.status)})`)
              .join(" · ")}
          </div>
        ) : null}
      </section>

      <section className="space-y-4" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-lg font-semibold">
          Acciones administrativas
        </h2>
        <RegistrationTransitionButtons registrationId={reg.id} status={reg.status} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Reasignar sede / entrada</h2>
          <AssignmentForm
            registrationId={reg.id}
            ticketTypeId={reg.ticketTypeId}
            venueId={reg.venueId}
            enabled={canAssign}
            ticketOptions={tickets.map((t) => ({
              id: t.id,
              label: `${t.name} (${t.code})`,
            }))}
            venueOptions={venues.map((v) => ({ id: v.id, label: v.name }))}
          />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Observaciones internas</h2>
          <InternalNoteForm registrationId={reg.id} />
          {internalNotes.length === 0 ? (
            <p className="text-sm text-ck-text-muted">Sin notas todavía.</p>
          ) : (
            <ul className="space-y-3">
              {internalNotes.map((n) => (
                <li
                  key={n.id}
                  className="rounded-[var(--ck-radius-card)] border border-ck-border px-4 py-3 text-sm"
                >
                  <p>{String(n.metadata?.note ?? "")}</p>
                  <p className="mt-2 text-xs text-ck-text-muted">
                    {formatArDateTime(n.createdAt)}
                    {n.actorUserId ? ` · actor #${n.actorUserId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          Historial de estados
        </h2>
        {reg.statusHistory.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Sin historial.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {reg.statusHistory.map((h) => (
              <li key={h.id} className="rounded border border-ck-border/70 px-3 py-2">
                <span className="font-medium">
                  {h.previousStatus ?? "—"} → {h.newStatus}
                </span>
                <span className="text-ck-text-muted">
                  {" "}
                  · cobro {h.previousPaymentStatus ?? "—"} → {h.newPaymentStatus}
                </span>
                <div className="text-xs text-ck-text-muted">
                  {formatArDateTime(h.createdAt)} · {h.source}
                  {h.reason ? ` · ${h.reason}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <dl className="grid gap-3 text-xs text-ck-text-muted sm:grid-cols-3">
        <div>
          <dt>Creada</dt>
          <dd>{formatArDateTime(reg.createdAt)}</dd>
        </div>
        <div>
          <dt>Actualizada</dt>
          <dd>{formatArDateTime(reg.updatedAt)}</dd>
        </div>
        <div>
          <dt>Confirmada / cancelada</dt>
          <dd>
            {formatArDateTime(reg.confirmedAt)} / {formatArDateTime(reg.cancelledAt)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
