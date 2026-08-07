import { Prisma, prisma } from "@repo/db";
import {
  PartnersDomainError,
  assertPartnerCapability,
  resolveAffectedBenefitsFromPayload,
  summarizeSyncPlan,
  type PartnerActor,
  type PartnerBenefitSyncEventPayload,
} from "@repo/partners";
import {
  applyBenefitAccessSync,
  previewBenefitAccessSync,
} from "@/lib/admin/edition-partners/eligibility-sync";
import {
  getPartnerBenefitAutoSyncMaxAttempts,
  resolveAutoSyncProcessMode,
  type AutoSyncProcessMode,
} from "./flags";
import { logAutoSync } from "./log";
import { loadEditionAudienceHints } from "./scope-loader";
import { detectStaleWinnerEvent } from "./stale";

const EVENT_TYPES = new Set([
  "CLICKATON_REGISTRATION_CREATED",
  "CLICKATON_REGISTRATION_CONFIRMED",
  "CLICKATON_REGISTRATION_CANCELLED",
  "CLICKATON_REGISTRATION_USER_LINKED",
  "CLICKATON_REGISTRATION_CATEGORY_CHANGED",
  "CLICKATON_PAYMENT_CONFIRMED",
  "CLICKATON_PAYMENT_REVERSED",
  "CLICKATON_WINNER_CONFIRMED",
  "CLICKATON_WINNER_REVOKED",
  "PARTNER_BENEFIT_ACTIVATED",
  "PARTNER_BENEFIT_PAUSED",
  "PARTNER_BENEFIT_ARCHIVED",
  "PARTNER_BENEFIT_AUDIENCE_CHANGED",
  "PARTNER_BENEFIT_VALIDITY_CHANGED",
]);

export function getSystemPartnerSyncActor(): PartnerActor {
  const raw = process.env.DNX_PARTNER_SYNC_ACTOR_USER_ID?.trim();
  const userId = raw ? Number.parseInt(raw, 10) : 0;
  return {
    userId: Number.isInteger(userId) ? userId : 0,
    isOpsAdmin: true,
  };
}

function parsePayload(raw: unknown): PartnerBenefitSyncEventPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.eventType !== "string" || !EVENT_TYPES.has(o.eventType)) return null;
  if (typeof o.editionId !== "string" || !o.editionId) return null;
  return o as unknown as PartnerBenefitSyncEventPayload;
}

function backoffMs(attempts: number): number {
  const base = Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
  return base;
}

