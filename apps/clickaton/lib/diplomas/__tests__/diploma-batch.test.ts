import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enqueueEditionDiplomas, processDueDiplomas } from "@/lib/diplomas/diploma-batch";

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
});
