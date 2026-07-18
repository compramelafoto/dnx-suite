import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createConversationId } from "../../conversation/create-conversation-id.js";
import { InMemoryConversationStore } from "../../conversation/in-memory-conversation-store.js";
import type { AssistantRequest } from "../../models/assistant.js";
import { processIncomingMessage } from "../../pipeline/process-incoming-message.js";
import {
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
} from "../__fixtures__/synthetic-ready.js";
import { executeRuntimePricing } from "./execute-runtime-pricing.js";
import {
  applyPricingRuntime,
  type PricingRuntimeDeps,
} from "./pricing-runtime.js";
import { createInlinePricingRuntimeConfigResolver } from "./resolve-pricing-runtime-config.js";

/** READY ya no usa la frase legacy fija (dani-conversation-v1). */
function assertReadyVisibleText(text: string): void {
  assert.ok(text.length > 0);
  assert.equal(/\?/.test(text), false);
  assert.equal(/recommendedBusiness|breakdown|pricing|READY_FOR_CALCULATION/i.test(text), false);
}

function makeRequest(text: string, from = "5493417654321"): AssistantRequest {
  return {
    message: {
      from,
      text,
      channel: "simulate",
      receivedAt: "2026-07-18T00:00:00.000Z",
    },
  };
}

function syntheticRuntime(silentLogs = true): PricingRuntimeDeps {
  return {
    silentLogs,
    resolveConfig: createInlinePricingRuntimeConfigResolver({
      profile: createSyntheticReadyProfile(),
      catalog: createSyntheticReadyCatalog(),
    }),
  };
}

async function completeQuote(
  store: InMemoryConversationStore,
  from: string,
  runtime: PricingRuntimeDeps,
) {
  const deps = { store, memoryClock: store, pricingRuntime: runtime };
  await processIncomingMessage(makeRequest("Quiero presupuesto para un casamiento.", from), deps);
  await processIncomingMessage(makeRequest("20/09/2026.", from), deps);
  await processIncomingMessage(makeRequest("En Córdoba.", from), deps);
  return processIncomingMessage(makeRequest("8 horas.", from), deps);
}