export async function claimPartnerBenefitSyncEvent(
  eventId: string,
): Promise<boolean> {
  const result = await prisma.clickatonIntegrationOutboxEvent.updateMany({
    where: {
      id: eventId,
      status: { in: ["PENDING", "FAILED"] },
      availableAt: { lte: new Date() },
    },
    data: {
      status: "PROCESSING",
      lockedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
  return result.count === 1;
}

export async function processPartnerBenefitSyncEvent(input: {
  eventId: string;
  actor?: PartnerActor;
  /** Force mode for admin process (overrides env when provided). */
  mode?: AutoSyncProcessMode;
}): Promise<{
  ok: boolean;
  mode: AutoSyncProcessMode;
  benefitIds: string[];
  summaries: unknown[];
  error?: string;
}> {
  const actor = input.actor ?? getSystemPartnerSyncActor();
  if (input.actor) {
    assertPartnerCapability(actor, "PARTNER_BENEFITS_PROCESS_SYNC_EVENTS");
  }

  const mode = input.mode ?? resolveAutoSyncProcessMode();
  if (mode === "disabled" && !input.mode) {
    return { ok: false, mode, benefitIds: [], summaries: [], error: "AUTO_SYNC_DISABLED" };
  }

  const claimed = await claimPartnerBenefitSyncEvent(input.eventId);
  if (!claimed) {
    return {
      ok: false,
      mode,
      benefitIds: [],
      summaries: [],
      error: "CLAIM_FAILED",
    };
  }

  const row = await prisma.clickatonIntegrationOutboxEvent.findUnique({
    where: { id: input.eventId },
  });
  if (!row) {
    return { ok: false, mode, benefitIds: [], summaries: [], error: "NOT_FOUND" };
  }

  const started = Date.now();
  try {
    const payload = parsePayload(row.payload);
    if (!payload) {
      await markDead(row.id, "INVALID_PAYLOAD");
      return { ok: false, mode, benefitIds: [], summaries: [], error: "INVALID_PAYLOAD" };
    }

    const stale = await detectStaleWinnerEvent(payload);
    if (stale.stale) {
      await prisma.clickatonIntegrationOutboxEvent.update({
        where: { id: row.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          lockedAt: null,
          lastError: null,
          payload: {
            ...payload,
            _result: {
              mode,
              stale: true,
              reasonCode: stale.reasonCode,
              currentVersion: stale.currentVersion ?? null,
              eventVersion: stale.eventVersion ?? null,
              durationMs: Date.now() - started,
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await prisma.dnxPartnerAuditEvent.create({
        data: {
          partnerId: null,
          entityType: "PartnerBenefitSyncEvent",
          entityId: row.id,
          action: "auto_sync.stale",
          actorUserId: actor.userId || null,
          summary: `${payload.eventType} STALE ${stale.reasonCode ?? ""}`.trim(),
          afterJson: {
            reasonCode: stale.reasonCode ?? null,
            currentVersion: stale.currentVersion ?? null,
            eventVersion: stale.eventVersion ?? null,
          },
        },
      });
      logAutoSync("stale", {
        eventId: row.id,
        eventType: payload.eventType,
        reasonCode: stale.reasonCode ?? null,
        prizeAssignmentId: payload.prizeAssignmentId ?? null,
      });
      return { ok: true, mode, benefitIds: [], summaries: [{ ...stale, stale: true }] };
    }

    const hints = await loadEditionAudienceHints(payload.editionId);
    const scope = resolveAffectedBenefitsFromPayload({ payload, hints });
    const benefitIds = scope.benefitIds;
    const summaries: unknown[] = [];

    for (const benefitId of benefitIds) {
      try {
        if (mode === "apply") {
          const plan = await applyBenefitAccessSync({
            actor,
            editionId: payload.editionId,
            benefitId,
          });
          summaries.push({ benefitId, ...summarizeSyncPlan(plan), applied: true });
        } else {
          const plan = await previewBenefitAccessSync({
            actor,
            editionId: payload.editionId,
            benefitId,
          });
          summaries.push({
            benefitId,
            ...summarizeSyncPlan(plan),
            applied: false,
            shadow: true,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 200) : "benefit_error";
        summaries.push({ benefitId, error: msg });
        // Partial failure: continue other benefits
        logAutoSync("benefit_partial_error", {
          eventId: row.id,
          benefitId,
          error: msg,
        });
      }
    }

    await prisma.clickatonIntegrationOutboxEvent.update({
      where: { id: row.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        lockedAt: null,
        lastError: null,
        payload: {
          ...payload,
          _result: { mode, summaries, durationMs: Date.now() - started },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.dnxPartnerAuditEvent.create({
      data: {
        partnerId: null,
        entityType: "PartnerBenefitSyncEvent",
        entityId: row.id,
        action: mode === "apply" ? "auto_sync.processed_apply" : "auto_sync.processed_shadow",
        actorUserId: actor.userId || null,
        summary: `${payload.eventType} benefits=${benefitIds.length} mode=${mode}`,
        afterJson: {
          benefitCount: benefitIds.length,
          mode,
          durationMs: Date.now() - started,
        },
      },
    });

    logAutoSync("processed", {
      eventId: row.id,
      eventType: payload.eventType,
      mode,
      benefitCount: benefitIds.length,
      durationMs: Date.now() - started,
    });

    return { ok: true, mode, benefitIds, summaries };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 400) : "process_failed";
    const permanent =
      err instanceof PartnersDomainError &&
      (err.code === "VALIDATION" || err.code === "FORBIDDEN" || err.code === "NOT_FOUND");
    await markFailedOrDead(row.id, row.attempts, message, permanent);
    logAutoSync("process_failed", { eventId: row.id, error: message.slice(0, 160) });
    return { ok: false, mode, benefitIds: [], summaries: [], error: message };
  }
}

async function markDead(id: string, error: string) {
  await prisma.clickatonIntegrationOutboxEvent.update({
    where: { id },
    data: {
      status: "DEAD",
      lastError: error.slice(0, 500),
      lockedAt: null,
      processedAt: new Date(),
    },
  });
  await prisma.dnxPartnerAuditEvent.create({
    data: {
      partnerId: null,
      entityType: "PartnerBenefitSyncEvent",
      entityId: id,
      action: "auto_sync.dead_letter",
      summary: error.slice(0, 200),
    },
  });
}

async function markFailedOrDead(
  id: string,
  attempts: number,
  error: string,
  permanent: boolean,
) {
  const max = getPartnerBenefitAutoSyncMaxAttempts();
  if (permanent || attempts >= max) {
    await markDead(id, error);
    return;
  }
  await prisma.clickatonIntegrationOutboxEvent.update({
    where: { id },
    data: {
      status: "FAILED",
      lastError: error.slice(0, 500),
      lockedAt: null,
      availableAt: new Date(Date.now() + backoffMs(attempts)),
    },
  });
  await prisma.dnxPartnerAuditEvent.create({
    data: {
      partnerId: null,
      entityType: "PartnerBenefitSyncEvent",
      entityId: id,
      action: "auto_sync.failed",
      summary: error.slice(0, 200),
      afterJson: { attempts, nextBackoffMs: backoffMs(attempts) },
    },
  });
}

export async function processPendingPartnerBenefitSyncEvents(
  limit = 20,
): Promise<{
  scanned: number;
  processed: number;
  failed: number;
  skipped: number;
  mode: AutoSyncProcessMode;
}> {
  const mode = resolveAutoSyncProcessMode();
  if (mode === "disabled") {
    logAutoSync("cron_disabled", {});
    return { scanned: 0, processed: 0, failed: 0, skipped: 0, mode };
  }

  const due = await prisma.clickatonIntegrationOutboxEvent.findMany({
    where: {
      eventType: { in: [...EVENT_TYPES] },
      status: { in: ["PENDING", "FAILED"] },
      availableAt: { lte: new Date() },
    },
    orderBy: { availableAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  let failed = 0;
  for (const e of due) {
    const result = await processPartnerBenefitSyncEvent({ eventId: e.id, mode });
    if (result.ok) processed += 1;
    else if (result.error !== "CLAIM_FAILED") failed += 1;
  }

  return {
    scanned: due.length,
    processed,
    failed,
    skipped: due.length - processed - failed,
    mode,
  };
}

export async function retryPartnerBenefitSyncEvent(input: {
  actor: PartnerActor;
  eventId: string;
}) {
  assertPartnerCapability(input.actor, "PARTNER_BENEFITS_RETRY_SYNC_EVENTS");
  const row = await prisma.clickatonIntegrationOutboxEvent.update({
    where: { id: input.eventId },
    data: {
      status: "PENDING",
      availableAt: new Date(),
      lockedAt: null,
      lastError: null,
      processedAt: null,
    },
  });
  await prisma.dnxPartnerAuditEvent.create({
    data: {
      partnerId: null,
      entityType: "PartnerBenefitSyncEvent",
      entityId: row.id,
      action: "auto_sync.retried",
      actorUserId: input.actor.userId,
      summary: "manual retry",
    },
  });
  return row;
}

export async function markPartnerBenefitSyncEventDiscarded(input: {
  actor: PartnerActor;
  eventId: string;
  reason: string;
}) {
  assertPartnerCapability(input.actor, "PARTNER_BENEFITS_DISCARD_SYNC_EVENTS");
  const reason = input.reason.trim().slice(0, 200) || "discarded";
  const row = await prisma.clickatonIntegrationOutboxEvent.update({
    where: { id: input.eventId },
    data: {
      status: "DEAD",
      lastError: `DISCARDED: ${reason}`,
      lockedAt: null,
      processedAt: new Date(),
    },
  });
  await prisma.dnxPartnerAuditEvent.create({
    data: {
      partnerId: null,
      entityType: "PartnerBenefitSyncEvent",
      entityId: row.id,
      action: "auto_sync.discarded",
      actorUserId: input.actor.userId,
      summary: reason,
    },
  });
  return row;
}

/** Aplica o previsualiza sync solo sobre benefitIds afectados. */
export async function syncAffectedBenefitAccess(input: {
  actor: PartnerActor;
  editionId: string;
  benefitIds: string[];
  mode: "shadow" | "apply";
}): Promise<Array<{ benefitId: string; summary?: unknown; error?: string }>> {
  const out: Array<{ benefitId: string; summary?: unknown; error?: string }> = [];
  for (const benefitId of input.benefitIds) {
    try {
      if (input.mode === "apply") {
        const plan = await applyBenefitAccessSync({
          actor: input.actor,
          editionId: input.editionId,
          benefitId,
        });
        out.push({ benefitId, summary: summarizeSyncPlan(plan) });
      } else {
        const plan = await previewBenefitAccessSync({
          actor: input.actor,
          editionId: input.editionId,
          benefitId,
        });
        out.push({ benefitId, summary: summarizeSyncPlan(plan) });
      }
    } catch (err) {
      out.push({
        benefitId,
        error: err instanceof Error ? err.message.slice(0, 200) : "error",
      });
    }
  }
  return out;
}

export async function listPartnerBenefitSyncEvents(input: {
  actor: PartnerActor;
  status?: string;
  eventType?: string;
  editionId?: string;
  prizeAssignmentId?: string;
  winnersOnly?: boolean;
  take?: number;
}) {
  assertPartnerCapability(input.actor, "PARTNER_BENEFITS_VIEW_SYNC_EVENTS");
  const winnerTypes = ["CLICKATON_WINNER_CONFIRMED", "CLICKATON_WINNER_REVOKED"];
  return prisma.clickatonIntegrationOutboxEvent.findMany({
    where: {
      eventType: input.eventType
        ? input.eventType
        : input.winnersOnly
          ? { in: winnerTypes }
          : { in: [...EVENT_TYPES] },
      status: input.status
        ? (input.status as "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED" | "DEAD")
        : undefined,
      editionId: input.editionId || undefined,
      aggregateId: input.prizeAssignmentId || undefined,
      aggregateType: input.prizeAssignmentId ? "ClickatonPrizeAssignment" : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 100,
  });
}
