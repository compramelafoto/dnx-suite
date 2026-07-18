import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { InMemoryConversationStore } from "../../conversation/in-memory-conversation-store.js";
import {
  createOwnerFacingTestProfile,
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
} from "../../pricing/__fixtures__/synthetic-ready.js";
import type { OwnerIdentityConfig } from "../../pricing/owner/owner-identity.js";
import { SYNTHETIC_PROFILE_ID } from "../../pricing/profile/user-facing-profile-guard.js";
import { createDefaultPricingRuntimeDeps } from "../../pricing/runtime/pricing-runtime.js";
import { PricingReviewLabApi } from "../../pricing-review/lab/pricing-review-lab-api.js";
import {
  loadTelegramConfig,
  validateTelegramConfig,
} from "./domain/config.js";
import { authorizeTelegramInbound, privateDenyMessage } from "./security/authorize.js";
import { escapeHtml, segmentTelegramText } from "./rendering/format.js";
import { nextBackoffMs, resetBackoff } from "./polling/backoff.js";
import { mapTelegramUpdate, buildTelegramIdentity } from "./mapping/map-update.js";
import { TelegramLocalStore } from "./persistence/telegram-local-store.js";
import { invalidateSyntheticBudgets } from "./session/invalidate-synthetic-budget.js";
import { TelegramChannelHandler } from "./session/telegram-channel-handler.js";
import { LongPollingRunner } from "./polling/long-polling-runner.js";
import { TelegramApiClient } from "./bot/telegram-api-client.js";
import { writeJsonAtomic } from "./persistence/atomic-write.js";
import { runTelegramChecklist } from "./cli/run-telegram-checklist.js";
import type { TelegramInboundMessage } from "./domain/models.js";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "dnx-tg-"));
process.env.DNX_TELEGRAM_LOCAL_DIR = tmpRoot;

after(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  delete process.env.DNX_TELEGRAM_LOCAL_DIR;
});

function authorizedConfig() {
  return {
    enabled: true,
    botToken: "000000:TEST_ONLY_FAKE",
    allowedUserIds: ["111"],
    allowedChatIds: ["222"],
    transport: "polling" as const,
  };
}

function inbound(
  partial: Partial<TelegramInboundMessage> & { text: string; updateId: number },
): TelegramInboundMessage {
  return {
    messageId: 1,
    chatId: "222",
    userId: "111",
    receivedAt: new Date().toISOString(),
    chatType: "private",
    ...partial,
  };
}

describe("telegram config + security", () => {
  it("configuración ausente / token ausente", () => {
    const config = loadTelegramConfig({
      DNX_TELEGRAM_ENABLED: "true",
      DNX_TELEGRAM_TRANSPORT: "polling",
    });
    const v = validateTelegramConfig(config);
    assert.equal(v.ok, false);
    assert.ok(v.lines.some((l) => /credentials not configured/i.test(l)));
  });

  it("usuario y chat no autorizados", () => {
    const cfg = authorizedConfig();
    assert.equal(
      authorizeTelegramInbound(
        { userId: "999", chatId: "222", chatType: "private" },
        cfg,
      ).ok,
      false,
    );
    assert.equal(
      authorizeTelegramInbound(
        { userId: "111", chatId: "999", chatType: "private" },
        cfg,
      ).ok,
      false,
    );
  });

  it("chat no privado denegado; username no autoriza", () => {
    const cfg = authorizedConfig();
    assert.equal(
      authorizeTelegramInbound(
        { userId: "111", chatId: "222", chatType: "group" },
        cfg,
      ).ok,
      false,
    );
    assert.equal(
      authorizeTelegramInbound(
        { userId: "111", chatId: "222", chatType: "private" },
        cfg,
      ).ok,
      true,
    );
    assert.match(privateDenyMessage(), /uso privado/i);
  });

  it("checklist no imprime secretos", () => {
    const result = runTelegramChecklist();
    assert.equal(result.exitCode, 0);
    assert.equal(/[0-9]{8,}:[A-Za-z0-9_-]+/.test(result.lines.join("\n")), false);
  });
});

