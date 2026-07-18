import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractServiceType } from "./extract-service-type.js";

describe("extractServiceType", () => {
  it("detecta WEDDING", () => {
    assert.equal(extractServiceType("presupuesto para un casamiento"), "WEDDING");
    assert.equal(extractServiceType("cobertura de boda"), "WEDDING");
  });

  it("prioriza FIFTEENTH_BIRTHDAY sobre BIRTHDAY", () => {
    assert.equal(extractServiceType("cumpleaños de 15"), "FIFTEENTH_BIRTHDAY");
    assert.equal(extractServiceType("fiesta de quince años"), "FIFTEENTH_BIRTHDAY");
    assert.equal(extractServiceType("fiesta de cumpleaños"), "BIRTHDAY");
  });

  it("no confunde 15 personas con quinceañera", () => {
    assert.notEqual(extractServiceType("presupuesto para 15 personas en un evento"), "FIFTEENTH_BIRTHDAY");
  });

  it("detecta CORPORATE, FAMILY, PRODUCT, SCHOOL, SPORTS", () => {
    assert.equal(extractServiceType("evento corporativo"), "CORPORATE_EVENT");
    assert.equal(extractServiceType("sesión familiar"), "FAMILY_SESSION");
    assert.equal(extractServiceType("fotos de producto"), "PRODUCT_PHOTOGRAPHY");
    assert.equal(extractServiceType("fotografía escolar"), "SCHOOL_PHOTOGRAPHY");
    assert.equal(extractServiceType("partido de fútbol"), "SPORTS_EVENT");
  });

  it("detecta OTHER y deja UNKNOWN/ausente en ambiguos", () => {
    assert.equal(
      extractServiceType("presupuesto de fotos para un proyecto artístico experimental"),
      "OTHER",
    );
    assert.equal(extractServiceType("asdf qwerty"), undefined);
  });
});
