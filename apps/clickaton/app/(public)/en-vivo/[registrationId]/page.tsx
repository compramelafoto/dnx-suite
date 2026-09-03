import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  ParticipantLiveInactive,
  ParticipantLivePending,
  ParticipantLiveScreen,
  type LivePromptView,
} from "@/components/account/ParticipantLiveScreen";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { participantCredentialPath, participantLivePath } from "@/lib/participant-live/routes";
import { loadParticipantLiveState } from "@/lib/participant-live/service";
import { isWithinUploadWindow, resolveEffectiveWindows } from "@/lib/photo-upload/windows";
import { systemClock } from "@/lib/timeline/clock";
import { listPromptPublicDtos } from "@/lib/timeline/prisma-timeline";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ya estás participando · Clickatón",
};

type Props = { params: Promise<{ registrationId: string }> };

export default async function ParticipantLivePage({ params }: Props) {
  const { registrationId } = await params;
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(
      `${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent(participantLivePath(registrationId))}`,
    );
  }

  const clock = systemClock();
  const result = await loadParticipantLiveState({
    registrationId,
    actor: { id: user.id, email: user.email },
    clock,
  });
  if (!result.ok) notFound();

  const live = result.state;
  const credentialHref = participantCredentialPath(live.registrationId);

  if (!live.active) {
    return (
      <ParticipantLiveInactive
        editionName={live.editionName}
        credentialHref={credentialHref}
      />
    );
  }

  if (!live.accredited) {
    return (
      <ParticipantLivePending
        editionName={live.editionName}
        firstName={live.firstName}
        credentialHref={credentialHref}
      />
    );
  }

  // Acreditación registrada: contenido del evento.
  const dtos = await listPromptPublicDtos(live.editionId, { clock, participantPaid: true });

  const rows = await prisma.clickatonPrompt.findMany({
    where: { editionId: live.editionId, status: { notIn: ["DRAFT", "CANCELLED"] } },
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
    },
  });

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: live.editionId },
    select: { uploadConfig: { select: { uploadsEnabled: true } } },
  });
  const uploadsEnabled = Boolean(edition?.uploadConfig?.uploadsEnabled);

  const submissionRows = await prisma.clickatonPhotoSubmission.findMany({
    where: { registrationId: live.registrationId },
    select: {
      promptId: true,
      status: true,
      validationResult: true,
      captureDateInterpreted: true,
      technicalSummaryJson: true,
    },
  });
  const submissionByPrompt = new Map(submissionRows.map((s) => [s.promptId, s]));

  const prompts: LivePromptView[] = dtos
    .filter((dto) => dto.status === "RELEASED" || dto.status === "CLOSED")
    .map((dto) => {
      const row = rows.find((r) => r.sequence === dto.sequence) ?? null;
      const windows = row ? resolveEffectiveWindows(row) : null;
      const submission = row ? submissionByPrompt.get(row.id) : null;
      const resumen =
        submission?.technicalSummaryJson &&
        typeof submission.technicalSummaryJson === "object"
          ? (submission.technicalSummaryJson as Record<string, unknown>)
          : null;
      const ancho = typeof resumen?.width === "number" ? resumen.width : null;
      const alto = typeof resumen?.height === "number" ? resumen.height : null;
      const camara = [resumen?.cameraMake, resumen?.cameraModel]
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .join(" ");

      return {
        promptId: row?.id ?? null,
        sequence: dto.sequence,
        title:
          ("title" in dto && dto.title ? dto.title : row?.title) ?? `Consigna ${dto.sequence}`,
        instructions: "instructions" in dto ? dto.instructions : null,
        closed: dto.status === "CLOSED",
        captureStartsAt: windows?.captureStartsAt?.toISOString() ?? null,
        captureEndsAt: windows?.captureEndsAt?.toISOString() ?? null,
        uploadEndsAt: windows?.uploadEndsAt?.toISOString() ?? null,
        uploadWindowOpen:
          uploadsEnabled && windows != null && isWithinUploadWindow(windows, clock),
        submissionStatus: submission?.status ?? null,
        validationResult: submission?.validationResult ?? null,
        tecnica: submission
          ? {
              dimensiones: ancho && alto ? `${ancho} × ${alto}` : null,
              captura: submission.captureDateInterpreted?.toISOString() ?? null,
              camara: camara || null,
            }
          : null,
      };
    });

  const ventanaMuestra = rows[0] ? resolveEffectiveWindows(rows[0]) : null;
  const entregaAbierta =
    uploadsEnabled && ventanaMuestra != null && isWithinUploadWindow(ventanaMuestra, clock);

  return (
    <ParticipantLiveScreen
      registrationId={live.registrationId}
      editionName={live.editionName}
      timezone={live.timezone}
      firstName={live.firstName}
      participantNumber={live.participantNumber}
      accreditedAt={live.accreditedAt}
      promptCount={live.promptCount}
      serverNow={live.serverNow}
      gate={live.gate}
      prompts={prompts}
      entregaAbierta={entregaAbierta}
      credentialHref={credentialHref}
    />
  );
}