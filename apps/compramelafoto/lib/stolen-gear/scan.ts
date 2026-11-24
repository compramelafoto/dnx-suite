import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/** Margen para la fecha del robo: la gente la carga de memoria. */
const STOLEN_AT_MARGIN = "1 day";

/**
 * Cruza las denuncias ACTIVAS contra el historial de números de serie y crea las
 * coincidencias nuevas. Coincide si: mismo tipo y misma serie normalizada, otra
 * cuenta (no el denunciante) y la serie se vio o se subió después del robo.
 * Idempotente: una coincidencia ya creada no se repite.
 */
export async function scanStolenGear(opts: { reportId?: number } = {}): Promise<{
  newMatches: number;
  reportsScanned: number;
}> {
  const onlyReport = opts.reportId ?? null;

  const inserted = await prisma.$queryRaw<{ id: number }[]>`
    INSERT INTO "StolenGearMatch" ("reportId", "sightingId", "makeMismatch", "updatedAt")
    SELECT r."id", s."id",
           NOT (lower(s."make") LIKE '%' || lower(r."make") || '%'
                OR lower(r."make") LIKE '%' || lower(s."make") || '%'),
           CURRENT_TIMESTAMP
    FROM "StolenGearReport" r
    JOIN "GearSerialSighting" s
      ON s."kind" = r."kind" AND s."serialNormalized" = r."serialNormalized"
    WHERE r."status" = 'ACTIVE'
      AND (${onlyReport}::int IS NULL OR r."id" = ${onlyReport}::int)
      AND s."photographerId" IS DISTINCT FROM r."reporterId"
      AND GREATEST(s."lastSeenAt", s."lastUploadedAt") >= r."stolenAt" - ${STOLEN_AT_MARGIN}::interval
    ON CONFLICT ("reportId", "sightingId") DO NOTHING
    RETURNING "id"
  `;

  const scanned = await prisma.stolenGearReport.updateMany({
    where: { status: "ACTIVE", ...(onlyReport ? { id: onlyReport } : {}) },
    data: { lastScannedAt: new Date() },
  });

  return { newMatches: inserted.length, reportsScanned: scanned.count };
}

function adminPanelUrl(): string {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com").replace(/\/$/, "");
  return `${base}/admin/equipos-robados`;
}

/**
 * Avisa al administrador por correo de las coincidencias todavía no avisadas.
 * El correo no lleva datos personales: sólo qué equipo y el link al panel.
 */
export async function notifyAdminOfNewStolenGearMatches(): Promise<{ notified: number; sent: boolean }> {
  const pending = await prisma.stolenGearMatch.findMany({
    where: { notifiedAt: null, status: "NEW", report: { status: "ACTIVE" } },
    select: {
      id: true,
      makeMismatch: true,
      report: { select: { id: true, kind: true, make: true, model: true } },
    },
    orderBy: { id: "asc" },
  });
  if (pending.length === 0) return { notified: 0, sent: false };

  const to = process.env.ADMIN_EMAIL?.trim() || "admin@compramelafoto.com";
  const lines = pending.map((m) => {
    const tipo = m.report.kind === "LENS" ? "Lente" : "Cámara";
    const aviso = m.makeMismatch ? " (la marca no coincide: revisar)" : "";
    return `• Denuncia #${m.report.id}: ${tipo} ${m.report.make} ${m.report.model}${aviso}`;
  });
  const url = adminPanelUrl();
  const text = [
    pending.length === 1
      ? "Un equipo denunciado como robado apareció en fotos subidas a CompramelaFoto."
      : `${pending.length} coincidencias nuevas con equipos denunciados como robados.`,
    "",
    ...lines,
    "",
    `Los detalles están sólo en el panel de administración: ${url}`,
    "",
    "Este aviso es privado. No se notificó a nadie más.",
  ].join("\n");

  const result = await sendEmail({
    to,
    subject:
      pending.length === 1
        ? "Equipo robado: apareció una coincidencia"
        : `Equipos robados: ${pending.length} coincidencias nuevas`,
    text,
  });
  if (!result.success) {
    console.error("[stolen-gear] no se pudo enviar el aviso al admin", result.error);
    return { notified: 0, sent: false };
  }

  await prisma.stolenGearMatch.updateMany({
    where: { id: { in: pending.map((m) => m.id) } },
    data: { notifiedAt: new Date() },
  });
  return { notified: pending.length, sent: true };
}
