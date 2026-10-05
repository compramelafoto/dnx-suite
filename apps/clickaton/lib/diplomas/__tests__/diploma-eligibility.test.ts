import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAccredited, selectDiplomaCandidates } from "@/lib/diplomas/diploma-eligibility";

const row = (over: Partial<Parameters<typeof selectDiplomaCandidates>[0][number]> = {}) => ({
  id: "reg_1",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.test",
  visibleCode: "CK1-0042",
  checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
  ...over,
});

describe("isAccredited", () => {
  it("es cierto con un check-in vigente", () => {
    assert.equal(isAccredited([{ reversedAt: null }]), true);
  });

  it("es falso sin check-ins", () => {
    assert.equal(isAccredited([]), false);
  });

  it("es falso si el único check-in fue revertido", () => {
    assert.equal(isAccredited([{ reversedAt: new Date() }]), false);
  });

  it("es cierto si hay uno revertido y otro vigente", () => {
    assert.equal(
      isAccredited([{ reversedAt: new Date() }, { reversedAt: null }]),
      true
    );
  });
});

describe("selectDiplomaCandidates", () => {
  it("deja pasar al acreditado", () => {
    const out = selectDiplomaCandidates([row()]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.registrationId, "reg_1");
    assert.equal(out[0]?.accreditedAt.toISOString(), "2026-09-19T19:30:00.000Z");
  });

  it("descarta al no acreditado y al revertido", () => {
    const out = selectDiplomaCandidates([
      row({ id: "reg_2", checkIns: [] }),
      row({ id: "reg_3", checkIns: [{ checkedInAt: new Date(), reversedAt: new Date() }] }),
    ]);
    assert.equal(out.length, 0);
  });

  it("un participante con dos check-ins da un solo candidato", () => {
    const out = selectDiplomaCandidates([
      row({
        checkIns: [
          { checkedInAt: new Date("2026-09-19T20:00:00Z"), reversedAt: null },
          { checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null },
        ],
      }),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.accreditedAt.toISOString(), "2026-09-19T19:30:00.000Z");
  });

  // La elegibilidad se define sólo por acreditación vigente, sin considerar pago.
});