describe("telegram mapping + rendering + backoff", () => {
  it("mapea mensaje y callback", () => {
    const msg = mapTelegramUpdate({
      update_id: 10,
      message: {
        message_id: 5,
        date: 1_700_000_000,
        text: "/inicio",
        chat: { id: 222, type: "private" },
        from: { id: 111, username: "dani" },
      },
    });
    assert.ok(msg);
    assert.equal(msg.chatId, "222");
    assert.equal(msg.userId, "111");
    const id = buildTelegramIdentity(msg);
    assert.equal(id.channel, "TELEGRAM");
    assert.match(id.pipelineFrom, /^tg222$/);

    const cb = mapTelegramUpdate({
      update_id: 11,
      callback_query: {
        id: "cq1",
        data: "budget:explain",
        from: { id: 111 },
        message: { message_id: 6, chat: { id: 222, type: "private" } },
      },
    });
    assert.ok(cb?.isCallback);
    assert.equal(cb?.callbackData, "budget:explain");
  });

  it("escape HTML y segmentación", () => {
    assert.equal(escapeHtml("a<b>&c"), "a&lt;b&gt;&amp;c");
    const long = `${"palabra ".repeat(800)}importe $12345 fin`;
    const parts = segmentTelegramText(long, 200);
    assert.ok(parts.length > 1);
    assert.ok(parts.join("").includes("12345") || parts.some((p) => p.includes("12345")));
  });

  it("backoff 429 y reset", () => {
    const a = nextBackoffMs(resetBackoff(), { retryAfterSeconds: 2 });
    assert.equal(a.delayMs, 2000);
    const b = nextBackoffMs({ attempt: 3 });
    assert.ok(b.delayMs >= 8000);
  });
});

describe("telegram persistence + idempotencia", () => {
  it("escritura atómica y updates idempotentes", async () => {
    const file = path.join(tmpRoot, "atomic.json");
    await writeJsonAtomic(file, { ok: true });
    const store = new TelegramLocalStore(new InMemoryConversationStore());
    assert.equal(store.isUpdateProcessed(1), false);
    await store.markUpdateProcessed(1);
    assert.equal(store.isUpdateProcessed(1), true);
    assert.equal(store.getLastUpdateId(), 1);
  });
});

