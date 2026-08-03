import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SOCIAL_SENSITIVE_CONFIRM } from "@/lib/social-communications/ui/social-communications-status-presentation";
import { AssignmentForm } from "@/components/admin/registrations/AssignmentForm";
import { InternalNoteForm } from "@/components/admin/registrations/InternalNoteForm";
import { ItemFulfillmentForm } from "@/components/admin/registrations/ItemFulfillmentForm";
import { RegistrationTransitionButtons } from "@/components/admin/registrations/RegistrationTransitionButtons";
import { AdminParticipantCardsPanel } from "@/components/admin/registrations/AdminParticipantCardsPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  evaluateClickatonCardEligibility,
  hasClickatonCardConsent,
} from "@/lib/participant-cards";
import { isAdminCardsV2Enabled } from "@/lib/participant-cards/participant-card-feature-flags";
import { adminRoutes } from "@/config/admin/navigation";
import { listTicketTypesAction } from "@/lib/admin-catalog/actions/tickets";
import { getCatalogAvailabilityAction } from "@/lib/admin-catalog/actions/tickets";
import { getRegistrationAction } from "@/lib/admin-registration/actions/registrations";
import {
  adminToneToBadgeVariant,
  displayAdminValue,
  presentAdminEmailQueueStatus,
  presentAdminFotoRankSyncStatus,
  presentAdminFulfillmentStatus,
  presentAdminOperationalSummary,
  presentAdminPaymentStatus,
  presentAdminPublicationStatus,
  presentAdminRegistrationStatus,
  presentAdminResendClassification,
  presentAdminWelcomeCardStatus,
} from "@/lib/admin-registration/ui/admin-status-presentation";
import {
  displayRegistrationAmount,
  formatArDateTime,
  holdStatusLabel,
  registrationStatusLabel,
  paymentStatusLabel,
} from "@/lib/admin-registration/ui/status-labels";
import { getEditionById } from "@/lib/admin/editions/queries";
import { listVenues } from "@/lib/admin/venues/queries";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getCheckoutService } from "@/lib/checkout/actions/runtime";
import { syncRegistrationFotoRankFormAction } from "@/lib/fotorank-sync/actions/fotorank-sync-admin";
import { getAdminIntegrations } from "@/config/admin/integrations";
import { prisma } from "@/lib/admin/db";
import {
  approveWelcomeCardAction,
  enqueueWelcomeCardForRegistrationAction,
  regenerateWelcomeCardAction,
  rejectWelcomeCardAction,
  retryWelcomeCardAction,
} from "@/lib/welcome-card/admin-actions";
import { adminResendConfirmationEmailAction } from "@/lib/registration/notifications/admin-resend-confirmation-action";
import { classifyResendStatus } from "@/lib/registration/notifications/resend-delivery-status";

type Props = {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ flash?: string }>;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-sm text-ck-text-secondary">{label}</dt>
      <dd className="break-words text-sm text-ck-text">{children}</dd>
    </div>
  );
}