describe("pricing runtime — ejecución silenciosa", () => {
  it("cálculo automático al llegar a READY_FOR_CALCULATION", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    const from = "5493000000001";
    const last = await completeQuote(store, from, syntheticRuntime());
    assert.equal(last.quoteRequest?.status, "READY_FOR_CALCULATION");
    assertReadyVisibleText(last.text);

    const stored = await store.get(createConversationId(from));
    assert.equal(stored?.pricingResult?.status, "READY");
    assert.ok((stored?.pricingResult?.minimumSustainablePrice ?? 0) > 0);
    assert.ok((stored?.pricingResult?.recommendedBusinessPrice ?? 0) > 0);
    assert.equal(stored?.pricingResult?.currency, "ARS");
    assert.equal(stored?.pricingResult?.approvalStatus, "NOT_REVIEWED");
    assert.ok(stored?.pricingCacheKey);
  });

  it("conversación HTTP-equivalente sin precios en la respuesta del processor", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    const last = await completeQuote(store, "5493000000002", syntheticRuntime());
    const blob = JSON.stringify(last);
    assert.equal(blob.includes("minimumSustainablePrice"), false);
    assert.equal(blob.includes("recommendedBusinessPrice"), false);
    assert.equal(blob.includes("pricingResult"), false);
    assertReadyVisibleText(last.text);
  });

  it("config ausente → FAILED sin romper conversación", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    const from = "5493000000003";
    const last = await completeQuote(store, from, {
      silentLogs: true,
      resolveConfig: () => ({ status: "UNAVAILABLE", reason: "test" }),
    });
    assert.equal(last.quoteRequest?.status, "READY_FOR_CALCULATION");
    assertReadyVisibleText(last.text);
    const stored = await store.get(createConversationId(from));
    assert.equal(stored?.pricingResult?.status, "FAILED");
  });

  it("INCOMPLETE cuando falta plantilla", async () => {
    const result = await executeRuntimePricing({
      draft: {
        serviceType: "OTHER",
        durationHours: 2,
        eventDate: "2026-09-20",
        city: "Córdoba",
      },
      resolveConfig: createInlinePricingRuntimeConfigResolver({
        profile: createSyntheticReadyProfile(),
        catalog: createSyntheticReadyCatalog(),
      }),
    });
    assert.equal(result.result.status, "INCOMPLETE");
    assert.equal(result.fromCache, false);
  });

  it("cache evita recálculo con misma huella", async () => {
    const resolveConfig = createInlinePricingRuntimeConfigResolver({
      profile: createSyntheticReadyProfile(),
      catalog: createSyntheticReadyCatalog(),
    });
    const draft = {
      serviceType: "WEDDING" as const,
      eventDate: "2026-09-20",
      city: "Córdoba",
      durationHours: 8,
    };
    const first = await executeRuntimePricing({ draft, resolveConfig });
    assert.equal(first.fromCache, false);
    assert.equal(first.result.status, "READY");
    const second = await executeRuntimePricing({
      draft,
      resolveConfig,
      previousCacheKey: first.cacheKey,
      previousResult: first.result,
    });
    assert.equal(second.fromCache, true);
    assert.equal(second.result.status, "READY");
    assert.equal(second.cacheKey, first.cacheKey);
  });

  it("invalidación: cambio de duración recalcula", async () => {
    const resolveConfig = createInlinePricingRuntimeConfigResolver({
      profile: createSyntheticReadyProfile(),
      catalog: createSyntheticReadyCatalog(),
    });
    const first = await executeRuntimePricing({
      draft: {
        serviceType: "WEDDING",
        eventDate: "2026-09-20",
        city: "Córdoba",
        durationHours: 8,
      },
      resolveConfig,
    });
    const second = await executeRuntimePricing({
      draft: {
        serviceType: "WEDDING",
        eventDate: "2026-09-20",
        city: "Córdoba",
        durationHours: 10,
      },
      resolveConfig,
      previousCacheKey: first.cacheKey,
      previousResult: first.result,
    });
    assert.equal(second.fromCache, false);
    assert.notEqual(second.cacheKey, first.cacheKey);
    assert.equal(second.result.status, "READY");
  });

  it("invalidación en pipeline al cambiar draft antes de READY", async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
    const from = "5493000000004";
    const runtime = syntheticRuntime();
    const deps = { store, memoryClock: store, pricingRuntime: runtime };
    await processIncomingMessage(makeRequest("Quiero presupuesto para un casamiento.", from), deps);
    await processIncomingMessage(makeRequest("20/09/2026.", from), deps);
    // sin pricing aún
    let stored = await store.get(createConversationId(from));
    assert.equal(stored?.pricingResult, undefined);

    await processIncomingMessage(makeRequest("En Córdoba.", from), deps);
    await processIncomingMessage(makeRequest("8 horas.", from), deps);
    stored = await store.get(createConversationId(from));
    assert.equal(stored?.pricingResult?.status, "READY");
    const firstKey = stored?.pricingCacheKey;

    // nuevo presupuesto tras completar → invalida y recalcula
    await processIncomingMessage(
      makeRequest("Quiero otro presupuesto para un casamiento el 21/09/2026 en Mendoza, 10 horas.", from),
      deps,
    );
    stored = await store.get(createConversationId(from));
    assert.equal(stored?.pricingResult?.status, "READY");
    assert.notEqual(stored?.pricingCacheKey, firstKey);
  });

  it("applyPricingRuntime limpia resultado si el draft cambia sin READY", async () => {
    const cleared = await applyPricingRuntime(
      {
        quoteStatus: "COLLECTING_INFORMATION",
        draft: { serviceType: "WEDDING", city: "Córdoba" },
        previousDraft: {
          serviceType: "WEDDING",
          city: "Rosario",
          eventDate: "2026-09-20",
          durationHours: 8,
        },
        previousResult: {
          status: "READY",
          minimumSustainablePrice: 1,
          recommendedBusinessPrice: 2,
          currency: "ARS",
          approvalStatus: "NOT_REVIEWED",
          warnings: [],
        },
        previousCacheKey: "old",
      },
      { silentLogs: true },
    );
    assert.equal(cleared.pricingResult, undefined);
    assert.equal(cleared.pricingCacheKey, undefined);
  });

  it("excepción del engine → FAILED sin throw", async () => {
    const result = await executeRuntimePricing({
      draft: {
        serviceType: "WEDDING",
        eventDate: "2026-09-20",
        city: "Córdoba",
        durationHours: 8,
      },
      resolveConfig: createInlinePricingRuntimeConfigResolver({
        profile: createSyntheticReadyProfile(),
        catalog: createSyntheticReadyCatalog(),
      }),
      engineOptions: {
        calculate: () => {
          throw new Error("boom");
        },
      },
    });
    assert.equal(result.result.status, "FAILED");
  });
});
