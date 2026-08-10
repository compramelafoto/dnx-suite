/**
 * ETAPA 17B — Polling Instagram (NORMAL / NEAR_CLOSE / FINALIZATION).
 */
import { prisma } from "@repo/db";
import { getPublicVoteNow } from "../clock";
import { ingestObservations } from "../ingest";
import { fetchLikeObservations, InstagramProviderError } from "./provider";
import { applyThrottle, parseUsageHeader } from "./rate-limit";
import { setSocialConnectionHealth } from "./social-connection";
import { writePublicVoteAudit } from "../audit";

export type PollingMode = "NORMAL" | "NEAR_CLOSE" | "FINALIZATION";

export function resolvePollingMode(input: {
  status: string;
  startsAt: Date;
  endsAt: Date;
  now?: Date;
}): PollingMode {
  const now = input.now ?? getPublicVoteNow();
  if (input.status === "CLOSING") return "FINALIZATION";
  const msToEnd = input.endsAt.getTime() - now.getTime();
  if (msToEnd <= 5 * 60_000 && msToEnd > 0) return "NEAR_CLOSE";
  return "NORMAL";
}

export async function runInstagramPollingTick(roundId: string) {
  const round = await prisma.fotorankPublicVoteRound.findUnique({
    where: { id: roundId },
    include: {
      candidates: { where: { active: true } },
      socialConnection: true,
    },
  });
  if (!round || round.provider !== "INSTAGRAM") {
    return { ok: false as const, reason: "NOT_INSTAGRAM" };
  }
  if (!["OPEN", "CLOSING"].includes(round.status)) {
    return { ok: false as const, reason: `STATUS_${round.status}` };
  }
  if (!round.socialConnection) {
    return { ok: false as const, reason: "NO_CONNECTION" };
  }

  const mode = resolvePollingMode({
    status: round.status,
    startsAt: round.startsAt,
    endsAt: round.endsAt,
  });

  await prisma.fotorankPublicVoteRound.update({
    where: { id: roundId },
    data: { pollingMode: mode },
  });

  try {
    const obs = await fetchLikeObservations({
      roundId,
      publicCodes: round.candidates.map((c) => c.publicCode),
      asOf: getPublicVoteNow(),
      forceEventKey: `poll:${mode.toLowerCase()}:${getPublicVoteNow().toISOString()}`,
    });
    const result = await ingestObservations({
      roundId,
      observations: obs,
      allowClosingWindow: round.status === "CLOSING",
    });

    const usage = parseUsageHeader('{"call_count":10,"total_time":5,"total_cputime":3}');
    const throttled = applyThrottle(usage);
    await setSocialConnectionHealth({
      connectionId: round.socialConnection.id,
      health: "CONNECTED",
      rateLimitState: throttled,
    });
    await prisma.fotorankPublicVoteRound.update({
      where: { id: roundId },
      data: { providerHealth: "CONNECTED" },
    });

    await writePublicVoteAudit({
      contestId: round.contestId,
      eventType: "METRIC_SYNC",
      entityType: "FotorankPublicVoteRound",
      entityId: roundId,
      payload: { mode, inserted: result.inserted },
    });

    return { ok: true as const, mode, ...result };
  } catch (e) {
    let health = "ERROR";
    if (e instanceof InstagramProviderError) {
      if (e.code === "RATE_LIMITED") health = "DEGRADED";
      if (e.code === "TOKEN_EXPIRED") health = "EXPIRED";
      if (e.code === "PUBLICATION_DELETED") {
        await prisma.fotorankPublicVoteRound.update({
          where: { id: roundId },
          data: { incidentStatus: "PUBLICATION_DELETED", providerHealth: "ERROR" },
        });
      }
      if (e.code === "LIKE_COUNT_HIDDEN") health = "ERROR";
    }
    if (round.socialConnection) {
      await setSocialConnectionHealth({
        connectionId: round.socialConnection.id,
        health,
      });
    }
    await prisma.fotorankPublicVoteRound.update({
      where: { id: roundId },
      data: { providerHealth: health === "EXPIRED" ? "ERROR" : health },
    });
    await writePublicVoteAudit({
      contestId: round.contestId,
      eventType: e instanceof InstagramProviderError && e.code === "RATE_LIMITED" ? "RATE_LIMITED" : "PROVIDER_DEGRADED",
      entityType: "FotorankPublicVoteRound",
      entityId: roundId,
      payload: { error: e instanceof Error ? e.message : "unknown" },
    });
    return { ok: false as const, reason: e instanceof Error ? e.message : "unknown", health };
  }
}
