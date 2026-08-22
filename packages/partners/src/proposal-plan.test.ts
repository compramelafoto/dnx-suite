import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProposalPlan } from "./proposal-plan";

const marca = {
  brandName: "Óptica Demostración",
  industry: "Salud visual",
  plate: { plate: "LIGHT" as const, reason: "El logo es oscuro." },
};

describe("armado del plan de propuesta", () => {
  it("genera una línea por cada pieza del catálogo", () => {
    const plan = buildProposalPlan(marca);
    assert.equal(plan.lines.length, 9);
  });

  it("todas las líneas nacen incluidas, con cantidad uno y sin precio", () => {
    const plan = buildProposalPlan(marca);
    for (const line of plan.lines) {
      assert.equal(line.selection, "INCLUDED");
      assert.equal(line.quantity, 1);
      assert.equal(line.unitPriceMinor, null);
      assert.equal(line.currency, null);
      assert.equal(line.kind, "DIGITAL_PLACEMENT");
    }
  });

  it("ordena las líneas por el orden del catálogo", () => {
    const plan = buildProposalPlan(marca);
    const orders = plan.lines.map((l) => l.sortOrder);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  });

  it("la etiqueta combina pieza y plataforma", () => {
    const plan = buildProposalPlan(marca);
    const primera = plan.lines[0];
    assert.equal(primera.label, "Placa de bienvenida · InfoSpot");
  });

  it("conserva la marca y el tratamiento de placa", () => {
    const plan = buildProposalPlan(marca);
    assert.equal(plan.brandName, "Óptica Demostración");
    assert.equal(plan.plate.plate, "LIGHT");
  });

  it("recorta espacios del nombre y rechaza el vacío", () => {
    assert.equal(buildProposalPlan({ ...marca, brandName: "  Acme  " }).brandName, "Acme");
    assert.throws(() => buildProposalPlan({ ...marca, brandName: "   " }));
  });

  it("permite excluir piezas por id", () => {
    const plan = buildProposalPlan({ ...marca, excludePieceIds: ["clf-banner"] });
    assert.equal(plan.lines.length, 8);
    assert.ok(!plan.lines.some((l) => l.pieceId === "clf-banner"));
  });
});
