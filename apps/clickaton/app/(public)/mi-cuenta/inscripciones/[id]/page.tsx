import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@repo/db";
import { Card } from "@/components/ui/Card";
import { CredentialPrintActions } from "@/components/account/CredentialPrintActions";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { resolveActiveQrPlaintext } from "@/lib/registration/application/confirm-free-registration";
import { Button } from "@/components/ui/Button";
import { PromptPhotoUpload } from "@/components/account/PromptPhotoUpload";
import { getEditionTemporalState, listPromptPublicDtos } from "@/lib/timeline/prisma-timeline";
import {
  isWithinUploadWindow,
  resolveEffectiveWindows,
} from "@/lib/photo-upload/windows";
import { systemClock } from "@/lib/timeline/clock";

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

  if (registration.status !== "CONFIRMED" || !registration.credential) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-16">
        <Card variant="outlined" className="space-y-4 p-8">
          <h1 className="ck-heading-md">
            {registration.paymentStatus === "PENDING" ||
            registration.paymentStatus === "PROCESSING"
              ? "Confirmando pago"
              : "Credencial aún no disponible"}
          </h1>
          <p className="text-sm text-ck-text-secondary">
            La inscripción debe estar confirmada por el backend. El retorno del navegador no
            marca el pago como aprobado.
          </p>
          <p className="text-sm text-ck-text-muted">
            Estado: {registration.status} · Pago: {registration.paymentStatus}
          </p>
          <Button href="/mi-cuenta" variant="primary">
            Volver a Mi cuenta
          </Button>
        </Card>
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

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12 print:py-4">
      <CredentialPrintActions />

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ck-yellow">
          Dashboard del participante
        </p>
        <h1 className="font-[family-name:var(--font-ck-display)] text-3xl text-ck-text">
          {registration.firstName} {registration.lastName}
        </h1>
        <p className="text-sm text-ck-text-secondary">{registration.edition.name}</p>
      </header>

      <Card variant="outlined" className="space-y-4 border-ck-yellow/40 p-6 print:border-black">
        <h2 className="font-semibold">Inscripción</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Estado</dt>
            <dd className="font-semibold text-ck-yellow">{registration.status}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Número</dt>
            <dd className="font-mono">{registration.visibleCode ?? registration.credential.publicCode}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Pago</dt>
            <dd>{registration.paymentStatus}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Fase de precio</dt>
            <dd>{registration.pricePhaseNameSnapshot ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Promoción</dt>
            <dd>{registration.promotionCodeSnapshot ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Inscripción</dt>
            <dd>
              {registration.confirmedAt
                ? new Date(registration.confirmedAt).toLocaleString("es-AR")
                : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Perfil</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Instagram</dt>
            <dd>{registration.instagramHandle ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Foto</dt>
            <dd>{registration.profilePhotoStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Consentimientos</dt>
            <dd>
              Imagen {registration.imageUsageConsent ? "OK" : "—"} · Social{" "}
              {registration.socialPublicationConsent ? "OK" : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Placa</dt>
            <dd>{registration.welcomeCardStatus ?? "PENDIENTE"}</dd>
          </div>
        </dl>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Acreditación</h2>
        {registration.checkIns[0] ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-ck-yellow">Acreditado</p>
            <p>
              {new Date(registration.checkIns[0].checkedInAt).toLocaleString("es-AR", {
                timeZone: registration.edition.timezone ?? "America/Argentina/Cordoba",
              })}
              {" · "}
              {registration.checkIns[0].source}
            </p>
            <p className="text-ck-text-muted">
              Identidad: {registration.checkIns[0].identityStatus}. Próximo paso: inicio de la
              maratón según cronograma.
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
                  : "aún no habilitada / cerrada"}
              .
            </p>
            <p>
              Kit esperado:{" "}
              {shirt
                ? `${shirt.nameSnapshot}${shirt.variantNameSnapshot ? ` talle ${shirt.variantNameSnapshot}` : ""}`
                : "según fase"}
              . La entrega la registra el equipo (no se autoacredita solo mostrando el QR).
            </p>
          </div>
        )}
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Kit</h2>
        <p className="text-sm text-ck-text-secondary">
          {shirt
            ? `${shirt.nameSnapshot}${shirt.variantNameSnapshot ? ` · talle ${shirt.variantNameSnapshot}` : ""} · entrega ${shirt.fulfillmentStatus}`
            : "Sin merch incluido en esta fase."}
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Evento</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Fecha</dt>
            <dd>
              {registration.edition.startAt
                ? new Date(registration.edition.startAt).toLocaleString("es-AR", {
                    timeZone: registration.edition.timezone ?? "America/Argentina/Cordoba",
                  })
                : "A confirmar"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Lugar</dt>
            <dd>
              {registration.venue
                ? `${registration.venue.name} · ${registration.venue.city}`
                : registration.edition.location ?? "A confirmar"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Acreditación</dt>
            <dd>{temporal.canCheckIn ? "Abierta" : "Horario a confirmar / próxima"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Reloj servidor</dt>
            <dd className="font-mono text-xs">{temporal.serverNow}</dd>
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
        <Button href={`/maratones/${registration.edition.slug}`} variant="secondary" size="sm">
          Ver ficha / reglamento
        </Button>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">FotoRank</h2>
        <p className="text-sm text-ck-text-secondary">
          Sync: {registration.fotoRankSyncStatus ?? "NO_CONFIGURADO"}
          {registration.fotoRankParticipantId
            ? ` · participante ${registration.fotoRankParticipantId}`
            : " · sin vínculo aún"}
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-6">
        <h2 className="font-semibold">Consignas y carga</h2>
        <p className="text-sm text-ck-text-secondary">
          Antes del horario de apertura solo ves estado LOCKED. El contenido secreto no viaja al
          navegador. Progreso: {completedCount}/{requiredCount || "—"} confirmadas.
        </p>
        <p className="text-xs text-ck-text-muted">
          Uploads edición: {uploadsEnabled ? "habilitados" : "deshabilitados (admin)"} · canUpload
          timeline: {temporal.canUpload ? "sí" : "no / a confirmar"}
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
              return (
                <li key={p.sequence} className="space-y-3">
                  <div className="rounded border border-ck-border p-4 text-sm">
                    <p className="font-semibold">
                      Consigna {p.sequence} · {p.status}
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
                          Subida hasta:{" "}
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
                          Admisión técnica:{" "}
                          {admissionBySubmission.get(submission.id)?.status ??
                            (submission.status === "CONFIRMED"
                              ? "pendiente de evaluación"
                              : submission.status === "REJECTED"
                                ? "rechazada"
                                : submission.status === "WITHDRAWN"
                                  ? "retirada"
                                  : "—")}
                          {admissionBySubmission.get(submission.id)?.publicRejectionReason
                            ? ` · ${admissionBySubmission.get(submission.id)?.publicRejectionReason}`
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
        variant="outlined"
        className="space-y-6 border-ck-yellow/40 p-8 print:border-black"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ck-yellow">
            Credencial Clickatón
          </p>
          <h2 className="font-[family-name:var(--font-ck-display)] text-2xl text-ck-text">
            QR de acreditación
          </h2>
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
            No pudimos regenerar el QR. Contactá soporte.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button href="/mi-cuenta" variant="secondary">
          Volver a Mi cuenta
        </Button>
      </div>
    </div>
  );
}
