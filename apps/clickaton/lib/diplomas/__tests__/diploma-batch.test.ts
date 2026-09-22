import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIPLOMA_EMAIL_RETRY_MAX_ATTEMPTS,
  DIPLOMA_QUEUE_MAX_ATTEMPTS,
  buildDiplomaQueueRenderHash,
  decidirCierreDeIntento,
  decidirReintentoDeCorreo,
  enqueueDiplomaQueueRow,
  enqueueEditionDiplomas,
  processDiplomaEmailEvent,
  processDueDiplomaEmails,
  processDueDiplomas,
} from "@/lib/diplomas/diploma-batch";

describe("enqueueEditionDiplomas", () => {
  it("encola sólo a los acreditados sin diploma", async () => {
    const encolados: string[] = [];
    const out = await enqueueEditionDiplomas("ed_1", {
      loadCandidates: async () => [
        { registrationId: "reg_1", fullName: "Ana", accreditedAt: new Date() },
        { registrationId: "reg_2", fullName: "Beto", accreditedAt: new Date() },
      ],
      loadIssuedRegistrationIds: async () => new Set(["reg_2"]),
      enqueue: async (id: string) => {
        encolados.push(id);
        return true;
      },
    });
    assert.deepEqual(encolados, ["reg_1"]);
    assert.equal(out.queued, 1);
    assert.equal(out.alreadyIssued, 1);
  });

  it("apretar el botón dos veces no duplica nada", async () => {
    const encolados: string[] = [];
    const deps = {
      loadCandidates: async () => [
        { registrationId: "reg_1", fullName: "Ana", accreditedAt: new Date() },
      ],
      loadIssuedRegistrationIds: async () => new Set(encolados),
      enqueue: async (id: string) => {
        encolados.push(id);
        return true;
      },
    };
    await enqueueEditionDiplomas("ed_1", deps);
    const segunda = await enqueueEditionDiplomas("ed_1", deps);
    assert.equal(encolados.length, 1);
    assert.equal(segunda.queued, 0);
  });
});

describe("processDueDiplomas", () => {
  it("emite los pendientes y cuenta los fallos sin cortar el lote", async () => {
    const out = await processDueDiplomas(25, {
      loadPending: async () => [{ registrationId: "reg_1" }, { registrationId: "reg_2" }],
      issue: async ({ registrationId }: { registrationId: string }) =>
        registrationId === "reg_1"
          ? { ok: true as const, diplomaId: "d1", diplomaCode: "c", verificationToken: "t", cardId: "c1", storageKey: "k", reused: false }
          : { ok: false as const, code: "DIPLOMA_TEMPLATE_INVALID" as const, issues: ["x"] },
    });
    assert.equal(out.issued, 1);
    assert.equal(out.failed, 1);
    assert.equal(out.scanned, 2);
  });

  it("no procesa más que el límite pedido", async () => {
    let pedidos = 0;
    await processDueDiplomas(1, {
      loadPending: async (limit: number) => {
        pedidos = limit;
        return [];
      },
      issue: async () => ({ ok: false as const, code: "DIPLOMA_NOT_ACCREDITED" as const, issues: [] }),
    });
    assert.equal(pedidos, 1);
  });

  it("una excepción cruda de issue no corta el resto del lote", async () => {
    const procesados: string[] = [];
    const out = await processDueDiplomas(25, {
      loadPending: async () => [
        { registrationId: "reg_1" },
        { registrationId: "reg_2" },
        { registrationId: "reg_3" },
      ],
      issue: async ({ registrationId }: { registrationId: string }) => {
        procesados.push(registrationId);
        if (registrationId === "reg_2") throw new Error("boom");
        return {
          ok: true as const,
          diplomaId: "d",
          diplomaCode: "c",
          verificationToken: "t",
          cardId: "c",
          storageKey: "k",
          reused: false,
        };
      },
    });
    // Las tres se intentan, aunque la del medio explote: no se corta el lote.
    assert.deepEqual(procesados, ["reg_1", "reg_2", "reg_3"]);
    assert.equal(out.issued, 2);
    assert.equal(out.failed, 1);
    assert.equal(out.scanned, 3);
  });
});

