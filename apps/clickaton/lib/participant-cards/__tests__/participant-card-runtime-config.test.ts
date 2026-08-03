import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { validateParticipantCardsRuntimeConfig } from "../participant-card-runtime-config";

const KEYS = [
  "CLICKATON_PARTICIPANT_CARDS_V2_ENABLED",
  "CLICKATON_PARTICIPANT_CARDS_V2_ADMIN_ENABLED",
  "CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED",
  "CLICKATON_CARD_RENDER_PROVIDER",
  "CLICKATON_CARD_REMOTE_RENDER_URL",
  "DNX_TEMPLATE_RENDER_HMAC_SECRET",
  "DNX_RENDER_HMAC_SECRET",
  "CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER",
  "CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX",
  "R2_BUCKET",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "DNX_ENVIRONMENT",
  "VERCEL_ENV",
  "VERCEL_PROJECT_NAME",
  "CLICKATON_PUBLIC_URL",
] as const;

const saved: Record<string, string | undefined> = {};

describe("validateParticipantCardsRuntimeConfig", () => {
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ADMIN_ENABLED = "false";
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("passes when V2 off", () => {
    const r = validateParticipantCardsRuntimeConfig();
    assert.equal(r.ok, true);
  });

  it("fails when V2 on without persistence", () => {
    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED = "true";
    const r = validateParticipantCardsRuntimeConfig();
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === "V2_WITHOUT_PERSISTENCE"));
  });

  it("fails remote without URL/HMAC", () => {
    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED = "true";
    process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED = "true";
    process.env.CLICKATON_CARD_RENDER_PROVIDER = "remote";
    process.env.CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER = "local";
    const r = validateParticipantCardsRuntimeConfig();
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === "REMOTE_WITHOUT_URL"));
    assert.ok(r.issues.some((i) => i.code === "REMOTE_WITHOUT_HMAC"));
  });

  it("fails R2 without credentials", () => {
    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED = "true";
    process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED = "true";
    process.env.CLICKATON_CARD_RENDER_PROVIDER = "local";
    process.env.CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER = "r2";
    const r = validateParticipantCardsRuntimeConfig();
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === "R2_WITHOUT_BUCKET"));
    assert.ok(r.issues.some((i) => i.code === "R2_WITHOUT_CREDENTIALS"));
  });

  it("fails productive prefix on staging-like runtime", () => {
    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED = "true";
    process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED = "true";
    process.env.CLICKATON_CARD_RENDER_PROVIDER = "local";
    process.env.CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER = "local";
    process.env.DNX_ENVIRONMENT = "staging";
    process.env.CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX =
      "clickaton/participant-cards";
    const r = validateParticipantCardsRuntimeConfig();
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === "PREFIX_PRODUCTIVE_ON_STAGING"));
  });

  it("accepts DNX_RENDER_HMAC_SECRET alias", () => {
    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED = "true";
    process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED = "true";
    process.env.CLICKATON_CARD_RENDER_PROVIDER = "remote";
    process.env.CLICKATON_CARD_REMOTE_RENDER_URL =
      "https://worker.example/internal/template-render";
    process.env.DNX_RENDER_HMAC_SECRET = "x".repeat(40);
    process.env.CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER = "local";
    process.env.CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX =
      "clickaton-staging/participant-cards";
    const r = validateParticipantCardsRuntimeConfig();
    assert.equal(r.ok, true, JSON.stringify(r.issues));
  });
});
