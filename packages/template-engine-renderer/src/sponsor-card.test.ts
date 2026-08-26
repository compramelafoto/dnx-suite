import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSponsorThankYouTemplateData,
  resolveSponsorThankYouDocument,
} from "./sponsor-card";

const BASE = {
  sponsor: { name: "Óptica Del Centro", message: "Gracias." },
  program: { productLabel: "Clickatón", name: "Clickatón Córdoba 2026" },
};

describe("buildSponsorThankYouTemplateData", () => {
  it("combina fecha y ciudad en metaLine", () => {
    const data = buildSponsorThankYouTemplateData({
      ...BASE,
      program: { ...BASE.program, dateFormatted: "11 DE OCTUBRE", city: "Córdoba" },
    });
    assert.equal(data["program.metaLine"], "11 DE OCTUBRE · Córdoba");
  });

  it("sin ciudad no deja el separador colgando", () => {
    const data = buildSponsorThankYouTemplateData({
      ...BASE,
      program: { ...BASE.program, dateFormatted: "20 DE SEPTIEMBRE", city: "" },
    });
    assert.equal(data["program.metaLine"], "20 DE SEPTIEMBRE");
  });

  it("sin fecha ni ciudad queda vacío y el bloque no se dibuja", () => {
    const data = buildSponsorThankYouTemplateData(BASE);
    assert.equal(data["program.metaLine"], "");
  });

  it("expone los datos anidados y aplanados", () => {
    const data = buildSponsorThankYouTemplateData(BASE);
    assert.equal(data["sponsor.name"], "Óptica Del Centro");
    assert.equal(
      (data.sponsor as { name: string }).name,
      "Óptica Del Centro"
    );
  });
});

describe("resolveSponsorThankYouDocument", () => {
  it("resuelve ambos productos sin errores de plantilla", () => {
    for (const product of ["clickaton", "fotorank"] as const) {
      const resolved = resolveSponsorThankYouDocument({
        product,
        data: {
          ...BASE,
          program: { ...BASE.program, dateFormatted: "11 DE OCTUBRE", city: "Córdoba" },
        },
      });
      assert.equal(resolved.document.width, 1080);
      assert.equal(resolved.document.height, 1920);
      assert.ok(resolved.templateKey.includes("SPONSOR_THANKYOU"));
    }
  });

  it("un logo vacío no rompe la resolución", () => {
    const resolved = resolveSponsorThankYouDocument({
      product: "clickaton",
      data: { ...BASE, sponsor: { ...BASE.sponsor, logoUrl: "" } },
    });
    assert.ok(resolved.document.blocks.length > 0);
  });
});
