import type { ReleasePhase } from "./release-types.js";
import type { ReleaseBrainAssessment } from "./release-brain.js";
import type { ReleaseReadiness as GitReleaseReadiness } from "../../providers/git/types/index.js";
import type { ReleaseReadiness as PrismaReleaseReadiness } from "../../providers/prisma/types/index.js";
import type { ReleaseReadiness as PostgresReleaseReadiness } from "../../providers/postgres/types/index.js";
import type { CloudflareReleaseReadiness } from "../../providers/cloudflare/types/index.js";

export interface StateTransition {
  from: ReleasePhase;
  to: ReleasePhase;
  at: string;
  reason?: string;
}

/**
 * Máquina de estados del ciclo de release.
 * Registra transiciones y expone el estado actual.
 */
export class ReleaseState {
  private phase: ReleasePhase = "idle";
  private readonly transitions: StateTransition[] = [];
  private project: string | null = null;
  private statusSnapshot: Record<string, unknown> | null = null;
  private stagingSnapshot: Record<string, unknown> | null = null;
  private lastBrainAssessment: ReleaseBrainAssessment | null = null;
  private lastGitReadiness: GitReleaseReadiness | null = null;
  private lastPrismaReadiness: PrismaReleaseReadiness | null = null;
  private lastPostgresReadiness: PostgresReleaseReadiness | null = null;
  private lastCloudflareReadiness: CloudflareReleaseReadiness | null = null;
  private lastValidationDecision: "GO" | "NO-GO" | null = null;

  getPhase(): ReleasePhase {
    return this.phase;
  }

  getProject(): string | null {
    return this.project;
  }

  getHistory(): readonly StateTransition[] {
    return this.transitions;
  }

  getSnapshots(): {
    status: Record<string, unknown> | null;
    staging: Record<string, unknown> | null;
  } {
    return {
      status: this.statusSnapshot,
      staging: this.stagingSnapshot,
    };
  }

  getLastBrainAssessment(): ReleaseBrainAssessment | null {
    return this.lastBrainAssessment;
  }

  getLastValidationDecision(): "GO" | "NO-GO" | null {
    return this.lastValidationDecision;
  }

  setSnapshots(status: Record<string, unknown>, staging: Record<string, unknown>): void {
    this.statusSnapshot = status;
    this.stagingSnapshot = staging;
  }

  getLastGitReadiness(): GitReleaseReadiness | null {
    return this.lastGitReadiness;
  }

  setGitReadiness(readiness: GitReleaseReadiness | null): void {
    this.lastGitReadiness = readiness;
  }

  getLastPrismaReadiness(): PrismaReleaseReadiness | null {
    return this.lastPrismaReadiness;
  }

  setPrismaReadiness(readiness: PrismaReleaseReadiness | null): void {
    this.lastPrismaReadiness = readiness;
  }

  getLastPostgresReadiness(): PostgresReleaseReadiness | null {
    return this.lastPostgresReadiness;
  }

  setPostgresReadiness(readiness: PostgresReleaseReadiness | null): void {
    this.lastPostgresReadiness = readiness;
  }

  getLastCloudflareReadiness(): CloudflareReleaseReadiness | null {
    return this.lastCloudflareReadiness;
  }

  setCloudflareReadiness(readiness: CloudflareReleaseReadiness | null): void {
    this.lastCloudflareReadiness = readiness;
  }

  setBrainAssessment(assessment: ReleaseBrainAssessment): void {
    this.lastBrainAssessment = assessment;
  }

  setValidationDecision(decision: "GO" | "NO-GO"): void {
    this.lastValidationDecision = decision;
  }

  reset(): void {
    this.transition("idle", "reset");
    this.project = null;
    this.statusSnapshot = null;
    this.stagingSnapshot = null;
    this.lastBrainAssessment = null;
    this.lastGitReadiness = null;
    this.lastPrismaReadiness = null;
    this.lastPostgresReadiness = null;
    this.lastCloudflareReadiness = null;
    this.lastValidationDecision = null;
  }

  bindPlatform(platformId: string): void {
    this.project = platformId;
  }

  /** @deprecated Usar bindPlatform */
  bindProject(project: string): void {
    this.bindPlatform(project);
  }

  transition(to: ReleasePhase, reason?: string): void {
    const from = this.phase;
    this.phase = to;
    this.transitions.push({
      from,
      to,
      at: new Date().toISOString(),
      ...(reason ? { reason } : {}),
    });
  }

  assertPhase(expected: ReleasePhase | ReleasePhase[], action: string): void {
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(this.phase)) {
      throw new ReleaseStateError(
        `No se puede ejecutar "${action}" en fase "${this.phase}". Se esperaba: ${allowed.join(" | ")}`,
      );
    }
  }

  canValidate(): boolean {
    return this.phase === "prepared" || this.phase === "validated";
  }

  canExecute(): boolean {
    return this.phase === "validated" && this.lastValidationDecision === "GO";
  }

  canRollback(): boolean {
    return (
      this.phase === "completed" ||
      this.phase === "failed" ||
      this.phase === "executing" ||
      this.phase === "validated"
    );
  }
}

export class ReleaseStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseStateError";
  }
}
