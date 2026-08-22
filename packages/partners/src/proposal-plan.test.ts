import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProposalPlan } from "./proposal-plan";
import { getProposalPiece } from "./proposal-pieces";

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
    assert.deepEqual(
      plan.lines.map((l) => l.pieceId),
      [
        "infospot-welcome",
        "clickaton-welcome",
        "fotorank-welcome",
        "clf-welcome",
        "infospot-banner",
        "clf-banner",
        "infospot-marquee",
        "clickaton-marquee",
        "clf-marquee",
      ],
    );
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

  it("procesa industry: normal, recortada, nula", () => {
    const plan1 = buildProposalPlan(marca);
    assert.equal(plan1.industry, "Salud visual");

    const plan2 = buildProposalPlan({ ...marca, industry: "  Tecnología  " });
    assert.equal(plan2.industry, "Tecnología");

    const plan3 = buildProposalPlan({ ...marca, industry: "   " });
    assert.equal(plan3.industry, null);

    const plan4 = buildProposalPlan({ ...marca, industry: null });
    assert.equal(plan4.industry, null);

    const plan5 = buildProposalPlan({ ...marca, industry: undefined });
    assert.equal(plan5.industry, null);
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

  it("cada línea deriva sus campos de su pieza", () => {
    const plan = buildProposalPlan(marca);
    for (const line of plan.lines) {
      const pieza = getProposalPiece(line.pieceId);
      assert.ok(pieza, `falta la pieza ${line.pieceId}`);
      assert.equal(line.placementKey, pieza.placementKey, `${line.pieceId}: placementKey`);
      assert.equal(line.location, pieza.location, `${line.pieceId}: location`);
      assert.equal(line.background, pieza.background, `${line.pieceId}: background`);
      assert.equal(line.label, `${pieza.label} · ${pieza.platformLabel}`, `${line.pieceId}: label`);
      assert.equal(line.sortOrder, pieza.sortOrder, `${line.pieceId}: sortOrder`);
    }
  });
});
