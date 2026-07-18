import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import http from "node:http";
import { createApp } from "../app/create-app.js";
import { InMemoryConversationStore } from "../conversation/in-memory-conversation-store.js";
import type { AppDeps } from "../types/app-deps.js";

async function post(
  port: number,
  from: string,
  message: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = JSON.stringify({ from, message });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/simulate/message",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(text) as Record<string, unknown>,
          });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

describe("HTTP memoria conversacional", () => {
  let server: http.Server;
  let port: number;

  before(async () => {
    const store = new InMemoryConversationStore({ ttlMs: 3_600_000 });
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
    };
    const handler = createApp(deps);
    server = http.createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    port = addr.port;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("mismo from comparte memoria; distinto from no", async () => {
    const a1 = await post(port, "5493000000001", "Quiero presupuesto para un casamiento.");
    assert.equal(a1.status, 200);
    const a2 = await post(port, "5493000000001", "20/09/2026.");
    const draftA = (a2.body.quoteRequest as { draft: { serviceType?: string; eventDate?: string } })
      .draft;
    assert.equal(draftA.serviceType, "WEDDING");
    assert.equal(draftA.eventDate, "2026-09-20");

    const b1 = await post(port, "5493000000002", "Quiero presupuesto para un cumpleaños de 15.");
    const draftB = (b1.body.quoteRequest as { draft: { serviceType?: string } }).draft;
    assert.equal(draftB.serviceType, "FIFTEENTH_BIRTHDAY");

    const raw = JSON.stringify(a2.body);
    assert.equal(raw.includes("5493000000001"), false);
    assert.equal("conversationId" in (a2.body.conversation as object), false);
  });

  it("health ok", async () => {
    const res = await new Promise<{ status: number; body: { ok?: boolean } }>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/health`, (r) => {
        const chunks: Buffer[] = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => {
          resolve({
            status: r.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as { ok?: boolean },
          });
        });
      }).on("error", reject);
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it("415 sin content-type json", async () => {
    const result = await new Promise<{ status: number }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/simulate/message",
          method: "POST",
          headers: { "Content-Length": 2 },
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
        },
      );
      req.on("error", reject);
      req.write("{}");
      req.end();
    });
    assert.equal(result.status, 415);
  });
});