describe("telegram channel handler (fake / sin credenciales reales)", () => {
  function testOwnerIdentity(
    partial: Partial<OwnerIdentityConfig> = {},
  ): OwnerIdentityConfig {
    return {
      ownerEmail: "dnxfotografia@gmail.com",
      telegramOwnerUserId: "111",
      telegramOwnerChatId: "222",
      profilePath: path.join(tmpRoot, "missing-owner.local.json"),
      templatesPath: path.join(tmpRoot, "missing-templates.local.json"),
      ...partial,
    };
  }

  async function makeHandler(ownerIdentity?: OwnerIdentityConfig) {
    const localStore = new TelegramLocalStore(new InMemoryConversationStore());
    const handler = new TelegramChannelHandler({
      config: authorizedConfig(),
      localStore,
      ownerIdentity: ownerIdentity ?? testOwnerIdentity(),
      pricingRuntime: {
        ...createDefaultPricingRuntimeDeps(),
        silentLogs: true,
        resolveConfig: () => ({ status: "UNAVAILABLE", reason: "test" }),
      },
    });
    return { handler, localStore };
  }

  it("niega no autorizado sin revelar funciones", async () => {
    const { handler } = await makeHandler();
    const out = await handler.handle(
      inbound({
        updateId: 1,
        text: "/presupuesto",
        userId: "999",
      }),
    );
    assert.equal(out[0]?.text, privateDenyMessage());
    assert.equal(/mínimo|recomendado|pricing/i.test(out[0]?.text ?? ""), false);
  });

  it("comandos /inicio /ayuda /privacidad /cancelar", async () => {
    const { handler } = await makeHandler();
    const inicio = await handler.handle(inbound({ updateId: 2, text: "/inicio" }));
    assert.match(inicio[0]?.text ?? "", /Contame qué trabajo/i);
    const ayuda = await handler.handle(inbound({ updateId: 3, text: "/ayuda" }));
    assert.match(ayuda[0]?.text ?? "", /presupuesto/i);
    const priv = await handler.handle(inbound({ updateId: 4, text: "/privacidad" }));
    assert.match(priv[0]?.text ?? "", /localmente/i);
    const cancel = await handler.handle(inbound({ updateId: 5, text: "/cancelar" }));
    assert.match(cancel[0]?.text ?? "", /Cancelé/i);
  });

  it("multiturno conserva draft; /presupuesto sin perfil no muestra importes", async () => {
    const { handler, localStore } = await makeHandler();
    const turns = [
      "/inicio",
      "Tengo un casamiento en Rosario.",
      "Son ocho horas.",
      "Perdón, al final son diez horas.",
      "Es el 20 de noviembre de 2026.",
    ];
    let n = 100;
    for (const text of turns) {
      const out = await handler.handle(inbound({ updateId: n++, text }));
      assert.ok(out[0]?.text);
      const joined = out.map((o) => o.text).join("\n");
      assert.equal(/recommendedBusiness|breakdown/i.test(joined), false);
    }

    const estado = await handler.handle(inbound({ updateId: n++, text: "/estado" }));
    assert.match(estado[0]?.text ?? "", /Rosario|Casamiento|10/i);

    const budget = await handler.handle(
      inbound({ updateId: n++, text: "/presupuesto" }),
    );
    assert.match(budget[0]?.text ?? "", /Todavía no está configurado tu perfil económico real/i);
    assert.equal(/mínimo|recomendado|ARS|\$\s*\d/i.test(budget[0]?.text ?? ""), false);
    assert.equal(budget[0]?.replyMarkup, undefined);

    const expl = await handler.handle(
      inbound({ updateId: n++, text: "/explicacion" }),
    );
    assert.match(expl[0]?.text ?? "", /Todavía no hay un presupuesto real/i);
    assert.equal(/\$\s*\d|mínimo sostenible/i.test(expl.map((e) => e.text).join(" ")), false);

    const approve = await handler.handle(
      inbound({
        updateId: n++,
        text: "callback:budget:approve",
        isCallback: true,
        callbackData: "budget:approve",
        callbackQueryId: "cq-a",
      }),
    );
    assert.equal(/aprobado/i.test(approve[0]?.text ?? ""), false);

    const fakeClient = new TelegramApiClient({
      botToken: "x",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ ok: true, result: [] }), {
          status: 200,
        })) as typeof fetch,
    });
    const runner = new LongPollingRunner({
      client: fakeClient,
      handler,
      localStore,
      maxCycles: 0,
    });
    const once = await runner.processInboundForTest(
      inbound({ updateId: 9001, text: "/ayuda" }),
    );
    assert.ok(once.length >= 1);
    const twice = await runner.processInboundForTest(
      inbound({ updateId: 9001, text: "/ayuda" }),
    );
    assert.equal(twice.length, 0);
  });

  it("/presupuesto con perfil real válido calcula sin sintético", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dnx-tg-ready-"));
    const profilePath = path.join(dir, "owner.local.json");
    const templatesPath = path.join(dir, "templates.local.json");
    writeFileSync(profilePath, JSON.stringify(createOwnerFacingTestProfile()));
    writeFileSync(templatesPath, JSON.stringify(createSyntheticReadyCatalog()));
    const { handler } = await makeHandler(
      testOwnerIdentity({ profilePath, templatesPath }),
    );
    let n = 200;
    for (const text of [
      "Tengo un casamiento en Rosario el 20 de noviembre de 2026.",
      "Son ocho horas.",
    ]) {
      await handler.handle(inbound({ updateId: n++, text }));
    }
    const budget = await handler.handle(
      inbound({ updateId: n++, text: "/presupuesto" }),
    );
    assert.match(budget[0]?.text ?? "", /Presupuesto listo|Mínimo|mínimo/i);
    assert.equal(/TEST_ONLY_SYNTHETIC|perfil de prueba/i.test(budget[0]?.text ?? ""), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("/presupuesto con perfil sintético en disco se bloquea", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dnx-tg-synth-"));
    const profilePath = path.join(dir, "synth.local.json");
    const templatesPath = path.join(dir, "templates.local.json");
    writeFileSync(
      profilePath,
      JSON.stringify(
        createSyntheticReadyProfile({
          id: SYNTHETIC_PROFILE_ID,
          name: "TEST_ONLY_SYNTHETIC_PROFILE",
        }),
      ),
    );
    writeFileSync(templatesPath, JSON.stringify(createSyntheticReadyCatalog()));
    const { handler } = await makeHandler(
      testOwnerIdentity({ profilePath, templatesPath }),
    );
    const budget = await handler.handle(
      inbound({ updateId: 301, text: "/presupuesto" }),
    );
    assert.match(budget[0]?.text ?? "", /perfil de prueba/i);
    assert.equal(/Mínimo sostenible|recomendado/i.test(budget[0]?.text ?? ""), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("identity mismatch no calcula", async () => {
    const { handler } = await makeHandler(
      testOwnerIdentity({ telegramOwnerUserId: "999" }),
    );
    const budget = await handler.handle(
      inbound({ updateId: 302, text: "/presupuesto" }),
    );
    assert.match(budget[0]?.text ?? "", /asociar este chat|perfil económico/i);
  });

  it("invalida presupuesto sintético previo y conserva draft", async () => {
    const localStore = new TelegramLocalStore(new InMemoryConversationStore());
    const conversationId = buildTelegramIdentity(
      inbound({ updateId: 1, text: "x" }),
    ).internalConversationId;
    const now = new Date().toISOString();
    await localStore.memory.set({
      id: conversationId,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      quoteRequestDraft: {
        serviceType: "WEDDING",
        city: "Rosario",
        eventDate: "2026-11-20",
        durationHours: 8,
      },
      pricingResult: {
        status: "READY",
        approvalStatus: "NOT_REVIEWED",
        warnings: [],
        profileVersion: "test-1",
        currency: "ARS",
        minimumSustainablePrice: 1,
        recommendedBusinessPrice: 2,
      },
      pricingCacheKey: "test-1:TEST_ONLY_SYNTHETIC_PROFILE",
    });
    await localStore.setFlags("222", { lastBudgetStatus: "READY" });
    await localStore.addReview({
      conversationId,
      chatId: "222",
      verdict: "APPROVED",
    });

    const result = await invalidateSyntheticBudgets(localStore);
    assert.ok(result.conversationsTouched >= 1);
    const stored = await localStore.memory.get(conversationId);
    assert.equal(stored?.pricingResult, undefined);
    assert.equal(stored?.quoteRequestDraft?.city, "Rosario");
    assert.equal(stored?.quoteRequestDraft?.serviceType, "WEDDING");
    const flags = localStore.getFlags("222");
    assert.equal(flags.budgetInvalidated, true);
    assert.match(flags.budgetInvalidatedMessage ?? "", /invalidado/i);
  });

  it("roles: entra CLIENT por NL, bloquea presupuesto, sale a OWNER", async () => {
    const { handler, localStore } = await makeHandler();
    let n = 400;
    const enter = await handler.handle(
      inbound({
        updateId: n++,
        text: "Simulemos una conversación con un cliente.",
      }),
    );
    assert.match(enter[0]?.text ?? "", /cliente real|No mostraré/i);

    const sales = await handler.handle(
      inbound({
        updateId: n++,
        text: "Hola. Me caso en Rosario. ¿Qué me podés ofrecer?",
      }),
    );
    assert.equal(/m[ií]nimo sostenible|recomendado/i.test(sales[0]?.text ?? ""), false);

    const budget = await handler.handle(
      inbound({ updateId: n++, text: "/presupuesto" }),
    );
    assert.match(budget[0]?.text ?? "", /simulación de cliente/i);

    const exit = await handler.handle(
      inbound({ updateId: n++, text: "Terminemos la simulación." }),
    );
    assert.match(exit[0]?.text ?? "", /modo propietario/i);

    const identity = buildTelegramIdentity(
      inbound({ updateId: n, text: "x" }),
    );
    const stored = await localStore.memory.get(identity.internalConversationId);
    assert.equal(stored?.roleState?.role, "OWNER");
    assert.equal(stored?.quoteRequestDraft?.city, "Rosario");
  });

  it("laboratorio: sintético solo con opt-in y advertencia", async () => {
    const store = new InMemoryConversationStore();
    const api = new PricingReviewLabApi(store);
    const session = {
      id: "lab-s1",
      participantFrom: "lab-test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      styleEngine: "dani-conversation-v1" as const,
      turns: [],
      humanReviews: [],
      humanVisualReviews: [],
    };
    api.setAllowSynthetic("lab-s1", false);
    const blocked = await api.calculate(session);
    assert.ok(
      blocked.review.status === "NOT_CONFIGURED" ||
        blocked.configSource !== "SYNTHETIC",
    );
    assert.equal(blocked.syntheticBanner, undefined);

    api.setAllowSynthetic("lab-s1", true);
    const synth = await api.calculate(session);
    assert.equal(synth.configSource, "SYNTHETIC");
    assert.match(synth.syntheticBanner ?? "", /PERFIL SINTÉTICO DE PRUEBA/);
    assert.throws(() =>
      api.reviewExplanation(session, { verdict: "APPROVED" }),
    );
  });

  it("necesita ajuste captura feedback sin mezclar cotización", async () => {
    const { handler } = await makeHandler();
    await handler.handle(
      inbound({
        updateId: 50,
        text: "callback:budget:adjust",
        isCallback: true,
        callbackData: "budget:adjust",
        callbackQueryId: "cq-b",
      }),
    );
    const ask = await handler.handle(
      inbound({
        updateId: 51,
        text: "callback:budget:adjust",
        isCallback: true,
        callbackData: "budget:adjust",
        callbackQueryId: "cq-c",
      }),
    );
    assert.match(ask[0]?.text ?? "", /cambiarías|poco claro/i);
    const fb = await handler.handle(
      inbound({ updateId: 52, text: "La explicación es muy larga." }),
    );
    assert.match(fb[0]?.text ?? "", /feedback/i);
  });

  it("polling stop + SIGTERM pattern", async () => {
    let calls = 0;
    const client = new TelegramApiClient({
      botToken: "x",
      fetchImpl: (async () => {
        calls += 1;
        return new Response(JSON.stringify({ ok: true, result: [] }), {
          status: 200,
        });
      }) as typeof fetch,
    });
    const localStore = new TelegramLocalStore(new InMemoryConversationStore());
    const handler = new TelegramChannelHandler({
      config: authorizedConfig(),
      localStore,
    });
    const runner = new LongPollingRunner({
      client,
      handler,
      localStore,
      pollTimeoutSeconds: 0,
      sleep: async () => undefined,
      maxCycles: 2,
    });
    const runPromise = runner.run();
    runner.stop();
    await runPromise;
    assert.equal(runner.isStopped, true);
    assert.ok(calls >= 0);
  });

  it("API client maneja 429", async () => {
    const client = new TelegramApiClient({
      botToken: "x",
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            ok: false,
            description: "Too Many Requests",
            parameters: { retry_after: 3 },
          }),
          { status: 429 },
        )) as typeof fetch,
    });
    const result = await client.getUpdates();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 429);
      assert.equal(result.retryAfterSeconds, 3);
    }
  });
});