/**
 * El mecanismo real que frena un doble clic (o dos ciclos de cron
 * pisándose) no es el chequeo previo contra `loadIssuedRegistrationIds`
 * (ese sólo sabe de diplomas ya terminados) sino la huella determinística
 * por inscripción chocando contra la unicidad de la base. Estos tests
 * cubren eso directamente, sin pasar por el atajo de deps que usa el test
 * de arriba.
 */
describe("buildDiplomaQueueRenderHash", () => {
  it("es determinístico: misma inscripción, misma huella", () => {
    assert.equal(buildDiplomaQueueRenderHash("reg_1"), buildDiplomaQueueRenderHash("reg_1"));
  });

  it("dos inscripciones distintas dan huellas distintas", () => {
    assert.notEqual(buildDiplomaQueueRenderHash("reg_1"), buildDiplomaQueueRenderHash("reg_2"));
  });
});

describe("enqueueDiplomaQueueRow", () => {
  it("si la fila que ya estaba sigue en curso, no revive nada ni duplica", async () => {
    const creadas: Array<{ renderHash: string }> = [];
    const create = async (data: { renderHash: string }) => {
      if (creadas.some((c) => c.renderHash === data.renderHash)) {
        throw { code: "P2002" };
      }
      creadas.push({ renderHash: data.renderHash });
      return { id: "card_1" };
    };
    // La fila existente sigue GENERATING (no fracasó): no hay nada para revivir.
    const reviveFailed = async () => false;

    const primera = await enqueueDiplomaQueueRow(
      { registrationId: "reg_1", editionId: "ed_1" },
      { create, reviveFailed }
    );
    const segunda = await enqueueDiplomaQueueRow(
      { registrationId: "reg_1", editionId: "ed_1" },
      { create, reviveFailed }
    );

    assert.equal(primera, true);
    assert.equal(segunda, false);
    assert.equal(creadas.length, 1);
  });

  it("si la fila que ya estaba fracasó todas sus veces, la revive en vez de perder el diploma para siempre", async () => {
    const create = async () => {
      throw { code: "P2002" };
    };
    let revividaCon: { registrationId: string; editionId: string } | null = null;
    const reviveFailed = async (input: { registrationId: string; editionId: string }) => {
      revividaCon = input;
      return true;
    };

    const result = await enqueueDiplomaQueueRow(
      { registrationId: "reg_1", editionId: "ed_1" },
      { create, reviveFailed }
    );

    assert.equal(result, true);
    assert.deepEqual(revividaCon, { registrationId: "reg_1", editionId: "ed_1" });
  });

  it("dos inscripciones distintas sí generan dos filas", async () => {
    const creadas: Array<{ renderHash: string }> = [];
    const create = async (data: { renderHash: string }) => {
      if (creadas.some((c) => c.renderHash === data.renderHash)) {
        throw { code: "P2002" };
      }
      creadas.push({ renderHash: data.renderHash });
      return { id: "card" };
    };

    await enqueueDiplomaQueueRow({ registrationId: "reg_1", editionId: "ed_1" }, { create });
    await enqueueDiplomaQueueRow({ registrationId: "reg_2", editionId: "ed_1" }, { create });

    assert.equal(creadas.length, 2);
  });

  it("un error que no es de unicidad no se traga", async () => {
    const create = async () => {
      throw new Error("boom");
    };
    await assert.rejects(
      () => enqueueDiplomaQueueRow({ registrationId: "reg_1", editionId: "ed_1" }, { create }),
      /boom/
    );
  });
});

