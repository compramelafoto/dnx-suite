/**
 * ETAPA 10 — Abrir carga pública de fotografías en Production (Santa Fe en Foco).
 *
 * NO habilita jurado / scoring / ranking / resultados públicos.
 *
 *   SFEF_ALLOW_PRODUCTION_UPLOAD_OPEN=1 \
 *   SFEF_INSTITUTIONAL_AUTH=1 \
 *   DATABASE_URL=...prod \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-10-open-upload-production.ts
 *
 * Opcional:
 *   SFEF_UPLOAD_OPENS_AT=2026-08-01T03:00:00.000Z
 *   SFEF_UPLOAD_CLOSES_AT=2026-10-01T03:00:00.000Z
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = "santa-fe-en-foco";

function assertProd() {
  if (process.env.SFEF_ALLOW_PRODUCTION_UPLOAD_OPEN !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_PRODUCTION_UPLOAD_OPEN=1 requerido");
  }
  if (process.env.SFEF_INSTITUTIONAL_AUTH !== "1") {
    throw new Error("ABORT: SFEF_INSTITUTIONAL_AUTH=1 requerido (CAMINO B vigente)");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("ABORT: DATABASE_URL ausente");
  if (/ep-round-fog|staging|localhost|127\.0\.0\.1|fotorank_staging/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL parece staging/local");
  }
}

async function main() {
  assertProd();

  const opens = new Date(
    process.env.SFEF_UPLOAD_OPENS_AT?.trim() || "2026-08-01T03:00:00.000Z",
  );
  const closes = new Date(
    process.env.SFEF_UPLOAD_CLOSES_AT?.trim() || "2026-10-01T03:00:00.000Z",
  );
  if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime()) || opens >= closes) {
    throw new Error("ABORT: ventana de carga inválida");
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: SLUG },
    select: {
      id: true,
      title: true,
      submissionOpensAt: true,
      submissionDeadline: true,
      uploadPolicyJson: true,
      judgingStartAt: true,
      judgingEndAt: true,
      resultsAt: true,
      registrationEnabled: true,
    },
  });
  if (!contest) throw new Error(`ABORT: concurso ${SLUG} no encontrado`);

  const prevPolicy =
    contest.uploadPolicyJson && typeof contest.uploadPolicyJson === "object"
      ? (contest.uploadPolicyJson as Record<string, unknown>)
      : {};

  const uploadPolicyJson = {
    ...prevPolicy,
    allowedMimeTypes: ["image/jpeg"],
    allowedExtensions: ["jpg", "jpeg"],
    maxFileSizeBytes: 25 * 1024 * 1024,
    requireExif: false,
    requireCaptureDate: false,
    requireGps: false,
    allowEditedFiles: true,
    maxEntriesPerRegistration: 1,
    allowReplaceUntilSubmissionClose: true,
    draftConfig: false,
    publicUploadOpen: true,
    notes: "UPLOAD_PUBLIC_OPEN=true — ETAPA 10 (jurado/resultados OFF)",
  };

  const updated = await prisma.fotorankContest.update({
    where: { id: contest.id },
    data: {
      submissionOpensAt: opens,
      submissionDeadline: closes,
      uploadPolicyJson,
      // Mantener registration ON; no tocar judging*/results* (pueden existir fechas futuras).
      registrationEnabled: true,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      timezone: "America/Argentina/Cordoba",
    },
    select: {
      id: true,
      submissionOpensAt: true,
      submissionDeadline: true,
      registrationEnabled: true,
      judgingStartAt: true,
      resultsAt: true,
      uploadPolicyJson: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        stage: "ETAPA_10_UPLOAD_OPEN",
        contestId: updated.id,
        slug: SLUG,
        before: {
          submissionOpensAt: contest.submissionOpensAt,
          submissionDeadline: contest.submissionDeadline,
        },
        after: {
          submissionOpensAt: updated.submissionOpensAt,
          submissionDeadline: updated.submissionDeadline,
          registrationEnabled: updated.registrationEnabled,
          publicUploadOpen: (updated.uploadPolicyJson as { publicUploadOpen?: boolean } | null)
            ?.publicUploadOpen,
        },
        juryStillOff:
          "No se crean scoring sessions ni freeze; ranking/resultados públicos no se publican",
        institutionalAuth: "Mario Alberto Laus / SFPR / CAMINO B / sfef-provisional-institutional-v1",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
