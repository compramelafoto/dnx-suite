import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildDiplomaEmail,
  enqueueEditionDiplomaEmails,
  resolveDiplomaEmailRecipient,
  resolveDiplomaImageUrl,
} from "@/lib/diplomas/diploma-email";

describe("buildDiplomaEmail", () => {
  it("nombra al participante y a la edición", () => {
    const mail = buildDiplomaEmail({
      participantName: "Ana",
      editionName: "1ª Edición",
      accountUrl: "https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1",
      diplomaImageUrl: "https://cdn.example/diploma.png",
    });
    assert.ok(mail.subject.includes("diploma"));
    assert.ok(mail.html.includes("Ana"));
    assert.ok(mail.html.includes("1ª Edición"));
    assert.ok(mail.html.includes("mi-cuenta/inscripciones/reg_1"));
  });

  it("el texto plano también lleva el enlace", () => {
    const mail = buildDiplomaEmail({
      participantName: "Ana",
      editionName: "1ª Edición",
      accountUrl: "https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1",
      diplomaImageUrl: "https://cdn.example/diploma.png",
    });
    assert.ok(mail.text.includes("https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1"));
  });

  it("muestra el diploma como imagen inline, no como adjunto", () => {
    const mail = buildDiplomaEmail({
      participantName: "Ana",
      editionName: "1ª Edición",
      accountUrl: "https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1",
      diplomaImageUrl: "https://cdn.example/diploma.png",
    });
    assert.ok(mail.html.includes('<img src="https://cdn.example/diploma.png"'));
    // El tipo de retorno sólo tiene subject/text/html: no hay dónde poner un adjunto.
    assert.deepEqual(Object.keys(mail).sort(), ["html", "subject", "text"]);
  });

  it("escapa el nombre del participante en el html", () => {
    const mail = buildDiplomaEmail({
      participantName: '<b>Ana "La" & Cía</b>',
      editionName: "1ª Edición",
      accountUrl: "https://maratonfotografica.com/mi-cuenta/inscripciones/reg_1",
      diplomaImageUrl: "https://cdn.example/diploma.png",
    });
    assert.ok(!mail.html.includes("<b>Ana"));
    assert.ok(mail.html.includes("&lt;b&gt;Ana"));
  });
});

describe("resolveDiplomaImageUrl", () => {
  const originalEnv = process.env.R2_PUBLIC_URL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = originalEnv;
  });

  it("arma la URL pública a partir de la storageKey", () => {
    process.env.R2_PUBLIC_URL = "https://cdn.example.com/";
    assert.equal(
      resolveDiplomaImageUrl("clickaton/participant-cards/edition-1/registration-1/diploma/v1/hash.png"),
      "https://cdn.example.com/clickaton/participant-cards/edition-1/registration-1/diploma/v1/hash.png"
    );
  });

  it("sin R2_PUBLIC_URL no hay URL pública posible", () => {
    delete process.env.R2_PUBLIC_URL;
    assert.equal(resolveDiplomaImageUrl("clickaton/participant-cards/x.png"), null);
  });

  it("sin storageKey tampoco hay URL", () => {
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
    assert.equal(resolveDiplomaImageUrl(null), null);
    assert.equal(resolveDiplomaImageUrl(undefined), null);
  });
});

describe("resolveDiplomaEmailRecipient", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "CLICKATON_PUBLIC_URL",
      "CLICKATON_EMAIL_TEST_TO",
      "CLICKATON_EMAIL_ALLOW_ANY",
      "CLICKATON_EMAIL_FALLBACK_TO",
      "VERCEL_ENV",
      "NODE_ENV",
    ]) {
      savedEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("fuera de audiencia production, una dirección .test se respeta", () => {
    process.env.CLICKATON_PUBLIC_URL = "https://clickaton-staging.vercel.app";
    delete process.env.CLICKATON_EMAIL_TEST_TO;
    delete process.env.CLICKATON_EMAIL_ALLOW_ANY;
    assert.equal(resolveDiplomaEmailRecipient("ana@example.test"), "ana@example.test");
  });

  it("fuera de audiencia production, una dirección real cae al fallback", () => {
    process.env.CLICKATON_PUBLIC_URL = "https://clickaton-staging.vercel.app";
    delete process.env.CLICKATON_EMAIL_TEST_TO;
    delete process.env.CLICKATON_EMAIL_ALLOW_ANY;
    delete process.env.CLICKATON_EMAIL_FALLBACK_TO;
    assert.equal(resolveDiplomaEmailRecipient("ana@gmail.com"), "clickaton-funnel-test@example.test");
  });
});

describe("enqueueEditionDiplomaEmails", () => {
  it("encola sólo a los que tienen diploma y dirección", async () => {
    const encolados: string[] = [];
    const out = await enqueueEditionDiplomaEmails("ed_1", {
      loadIssued: async () => [
        { id: "d1", registrationId: "r1", email: "ana@example.test", emailStatus: "NOT_SENT" },
        { id: "d2", registrationId: "r2", email: "", emailStatus: "NOT_SENT" },
        { id: "d3", registrationId: "r3", email: "beto@example.test", emailStatus: "SENT" },
      ],
      enqueue: async (id: string) => {
        encolados.push(id);
      },
      markNoEmail: async () => {},
    });
    assert.deepEqual(encolados, ["d1"]);
    assert.equal(out.withoutEmail, 1);
    assert.equal(out.alreadySent, 1);
    assert.equal(out.queued, 1);
  });

  it("dos clics no reenvían", async () => {
    const enviados = new Set<string>();
    const deps = {
      loadIssued: async () => [
        {
          id: "d1",
          registrationId: "r1",
          email: "ana@example.test",
          emailStatus: enviados.has("d1") ? "QUEUED" : "NOT_SENT",
        },
      ],
      enqueue: async (id: string) => {
        enviados.add(id);
      },
      markNoEmail: async () => {},
    };
    await enqueueEditionDiplomaEmails("ed_1", deps);
    const segunda = await enqueueEditionDiplomaEmails("ed_1", deps);
    assert.equal(segunda.queued, 0);
  });

  it("marca sin dirección a quien no tiene email, sin frenar a los demás", async () => {
    const marcados: string[] = [];
    const encolados: string[] = [];
    const out = await enqueueEditionDiplomaEmails("ed_1", {
      loadIssued: async () => [
        { id: "d1", registrationId: "r1", email: "", emailStatus: "NOT_SENT" },
        { id: "d2", registrationId: "r2", email: "beto@example.test", emailStatus: "NOT_SENT" },
      ],
      enqueue: async (id: string) => {
        encolados.push(id);
      },
      markNoEmail: async (id: string) => {
        marcados.push(id);
      },
    });
    assert.deepEqual(marcados, ["d1"]);
    assert.deepEqual(encolados, ["d2"]);
    assert.equal(out.queued, 1);
    assert.equal(out.withoutEmail, 1);
  });
});
