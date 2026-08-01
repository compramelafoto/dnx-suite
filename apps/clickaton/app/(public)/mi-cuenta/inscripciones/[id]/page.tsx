import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@repo/db";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CredentialPrintActions } from "@/components/account/CredentialPrintActions";
import { WelcomeCardShareCard } from "@/components/account/WelcomeCardShareCard";
import {
  ParticipantCardsSection,
  type ParticipantCardUiState,
} from "@/components/account/ParticipantCardsSection";
import { PublicStatusCard } from "@/components/account/PublicStatusCard";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { hasClickatonCardConsent } from "@/lib/participant-cards";
import { evaluateClickatonCardEligibility } from "@/lib/participant-cards";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { resolveActiveQrPlaintext } from "@/lib/registration/application/confirm-free-registration";
import { Button } from "@/components/ui/Button";
import { PromptPhotoUpload } from "@/components/account/PromptPhotoUpload";
import { getEditionTemporalState, listPromptPublicDtos } from "@/lib/timeline/prisma-timeline";
import {
  CAPTURE_CLOSED_UPLOAD_OPEN_MESSAGE_ES,
  CAMERA_CLOCK_WARNING_ES,
  UPLOAD_CLOSED_MESSAGE_ES,
} from "@/config/editions/argentina-2026";
import {
  getUploadWindowState,
  isCaptureClosedUploadOpen,
  isWithinUploadWindow,
  resolveEffectiveWindows,
} from "@/lib/photo-upload/windows";
import { systemClock } from "@/lib/timeline/clock";
import { marathonRegistrationPath } from "@/config/navigation";
import { buildRegistrationDetailHeading } from "@/lib/public-ux/registration-detail-heading";
import {
  presentCheckInSource,
  presentCredentialStatus,
  presentFulfillmentStatus,
  presentIdentityStatus,
  presentParticipantRegistration,
  presentPaymentStatus,
  presentProfilePhotoStatus,
  presentPromptStatus,
  publicToneToBadgeVariant,
} from "@/lib/public-ux/status-presentation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RegistrationCredentialPage({ params }: Props) {
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(
      `${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent("/mi-cuenta")}`,
    );
  }
  const { id } = await params;

  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id },
    include: {
      edition: { include: { uploadConfig: true } },
      venue: true,
      ticketType: true,
      credential: true,
      items: {
        select: {
          nameSnapshot: true,
          variantNameSnapshot: true,
          fulfillmentStatus: true,
          isIncluded: true,
        },
      },
      photoSubmissions: {
        select: {
          id: true,
          promptId: true,
          status: true,
          validationResult: true,
        },
      },
      checkIns: {
        where: { reversedAt: null },
        orderBy: { checkedInAt: "desc" },
        take: 1,
        select: {
          checkedInAt: true,
          identityStatus: true,
          source: true,
        },
      },
    },
  });

  if (!registration) notFound();

  const owns =
    registration.userId === user.id ||
    registration.email.toLowerCase() === user.email.toLowerCase();
  if (!owns) notFound();

  const paid =
    registration.status === "CONFIRMED" &&
    (registration.paymentStatus === "APPROVED" ||
      registration.paymentStatus === "NOT_REQUIRED");

  const temporal = await getEditionTemporalState(registration.editionId);
  const prompts = paid
    ? await listPromptPublicDtos(registration.editionId, { participantPaid: true })
    : [];
  const promptRows = paid
    ? await prisma.clickatonPrompt.findMany({
        where: { editionId: registration.editionId, status: { in: ["RELEASED", "CLOSED", "LOCKED", "READY"] } },
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          status: true,
          title: true,
          releasedAt: true,
          captureStartsAt: true,
          captureEndsAt: true,
          uploadStartsAt: true,
          uploadEndsAt: true,
          allowReplacement: true,
        },
      })
    : [];
  const submissionByPrompt = new Map(
    registration.photoSubmissions.map((s) => [s.promptId, s]),
  );
  const admissionDecisions = registration.photoSubmissions.length
    ? await prisma.clickatonTechnicalAdmissionDecision.findMany({
        where: {
          submissionId: { in: registration.photoSubmissions.map((s) => s.id) },
        },
        orderBy: { evaluatedAt: "desc" },
        distinct: ["submissionId"],
        select: {
          submissionId: true,
          status: true,
          publicRejectionReason: true,
        },
      })
    : [];
  const admissionBySubmission = new Map(
    admissionDecisions.map((d) => [d.submissionId, d]),
  );
  const clock = systemClock();
  const uploadsEnabled = Boolean(registration.edition.uploadConfig?.uploadsEnabled);
  const requiredCount = promptRows.filter((p) => p.status === "RELEASED" || p.status === "CLOSED").length;
  const completedCount = registration.photoSubmissions.filter((s) => s.status === "CONFIRMED").length;

  const statusPresentation = presentParticipantRegistration(
    registration.status,
    registration.paymentStatus,
  );
  const paymentPresentation = presentPaymentStatus(registration.paymentStatus);
  const summaryHref = `${marathonRegistrationPath(registration.edition.slug)}/resumen/${registration.id}`;
  const detailHeading = buildRegistrationDetailHeading({
    firstName: registration.firstName,
    lastName: registration.lastName,
    editionName: registration.edition.name,
  });

  if (registration.status !== "CONFIRMED" || !registration.credential) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-16">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ck-yellow">
            Mi participación en Clickatón
          </p>
          <h1 className="font-[family-name:var(--font-ck-display)] text-3xl text-ck-text">
            {detailHeading}
          </h1>
        </header>
        <PublicStatusCard
          presentation={statusPresentation}
          title="Tu inscripción"
          actions={
            <>
              {registration.status === "PENDING_PAYMENT" ? (
                <Button href={summaryHref} variant="primary" className="min-h-11 w-full">
                  Ir al resumen y pago
                </Button>
              ) : null}
              <Button href="/mi-cuenta" variant="secondary" className="min-h-11 w-full">
                Volver a Mi cuenta
              </Button>
            </>
          }
        >
          <p className="text-sm text-ck-text-muted">
            Pago: {paymentPresentation.label}. La confirmación no depende solo de volver del
            navegador: cuando el pago se acredite, vas a poder ver tu QR acá.
          </p>
        </PublicStatusCard>
      </div>
    );
  }

  const qr = await resolveActiveQrPlaintext({ registrationId: registration.id });
  const qrDataUrl = qr
    ? await QRCode.toDataURL(qr.plaintext, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 240,
      })
    : null;

  const shirt = registration.items.find((i) => i.isIncluded);
  const eventDate = registration.edition.startAt
    ? new Date(registration.edition.startAt).toLocaleString("es-AR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: registration.edition.timezone ?? "America/Argentina/Cordoba",
      })
    : "A confirmar";
  const placeLabel = registration.venue
    ? `${registration.venue.name} · ${registration.venue.city}`
    : registration.edition.location ?? "A confirmar";

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12 print:py-4">
      <CredentialPrintActions />

      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ck-yellow">
          Mi participación en Clickatón
        </p>
        <h1 className="font-[family-name:var(--font-ck-display)] text-3xl text-ck-text">
          {detailHeading}
        </h1>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          {registration.edition.name}
        </p>
      </header>

      <PublicStatusCard
        presentation={statusPresentation}
        title="Estado de tu inscripción"
        actions={
          qrDataUrl ? (
            <Button href="#credencial-qr" variant="primary" className="min-h-11 w-full sm:w-auto">
              Ver mi código QR
            </Button>
          ) : null
        }
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Edición</dt>
            <dd className="font-medium">{registration.edition.name}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Fecha y horario</dt>
            <dd>{eventDate}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Lugar</dt>
            <dd>{placeLabel}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Pago</dt>
            <dd>
              <Badge variant={publicToneToBadgeVariant(paymentPresentation.tone)}>
                {paymentPresentation.label}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Número de participante</dt>
            <dd className="font-mono">
              {registration.visibleCode ?? registration.credential.publicCode}
            </dd>
          </div>
          {registration.promotionCodeSnapshot ? (
            <div>
              <dt className="text-ck-text-muted">Código aplicado</dt>
              <dd>{registration.promotionCodeSnapshot}</dd>
            </div>
          ) : null}
        </dl>
      </PublicStatusCard>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Perfil</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Instagram</dt>
            <dd>{registration.instagramHandle ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Foto de perfil</dt>
            <dd>{presentProfilePhotoStatus(registration.profilePhotoStatus)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-ck-text-muted">Autorizaciones</dt>
            <dd className="leading-relaxed">
              {registration.imageUsageConsent
                ? "Autorizaste el uso de tu imagen para la placa de bienvenida"
                : "Uso de imagen pendiente"}
              {" · "}
              {registration.socialPublicationConsent
                ? "Autorizaste la posible publicación en redes del evento"
                : "Publicación en redes pendiente"}
            </dd>
          </div>
        </dl>
      </Card>

      {(() => {
        const consent = hasClickatonCardConsent(registration);
        const hasPhoto = Boolean(registration.profilePhotoAssetId);
        const snapshot = {
          id: registration.id,
          userId: registration.userId,
          email: registration.email,
          firstName: registration.firstName,
          lastName: registration.lastName,
          city: registration.city,
          province: registration.province,
          country: registration.country,
          instagramHandle: registration.instagramHandle,
          instagramHandleNormalized: registration.instagramHandleNormalized,
          profilePhotoAssetId: registration.profilePhotoAssetId,
          profilePhotoStatus: registration.profilePhotoStatus,
          visibleCode: registration.visibleCode,
          sequenceNumber: registration.sequenceNumber,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
          imageUsageConsent: registration.imageUsageConsent,
          socialPublicationConsent: registration.socialPublicationConsent,
          consentAcceptedAt: registration.consentAcceptedAt,
          acceptedImageAt: registration.acceptedImageAt,
          acceptedTermsAt: registration.acceptedTermsAt,
          termsAcceptedAt: registration.termsAcceptedAt,
          termsVersion: registration.termsVersion,
          ticketType: { name: registration.ticketType?.name ?? "Participante" },
          edition: {
            name: registration.edition.name,
            slug: registration.edition.slug,
            city: registration.edition.city,
            startAt: registration.edition.startAt,
            location: registration.edition.location ?? null,
            timezone: registration.edition.timezone,
            coverImageUrl: registration.edition.coverImageUrl,
          },
          venue: registration.venue
            ? { name: registration.venue.name, city: registration.venue.city }
            : null,
        };
        const toUi = (cardType: "welcome" | "member"): ParticipantCardUiState => {
          const e = evaluateClickatonCardEligibility({
            registration: snapshot,
            cardType,
            mode: "final",
            actorKind: "participant",
            hasConsent: consent,
            hasPhoto,
          });
          if (e.eligible) return "available";
          if (e.blockReason?.includes("Foto")) return "missing_photo";
          if (e.blockReason?.includes("Consentimiento")) return "missing_consent";
          if (
            e.blockReason?.includes("no confirmada") ||
            e.blockReason?.includes("no permitido")
          ) {
            return "not_confirmed";
          }
          return "error";
        };
        return (
          <ParticipantCardsSection
            registrationId={registration.id}
            welcomeState={toUi("welcome")}
            memberState={toUi("member")}
          />
        );
      })()}

      {paid ? (
        <WelcomeCardShareCard
          registrationId={registration.id}
          status={registration.welcomeCardStatus}
          visibleCode={registration.visibleCode}
          instagramHandle={registration.instagramHandle}
          participantName={`${registration.firstName} ${registration.lastName}`.trim()}
          city={registration.city}
          categoryLabel={registration.ticketType?.name ?? null}
        />
      ) : null}

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Acreditación</h2>
        {registration.checkIns[0] ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-ck-yellow">Ya estás acreditado</p>
            <p>
              {new Date(registration.checkIns[0].checkedInAt).toLocaleString("es-AR", {
                timeZone: registration.edition.timezone ?? "America/Argentina/Cordoba",
              })}
              {" · "}
              {presentCheckInSource(registration.checkIns[0].source)}
            </p>
            <p className="text-ck-text-muted">
              Identidad: {presentIdentityStatus(registration.checkIns[0].identityStatus)}.
              Próximo paso: seguí el cronograma del evento.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-ck-text-secondary">
            <p className="font-semibold text-ck-text">Pendiente de acreditación</p>
            <p>
              Presentá tu QR en el punto de acreditación. Ventana:{" "}
              {temporal.canCheckIn == null
                ? "horario a confirmar"
                : temporal.canCheckIn
                  ? "abierta"
                  : "aún no habilitada o ya cerrada"}
              .
            </p>
            <p>
              Kit esperado:{" "}
              {shirt
                ? `${shirt.nameSnapshot}${shirt.variantNameSnapshot ? ` talle ${shirt.variantNameSnapshot}` : ""}`
                : "según tu entrada"}
              . La entrega la registra el equipo en sede.
            </p>
          </div>
        )}
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Kit</h2>
        <p className="text-sm text-ck-text-secondary">
          {shirt
            ? `${shirt.nameSnapshot}${shirt.variantNameSnapshot ? ` · talle ${shirt.variantNameSnapshot}` : ""} · ${presentFulfillmentStatus(shirt.fulfillmentStatus)}`
            : "Sin merchandising incluido en esta fase."}
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Evento</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Fecha</dt>
            <dd>{eventDate}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Lugar</dt>
            <dd>{placeLabel}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Acreditación</dt>
            <dd>{temporal.canCheckIn ? "Abierta" : "Horario a confirmar"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Inscripción confirmada</dt>
            <dd>
              {registration.confirmedAt
                ? new Date(registration.confirmedAt).toLocaleString("es-AR")
                : "—"}
            </dd>
          </div>
        </dl>
        {temporal.nextEvent ? (
          <p className="text-sm text-ck-text-secondary">
            Próxima fase: {temporal.nextEvent.name}
            {temporal.nextEvent.startsAt
              ? ` · ${new Date(temporal.nextEvent.startsAt).toLocaleString("es-AR", {
                  timeZone: temporal.timezone,
                })}`
              : " · horario a confirmar"}
          </p>
        ) : null}
        <Button
          href={`/maratones/${registration.edition.slug}`}
          variant="secondary"
          className="min-h-11 w-full sm:w-auto"
        >
          Ver ficha del evento
        </Button>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Consignas y carga de fotos</h2>
        <p className="text-sm text-ck-text-secondary leading-relaxed">
          Antes del horario de apertura las consignas aparecen como bloqueadas. El contenido
          secreto no se muestra hasta que se habiliten. Progreso: {completedCount}/
          {requiredCount || "—"} confirmadas.
        </p>
        <p
          className="rounded-lg border border-ck-yellow/40 bg-ck-yellow/10 px-4 py-3 text-sm leading-relaxed text-ck-text"
          role="note"
        >
          {CAMERA_CLOCK_WARNING_ES}
        </p>
        {(() => {
          const sample = promptRows[0] ? resolveEffectiveWindows(promptRows[0]) : null;
          if (!sample) return null;
          const uploadState = getUploadWindowState(sample, clock);
          if (uploadState === "CLOSED") {
            return (
              <p className="rounded-lg border border-ck-border bg-ck-bg-elevated px-4 py-3 text-sm">
                {UPLOAD_CLOSED_MESSAGE_ES}
              </p>
            );
          }
          if (isCaptureClosedUploadOpen(sample, clock)) {
            return (
              <p className="rounded-lg border border-ck-yellow/50 bg-ck-yellow/10 px-4 py-3 text-sm leading-relaxed">
                {CAPTURE_CLOSED_UPLOAD_OPEN_MESSAGE_ES}
              </p>
            );
          }
          return null;
        })()}
        <p className="text-xs text-ck-text-muted">
          {uploadsEnabled
            ? "La carga de fotos está habilitada para esta edición."
            : "La carga de fotos todavía no está habilitada."}{" "}
          {temporal.canUpload
            ? "Ya podés enviar dentro de la ventana del evento."
            : "La ventana de carga se habilita según el cronograma."}
        </p>
        {prompts.length === 0 ? (
          <p className="text-sm text-ck-text-muted">
            Las consignas estarán disponibles durante el evento.
          </p>
        ) : (
          <ul className="space-y-4">
            {prompts.map((p) => {
              const row = promptRows.find((r) => r.sequence === p.sequence);
              const submission = row ? submissionByPrompt.get(row.id) : null;
              const windows = row ? resolveEffectiveWindows(row) : null;
              const canUploadPrompt =
                Boolean(row) &&
                uploadsEnabled &&
                paid &&
                p.status === "RELEASED" &&
                windows != null &&
                isWithinUploadWindow(windows, clock);
              const admission = submission
                ? admissionBySubmission.get(submission.id)
                : null;
              return (
                <li key={p.sequence} className="space-y-3">
                  <div className="rounded border border-ck-border p-4 text-sm">
                    <p className="font-semibold">
                      Consigna {p.sequence} · {presentPromptStatus(p.status)}
                    </p>
                    {p.status === "LOCKED" ? (
                      <p className="mt-1 text-ck-text-muted">{p.message}</p>
                    ) : null}
                    {p.status === "RELEASED" ? (
                      <div className="mt-2 space-y-1">
                        <p>{p.title}</p>
                        <p className="text-ck-text-secondary">{p.instructions}</p>
                        <p className="text-xs text-ck-text-muted">
                          Captura:{" "}
                          {windows?.captureStartsAt
                            ? windows.captureStartsAt.toLocaleString("es-AR")
                            : "a confirmar"}
                          {" → "}
                          {windows?.captureEndsAt
                            ? windows.captureEndsAt.toLocaleString("es-AR")
                            : "a confirmar"}
                        </p>
                        <p className="text-xs text-ck-text-muted">
                          Carga hasta:{" "}
                          {windows?.uploadEndsAt
                            ? windows.uploadEndsAt.toLocaleString("es-AR")
                            : "a confirmar"}
                        </p>
                      </div>
                    ) : null}
                    {p.status === "CLOSED" ? (
                      <p className="mt-1 text-ck-text-muted">{p.message}</p>
                    ) : null}
                  </div>
                  {row && (p.status === "RELEASED" || p.status === "CLOSED") ? (
                    <>
                      <PromptPhotoUpload
                        registrationId={registration.id}
                        promptId={row.id}
                        sequence={row.sequence}
                        title={p.status === "RELEASED" ? p.title : row.title ?? `Consigna ${row.sequence}`}
                        canUpload={canUploadPrompt}
                        submissionStatus={submission?.status}
                        validationResult={submission?.validationResult}
                      />
                      {submission ? (
                        <p className="text-xs text-ck-text-muted">
                          Revisión técnica:{" "}
                          {admission?.status === "ELIGIBLE" ||
                          admission?.status === "FROZEN_FOR_JURY"
                            ? "Admitida"
                            : admission?.status === "EXCLUDED"
                              ? "No admitida"
                              : admission?.status === "PENDING_AUTOMATIC_REVIEW" ||
                                  admission?.status === "PENDING_MANUAL_REVIEW" ||
                                  admission?.status === "NOT_EVALUATED"
                                ? "Pendiente de revisión"
                                : submission.status === "CONFIRMED"
                                  ? "Pendiente de evaluación"
                                  : submission.status === "REJECTED"
                                    ? "Rechazada"
                                    : submission.status === "WITHDRAWN"
                                      ? "Retirada"
                                      : "En proceso"}
                          {admission?.publicRejectionReason
                            ? ` · ${admission.publicRejectionReason}`
                            : null}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        id="credencial-qr"
        variant="outlined"
        className="space-y-6 border-ck-yellow/40 p-8 print:border-black"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ck-yellow">
            Credencial Clickatón
          </p>
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl text-ck-text">
            Código QR de acreditación
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Credencial del participante:{" "}
            {presentCredentialStatus(registration.credential.status)}. El código QR se utiliza
            durante la acreditación para identificarte en sede.
          </p>
        </div>

        {qrDataUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Código QR de acreditación"
              width={240}
              height={240}
              className="mx-auto rounded-md border border-ck-border bg-white p-2"
            />
            <p className="text-center text-xs text-ck-text-muted">
              No compartas este QR. Es personal e intransferible.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ck-text-secondary">
            No pudimos mostrar el QR ahora. Probá de nuevo en unos minutos o contactá soporte.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button href="/mi-cuenta" variant="secondary" className="min-h-11 w-full sm:w-auto">
          Volver a Mi cuenta
        </Button>
        <Button href="/contacto" variant="outline" className="min-h-11 w-full sm:w-auto">
          Pedir ayuda
        </Button>
      </div>
    </div>
  );
}
