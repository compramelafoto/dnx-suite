import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { createClickatonTemplateExampleData } from "@repo/template-engine";
import { resolveClickatonParticipantCardDocument } from "../participant-card-renderer";
import {
  RemoteParticipantCardRenderProvider,
} from "../participant-card-render-provider";
import { ParticipantCardCircuitBreaker } from "../participant-card-circuit-breaker";
import { ClickatonCardError } from "../participant-card-errors";

describe("RemoteParticipantCardRenderProvider", () => {
  let circuit: ParticipantCardCircuitBreaker;
  let document: Awaited<
    ReturnType<typeof resolveClickatonParticipantCardDocument>
  >["document"];

  beforeEach(() => {
    circuit = new ParticipantCardCircuitBreaker({
      failureThreshold: 5,
      halfOpenAfterMs: 30_000,
    });
    const resolved = resolveClickatonParticipantCardDocument({
      cardType: "welcome",
      templateData: createClickatonTemplateExampleData(),
    });
    document = resolved.document;
  });

  it("returns PNG on successful remote response", async () => {
    const fakePng = Buffer.from("fake-png-bytes");
    const provider = new RemoteParticipantCardRenderProvider({
      remoteUrl: "http://worker.test/internal/template-render",
      hmacSecret: "secret",
      circuit,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            pngBase64: fakePng.toString("base64"),
            width: 1080,
            height: 1920,
            durationMs: 12,
            mimeType: "image/png",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
    });

    const result = await provider.render({ document });
    assert.deepEqual(result.png, fakePng);
    assert.equal(result.width, 1080);
    assert.equal(result.height, 1920);
    assert.equal(circuit.getState(), "CLOSED");
  });

  it("retries retryable HTTP statuses and succeeds", async () => {
    let calls = 0;
    const fakePng = Buffer.from("ok");
    const provider = new RemoteParticipantCardRenderProvider({
      remoteUrl: "http://worker.test/internal/template-render",
      hmacSecret: "secret",
      circuit,
      fetchImpl: async () => {
        calls += 1;
        if (calls < 3) {
          return new Response(JSON.stringify({ ok: false, error: "busy" }), {
            status: 503,
          });
        }
        return new Response(
          JSON.stringify({
            ok: true,
            pngBase64: fakePng.toString("base64"),
            width: 1080,
            height: 1920,
            durationMs: 5,
            mimeType: "image/png",
          }),
          { status: 200 }
        );
      },
    });

    const result = await provider.render({ document });
    assert.equal(calls, 3);
    assert.equal(result.png.toString(), "ok");
  });

  it("maps hard failures to cardRenderFailed", async () => {
    const provider = new RemoteParticipantCardRenderProvider({
      remoteUrl: "http://worker.test/internal/template-render",
      hmacSecret: "secret",
      circuit,
      fetchImpl: async () =>
        new Response(JSON.stringify({ ok: false, error: "invalid doc" }), {
          status: 422,
        }),
    });

    await assert.rejects(
      () => provider.render({ document }),
      (err: unknown) =>
        err instanceof ClickatonCardError &&
        err.code === "CLICKATON_CARD_RENDER_FAILED"
    );
  });

  it("maps missing config to cardRenderUnavailable", async () => {
    const provider = new RemoteParticipantCardRenderProvider({
      remoteUrl: "",
      hmacSecret: "",
      circuit,
    });

    await assert.rejects(
      () => provider.render({ document }),
      (err: unknown) =>
        err instanceof ClickatonCardError &&
        err.code === "CLICKATON_CARD_RENDER_UNAVAILABLE"
    );
  });
});
