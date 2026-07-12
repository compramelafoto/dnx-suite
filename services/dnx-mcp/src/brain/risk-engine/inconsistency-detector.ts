import type { BrainContext, BrainSignal, Inconsistency, SignalSeverity } from "../types.js";

export interface InconsistencyResult {
  inconsistencies: Inconsistency[];
  penalty: number;
}

export class InconsistencyDetector {
  detect(context: BrainContext, signals: BrainSignal[]): InconsistencyResult {
    const inconsistencies: Inconsistency[] = [];
    const signalMap = buildSignalMap(signals);

    this.checkMaintenanceVsExecute(context, signalMap, inconsistencies);
    this.checkStagingValidatedVsIssues(context, signalMap, inconsistencies);
    this.checkStagingReadyVsHealth(signalMap, inconsistencies);
    this.checkGoDecisionVsIssues(context, signalMap, inconsistencies);
    this.checkPreviewMissingVsValidate(context, signalMap, inconsistencies);
    this.checkChecklistFailedVsReady(signalMap, inconsistencies);
    this.checkGoDecisionVsGitDirty(context, signalMap, inconsistencies);

    const penalty = inconsistencies.reduce((sum, item) => sum + severityPenalty(item.severity), 0);

    return { inconsistencies, penalty };
  }

  private checkMaintenanceVsExecute(
    context: BrainContext,
    map: SignalMap,
    out: Inconsistency[],
  ): void {
    if (context.operation !== "release.execute") {
      return;
    }
    if (map.getBoolean("policy", "maintenance.enabled") === true) {
      out.push({
        id: "maintenance-vs-execute",
        severity: "critical",
        description: "Se intenta ejecutar release con modo mantenimiento activo",
        signals: ["policy:maintenance.enabled", `operation:${context.operation}`],
      });
    }
  }

  private checkStagingValidatedVsIssues(
    context: BrainContext,
    map: SignalMap,
    out: Inconsistency[],
  ): void {
    if (context.operation !== "release.execute") {
      return;
    }
    const validated = map.getBoolean("state", "staging.validated");
    const issueCount = map.getNumber("metric", "validation.issues.count") ?? 0;
    if (validated === true && issueCount > 0) {
      out.push({
        id: "validated-with-issues",
        severity: "high",
        description: "Staging marcado como validado pero hay issues abiertos",
        signals: ["state:staging.validated", "metric:validation.issues.count"],
      });
    }
  }

  private checkStagingReadyVsHealth(map: SignalMap, out: Inconsistency[]): void {
    const stagingReady = map.getBoolean("checklist", "staging.ready");
    const health = map.getString("health", "deployment.status");
    if (stagingReady === true && health === "failed") {
      out.push({
        id: "staging-ready-unhealthy",
        severity: "high",
        description: "Staging reportado como listo pero salud del deployment es fallida",
        signals: ["checklist:staging.ready", "health:deployment.status"],
      });
    }
  }

  private checkGoDecisionVsIssues(
    context: BrainContext,
    map: SignalMap,
    out: Inconsistency[],
  ): void {
    if (context.operation !== "release.validate") {
      return;
    }
    const decision = map.getString("state", "validation.decision");
    const issueCount = map.getNumber("metric", "validation.issues.count") ?? 0;
    if (decision === "GO" && issueCount > 0) {
      out.push({
        id: "go-with-issues",
        severity: "critical",
        description: "Decisión GO con issues pendientes",
        signals: ["state:validation.decision", "metric:validation.issues.count"],
      });
    }
  }

  private checkPreviewMissingVsValidate(
    context: BrainContext,
    map: SignalMap,
    out: Inconsistency[],
  ): void {
    if (context.operation !== "release.validate") {
      return;
    }
    const hasPreview = map.getBoolean("state", "preview.available");
    const passed = map.getBoolean("state", "validation.passed");
    if (hasPreview === false && passed === true) {
      out.push({
        id: "validate-without-preview",
        severity: "high",
        description: "Validación exitosa sin deployment de preview",
        signals: ["state:preview.available", "state:validation.passed"],
      });
    }
  }

  private checkChecklistFailedVsReady(map: SignalMap, out: Inconsistency[]): void {
    const failedCount = map.getNumber("metric", "checklist.failed") ?? 0;
    const readyForValidation = map.getBoolean("state", "ready.for.validation");
    if (failedCount > 0 && readyForValidation === true) {
      out.push({
        id: "ready-with-failed-checklist",
        severity: "medium",
        description: "Marcado como listo para validación con items fallidos en checklist",
        signals: ["metric:checklist.failed", "state:ready.for.validation"],
      });
    }
  }

  private checkGoDecisionVsGitDirty(
    context: BrainContext,
    map: SignalMap,
    out: Inconsistency[],
  ): void {
    if (context.operation !== "release.validate" && context.operation !== "release.execute") {
      return;
    }

    const decision = map.getString("state", "validation.decision");
    const dirtyTree = map.getBoolean("state", "git.dirtyTree");
    if (decision === "GO" && dirtyTree === true) {
      out.push({
        id: "go-with-dirty-git",
        severity: "critical",
        description: "Decisión GO con working tree Git sucio",
        signals: ["state:validation.decision", "state:git.dirtyTree"],
      });
    }
  }
}

type SignalMap = {
  get(type: string, key: string): BrainSignal | undefined;
  getBoolean(type: string, key: string): boolean | undefined;
  getNumber(type: string, key: string): number | undefined;
  getString(type: string, key: string): string | undefined;
};

function buildSignalMap(signals: BrainSignal[]): SignalMap {
  const map = new Map<string, BrainSignal>();
  for (const signal of signals) {
    map.set(`${signal.type}:${signal.key}`, signal);
  }
  return {
    get(type: string, key: string): BrainSignal | undefined {
      return map.get(`${type}:${key}`);
    },
    getBoolean(type: string, key: string): boolean | undefined {
      const signal = map.get(`${type}:${key}`);
      if (!signal) {
        return undefined;
      }
      if (typeof signal.value === "boolean") {
        return signal.value;
      }
      if (signal.value === "true") {
        return true;
      }
      if (signal.value === "false") {
        return false;
      }
      return undefined;
    },
    getNumber(type: string, key: string): number | undefined {
      const signal = map.get(`${type}:${key}`);
      if (typeof signal?.value === "number") {
        return signal.value;
      }
      return undefined;
    },
    getString(type: string, key: string): string | undefined {
      const signal = map.get(`${type}:${key}`);
      if (typeof signal?.value === "string") {
        return signal.value;
      }
      return undefined;
    },
  };
}

function severityPenalty(severity: SignalSeverity): number {
  switch (severity) {
    case "critical":
      return 35;
    case "high":
      return 20;
    case "medium":
      return 10;
    case "low":
      return 5;
  }
}
