import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProposalPlan } from "./proposal-plan";
import { getProposalPiece } from "./proposal-pieces";
import { listSellableSpaces } from "./inventory";

const marca = {
  brandName: "Óptica Demostración",
  industry: "Salud visual",
  plate: { plate: "LIGHT" as const, reason: "El logo es oscuro." },
  seller: { owner: "PLATFORM" as const },
};

describe("armado del plan de propuesta", () => {
  it("genera una línea por cada pieza que el vendedor puede ofrecer", () => {
    const plan = buildProposalPlan(marca);
    // DNX vende 7 de las 9 piezas: la del concurso es del organizador y la
    // franja de Clickatón está declarada pero todavía no montada.
    assert.equal(plan.lines.length, 7);
    assert.ok(plan.lines.every((l) => l.pieceId !== "fotorank-welcome"));
    assert.ok(plan.lines.every((l) => l.pieceId !== "clickaton-marquee"));
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
      // Sin fotorank-welcome (es del organizador) ni clickaton-marquee
      // (declarado y todavía sin montar), pero conservando el orden del catálogo.
      [
        "infospot-welcome",
        "clickaton-welcome",
        "clf-welcome",
        "infospot-banner",
        "clf-banner",
        "infospot-marquee",
        "clf-marquee",
      ],
    );
  });

  it("la etiqueta combina pieza y plataforma", () => {
    const plan = buildProposalPlan(marca);
    const primera = plan.lines[0];
    assert.ok(primera, "el plan debe tener al menos una línea");
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
    assert.equal(plan.lines.length, 6);
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

describe("el plan respeta quién vende", () => {
  it("un organizador de FotoRank solo recibe la placa de su concurso", () => {
    const plan = buildProposalPlan({
      ...marca,
      seller: { owner: "ORGANIZER", application: "FOTO_RANK" },
    });
    assert.deepEqual(
      plan.lines.map((l) => l.pieceId),
      ["fotorank-welcome"],
    );
  });

  it("un workspace de FotoOffice todavía no tiene nada que ofrecer", () => {
    const plan = buildProposalPlan({ ...marca, seller: { owner: "WORKSPACE" } });
    assert.deepEqual(plan.lines, []);
  });

  it("nunca ofrece un espacio que el vendedor no puede vender", () => {
    for (const owner of ["PLATFORM", "ORGANIZER", "WORKSPACE"] as const) {
      const plan = buildProposalPlan({ ...marca, seller: { owner } });
      const vendibles = new Set(
        listSellableSpaces({ owner }).map((s) => s.placementKey),
      );
      for (const line of plan.lines) {
        assert.ok(vendibles.has(line.placementKey), `${line.placementKey} no es vendible`);
      }
    }
  });
});

describe("el plan respeta el cupo", () => {
  it("sin datos de disponibilidad, no filtra por cupo", () => {
    const plan = buildProposalPlan(marca);
    assert.equal(plan.lines.length, 7);
    assert.deepEqual(plan.unavailable, []);
  });

  it("un espacio sin lugar no entra en la propuesta", () => {
    const plan = buildProposalPlan({
      ...marca,
      availability: {
        INFOSPOT_HOME_TOP: { available: false, nextFreeAt: new Date("2027-03-01T00:00:00Z") },
      },
    });
    assert.ok(plan.lines.every((l) => l.pieceId !== "infospot-banner"));
    assert.equal(plan.lines.length, 6);
  });

  it("dice desde cuándo se libera, que también es información de venta", () => {
    const plan = buildProposalPlan({
      ...marca,
      availability: {
        INFOSPOT_HOME_TOP: { available: false, nextFreeAt: new Date("2027-03-01T00:00:00Z") },
      },
    });
    assert.deepEqual(plan.unavailable, [
      {
        pieceId: "infospot-banner",
        placementKey: "INFOSPOT_HOME_TOP",
        label: "Banner horizontal · InfoSpot",
        nextFreeAt: new Date("2027-03-01T00:00:00Z"),
      },
    ]);
  });

  it("un espacio con lugar entra normalmente", () => {
    const plan = buildProposalPlan({
      ...marca,
      availability: { INFOSPOT_HOME_TOP: { available: true, nextFreeAt: null } },
    });
    assert.ok(plan.lines.some((l) => l.pieceId === "infospot-banner"));
    assert.deepEqual(plan.unavailable, []);
  });

  it("lo que el vendedor no puede vender no aparece como sin lugar", () => {
    const plan = buildProposalPlan({
      ...marca,
      seller: { owner: "ORGANIZER", application: "FOTO_RANK" },
      availability: {
        INFOSPOT_HOME_TOP: { available: false, nextFreeAt: null },
      },
    });
    assert.deepEqual(plan.lines.map((l) => l.pieceId), ["fotorank-welcome"]);
    assert.deepEqual(plan.unavailable, []);
  });
});
