import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideSuiteReferralOutcome,
  isValidSuiteReferralSecret,
  parseSuiteReferralSignupBody,
  recordSuiteReferralSignup,
} from "./suite-referral-signup";

const valido = {
  platform: "fotoffice",
  code: " bgr4zmhu ",
  externalUserId: "42",
  email: "Nueva@Mail.com ",
  name: "Ana",
};

describe("parseSuiteReferralSignupBody", () => {
  it("normaliza código y email", () => {
    const out = parseSuiteReferralSignupBody(valido);
    assert.ok(out.ok);
    if (!out.ok) return;
    assert.equal(out.input.code, "BGR4ZMHU");
    assert.equal(out.input.email, "nueva@mail.com");
  });

  it("rechaza plataformas que no son de la suite", () => {
    assert.equal(parseSuiteReferralSignupBody({ ...valido, platform: "compramelafoto" }).ok, false);
  });

  it("rechaza códigos con caracteres raros", () => {
    assert.equal(parseSuiteReferralSignupBody({ ...valido, code: "<script>" }).ok, false);
  });

  it("rechaza email inválido", () => {
    assert.equal(parseSuiteReferralSignupBody({ ...valido, email: "no-es-mail" }).ok, false);
  });
});

describe("isValidSuiteReferralSecret", () => {
  it("acepta sólo el secreto exacto", () => {
    assert.equal(isValidSuiteReferralSecret("abc123", "abc123"), true);
    assert.equal(isValidSuiteReferralSecret("abc124", "abc123"), false);
    assert.equal(isValidSuiteReferralSecret("abc", "abc123"), false);
  });

  it("sin secreto configurado no deja pasar a nadie", () => {
    assert.equal(isValidSuiteReferralSecret("", undefined), false);
    assert.equal(isValidSuiteReferralSecret(null, ""), false);
  });
});

describe("decideSuiteReferralOutcome", () => {
  it("código inexistente", () => {
    assert.equal(decideSuiteReferralOutcome(null, "a@b.com"), "CODE_NOT_FOUND");
  });
  it("el referidor no se puede referir a sí mismo", () => {
    assert.equal(decideSuiteReferralOutcome({ email: "A@b.com" }, "a@b.com"), "SELF_REFERRAL");
  });
  it("otra persona queda atribuida", () => {
    assert.equal(decideSuiteReferralOutcome({ email: "x@b.com" }, "a@b.com"), "CREATED");
  });
});

describe("recordSuiteReferralSignup", () => {
  function fakeDb(found: { id: number; ownerUserId: number; ownerUser: { email: string } } | null) {
    const calls: Array<Record<string, unknown>> = [];
    return {
      calls,
      db: {
        referralCode: { findFirst: async () => found },
        suiteReferralSignup: {
          upsert: async (args: { create: Record<string, unknown> }) => {
            calls.push(args.create);
            return { id: 1, outcome: String(args.create.outcome) };
          },
        },
      },
    };
  }

  const input = {
    platform: "fotorank" as const,
    code: "BGR4ZMHU",
    externalUserId: "7",
    email: "nueva@mail.com",
    name: null,
  };

  it("guarda al referidor cuando el código existe", async () => {
    const f = fakeDb({ id: 9, ownerUserId: 403, ownerUser: { email: "ref@mail.com" } });
    const out = await recordSuiteReferralSignup(f.db as never, input);
    assert.equal(out.outcome, "CREATED");
    assert.equal(f.calls[0].referrerUserId, 403);
    assert.equal(f.calls[0].referralCodeId, 9);
  });

  it("deja rastro sin referidor cuando el código no existe", async () => {
    const f = fakeDb(null);
    const out = await recordSuiteReferralSignup(f.db as never, input);
    assert.equal(out.outcome, "CODE_NOT_FOUND");
    assert.equal(f.calls[0].referrerUserId, null);
  });

  it("auto-referido: queda el código pero no el referidor", async () => {
    const f = fakeDb({ id: 9, ownerUserId: 403, ownerUser: { email: "nueva@mail.com" } });
    const out = await recordSuiteReferralSignup(f.db as never, input);
    assert.equal(out.outcome, "SELF_REFERRAL");
    assert.equal(f.calls[0].referrerUserId, null);
  });
});
