import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDiplomaQueueRenderHash,
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
  it("la segunda vez para la misma inscripción choca contra la unicidad y no crea nada", async () => {
    const creadas: Array<{ renderHash: string }> = [];
    const create = async (data: { renderHash: string }) => {
      if (creadas.some((c) => c.renderHash === data.renderHash)) {
        throw { code: "P2002" };
      }
      creadas.push({ renderHash: data.renderHash });
      return { id: "card_1" };
    };

    const primera = await enqueueDiplomaQueueRow(
      { registrationId: "reg_1", editionId: "ed_1" },
      { create }
    );
    const segunda = await enqueueDiplomaQueueRow(
      { registrationId: "reg_1", editionId: "ed_1" },
      { create }
    );

    assert.equal(primera, true);
    assert.equal(segunda, false);
    assert.equal(creadas.length, 1);
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