describe("decidirCierreDeIntento", () => {
  it("antes del tope, vuelve a quedar disponible para el próximo ciclo", () => {
    const decision = decidirCierreDeIntento(0, "DIPLOMA_TEMPLATE_INVALID");
    assert.equal(decision.status, "GENERATING");
    assert.equal(decision.attemptCount, 1);
  });

  it("al llegar al tope, queda fallida", () => {
    const decision = decidirCierreDeIntento(DIPLOMA_QUEUE_MAX_ATTEMPTS - 1, "DIPLOMA_TEMPLATE_INVALID");
    assert.equal(decision.status, "FAILED");
    assert.equal(decision.attemptCount, DIPLOMA_QUEUE_MAX_ATTEMPTS);
  });

  it("el motivo se conserva, antes y después del tope", () => {
    const antes = decidirCierreDeIntento(0, "DIPLOMA_PHOTO_REQUIRED");
    const despues = decidirCierreDeIntento(DIPLOMA_QUEUE_MAX_ATTEMPTS - 1, "DIPLOMA_PHOTO_REQUIRED");
    assert.equal(antes.errorCode, "DIPLOMA_PHOTO_REQUIRED");
    assert.equal(despues.errorCode, "DIPLOMA_PHOTO_REQUIRED");
  });
});

describe("processDueDiplomaEmails", () => {
  it("manda los pendientes y cuenta los rebotes sin cortar el lote", async () => {
    const out = await processDueDiplomaEmails(25, {
      loadPending: async () => [
        { eventId: "ev1", diplomaId: "d1", attempt: 1 },
        { eventId: "ev2", diplomaId: "d2", attempt: 1 },
      ],
      processOne: async ({ diplomaId }) =>
        diplomaId === "d1"
          ? { ok: true as const, status: "SENT" as const }
          : { ok: false as const, status: "BOUNCED" as const, reason: "Resend HTTP 422" },
    });
    assert.equal(out.scanned, 2);
    assert.equal(out.sent, 1);
    assert.equal(out.failed, 1);
  });

  it("no procesa más que el límite pedido", async () => {
    let pedidos = 0;
    await processDueDiplomaEmails(1, {
      loadPending: async (limit: number) => {
        pedidos = limit;
        return [];
      },
      processOne: async () => ({ ok: true as const, status: "SENT" as const }),
    });
    assert.equal(pedidos, 1);
  });

  it("una excepción cruda de processOne no corta el resto del lote", async () => {
    const procesados: string[] = [];
    const out = await processDueDiplomaEmails(25, {
      loadPending: async () => [
        { eventId: "ev1", diplomaId: "d1", attempt: 1 },
        { eventId: "ev2", diplomaId: "d2", attempt: 1 },
      ],
      processOne: async ({ diplomaId }) => {
        procesados.push(diplomaId);
        if (diplomaId === "d1") throw new Error("boom");
        return { ok: true as const, status: "SENT" as const };
      },
    });
    assert.deepEqual(procesados, ["d1", "d2"]);
    assert.equal(out.sent, 1);
    assert.equal(out.failed, 1);
  });

  it("sin dirección, sin diploma vigente, o ya resuelto: no cuenta como fallo", async () => {
    const out = await processDueDiplomaEmails(25, {
      loadPending: async () => [
        { eventId: "ev1", diplomaId: "d1", attempt: 1 },
        { eventId: "ev2", diplomaId: "d2", attempt: 1 },
        { eventId: "ev3", diplomaId: "d3", attempt: 1 },
      ],
      processOne: async ({ diplomaId }) => {
        if (diplomaId === "d1") return { ok: false as const, status: "SKIPPED_NO_EMAIL" as const };
        if (diplomaId === "d2") return { ok: false as const, status: "SKIPPED_REVOKED" as const };
        return { ok: false as const, status: "SKIPPED_ALREADY_RESOLVED" as const };
      },
    });
    assert.equal(out.scanned, 3);
    assert.equal(out.sent, 0);
    assert.equal(out.failed, 0);
  });

  it("una falla recuperable (falta config) se cuenta como fallo, pero queda disponible para reintentar", async () => {
    const out = await processDueDiplomaEmails(25, {
      loadPending: async () => [{ eventId: "ev1", diplomaId: "d1", attempt: 1 }],
      processOne: async () => ({
        ok: false as const,
        status: "RETRY" as const,
        reason: "DIPLOMA_IMAGE_URL_UNAVAILABLE",
      }),
    });
    assert.equal(out.failed, 1);
    assert.equal(out.sent, 0);
  });
});

