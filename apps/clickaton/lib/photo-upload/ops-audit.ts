/**
 * Auditoría operativa de cronograma / reveal / uploads (ETAPA 15).
 * Usa ClickatonTimelineAudit como ledger durable sin migración nueva.
 */
import { prisma } from "@/lib/admin/db";

async function ensureOpsTimeline(editionId: string, actorUserId: number) {
  const existing = await prisma.clickatonEditionTimeline.findFirst({
    where: { editionId, status: { in: ["ACTIVE", "DRAFT"] } },
    orderBy: [{ status: "asc" }, { version: "desc" }],
    select: { id: true },
  });
  if (existing) return existing.id;

  const max = await prisma.clickatonEditionTimeline.aggregate({
    where: { editionId },
    _max: { version: true },
  });
  const created = await prisma.clickatonEditionTimeline.create({
    data: {
      editionId,
      version: (max._max.version ?? 0) + 1,
      status: "DRAFT",
      timezone: "America/Argentina/Cordoba",
      createdByUserId: actorUserId,
    },
    select: { id: true },
  });
  return created.id;
}

export async function writeEditionOpsAudit(input: {
  editionId: string;
  actorUserId: number;
  action: string;
  payload: Record<string, unknown>;
}) {
  const timelineId = await ensureOpsTimeline(input.editionId, input.actorUserId);
  await prisma.clickatonTimelineAudit.create({
    data: {
      timelineId,
      actorUserId: input.actorUserId,
      action: input.action,
      payload: {
        ...input.payload,
        editionId: input.editionId,
        auditedAt: new Date().toISOString(),
      },
    },
  });
}

export async function listEditionOpsAudits(editionId: string, take = 30) {
  const timelines = await prisma.clickatonEditionTimeline.findMany({
    where: { editionId },
    select: { id: true },
  });
  const ids = timelines.map((t) => t.id);
  if (ids.length === 0) return [];
  return prisma.clickatonTimelineAudit.findMany({
    where: {
      timelineId: { in: ids },
      action: {
        in: [
          "EXTEND_UPLOAD_WINDOW",
          "EMERGENCY_REVEAL",
          "ROLLBACK_REVEAL_TO_LOCKED",
          "SET_UPLOADS_ENABLED",
          "SET_CANONICAL_ASSETS",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { id: true, email: true, name: true } } },
  });
}
