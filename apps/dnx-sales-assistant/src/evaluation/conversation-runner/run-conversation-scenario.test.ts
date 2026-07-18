import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderConversationReport } from "../report/render-conversation-report.js";
import { serializeTranscript } from "../conversation-transcript/transcript-serializer.js";
import { getScenarioById, CONVERSATION_SCENARIOS } from "../scenarios/catalog.js";
import { runConversationScenario } from "./run-conversation-scenario.js";

describe("runConversationScenario", () => {
  it("ejecuta escenario completo y llega a READY + pricing READY", async () => {
    const scenario = getScenarioById("wedding-complete-first-message");
    assert.ok(scenario);
    const result = await runConversationScenario(scenario!);
    assert.equal(result.passed, true);
    assert.equal(result.transcript.final.quoteStatus, "READY_FOR_CALCULATION");
    assert.equal(result.transcript.final.pricingRuntimeStatus, "READY");
    assert.equal(result.transcript.turns.length, 1);
    assert.ok(result.daniStyle.score >= 0 && result.daniStyle.score <= 100);
  });

  it("soporta múltiples turnos", async () => {
    const scenario = getScenarioById("wedding-multi-turn");
    assert.ok(scenario);
    const result = await runConversationScenario(scenario!);
    assert.equal(result.passed, true);
    assert.equal(result.metrics.totalTurns, 4);
    assert.equal(result.transcript.final.draft?.durationHours, 10);
  });

  it("corrige duración y mantiene READY", async () => {
    const scenario = getScenarioById("duration-correction");
    assert.ok(scenario);
    const result = await runConversationScenario(scenario!);
    assert.equal(result.passed, true);
    assert.equal(result.transcript.final.draft?.durationHours, 6);
    assert.equal(result.transcript.final.pricingRuntimeStatus, "READY");
  });

  it("conversación no relacionada no llega a READY", async () => {
    const scenario = getScenarioById("album-publish-out-of-quote");
    assert.ok(scenario);
    const result = await runConversationScenario(scenario!);
    assert.equal(result.passed, true);
    assert.notEqual(result.transcript.final.quoteStatus, "READY_FOR_CALCULATION");
  });

  it("reporte y transcript no filtran precios ni breakdown", async () => {
    const scenario = getScenarioById("wedding-complete-first-message");
    const result = await runConversationScenario(scenario!);
    const report = renderConversationReport(result);
    const json = serializeTranscript(result.transcript);
    assert.equal(/recommendedBusiness|breakdown|hourlyRate|minimumSustainable/i.test(report), false);
    assert.equal(/recommendedBusiness|breakdown|hourlyRate|minimumSustainable/i.test(json), false);
    assert.ok(report.includes("SCENARIO: wedding-complete-first-message"));
    assert.ok(report.includes("DANI STYLE:"));
  });

  it("catálogo tiene al menos 25 escenarios", () => {
    assert.ok(CONVERSATION_SCENARIOS.length >= 25);
  });
});
