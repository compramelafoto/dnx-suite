/**
 * ETAPA 10 — Rollback: cerrar carga pública de fotografías en Production (Santa Fe en Foco).
 * No toca jurado/resultados. Conserva registrationEnabled salvo SFEF_ALSO_CLOSE_REGISTRATION=1.
 *
 *   SFEF_ALLOW_PRODUCTION_UPLOAD_CLOSE=1 \
 *   DATABASE_URL=...prod \
 *   pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-10-close-upload-production.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = "santa-fe-en-foco";

function assertProd() {
  if (process.env.SFEF_ALLOW_PRODUCTION_UPLOAD_CLOSE !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_PRODUCTION_UPLOAD_CLOSE=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("ABORT: DATABASE_URL ausente");
  if (/ep-round-fog|staging|localhost|127\.0\.0\.1|fotorank_staging/i.test(url)) {
    throw new Error("ABORT: DATABASE_URL parece staging/local");
  }
}

async function main() {
  assertProd();

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: SLUG },
    select: { id: true, uploadPolicyJson: true, submissionOpensAt: true, submissionDeadline: true },
  });
  if (!contest) throw new Error(`ABORT: concurso ${SLUG} no encontrado`);

  const prevPolicy =
    contest.uploadPolicyJson && typeof contest.uploadPolicyJson === "object"
      ? (contest.uploadPolicyJson as Record<string, unknown>)
      : {};

  const data: {
    submissionOpensAt: Date;
    submissionDeadline: Date;
    uploadPolicyJson: Record<string, unknown>;
    registrationEnabled?: boolean;
  } = {
    submissionOpensAt: new Date("2099-01-01T03:00:00.000Z"),
    submissionDeadline: new Date("2099-12-31T03:00:00.000Z"),
    uploadPolicyJson: {
      ...prevPolicy,
      publicUploadOpen: false,
      notes: "UPLOAD_PUBLIC_OPEN=false — ETAPA 10 rollback",
    },
  };
  if (process.env.SFEF_ALSO_CLOSE_REGISTRATION === "1") {
    data.registrationEnabled = false;
  }

  const updated = await prisma.fotorankContest.update({
    where: { id: contest.id },
    data,
    select: {
      submissionOpensAt: true,
      submissionDeadline: true,
      registrationEnabled: true,
      uploadPolicyJson: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        stage: "ETAPA_10_UPLOAD_CLOSE",
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