export default async function AdminRegistrationDetailPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { registrationId } = await params;
  const { flash } = await searchParams;

  const result = await getRegistrationAction(registrationId);
  if (!result.ok || !result.data) {
    if (result.code === "NOT_FOUND") notFound();
    return (
      <div className="min-w-0 space-y-8">
        <AdminPageHeader
          title="Inscripción"
          description="No pudimos cargar esta inscripción."
        />
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm" role="alert">
          No pudimos cargar la inscripción. Revisá la conexión e intentá nuevamente.
          {result.message ? (
            <span className="mt-2 block text-xs text-ck-text-muted">{result.message}</span>
          ) : null}
        </p>
        <Button href={adminRoutes.registrations} variant="secondary" className="min-h-11">
          Volver al listado
        </Button>
      </div>
    );
  }

  const reg = result.data;
  const socialPublish = await prisma.dnxSocialPublishRequest.findFirst({
    where: {
      application: "CLICKATON",
      entityType: "WELCOME_CARD",
      entityId: { in: [reg.id, reg.welcomeCard?.id ?? ""] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, scheduleAt: true, publishedAt: true, lastErrorCode: true, permalink: true },
  });
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
  const accreditationHref = `${adminRoutes.editions}/${reg.editionId}/acreditacion`;
  const canAssign = ["DRAFT", "PENDING_PAYMENT", "WAITLISTED"].includes(reg.status);
  const internalNotes = reg.audits.filter((a) => a.action === "INTERNAL_NOTE");

  const summary = presentAdminOperationalSummary({
    registrationStatus: reg.status,
    paymentStatus: reg.paymentStatus,
    fulfillmentStatus: reg.itemFulfillmentStatus,
  });
  const regStatus = presentAdminRegistrationStatus(reg.status);
  const payStatus = presentAdminPaymentStatus(reg.paymentStatus);
  const welcomeStatus = presentAdminWelcomeCardStatus(
    reg.welcomeCardStatus ?? reg.welcomeCard?.status,
  );
  const publicationStatus = presentAdminPublicationStatus(
    reg.welcomePublicationStatus ?? reg.welcomeCard?.publicationStatus ?? socialPublish?.status,
  );
  const fotoRankStatus = presentAdminFotoRankSyncStatus(
    reg.fotoRankSyncStatus ?? reg.fotoRankSync?.status,
  );

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

  const emailRows = await prisma.emailQueue.findMany({
    where: {
      OR: [
        { to: reg.email },
        {
          idempotencyKey: {
            startsWith: `${reg.id}:CLICKATON_PAYMENT_CONFIRMATION`,
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      to: true,
      subject: true,
      status: true,
      sentAt: true,
      attempts: true,
      errorMessage: true,
      createdAt: true,
      templateData: true,
      idempotencyKey: true,
    },
  });
  const latestEmail = emailRows[0] ?? null;
  const latestTemplate =
    latestEmail?.templateData && typeof latestEmail.templateData === "object"
      ? (latestEmail.templateData as Record<string, unknown>)
      : null;
  const providerMessageId =
    typeof latestTemplate?.providerMessageId === "string"
      ? latestTemplate.providerMessageId
      : null;
  const resendClassification = classifyResendStatus(
    typeof latestTemplate?.resendLastEvent === "string"
      ? { last_event: latestTemplate.resendLastEvent }
      : typeof latestTemplate?.last_event === "string"
        ? { last_event: latestTemplate.last_event }
        : latestEmail?.status === "SENT"
          ? { status: "sent" }
          : null,
  );
  const resendPresentation = presentAdminResendClassification(resendClassification);
  const emailQueuePresentation = presentAdminEmailQueueStatus(latestEmail?.status);
  const resendAttempts = await prisma.clickatonRegistrationAudit.count({
    where: { registrationId: reg.id, action: "EMAIL_RESEND" },
  });
  const bounceReason =
    typeof latestTemplate?.bounceReason === "string"
      ? String(latestTemplate.bounceReason).slice(0, 240)
      : latestEmail?.errorMessage?.slice(0, 240) ?? null;

  const hasDiscount = reg.discountAmount > 0;
  const pendingActions: string[] = [];
  if (summary.nextAction) pendingActions.push(summary.nextAction);
  if (payStatus.nextAction && !pendingActions.includes(payStatus.nextAction)) {
    pendingActions.push(payStatus.nextAction);
  }
  if (
    reg.itemFulfillmentStatus &&
    reg.itemFulfillmentStatus !== "DELIVERED" &&
    reg.itemFulfillmentStatus !== "CANCELLED"
  ) {
    pendingActions.push("Registrá la entrega del kit cuando corresponda.");
  }
  if (welcomeStatus.attention === "action") {
    pendingActions.push(welcomeStatus.nextAction ?? "Revisá la placa de bienvenida.");
  }

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title={`Inscripción de ${reg.firstName} ${reg.lastName}`}
        description="Revisá el estado del pago, la acreditación y los datos necesarios para participar."
        breadcrumbs={[
          { label: "Inscripciones", href: listHref },
          { label: reg.visibleCode ? `N.º ${reg.visibleCode}` : "Detalle" },
        ]}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Badge variant={adminToneToBadgeVariant(summary.tone)}>{summary.label}</Badge>
            <Badge variant={adminToneToBadgeVariant(payStatus.tone)}>{payStatus.label}</Badge>
            <span className="text-sm text-ck-text-secondary">
              {edition?.name ?? "Edición"} · {ticket?.name ?? "Entrada"}
            </span>
            <Button href={listHref} variant="secondary" className="min-h-11 w-full sm:w-auto">
              Volver al listado
            </Button>
            <Button
              href={accreditationHref}
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
            >
              Ir a acreditación
            </Button>
          </div>
        }
      />

      <AdminFlashMessage flash={flash} />

      {/* 1. Resumen del estado */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="summary-heading"
      >
        <h2 id="summary-heading" className="text-lg font-semibold">
          Resumen operativo
        </h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">{summary.description}</p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Estado de inscripción">
            <Badge variant={adminToneToBadgeVariant(regStatus.tone)}>{regStatus.label}</Badge>
            <p className="mt-2 text-xs text-ck-text-muted">{regStatus.description}</p>
          </Field>
          <Field label="Estado del pago">
            <Badge variant={adminToneToBadgeVariant(payStatus.tone)}>{payStatus.label}</Badge>
            <p className="mt-2 text-xs text-ck-text-muted">{payStatus.description}</p>
          </Field>
          <Field label="Acreditación">
            Se opera desde el módulo de acreditación de la edición.
            <p className="mt-2 text-xs text-ck-text-muted">
              Este detalle no modifica el check-in. Usá el escáner o el panel de sede.
            </p>
          </Field>
        </dl>
        {pendingActions.length > 0 ? (
          <div className="rounded-[var(--ck-radius-card)] border border-ck-yellow/30 bg-ck-yellow/5 px-4 py-3">
            <h3 className="text-sm font-semibold text-ck-text">Acciones pendientes</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ck-text-secondary">
              {pendingActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 2. Participante */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="participant-heading"
      >
        <h2 id="participant-heading" className="text-lg font-semibold">
          Datos del participante
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre y apellido">
            {reg.firstName} {reg.lastName}
          </Field>
          <Field label="Correo electrónico">{displayAdminValue(reg.email)}</Field>
          <Field label="Teléfono">{displayAdminValue(reg.phone)}</Field>
          <Field label="Usuario de Instagram">
            {reg.instagramHandle
              ? `@${reg.instagramHandle.replace(/^@/, "")}`
              : "No informado"}
          </Field>
          <Field label="Documento">{displayAdminValue(reg.documentNumber)}</Field>
          <Field label="Ciudad">
            {displayAdminValue(
              [reg.city, reg.province, reg.country].filter(Boolean).join(", ") || null,
            )}
          </Field>
          <Field label="Contacto de emergencia">
            {reg.emergencyContactName || reg.emergencyContactPhone
              ? `${reg.emergencyContactName ?? "Sin nombre"}${
                  reg.emergencyContactPhone ? ` · ${reg.emergencyContactPhone}` : ""
                }`
              : "No informado"}
          </Field>
          <Field label="Fecha de inscripción">{formatArDateTime(reg.createdAt)}</Field>
          <Field label="Fotografía de perfil">
            {reg.profilePhotoAssetId
              ? "Hay una fotografía asociada (detalle técnico abajo)."
              : "No informada"}
          </Field>
          <Field label="Código de participante">
            {displayAdminValue(reg.visibleCode, "Todavía sin código visible")}
          </Field>
        </dl>
      </section>

      {/* 3. Evento */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="event-heading"
      >
        <h2 id="event-heading" className="text-lg font-semibold">
          Edición y entrada
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Edición">{edition?.name ?? "No informada"}</Field>
          <Field label="Sede">{venue?.name ?? (reg.venueId ? "Sede asignada" : "Sin sede")}</Field>
          <Field label="Entrada">{ticket?.name ?? "No informada"}</Field>
          <Field label="Cupo de la entrada">
            {availability?.isUnlimited
              ? "Ilimitado"
              : `Disponibles: ${availability?.available ?? "—"}. Confirmadas: ${
                  availability?.confirmedCount ?? 0
                }. Reservas activas: ${availability?.activeHoldCount ?? 0}.`}
          </Field>
          <Field label="Reserva de cupo">
            {reg.capacityHold
              ? `${holdStatusLabel(reg.capacityHold.status)} · vence ${formatArDateTime(reg.capacityHold.expiresAt)}`
              : "Sin reserva activa"}
          </Field>
        </dl>
      </section>

      {/* 4. Pago */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="payment-heading"
      >
        <h2 id="payment-heading" className="text-lg font-semibold">
          Pago
        </h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          {payStatus.description}
          {payStatus.nextAction ? ` ${payStatus.nextAction}` : ""}
        </p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Estado del pago">
            <Badge variant={adminToneToBadgeVariant(payStatus.tone)}>{payStatus.label}</Badge>
          </Field>
          <Field label="Total">
            <span className="text-lg font-semibold">
              {displayRegistrationAmount(reg.totalAmount, reg.currency)}
            </span>
          </Field>
          <Field label="Subtotal">
            {displayRegistrationAmount(reg.subtotalAmount, reg.currency)}
          </Field>
          <Field label="Descuento aplicado">
            {hasDiscount
              ? displayRegistrationAmount(reg.discountAmount, reg.currency)
              : "Sin descuento"}
          </Field>
          {hasDiscount ? (
            <Field label="Código promocional">
              Hubo un descuento aplicado. El detalle interno del código está en información
              técnica si existe referencia.
            </Field>
          ) : null}
          <Field label="Fecha de confirmación">
            {reg.confirmedAt ? formatArDateTime(reg.confirmedAt) : "Todavía no confirmada"}
          </Field>
          <Field label="Medio de cobro">
            {reg.paymentProvider
              ? reg.paymentProvider === "mercadopago" || reg.paymentProvider === "MP"
                ? "Mercado Pago"
                : reg.paymentProvider
              : "No informado"}
          </Field>
        </dl>
        {reg.paymentStatus === "MANUAL_REVIEW" ? (
          <p
            className="rounded-[var(--ck-radius-card)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
            role="status"
          >
            Este pago requiere revisión manual. No fuerces un segundo cobro ni acciones
            irreversibles hasta resolver la inconsistencia.
          </p>
        ) : null}
        {reg.paymentStatus === "PROCESSING" ? (
          <p
            className="rounded-[var(--ck-radius-card)] border border-ck-border px-4 py-3 text-sm text-ck-text-secondary"
            role="status"
          >
            El cobro está en proceso. Esperá unos minutos antes de pedir otro intento de pago.
          </p>
        ) : null}
        {reconcile && reconcile.status !== "CONSISTENT" ? (
          <p
            className="rounded-[var(--ck-radius-card)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
            role="status"
          >
            Detectamos una diferencia entre el estado local y el cobro registrado. Revisá la
            información técnica antes de operar.
          </p>
        ) : null}
      </section>

      {/* 5. Kit / productos */}
      <section className="space-y-4" aria-labelledby="kit-heading">
        <div className="space-y-2">
          <h2 id="kit-heading" className="text-lg font-semibold">
            Producto, talle y entrega
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Productos asociados a esta inscripción. La entrega se registra en sede.
          </p>
        </div>
        {reg.items.length === 0 ? (
          <p className="text-sm text-ck-text-muted" role="status">
            Esta inscripción no tiene productos asociados.
          </p>
        ) : (
          <ul className="grid gap-4">
            {reg.items.map((item) => {
              const fulfillment = presentAdminFulfillmentStatus(item.fulfillmentStatus);
              return (
                <li
                  key={item.id}
                  className="min-w-0 space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-base font-semibold">{item.nameSnapshot}</h3>
                      <p className="text-sm text-ck-text-secondary">
                        Talle: {displayAdminValue(item.variantNameSnapshot, "Sin talle")} ·
                        Cantidad: {item.quantity}
                        {item.isIncluded ? " · Incluido" : ""}
                      </p>
                    </div>
                    <Badge variant={adminToneToBadgeVariant(fulfillment.tone)}>
                      {fulfillment.label}
                    </Badge>
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Field label="Estado de entrega">
                      {fulfillment.label}
                      <p className="mt-1 text-xs text-ck-text-muted">{fulfillment.description}</p>
                    </Field>
                    <Field label="Importe">
                      {displayRegistrationAmount(item.totalPriceAmount, item.currency)}
                    </Field>
                    <Field label="Fecha de entrega">
                      {item.fulfilledAt
                        ? formatArDateTime(item.fulfilledAt)
                        : "Todavía no entregado"}
                    </Field>
                  </dl>
                  {item.isIncluded ? (
                    <ItemFulfillmentForm
                      registrationId={reg.id}
                      itemId={item.id}
                      currentStatus={item.fulfillmentStatus ?? "PENDING"}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 6. Acreditación (enlace, sin cambiar lógica) */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="accreditation-heading"
      >
        <h2 id="accreditation-heading" className="text-lg font-semibold">
          Acreditación
        </h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          La acreditación en sede (QR, check-in y credencial) se gestiona en el módulo de
          acreditación de la edición. Desde aquí no se modifica ese estado.
        </p>
        <Button href={accreditationHref} variant="primary" className="min-h-11 w-full sm:w-auto">
          Abrir módulo de acreditación
        </Button>
      </section>

      {/* 7. Placa */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="welcome-card-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 id="welcome-card-heading" className="text-lg font-semibold">
              Placa de bienvenida
            </h2>
            <p className="text-sm text-ck-text-secondary">{welcomeStatus.description}</p>
          </div>
          <Badge variant={adminToneToBadgeVariant(welcomeStatus.tone)}>
            {welcomeStatus.label}
          </Badge>
        </div>
        <p className="text-sm text-ck-text-muted">
          Generá y administrá la pieza que el participante puede compartir en sus redes. Aprobar
          una placa no implica publicarla automáticamente.
        </p>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
          {reg.welcomeCard?.id ? (
            <>
              <form action={regenerateWelcomeCardAction.bind(null, reg.welcomeCard.id)}>
                <ConfirmSubmitButton
                  confirmMessage={SOCIAL_SENSITIVE_CONFIRM.regenerateWelcome}
                  variant="secondary"
                  className="min-h-11 w-full sm:w-auto"
                >
                  Volver a generar
                </ConfirmSubmitButton>
              </form>
              <form action={retryWelcomeCardAction.bind(null, reg.welcomeCard.id)}>
                <ConfirmSubmitButton
                  confirmMessage={SOCIAL_SENSITIVE_CONFIRM.retryWelcome}
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                >
                  Volver a intentar la generación
                </ConfirmSubmitButton>
              </form>
              <form action={approveWelcomeCardAction.bind(null, reg.welcomeCard.id)}>
                <ConfirmSubmitButton
                  confirmMessage={SOCIAL_SENSITIVE_CONFIRM.approveWelcome}
                  variant="secondary"
                  className="min-h-11 w-full sm:w-auto"
                >
                  Aprobar placa
                </ConfirmSubmitButton>
              </form>
              <form action={rejectWelcomeCardAction.bind(null, reg.welcomeCard.id)}>
                <ConfirmSubmitButton
                  confirmMessage={SOCIAL_SENSITIVE_CONFIRM.rejectWelcome}
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                >
                  Rechazar placa
                </ConfirmSubmitButton>
              </form>
            </>
          ) : reg.status === "CONFIRMED" && reg.paymentStatus === "APPROVED" ? (
            <form action={enqueueWelcomeCardForRegistrationAction.bind(null, reg.id)}>
              <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
                Generar placa
              </Button>
            </form>
          ) : (
            <p className="text-sm text-ck-text-muted">
              La placa se puede generar cuando la inscripción esté confirmada y el pago
              acreditado.
            </p>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Usuario de Instagram del participante">
            {reg.instagramHandle ? (
              <>
                @{reg.instagramHandle.replace(/^@/, "")}
                <span className="mt-1 block text-xs text-ck-text-muted">
                  Se utilizará para identificarlo o etiquetarlo cuando la publicación lo permita.
                  No implica etiquetado automático.
                </span>
              </>
            ) : (
              <>
                Instagram no informado
                <span className="mt-1 block text-xs text-ck-text-muted">
                  Podés preparar la pieza, pero no será posible identificar al participante
                  mediante su usuario.
                </span>
              </>
            )}
          </Field>
          <Field label="Estado de publicación">
            <div className="space-y-1">
              <Badge variant={adminToneToBadgeVariant(publicationStatus.tone)}>
                {publicationStatus.label}
              </Badge>
              <p className="text-xs text-ck-text-muted">{publicationStatus.description}</p>
            </div>
          </Field>
        </dl>
        {reg.welcomeCard?.pngUrl ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reg.welcomeCard.pngUrl}
              alt="Vista previa de la placa de bienvenida"
              className="h-auto w-full max-w-[220px] aspect-[9/16] rounded border border-ck-border object-cover"
            />
            <div className="flex flex-col gap-2">
              <Button
                href={reg.welcomeCard.pngUrl}
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
              >
                Descargar
              </Button>
              {reg.welcomeCard.webpUrl ? (
                <Button
                  href={reg.welcomeCard.webpUrl}
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                >
                  Descargar versión liviana
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ck-text-muted">
            Todavía no hay placas generadas para este participante. Puede tardar unos segundos
            después de pedirla.
          </p>
        )}
        {socialPublish?.permalink ? (
          <Button
            href={socialPublish.permalink}
            variant="text"
            className="min-h-11"
          >
            Ver publicación en Instagram
          </Button>
        ) : null}
      </section>

      {isAdminCardsV2Enabled()
        ? await (async () => {
        const cardReg = await prisma.clickatonRegistration.findUnique({
          where: { id: reg.id },
          select: {
            id: true,
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
            city: true,
            province: true,
            country: true,
            instagramHandle: true,
            instagramHandleNormalized: true,
            profilePhotoAssetId: true,
            profilePhotoStatus: true,
            visibleCode: true,
            sequenceNumber: true,
            status: true,
            paymentStatus: true,
            imageUsageConsent: true,
            socialPublicationConsent: true,
            consentAcceptedAt: true,
            acceptedImageAt: true,
            acceptedTermsAt: true,
            termsAcceptedAt: true,
            termsVersion: true,
            ticketType: { select: { name: true } },
            edition: {
              select: {
                name: true,
                slug: true,
                city: true,
                startAt: true,
                location: true,
                timezone: true,
                coverImageUrl: true,
              },
            },
            venue: { select: { name: true, city: true } },
          },
        });
        if (!cardReg) return null;
        const consent = hasClickatonCardConsent(cardReg);
        const hasPhoto = Boolean(cardReg.profilePhotoAssetId);
        const welcomeElig = evaluateClickatonCardEligibility({
          registration: cardReg,
          cardType: "welcome",
          mode: "preview",
          actorKind: "admin",
          allowAdminPreview: true,
          hasConsent: consent,
          hasPhoto,
        });
        const memberElig = evaluateClickatonCardEligibility({
          registration: cardReg,
          cardType: "member",
          mode: "preview",
          actorKind: "admin",
          allowAdminPreview: true,
          hasConsent: consent,
          hasPhoto,
        });
        return (
          <AdminParticipantCardsPanel
            registrationId={cardReg.id}
            participantName={`${cardReg.firstName} ${cardReg.lastName}`.trim()}
            instagramNormalized={cardReg.instagramHandleNormalized}
            hasPhoto={hasPhoto}
            numberLabel={
              cardReg.visibleCode ??
              (cardReg.sequenceNumber != null
                ? String(cardReg.sequenceNumber)
                : "—")
            }
            categoryLabel={cardReg.ticketType.name}
            statusLabel={registrationStatusLabel(
              cardReg.status as Parameters<typeof registrationStatusLabel>[0]
            )}
            paymentLabel={paymentStatusLabel(
              cardReg.paymentStatus as Parameters<typeof paymentStatusLabel>[0]
            )}
            hasConsent={consent}
            welcomeEligible={welcomeElig.eligible}
            memberEligible={memberElig.eligible}
          />
        );
      })()
        : null}

      {/* 8. Comunicaciones */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="email-delivery-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 id="email-delivery-heading" className="text-lg font-semibold">
              Confirmación por correo
            </h2>
            <p className="text-sm text-ck-text-secondary">
              {emailQueuePresentation.description}
            </p>
          </div>
          {reg.status === "CONFIRMED" ? (
            <form action={adminResendConfirmationEmailAction.bind(null, reg.id)}>
              <ConfirmSubmitButton
                confirmMessage={`${SOCIAL_SENSITIVE_CONFIRM.resendEmail}\n\nDestinatario: ${latestEmail?.to ?? reg.email}`}
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
              >
                Reenviar correo
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Destinatario">
            {displayAdminValue(latestEmail?.to ?? reg.email)}
          </Field>
          <Field label="Estado del envío">
            <Badge variant={adminToneToBadgeVariant(emailQueuePresentation.tone)}>
              {emailQueuePresentation.label}
            </Badge>
          </Field>
          <Field label="Confirmación de entrega">
            <Badge variant={adminToneToBadgeVariant(resendPresentation.tone)}>
              {resendPresentation.label}
            </Badge>
            <p className="mt-1 text-xs text-ck-text-muted">{resendPresentation.description}</p>
          </Field>
          <Field label="Último envío">
            {latestEmail?.sentAt
              ? formatArDateTime(latestEmail.sentAt)
              : latestEmail?.createdAt
                ? formatArDateTime(latestEmail.createdAt)
                : "Sin envíos registrados"}
          </Field>
          <Field label="Reenvíos registrados">{String(resendAttempts)}</Field>
          {bounceReason ? (
            <Field label="Qué ocurrió">
              No pudimos entregar el correo. Revisá la dirección del participante antes de
              volver a enviarlo.
              <span className="mt-1 block text-xs text-ck-text-muted">
                El detalle técnico del rebote queda en información técnica.
              </span>
            </Field>
          ) : null}
        </dl>
        <p className="text-xs text-ck-text-muted">
          “Enviado” significa que el proveedor aceptó el mensaje. “Entregado” solo aparece cuando
          hay confirmación de llegada. Reenviar puede duplicar mensajes.
        </p>
      </section>

      {/* 9. FotoRank (operativo, IDs técnicos abajo) */}
      <section
        className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-5 md:p-6"
        aria-labelledby="fotorank-sync-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h2 id="fotorank-sync-heading" className="text-lg font-semibold">
              Sincronización con FotoRank
            </h2>
            <p className="text-sm text-ck-text-secondary">{fotoRankStatus.description}</p>
          </div>
          <Badge variant={adminToneToBadgeVariant(fotoRankStatus.tone)}>
            {fotoRankStatus.label}
          </Badge>
        </div>
        {reg.status === "CONFIRMED" && reg.paymentStatus === "APPROVED" ? (
          <form action={syncRegistrationFotoRankFormAction.bind(null, reg.id)}>
            <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
              Sincronizar con FotoRank
            </Button>
          </form>
        ) : null}
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Última sincronización">
            {reg.fotoRankSyncedAt
              ? formatArDateTime(reg.fotoRankSyncedAt)
              : reg.fotoRankSync?.completedAt
                ? formatArDateTime(reg.fotoRankSync.completedAt)
                : "Todavía no sincronizada"}
          </Field>
          <Field label="Número de participante">
            {displayAdminValue(reg.visibleCode, "Todavía sin número")}
          </Field>
        </dl>
        {(() => {
          const frBase = getAdminIntegrations().fotorank.href;
          return frBase ? (
            <Button href={frBase} variant="text" className="min-h-11">
              Abrir panel de FotoRank
            </Button>
          ) : null;
        })()}
      </section>

      {/* 10. Acciones administrativas */}
      <section className="space-y-4" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-lg font-semibold">
          Acciones administrativas
        </h2>
        <p className="text-sm text-ck-text-secondary">
          Estas acciones cambian el estado de la inscripción. Las destructivas piden
          confirmación y motivo.
        </p>
        <RegistrationTransitionButtons registrationId={reg.id} status={reg.status} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold">Reasignar sede o entrada</h2>
          <AssignmentForm
            registrationId={reg.id}
            ticketTypeId={reg.ticketTypeId}
            venueId={reg.venueId}
            enabled={canAssign}
            ticketOptions={tickets.map((t) => ({
              id: t.id,
              label: t.name,
            }))}
            venueOptions={venues.map((v) => ({ id: v.id, label: v.name }))}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <h2 className="text-lg font-semibold">Observaciones internas</h2>
          <InternalNoteForm registrationId={reg.id} />
          {internalNotes.length === 0 ? (
            <p className="text-sm text-ck-text-muted">Sin observaciones todavía.</p>
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
                    {n.actorUserId ? ` · operador #${n.actorUserId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Historial legible */}
      <section className="space-y-3" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          Historial de estados
        </h2>
        {reg.statusHistory.length === 0 ? (
          <p className="text-sm text-ck-text-muted">Sin historial todavía.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {reg.statusHistory.map((h) => (
              <li
                key={h.id}
                className="rounded-[var(--ck-radius-card)] border border-ck-border/70 px-3 py-3"
              >
                <span className="font-medium">
                  {h.previousStatus
                    ? registrationStatusLabel(h.previousStatus)
                    : "Sin estado previo"}{" "}
                  → {registrationStatusLabel(h.newStatus)}
                </span>
                <span className="block text-ck-text-muted sm:inline sm:before:content-['·_']">
                  Pago:{" "}
                  {h.previousPaymentStatus
                    ? paymentStatusLabel(h.previousPaymentStatus)
                    : "Sin estado previo"}{" "}
                  → {paymentStatusLabel(h.newPaymentStatus)}
                </span>
                <div className="mt-1 text-xs text-ck-text-muted">
                  {formatArDateTime(h.createdAt)}
                  {h.reason ? ` · ${h.reason}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <AdminTechnicalInfo
        rows={[
          { label: "ID de inscripción", value: reg.id, mono: true, copyText: reg.id },
          {
            label: "ID de usuario",
            value: reg.userId != null ? String(reg.userId) : "No vinculado",
            mono: true,
            copyText: reg.userId != null ? String(reg.userId) : undefined,
          },
          {
            label: "ID de edición",
            value: reg.editionId,
            mono: true,
            copyText: reg.editionId,
          },
          {
            label: "ID de entrada",
            value: reg.ticketTypeId,
            mono: true,
            copyText: reg.ticketTypeId,
          },
          {
            label: "ID de sede",
            value: reg.venueId ?? "Sin sede",
            mono: true,
            copyText: reg.venueId ?? undefined,
          },
          {
            label: "Referencia de cobro",
            value: reg.paymentOrderId ?? "Sin referencia",
            mono: true,
            copyText: reg.paymentOrderId ?? undefined,
          },
          {
            label: "Referencia externa de pago",
            value: reg.paymentExternalReference ?? "Sin referencia",
            mono: true,
            copyText: reg.paymentExternalReference ?? undefined,
          },
          {
            label: "Clave de idempotencia de pago",
            value: reg.paymentIdempotencyKey
              ? `${reg.paymentIdempotencyKey.slice(0, 12)}…`
              : "Sin clave",
            mono: true,
          },
          {
            label: "Estado durable del cobro",
            value: durableOrder?.status ?? "No disponible",
            mono: true,
          },
          {
            label: "Último evento de cobro",
            value: durableOrder?.lastEventId
              ? `${durableOrder.lastEventId.slice(0, 12)}…`
              : "Sin eventos",
            mono: true,
          },
          {
            label: "Fecha del último evento de cobro",
            value: durableOrder?.lastEventAt
              ? formatArDateTime(durableOrder.lastEventAt)
              : "No informada",
          },
          {
            label: "Resultado de reconciliación",
            value: reconcile?.status ?? "No disponible",
            mono: true,
          },
          {
            label: "ID de mensaje del proveedor de correo",
            value: providerMessageId ?? "No informado",
            mono: true,
            copyText: providerMessageId ?? undefined,
          },
          {
            label: "Detalle técnico de rebote / entrega",
            value: bounceReason ?? "Sin detalle",
            mono: true,
          },
          {
            label: "ID de participante FotoRank",
            value: reg.fotoRankParticipantId ?? "No vinculado",
            mono: true,
            copyText: reg.fotoRankParticipantId ?? undefined,
          },
          {
            label: "ID de fotografía de perfil",
            value: reg.profilePhotoAssetId ?? "Sin fotografía",
            mono: true,
            copyText: reg.profilePhotoAssetId ?? undefined,
          },
          {
            label: "ID de placa",
            value: reg.welcomeCard?.id ?? reg.welcomeCardId ?? "Sin placa",
            mono: true,
            copyText: reg.welcomeCard?.id ?? reg.welcomeCardId ?? undefined,
          },
          {
            label: "Intentos de generación de placa",
            value: String(reg.welcomeCard?.attemptCount ?? "0"),
          },
          {
            label: "Último error de placa",
            value: reg.welcomeCard?.lastErrorCode
              ? `${reg.welcomeCard.lastErrorCode}${
                  reg.welcomeCard.lastErrorMessage
                    ? `: ${reg.welcomeCard.lastErrorMessage}`
                    : ""
                }`
              : "Sin errores",
          },
          {
            label: "Último error FotoRank",
            value: reg.fotoRankSync?.lastErrorCode
              ? `${reg.fotoRankSync.lastErrorCode}${
                  reg.fotoRankSync.lastErrorMessage
                    ? `: ${reg.fotoRankSync.lastErrorMessage}`
                    : ""
                }`
              : "Sin errores",
          },
          {
            label: "Reservas de stock",
            value:
              reg.stockHolds.length > 0
                ? reg.stockHolds
                    .map(
                      (h) =>
                        `${h.productVariantId} ×${h.quantity} (${holdStatusLabel(h.status)})`,
                    )
                    .join(" · ")
                : "Sin reservas",
            mono: true,
          },
          {
            label: "SKU de productos",
            value:
              reg.items.length > 0
                ? reg.items
                    .map((i) => i.skuSnapshot ?? "sin SKU")
                    .join(" · ")
                : "Sin productos",
            mono: true,
          },
          {
            label: "Actualizada",
            value: formatArDateTime(reg.updatedAt),
          },
          {
            label: "Cancelada",
            value: reg.cancelledAt ? formatArDateTime(reg.cancelledAt) : "No cancelada",
          },
        ]}
      />
    </div>
  );
}
