import { describe, expect, it } from "vitest";
import { InconsistencyDetector } from "./inconsistency-detector.js";
import type { BrainContext } from "../types.js";

describe("InconsistencyDetector", () => {
  const detector = new InconsistencyDetector();

  const executeContext: BrainContext = {
    operation: "release.execute",
    platformId: "fotorank",
    platformName: "Fotorank",
  };

  it("detecta mantenimiento vs execute", () => {
    const result = detector.detect(executeContext, [
      {
        source: "policy",
        type: "policy",
        key: "maintenance.enabled",
        message: "Mantenimiento",
        value: true,
      },
    ]);

    expect(result.inconsistencies.some((i) => i.id === "maintenance-vs-execute")).toBe(true);
    expect(result.penalty).toBeGreaterThan(0);
  });

  it("detecta staging validado con issues de validación", () => {
    const result = detector.detect(executeContext, [
      {
        source: "state",
        type: "state",
        key: "staging.validated",
        message: "Validado",
        value: true,
      },
      {
        source: "metric",
        type: "metric",
        key: "validation.issues.count",
        message: "Issues",
        value: 2,
      },
    ]);

    expect(result.inconsistencies.some((i) => i.id === "validated-with-issues")).toBe(true);
  });

  it("detecta GO con issues críticos de validación", () => {
    const result = detector.detect({ ...executeContext, operation: "release.validate" }, [
      {
        source: "state",
        type: "state",
        key: "validation.decision",
        message: "GO",
        value: "GO",
      },
      {
        source: "metric",
        type: "metric",
        key: "validation.issues.count",
        message: "Issues",
        value: 1,
      },
    ]);

    expect(result.inconsistencies.some((i) => i.id === "go-with-issues")).toBe(true);
  });

  it("no dispara go-with-issues por diffs de entorno staging", () => {
    const result = detector.detect({ ...executeContext, operation: "release.validate" }, [
      {
        source: "state",
        type: "state",
        key: "validation.decision",
        message: "GO",
        value: "GO",
      },
      {
        source: "metric",
        type: "metric",
        key: "staging.env.issues.count",
        message: "Env diffs",
        value: 10,
      },
      {
        source: "metric",
        type: "metric",
        key: "validation.issues.count",
        message: "Validation issues",
        value: 0,
      },
    ]);

    expect(result.inconsistencies.some((i) => i.id === "go-with-issues")).toBe(false);
  });

  it("detecta staging ready con health fallida", () => {
    const result = detector.detect({ ...executeContext, operation: "release.prepare" }, [
      {
        source: "checklist",
        type: "checklist",
        key: "staging.ready",
        message: "Ready",
        value: true,
      },
      {
        source: "health",
        type: "health",
        key: "deployment.status",
        message: "Failed",
        value: "failed",
      },
    ]);

    expect(result.inconsistencies.some((i) => i.id === "staging-ready-unhealthy")).toBe(true);
  });

  it("no reporta inconsistencias sin señales conflictivas", () => {
    const result = detector.detect(executeContext, [
      {
        source: "state",
        type: "state",
        key: "staging.validated",
        message: "OK",
        value: true,
      },
    ]);

    expect(result.inconsistencies).toHaveLength(0);
    expect(result.penalty).toBe(0);
  });
});
