import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIPLOMA_QUEUE_MAX_ATTEMPTS,
  buildDiplomaQueueRenderHash,
  decidirCierreDeIntento,
  enqueueDiplomaQueueRow,
  enqueueEditionDiplomas,
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
