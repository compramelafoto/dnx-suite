/**
 * Ready-check de una ronda / fase pública (ETAPA 17A).
 */
import { prisma } from "@repo/db";
import { assertJuryActivationAllowed } from "../jury/commercial-contest-guard";
import { evaluatePrePublicVoteReadiness } from "../jury/pre-public-vote-readiness";
import { assertNoPiiInFinalistMetadata } from "../jury/finalist-pii-guard";
import { getOrCreateCompetitionJuryConfig } from "../jury/competition-jury-config";

export type RoundReadyReason =
  | "COMMERCIAL_BLOCKED"
  | "MODE_SKIP"
  | "PRE_PUBLIC_BLOCKED"
  | "PROVIDER_INVALID"
  | "METRIC_INVALID"
  | "WINDOW_INVALID"
  | "TIMEZONE_INVALID"
  | "CANDIDATES_INCOMPLETE"
  | "ASSETS_NOT_READY"
  | "PII_DETECTED"
  | "UNRESOLVED_FINALIST_REVISION";

export async function evaluatePublicVotePhaseReadiness(contestId: string) {
  assertJuryActivationAllowed(contestId);

  const config = await getOrCreateCompetitionJuryConfig(contestId);
  if (config.publicVoteMode === "JURY_ONLY" || config.publicVoteMode === "DISABLED") {
    return {
      status: "SKIP" as const,
      reasons: [{ code: "MODE_SKIP" as RoundReadyReason, message: `mode=${config.publicVoteMode}` }],
      config,
    };
  }

  const pre = await evaluatePrePublicVoteReadiness(contestId);
  const reasons: Array<{ code: RoundReadyReason; message: string }> = [];
  if (pre.status !== "READY_FOR_PUBLIC_VOTE") {
    for (const r of pre.reasons) {
      reasons.push({ code: "PRE_PUBLIC_BLOCKED", message: `${r.code}: ${r.message}` });
    }
  }

  const provider = config.publicVoteProvider;
  if (provider !== "TEST_PROVIDER" && provider !== "NONE") {
    reasons.push({
      code: "PROVIDER_INVALID",
      message: `Provider ${provider} no operativo en 17A (solo TEST_PROVIDER/NONE).`,
    });
  }
  if (config.publicVoteEnabled && provider === "NONE") {
    reasons.push({
      code: "PROVIDER_INVALID",
      message: "publicVoteEnabled requiere TEST_PROVIDER en 17A.",
    });
  }
  if (!config.publicVoteMetric?.trim()) {
    reasons.push({ code: "METRIC_INVALID", message: "Métrica vacía." });
  }
  if (config.publicVoteDurationMinutes <= 0) {
    reasons.push({ code: "WINDOW_INVALID", message: "Duración inválida." });
  }
  if (config.publicVoteStartsAt && config.publicVoteEndsAt) {
    if (config.publicVoteEndsAt.getTime() <= config.publicVoteStartsAt.getTime()) {
      reasons.push({ code: "WINDOW_INVALID", message: "startsAt >= endsAt." });
    }
  }

  const tz = config.timezone;
  if (tz) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch {
      reasons.push({ code: "TIMEZONE_INVALID", message: `Timezone inválida: ${tz}` });
    }
  }

  const finalists = await prisma.fotorankFinalistSnapshot.findMany({
    where: { contestId, status: "CONFIRMED" },
  });
  const draftOrPending = await prisma.fotorankFinalistSnapshot.count({
    where: { contestId, status: { in: ["DRAFT"] } },
  });
  if (finalists.length === 0) {
    reasons.push({
      code: "CANDIDATES_INCOMPLETE",
      message: "No hay finalistas CONFIRMED para crear rondas públicas.",
    });
  }
  if (draftOrPending > 0 && finalists.length < config.finalistsPerUnit) {
    reasons.push({
      code: "UNRESOLVED_FINALIST_REVISION",
      message: `Hay ${draftOrPending} finalista(s) en DRAFT sin confirmar.`,
    });
  }
  for (const f of finalists) {
    if (f.derivativeStatus !== "READY") {
      reasons.push({
        code: "ASSETS_NOT_READY",
        message: `Asset no READY: ${f.publicCode}`,
      });
      break;
    }
    try {
      assertNoPiiInFinalistMetadata(f.metadataJson);
    } catch (e) {
      reasons.push({
        code: "PII_DETECTED",
        message: e instanceof Error ? e.message : "PII",
      });
      break;
    }
  }

  const byUnit = new Map<string, typeof finalists>();
  for (const f of finalists) {
    const list = byUnit.get(f.promptExternalId) ?? [];
    list.push(f);
    byUnit.set(f.promptExternalId, list);
  }
  if (finalists.length > 0 && byUnit.size === 0) {
    reasons.push({
      code: "CANDIDATES_INCOMPLETE",
      message: "Sin unidades de votación.",
    });
  }
  for (const [unit, list] of byUnit) {
    if (list.length < config.finalistsPerUnit) {
      reasons.push({
        code: "CANDIDATES_INCOMPLETE",
        message: `Unidad ${unit}: ${list.length}/${config.finalistsPerUnit}`,
      });
    }
  }
  // DRAFT presentes con paquetes incompletos de CONFIRMED
  if (draftOrPending > 0) {
    const expectedUnits = Math.max(byUnit.size, 1);
    const expected = expectedUnits * config.finalistsPerUnit;
    // Si hay DRAFT y no alcanzamos el total esperado de confirmados por unidad conocida
    if (finalists.length < expected || byUnit.size === 0) {
      if (!reasons.some((r) => r.code === "UNRESOLVED_FINALIST_REVISION")) {
        reasons.push({
          code: "UNRESOLVED_FINALIST_REVISION",
          message: "Finalistas DRAFT pendientes de confirmación/revisión.",
        });
      }
    }
  }

  return {
    status: reasons.length === 0 ? ("READY" as const) : ("BLOCKED" as const),
    reasons,
    config,
    pre,
    unitCount: byUnit.size,
    candidateCount: finalists.length,
  };
}
