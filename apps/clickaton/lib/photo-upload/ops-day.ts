/**
 * Snapshot operativo del día (ETAPA 15) — read-only.
 */
import { prisma } from "@/lib/admin/db";
import { isEnvCanonicalFotoRankAssetsEnabled } from "./fotorank-canonical-assets";
import {
  getCapturePhase,
  getUploadPhase,
  resolveEditionSchedule,
} from "./edition-schedule";
import { systemClock } from "@/lib/timeline/clock";

export type OpsDayAlert = {
  level: "info" | "warning" | "critical";
  code: string;
  message: string;
};

export async function getOpsDaySnapshot(editionId: string) {
  const clock = systemClock();
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      fotorankContestId: true,
      fotoRankSyncEnabled: true,
      fotoRankSyncMode: true,
      fotoRankValidationStatus: true,
      uploadConfig: true,
    },
  });
  if (!edition) return null;

  const [prompts, regsTotal, regsReal, regsTest, submissions, perPrompt] =
    await Promise.all([
      prisma.clickatonPrompt.findMany({
        where: { editionId, status: { not: "CANCELLED" } },
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          status: true,
          titleSnapshot: true,
          title: true,
        },
      }),
      prisma.clickatonRegistration.count({ where: { editionId } }),
      prisma.clickatonRegistration.count({
        where: { editionId, isOpsTest: false },
      }),
      prisma.clickatonRegistration.count({
        where: { editionId, isOpsTest: true },
      }),
      prisma.clickatonPhotoSubmission.groupBy({
        by: ["status"],
        where: { editionId },
        _count: true,
      }),
      prisma.clickatonPhotoSubmission.groupBy({
        by: ["promptId"],
        where: { editionId, status: "CONFIRMED" },
        _count: true,
      }),
    ]);

  const confirmedByPrompt = new Map(
    perPrompt.map((r) => [r.promptId, r._count]),
  );
  const failedCount = submissions
    .filter((s) => s.status === "REJECTED" || s.status === "UPLOAD_PENDING")
    .reduce((a, s) => a + s._count, 0);
  const processingCount = submissions
    .filter((s) => s.status === "PROCESSING" || s.status === "UPLOADING")
    .reduce((a, s) => a + s._count, 0);

  const cfg = edition.uploadConfig;
  const schedule = resolveEditionSchedule(cfg);
  const capturePhase = getCapturePhase(schedule, clock);
  const uploadPhase = getUploadPhase(schedule, clock);

  const frContest =
    edition.fotorankContestId && edition.fotorankContestId !== "000000"
      ? await prisma.fotorankContest.findUnique({
          where: { id: edition.fotorankContestId },
          select: {
            id: true,
            title: true,
            slug: true,
            visibility: true,
            distributionChannel: true,
            experienceType: true,
            status: true,
          },
        })
      : null;

  const alerts: OpsDayAlert[] = [];
  if (!cfg) {
    alerts.push({
      level: "critical",
      code: "NO_UPLOAD_CONFIG",
      message: "Falta ClickatonEditionUploadConfig.",
    });
  }
  if (!frContest) {
    alerts.push({
      level: "critical",
      code: "FOTORANK_UNLINKED",
      message: "FotoRank no vinculado o placeholder inválido.",
    });
  }
  if (cfg && !cfg.uploadsEnabled) {
    alerts.push({
      level: "info",
      code: "UPLOADS_OFF",
      message: "COMMERCIAL_UPLOADS está OFF (edition.uploadsEnabled=false).",
    });
  }
  if (cfg?.canonicalAssetsEnabled && !isEnvCanonicalFotoRankAssetsEnabled()) {
    alerts.push({
      level: "warning",
      code: "CANONICAL_ENV_OFF",
      message:
        "canonicalAssetsEnabled=true pero CLICKATON_FOTORANK_CANONICAL_ASSETS≠1.",
    });
  }
  if (uploadPhase === "OPEN" && cfg?.uploadWindowEndsAt) {
    const ms = cfg.uploadWindowEndsAt.getTime() - clock.now().getTime();
    if (ms > 0 && ms < 60 * 60_000) {
      alerts.push({
        level: "warning",
        code: "DEADLINE_NEAR",
        message: "Queda menos de 1 hora de ventana de carga.",
      });
    }
  }
  if (uploadPhase === "CLOSED") {
    alerts.push({
      level: "warning",
      code: "UPLOAD_CLOSED",
      message: "Ventana de carga cerrada.",
    });
  }
  if (failedCount > 0) {
    alerts.push({
      level: "warning",
      code: "UPLOAD_FAILURES",
      message: `${failedCount} envíos en estados de fallo/pendiente.`,
    });
  }
  if (processingCount > 5) {
    alerts.push({
      level: "warning",
      code: "PROCESSING_BACKLOG",
      message: `${processingCount} envíos en PROCESSING/UPLOADING.`,
    });
  }
  if (regsReal > 0 && prompts.length === 10) {
    for (const p of prompts) {
      const n = confirmedByPrompt.get(p.id) ?? 0;
      if (uploadPhase === "OPEN" && n === 0) {
        alerts.push({
          level: "info",
          code: "PROMPT_ZERO_DELIVERIES",
          message: `Consigna ${String(p.sequence).padStart(2, "0")} sin entregas confirmadas aún.`,
        });
      }
    }
  }

  const msUpload =
    cfg?.uploadWindowEndsAt != null
      ? cfg.uploadWindowEndsAt.getTime() - clock.now().getTime()
      : null;

  return {
    edition: {
      id: edition.id,
      name: edition.name,
      slug: edition.slug,
      timezone: edition.timezone,
    },
    flags: {
      uploadsEnabled: cfg?.uploadsEnabled ?? false,
      canonicalAssetsEnabled: cfg?.canonicalAssetsEnabled ?? false,
      envCanonical: isEnvCanonicalFotoRankAssetsEnabled(),
      fotoRankSyncEnabled: edition.fotoRankSyncEnabled,
      fotoRankSyncMode: edition.fotoRankSyncMode,
      fotoRankValidationStatus: edition.fotoRankValidationStatus,
      allowReplacement: cfg?.allowReplacement ?? null,
      globalPromptReveal: cfg?.globalPromptReveal ?? null,
    },
    schedule: {
      eventRevealAt: cfg?.eventRevealAt ?? null,
      captureWindowStartsAt: cfg?.captureWindowStartsAt ?? null,
      captureWindowEndsAt: cfg?.captureWindowEndsAt ?? null,
      uploadWindowStartsAt: cfg?.uploadWindowStartsAt ?? null,
      uploadWindowEndsAt: cfg?.uploadWindowEndsAt ?? null,
      capturePhase,
      uploadPhase,
      uploadRemainingMs: msUpload,
    },
    fotorank: frContest,
    counts: {
      regsTotal,
      regsReal,
      regsTest,
      submissionsByStatus: Object.fromEntries(
        submissions.map((s) => [s.status, s._count]),
      ),
      failedOrPending: failedCount,
      processing: processingCount,
    },
    prompts: prompts.map((p) => ({
      id: p.id,
      sequence: p.sequence,
      status: p.status,
      title: p.titleSnapshot ?? p.title,
      confirmedDeliveries: confirmedByPrompt.get(p.id) ?? 0,
    })),
    alerts,
  };
}
