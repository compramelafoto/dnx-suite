import { describe, expect, it } from "vitest";
import { resolveExecutionGate, ToolConfirmationRequiredError } from "./guards.js";

describe("resolveExecutionGate", () => {
  it("retorna dryRun sin ejecutar", () => {
    const gate = resolveExecutionGate({ dryRun: true, confirm: false }, "test");
    expect(gate).toEqual({ dryRun: true, proceed: false });
  });

  it("requiere confirmación sin dryRun", () => {
    expect(() => resolveExecutionGate({ dryRun: false, confirm: false }, "deploy")).toThrow(
      ToolConfirmationRequiredError,
    );
  });

  it("permite ejecución con confirmación", () => {
    const gate = resolveExecutionGate({ dryRun: false, confirm: true }, "deploy");
    expect(gate).toEqual({ dryRun: false, proceed: true });
  });
});
