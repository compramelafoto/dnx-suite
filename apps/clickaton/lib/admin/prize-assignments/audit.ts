import type { Prisma } from "@repo/db";
import type { PrizeAssignmentDecision } from "./state";

export type PrizeAssignmentAuditAction =
  | "PROPOSED"
  | "CONFIRMED"
  | "REVOKED"
  | "REPLACED"
  | "CANCELLED"
  | "DELIVERED"
  | "BUNDLE_AVAILABLE"
  | "NOTE";

export type PrizeAssignmentAuditEntry = {
  at: string;
  action: PrizeAssignmentAuditAction;
  actorUserId?: number | null;
  fromDecision?: PrizeAssignmentDecision | null;
  toDecision?: PrizeAssignmentDecision | null;
  winnerRegistrationId?: string | null;
  previousWinnerRegistrationId?: string | null;
  note?: string | null;
};

export type PrizeAssignmentAuditState = {
  winnerVersion: number;
  decision: PrizeAssignmentDecision;
  entries: PrizeAssignmentAuditEntry[];
};

const DECISIONS = new Set<PrizeAssignmentDecision>([
  "NONE",
  "PROPOSED",
  "CONFIRMED",
  "REVOKED",
  "CANCELLED",
  "DELIVERED",
]);

function asDecision(value: unknown): PrizeAssignmentDecision {
  if (typeof value === "string" && DECISIONS.has(value as PrizeAssignmentDecision)) {
    return value as PrizeAssignmentDecision;
  }
  return "NONE";
}

function asEntries(value: unknown): PrizeAssignmentAuditEntry[] {
  if (!Array.isArray(value)) return [];
  const out: PrizeAssignmentAuditEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.at !== "string" || typeof e.action !== "string") continue;
    out.push({
      at: e.at,
      action: e.action as PrizeAssignmentAuditAction,
      actorUserId: typeof e.actorUserId === "number" ? e.actorUserId : null,
      fromDecision: e.fromDecision ? asDecision(e.fromDecision) : null,
      toDecision: e.toDecision ? asDecision(e.toDecision) : null,
      winnerRegistrationId:
        typeof e.winnerRegistrationId === "string" ? e.winnerRegistrationId : null,
      previousWinnerRegistrationId:
        typeof e.previousWinnerRegistrationId === "string"
          ? e.previousWinnerRegistrationId
          : null,
      note: typeof e.note === "string" ? e.note : null,
    });
  }
  return out;
}

export function readPrizeAssignmentAudit(auditJson: unknown): PrizeAssignmentAuditState {
  if (!auditJson || typeof auditJson !== "object" || Array.isArray(auditJson)) {
    return { winnerVersion: 0, decision: "NONE", entries: [] };
  }
  const o = auditJson as Record<string, unknown>;
  const versionRaw = o.winnerVersion;
  const winnerVersion =
    typeof versionRaw === "number" && Number.isFinite(versionRaw) && versionRaw >= 0
      ? Math.floor(versionRaw)
      : 0;
  return {
    winnerVersion,
    decision: asDecision(o.decision ?? o.status),
    entries: asEntries(o.entries ?? o.history),
  };
}

export function appendPrizeAssignmentAudit(
  auditJson: unknown,
  patch: {
    winnerVersion?: number;
    decision?: PrizeAssignmentDecision;
    entry: Omit<PrizeAssignmentAuditEntry, "at"> & { at?: string };
  },
): { state: PrizeAssignmentAuditState; json: Prisma.InputJsonValue } {
  const prev = readPrizeAssignmentAudit(auditJson);
  const nextVersion =
    typeof patch.winnerVersion === "number" ? patch.winnerVersion : prev.winnerVersion;
  const nextDecision = patch.decision ?? prev.decision;
  const entry: PrizeAssignmentAuditEntry = {
    at: patch.entry.at ?? new Date().toISOString(),
    action: patch.entry.action,
    actorUserId: patch.entry.actorUserId ?? null,
    fromDecision: patch.entry.fromDecision ?? prev.decision,
    toDecision: patch.entry.toDecision ?? nextDecision,
    winnerRegistrationId: patch.entry.winnerRegistrationId ?? null,
    previousWinnerRegistrationId: patch.entry.previousWinnerRegistrationId ?? null,
    note: patch.entry.note ?? null,
  };
  const state: PrizeAssignmentAuditState = {
    winnerVersion: nextVersion,
    decision: nextDecision,
    entries: [...prev.entries, entry].slice(-100),
  };
  return { state, json: state as unknown as Prisma.InputJsonValue };
}