describe("decidirReintentoDeCorreo", () => {
  it("antes del tope, da una fecha futura para reintentar", () => {
    const decision = decidirReintentoDeCorreo(0);
    assert.equal(decision.status, "FAILED");
    if (decision.status === "FAILED") {
      assert.ok(decision.availableAt.getTime() > Date.now());
    }
  });

  it("el backoff crece con cada intento", () => {
    const primero = decidirReintentoDeCorreo(0);
    const segundo = decidirReintentoDeCorreo(1);
    assert.equal(primero.status, "FAILED");
    assert.equal(segundo.status, "FAILED");
    if (primero.status === "FAILED" && segundo.status === "FAILED") {
      assert.ok(segundo.availableAt.getTime() > primero.availableAt.getTime());
    }
  });

  it("al llegar al tope, queda DEAD en vez de seguir reintentando", () => {
    const decision = decidirReintentoDeCorreo(DIPLOMA_EMAIL_RETRY_MAX_ATTEMPTS);
    assert.deepEqual(decision, { status: "DEAD" });
  });

  it("justo antes del tope, todavía reintenta", () => {
    const decision = decidirReintentoDeCorreo(DIPLOMA_EMAIL_RETRY_MAX_ATTEMPTS - 1);
    assert.equal(decision.status, "FAILED");
  });
});

