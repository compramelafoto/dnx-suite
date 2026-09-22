import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  buildDiplomaEmail,
  classifyDiplomaEmailSendFailure,
  enqueueEditionDiplomaEmails,
  previewDiplomaEmailBatch,
  requeueDiplomaEmail,
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
  it("arma la URL pública vía /api/media para una key de diploma real", () => {
    const key =
      "clickaton/participant-cards/edition-ed1/registration-reg1/diploma/v1/abc123.png";
    const url = resolveDiplomaImageUrl(key);
    assert.equal(url, `https://maratonfotografica.com/api/media/${key}`);
  });

  it("nunca arma una URL para una key fuera de la lista blanca (welcome, member, o el pdf del diploma)", () => {
    assert.equal(
      resolveDiplomaImageUrl(
        "clickaton/participant-cards/edition-ed1/registration-reg1/welcome/v1/abc123.png"
      ),
      null
    );
    assert.equal(
      resolveDiplomaImageUrl(
        "clickaton/participant-cards/edition-ed1/registration-reg1/diploma/v1/abc123.pdf"
      ),
      null
    );
    assert.equal(resolveDiplomaImageUrl("clickaton/private/algo.png"), null);
  });

  it("sin storageKey no hay URL", () => {
    assert.equal(resolveDiplomaImageUrl(null), null);
    assert.equal(resolveDiplomaImageUrl(undefined), null);
    assert.equal(resolveDiplomaImageUrl(""), null);
  });
});

describe("classifyDiplomaEmailSendFailure", () => {
  it("un rechazo explícito de Resend (4xx) es REJECTED", () => {
    assert.equal(
      classifyDiplomaEmailSendFailure("Resend HTTP 422: dirección inválida"),
      "REJECTED"
    );
    assert.equal(classifyDiplomaEmailSendFailure("Resend HTTP 400: bad request"), "REJECTED");
  });

  it("un 5xx de Resend es transitorio, no un rechazo", () => {
    assert.equal(classifyDiplomaEmailSendFailure("Resend HTTP 500: internal error"), "TRANSIENT");
    assert.equal(classifyDiplomaEmailSendFailure("Resend HTTP 503: unavailable"), "TRANSIENT");
  });

  it("un fallo de red, sin respuesta de Resend, es transitorio", () => {
    assert.equal(classifyDiplomaEmailSendFailure("fetch failed"), "TRANSIENT");
    assert.equal(classifyDiplomaEmailSendFailure("ETIMEDOUT"), "TRANSIENT");
    assert.equal(classifyDiplomaEmailSendFailure(undefined), "TRANSIENT");
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

  it("un diploma ya enviado no pierde su estado aunque después le vacíen el email", async () => {
    const marcados: string[] = [];
    const out = await enqueueEditionDiplomaEmails("ed_1", {
      loadIssued: async () => [
        // Se mandó, y en algún momento posterior la inscripción se quedó sin email.
        { id: "d1", registrationId: "r1", email: "", emailStatus: "SENT" },
      ],
      enqueue: async () => {},
      markNoEmail: async (id: string) => {
        marcados.push(id);
      },
    });
    assert.deepEqual(marcados, [], "no debería tocar un diploma que no está NOT_SENT");
    assert.equal(out.withoutEmail, 0);
    assert.equal(out.alreadySent, 1);
  });
});

describe("previewDiplomaEmailBatch", () => {
  it("cuenta lo mismo que después va a encolar/marcar enqueueEditionDiplomaEmails", () => {
    const rows = [
      { email: "ana@example.test", emailStatus: "NOT_SENT" },
      { email: "", emailStatus: "NOT_SENT" },
      { email: "beto@example.test", emailStatus: "SENT" },
      { email: "", emailStatus: "BOUNCED" },
    ];
    assert.deepEqual(previewDiplomaEmailBatch(rows), { pending: 1, withoutEmail: 1 });
  });

  it("no cuenta nada sobre una lista vacía", () => {
    assert.deepEqual(previewDiplomaEmailBatch([]), { pending: 0, withoutEmail: 0 });
  });
});

describe("requeueDiplomaEmail", () => {
  it("reencola un diploma rebotado", async () => {
    const requeued: Array<[string, string]> = [];
    const out = await requeueDiplomaEmail("d1", {
      loadDiploma: async () => ({ id: "d1", editionId: "ed_1", emailStatus: "BOUNCED" }),
      requeue: async (diplomaId, editionId) => {
        requeued.push([diplomaId, editionId]);
      },
    });
    assert.deepEqual(out, { ok: true });
    assert.deepEqual(requeued, [["d1", "ed_1"]]);
  });

  it("reencola un evento que quedó DEAD (agotó los reintentos automáticos)", async () => {
    const requeued: string[] = [];
    const out = await requeueDiplomaEmail("d1", {
      loadDiploma: async () => ({ id: "d1", editionId: "ed_1", emailStatus: "QUEUED" }),
      requeue: async (diplomaId) => {
        requeued.push(diplomaId);
      },
    });
    assert.equal(out.ok, true);
    assert.deepEqual(requeued, ["d1"]);
  });

  it("no reenvía uno que ya se mandó", async () => {
    const requeued: string[] = [];
    const out = await requeueDiplomaEmail("d1", {
      loadDiploma: async () => ({ id: "d1", editionId: "ed_1", emailStatus: "SENT" }),
      requeue: async (diplomaId) => {
        requeued.push(diplomaId);
      },
    });
    assert.deepEqual(out, { ok: false, reason: "ALREADY_SENT" });
    assert.deepEqual(requeued, []);
  });

  it("un diploma inexistente no revienta", async () => {
    const out = await requeueDiplomaEmail("no_existe", {
      loadDiploma: async () => null,
      requeue: async () => {},
    });
    assert.deepEqual(out, { ok: false, reason: "DIPLOMA_NOT_FOUND" });
  });
});
