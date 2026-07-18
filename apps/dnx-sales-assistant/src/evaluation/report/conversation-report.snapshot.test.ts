import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getScenarioById } from "../scenarios/catalog.js";
import { runConversationScenario } from "../conversation-runner/run-conversation-scenario.js";
import { renderConversationReport } from "./render-conversation-report.js";

/**
 * Snapshot estructural (no frágil): encabezados fijos + ausencia de precios.
 * No fija el texto completo del asistente.
 */
describe("conversation report golden structure", () => {
  it("mantiene secciones del reporte", async () => {
    const scenario = getScenarioById("wedding-complete-first-message");
    const result = await runConversationScenario(scenario!);
    const report = renderConversationReport(result);

    for (const section of [
      "SCENARIO:",
      "STATUS:",
      "FINAL STATE:",
      "PRICING:",
      "TURN 1",
      "USER:",
      "ASSISTANT:",
      "DETECTED:",
      "MISSING:",
      "DANI STYLE:",
      "Score:",
      "METRICS:",
    ]) {
      assert.ok(report.includes(section), `falta sección ${section}`);
    }

    assert.equal(report.includes("ERROR: price leak"), false);
    assert.match(report, /FINAL STATE: READY_FOR_CALCULATION/);
    assert.match(report, /PRICING: READY/);
  });
});