describe("processDiplomaEmailEvent (el despachador)", () => {
  const baseDiploma = {
    id: "d1",
    emailStatus: "QUEUED",
    revokedAt: null,
    registrationId: "r1",
    email: "ana@example.test",
    participantName: "Ana",
    editionName: "1ª Edición",
    cardStorageKey:
      "clickaton/participant-cards/edition-ed1/registration-r1/diploma/v1/hash123.png",
  };

  function makeDeps(overrides: Record<string, unknown> = {}) {
    const calls = {
      sendEmailInputs: [] as Array<{ to: string; subject: string; text: string; html: string }>,
      markSent: [] as Array<[string, string | null]>,
      markBounced: [] as Array<[string, string]>,
      markNoEmail: [] as string[],
      closeEvent: [] as Array<[string, string | null | undefined]>,
      retryEventLater: [] as Array<[string, number, string]>,
    };
    const deps = {
      loadDiploma: async () => baseDiploma,
      sendEmail: async (input: { to: string; subject: string; text: string; html: string }) => {
        calls.sendEmailInputs.push(input);
        return { sent: true, skipped: false, messageId: "msg_123" };
      },
      markSent: async (diplomaId: string, providerMessageId: string | null) => {
        calls.markSent.push([diplomaId, providerMessageId]);
      },
      markBounced: async (diplomaId: string, reason: string) => {
        calls.markBounced.push([diplomaId, reason]);
      },
      markNoEmail: async (diplomaId: string) => {
        calls.markNoEmail.push(diplomaId);
      },
      closeEvent: async (eventId: string, lastError?: string | null) => {
        calls.closeEvent.push([eventId, lastError]);
      },
      retryEventLater: async (eventId: string, attempt: number, reason: string) => {
        calls.retryEventLater.push([eventId, attempt, reason]);
      },
      ...overrides,
    };
    return { deps, calls };
  }

  it("manda el correo, guarda el messageId del proveedor y cierra el evento", async () => {
    const { deps, calls } = makeDeps();
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.deepEqual(outcome, { ok: true, status: "SENT" });
    assert.equal(calls.sendEmailInputs.length, 1);
    assert.equal(calls.sendEmailInputs.at(0)?.to, "ana@example.test");
    assert.deepEqual(calls.markSent, [["d1", "msg_123"]]);
    assert.deepEqual(calls.closeEvent, [["ev1", undefined]]);
    assert.equal(calls.markBounced.length, 0);
    assert.equal(calls.retryEventLater.length, 0);
  });

  it("un rechazo explícito de Resend (4xx) rebota: BOUNCED, no se reintenta solo", async () => {
    const { deps, calls } = makeDeps({
      sendEmail: async () => ({
        sent: false,
        skipped: false,
        reason: "Resend HTTP 422: dirección inválida",
      }),
    });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.status, "BOUNCED");
    assert.deepEqual(calls.markBounced, [["d1", "Resend HTTP 422: dirección inválida"]]);
    assert.equal(calls.closeEvent.length, 1);
    assert.equal(calls.retryEventLater.length, 0);
    assert.equal(calls.markSent.length, 0);
  });

  it("un fallo de red (sin respuesta de Resend) se reintenta, no rebota", async () => {
    const { deps, calls } = makeDeps({
      sendEmail: async () => ({ sent: false, skipped: false, reason: "fetch failed" }),
    });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 3 }, deps);
    assert.equal(outcome.ok, false);
    assert.equal(outcome.status, "RETRY");
    assert.deepEqual(calls.retryEventLater, [["ev1", 3, "fetch failed"]]);
    assert.equal(calls.markBounced.length, 0);
    assert.equal(calls.closeEvent.length, 0);
  });

  it("un 5xx de Resend se reintenta, no rebota", async () => {
    const { deps, calls } = makeDeps({
      sendEmail: async () => ({ sent: false, skipped: false, reason: "Resend HTTP 500: oops" }),
    });
    await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.equal(calls.retryEventLater.length, 1);
    assert.equal(calls.markBounced.length, 0);
  });

  it("sin RESEND_API_KEY (skipped) se reintenta, no rebota ni cierra el evento", async () => {
    const { deps, calls } = makeDeps({
      sendEmail: async () => ({ sent: false, skipped: true, reason: "RESEND_API_KEY no configurada" }),
    });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.equal(outcome.status, "RETRY");
    assert.deepEqual(calls.retryEventLater, [["ev1", 1, "RESEND_API_KEY no configurada"]]);
    assert.equal(calls.closeEvent.length, 0);
  });

  it("sin storageKey pública para la imagen, se reintenta sin llegar a mandar nada", async () => {
    const { deps, calls } = makeDeps({
      loadDiploma: async () => ({ ...baseDiploma, cardStorageKey: null }),
    });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.equal(outcome.status, "RETRY");
    assert.equal(calls.sendEmailInputs.length, 0, "no debería llegar a mandar nada");
    assert.equal(calls.retryEventLater.length, 1);
  });

  it("un diploma revocado no manda nada y cierra el evento", async () => {
    const { deps, calls } = makeDeps({
      loadDiploma: async () => ({ ...baseDiploma, revokedAt: new Date() }),
    });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.deepEqual(outcome, { ok: false, status: "SKIPPED_REVOKED" });
    assert.equal(calls.sendEmailInputs.length, 0);
    assert.equal(calls.closeEvent.length, 1);
  });

  it("un diploma que ya se resolvió por otro intento no se manda dos veces", async () => {
    const { deps, calls } = makeDeps({
      loadDiploma: async () => ({ ...baseDiploma, emailStatus: "SENT" }),
    });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.deepEqual(outcome, { ok: false, status: "SKIPPED_ALREADY_RESOLVED" });
    assert.equal(calls.sendEmailInputs.length, 0);
  });

  it("sin dirección de correo, marca NO_EMAIL y cierra sin mandar nada", async () => {
    const { deps, calls } = makeDeps({
      loadDiploma: async () => ({ ...baseDiploma, email: null }),
    });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "d1", attempt: 1 }, deps);
    assert.deepEqual(outcome, { ok: false, status: "SKIPPED_NO_EMAIL" });
    assert.deepEqual(calls.markNoEmail, ["d1"]);
    assert.equal(calls.sendEmailInputs.length, 0);
  });

  it("un diploma inexistente cierra el evento sin reventar", async () => {
    const { deps, calls } = makeDeps({ loadDiploma: async () => null });
    const outcome = await processDiplomaEmailEvent({ eventId: "ev1", diplomaId: "no_existe", attempt: 1 }, deps);
    assert.deepEqual(outcome, { ok: false, status: "SKIPPED_ALREADY_RESOLVED" });
    assert.equal(calls.closeEvent.length, 1);
  });
});
