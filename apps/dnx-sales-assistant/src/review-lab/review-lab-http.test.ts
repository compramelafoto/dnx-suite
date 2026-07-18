import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../app/create-app.js";
import { InMemoryConversationStore } from "../conversation/in-memory-conversation-store.js";
import type { AppDeps } from "../types/app-deps.js";
import { LAB_MAX_MESSAGE_CHARS } from "./session/lab-limits.js";

async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    prev[key] = process.env[key];
    const value = env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

function listen(handler: ReturnType<typeof createApp>): Promise<{
  port: number;
  server: http.Server;
  close: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      assert.ok(addr && typeof addr === "object");
      resolve({
        port: addr.port,
        server,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

async function json(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload,
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body: data };
}

describe("review-lab HTTP", () => {
  it("no registra laboratorio si está deshabilitado", async () => {
    await withEnv(
      {
        DNX_SALES_ASSISTANT_REVIEW_LAB: undefined,
        NODE_ENV: "development",
      },
      async () => {
        const store = new InMemoryConversationStore();
        const deps: AppDeps = {
          config: {
            port: 0,
            environment: "development",
            mode: "simulate",
            serviceName: "dnx-sales-assistant",
            version: "0.1.0",
          },
          store,
          memoryClock: store,
        };
        const app = createApp(deps);
        const srv = await listen(app);
        try {
          const ui = await fetch(`http://127.0.0.1:${srv.port}/review-lab`);
          assert.equal(ui.status, 404);
          const health = await json(srv.port, "GET", "/health");
          assert.equal(health.body.ok, true);
        } finally {
          await srv.close();
        }
      },
    );
  });

  it("bloqueado en production", async () => {
    await withEnv(
      {
        DNX_SALES_ASSISTANT_REVIEW_LAB: "true",
        NODE_ENV: "production",
      },
      async () => {
        const store = new InMemoryConversationStore();
        const deps: AppDeps = {
          config: {
            port: 0,
            environment: "production",
            mode: "simulate",
            serviceName: "dnx-sales-assistant",
            version: "0.1.0",
          },
          store,
          memoryClock: store,
        };
        const app = createApp(deps);
        const srv = await listen(app);
        try {
          const ui = await fetch(`http://127.0.0.1:${srv.port}/review-lab`);
          assert.equal(ui.status, 404);
        } finally {
          await srv.close();
        }
      },
    );
  });

  describe("activado", () => {
    let port = 0;
    let close: () => Promise<void> = async () => undefined;
    let sessionId = "";

    before(async () => {
      process.env.DNX_SALES_ASSISTANT_REVIEW_LAB = "true";
      process.env.NODE_ENV = "test";
      const store = new InMemoryConversationStore();
      const deps: AppDeps = {
        config: {
          port: 0,
          environment: "test",
          mode: "simulate",
          serviceName: "dnx-sales-assistant",
          version: "0.1.0",
        },
        store,
        memoryClock: store,
        pricingRuntime: {
          silentLogs: true,
          resolveConfig: () => ({ status: "UNAVAILABLE", reason: "lab-test" }),
        },
      };
      const app = createApp(deps);
      const srv = await listen(app);
      port = srv.port;
      close = srv.close;
    });

    after(async () => {
      await close();
      delete process.env.DNX_SALES_ASSISTANT_REVIEW_LAB;
    });

    it("sirve UI y crea sesión", async () => {
      const ui = await fetch(`http://127.0.0.1:${port}/review-lab`);
      assert.equal(ui.status, 200);
      const html = await ui.text();
      assert.match(html, /Laboratorio local/);
      const created = await json(port, "POST", "/review-lab/api/session", {});
      assert.equal(created.status, 200);
      sessionId = (created.body.session as { id: string }).id;
      assert.ok(sessionId);
    });

    it("conversación libre multiturno + review + compare sin mutar", async () => {
      const t1 = await json(port, "POST", "/review-lab/api/message", {
        sessionId,
        message: "Che, me salió un casamiento.",
      });
      assert.equal(t1.status, 200);
      const turnsBefore = ((t1.body.session as { turns: unknown[] }).turns).length;

      const cmp = await json(port, "POST", "/review-lab/api/compare", {
        sessionId,
        message: "Es en Rosario.",
      });
      assert.equal(cmp.status, 200);
      assert.ok((cmp.body.legacy as { text: string }).text);
      assert.ok((cmp.body.dani as { text: string }).text);

      const afterCompare = await json(port, "POST", "/review-lab/api/reset", {
        sessionId,
      });
      // reset clears; recreate flow
      assert.equal(afterCompare.status, 200);

      const s2 = await json(port, "POST", "/review-lab/api/session", {
        styleEngine: "dani-conversation-v1",
      });
      sessionId = (s2.body.session as { id: string }).id;

      await json(port, "POST", "/review-lab/api/message", {
        sessionId,
        message: "Quiero presupuesto para un casamiento.",
      });
      const t2 = await json(port, "POST", "/review-lab/api/message", {
        sessionId,
        message: "Rosario.",
      });
      assert.equal(t2.status, 200);
      const turn = t2.body.turn as {
        turnNumber: number;
        diagnostics: {
          daniScore: number;
          knownFields: string[];
          fieldsLearnedThisTurn: string[];
        };
        assistantMessage: string;
      };
      assert.ok(turn.diagnostics.daniScore >= 0);
      assert.ok(turn.assistantMessage.length > 0);
      assert.ok(
        turn.diagnostics.knownFields.includes("CITY") ||
          turn.diagnostics.fieldsLearnedThisTurn.includes("CITY"),
      );

      const review = await json(port, "POST", "/review-lab/api/review", {
        sessionId,
        turnNumber: turn.turnNumber,
        verdict: "APPROVED",
        note: "Está perfecta.",
      });
      assert.equal(review.status, 200);

      const visual = await json(port, "POST", "/review-lab/api/message", {
        sessionId,
        message: "Mostrame ejemplos de fotos deportivas.",
      });
      const vTurn = visual.body.turn as {
        diagnostics: { visualReferenceRequested: boolean; visualNiche?: string };
        assistantMessage: string;
      };
      assert.equal(vTurn.diagnostics.visualReferenceRequested, true);
      assert.equal(vTurn.diagnostics.visualNiche, "fotografía deportiva");
      assert.equal(
        (vTurn.diagnostics as { visualProvider?: string }).visualProvider,
        "LOCAL_CURATED",
      );
      assert.equal(
        (vTurn.diagnostics as { visualAuthorizedCount?: number }).visualAuthorizedCount,
        0,
      );
      assert.match(vTurn.assistantMessage, /referencias autorizadas/i);
      assert.equal(/https?:\/\//.test(vTurn.assistantMessage), false);

      const vList = await json(port, "GET", "/review-lab/api/visual-references");
      assert.equal(vList.status, 200);
      assert.equal(vList.body.provider, "LOCAL_CURATED");

      const exported = await json(port, "POST", "/review-lab/api/export", {
        sessionId,
      });
      assert.equal(exported.status, 200);
      const raw = JSON.stringify(exported.body.export);
      assert.equal(/recommendedBusiness|breakdown|hourlyRate/i.test(raw), false);
      assert.equal(/\/Users\//.test(raw), false);
      assert.ok(turnsBefore >= 1);
    });

    it("lista escenarios y ejecuta uno", async () => {
      const list = await json(port, "GET", "/review-lab/api/scenarios");
      assert.equal(list.status, 200);
      assert.ok(((list.body.scenarios as unknown[]) || []).length >= 25);

      const s = await json(port, "POST", "/review-lab/api/session", {});
      const id = (s.body.session as { id: string }).id;
      await json(port, "POST", "/review-lab/api/scenario/load", {
        sessionId: id,
        scenarioId: "wedding-complete-first-message",
      });
      const run = await json(port, "POST", "/review-lab/api/scenario/run", {
        sessionId: id,
      });
      assert.equal(run.status, 200);
      assert.equal(run.body.passed, true);
    });

    it("rechaza mensaje demasiado largo", async () => {
      const s = await json(port, "POST", "/review-lab/api/session", {});
      const id = (s.body.session as { id: string }).id;
      const res = await json(port, "POST", "/review-lab/api/message", {
        sessionId: id,
        message: "x".repeat(LAB_MAX_MESSAGE_CHARS + 1),
      });
      assert.equal(res.status, 400);
    });

    it("rutas públicas siguen estables", async () => {
      const health = await json(port, "GET", "/health");
      assert.equal(health.body.ok, true);
      const sim = await json(port, "POST", "/simulate/message", {
        from: "5493410000999",
        message: "Hola",
      });
      assert.equal(sim.status, 200);
      assert.equal(sim.body.ok, true);
      assert.equal(
        /recommendedBusiness|breakdown/i.test(JSON.stringify(sim.body)),
        false,
      );
    });

    it("pricing-review lab: importes ocultos y sin leak en público", async () => {
      const s = await json(port, "POST", "/review-lab/api/session", {});
      const id = (s.body.session as { id: string }).id;
      await json(port, "POST", "/review-lab/api/message", {
        sessionId: id,
        message:
          "Tengo un casamiento en Rosario el 20 de noviembre y son ocho horas.",
      });
      const calc = await json(port, "POST", "/review-lab/api/pricing-review/calculate", {
        sessionId: id,
        showInternalAmounts: false,
      });
      assert.equal(calc.status, 200);
      const review = calc.body.review as {
        status: string;
        amountsVisible: boolean;
        result?: { amountsHidden?: boolean; minimumSustainable?: number };
        explanationDani: string;
      };
      assert.ok(["READY", "INCOMPLETE", "NOT_CONFIGURED", "FAILED"].includes(review.status));
      assert.equal(review.amountsVisible, false);
      if (review.result) {
        assert.equal(review.result.amountsHidden, true);
        assert.equal(review.result.minimumSustainable, undefined);
      }
      assert.ok(review.explanationDani.length > 0);

      const human = await json(port, "POST", "/review-lab/api/pricing-review/review", {
        sessionId: id,
        verdict: "NEEDS_ADJUSTMENT",
        code: "PRICING_EXPLANATION_UNCLEAR",
        note: "Test lab",
      });
      assert.equal(human.status, 200);

      const ui = await fetch(`http://127.0.0.1:${port}/review-lab`);
      const html = await ui.text();
      assert.match(html, /Revisión de presupuesto/);
      assert.match(html, /Mostrar valores internos/);
    });
  });
});
