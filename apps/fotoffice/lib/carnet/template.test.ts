import { describe, expect, it } from "vitest";
import { readDesignDocument, validateForPublish, type TextMeasurer } from "@repo/design-studio";
import {
  addMonthsUtc,
  carnetDesignDocument,
  CARNET_VALIDITY_MONTHS,
  CARNET_VARIABLE_CONTRACT,
} from "./template";

/** Medidor de prueba, determinista. El real usa la fuente incrustada. */
const medidor: TextMeasurer = {
  widthOf: (texto, _f, _s, sizePt) => texto.length * sizePt * 0.5,
};

describe("plantilla del carnet", () => {
  it("el documento se lee sin errores", () => {
    const r = readDesignDocument(carnetDesignDocument());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sides.map((s) => s.id)).toEqual(["frente", "dorso"]);
    expect(r.value.format.width).toBe(85.6);
  });

  it("la plantilla se puede publicar con su contrato", () => {
    const doc = readDesignDocument(carnetDesignDocument());
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const r = validateForPublish(doc.value, CARNET_VARIABLE_CONTRACT, { measurer: medidor });
    expect(r.errors).toEqual([]);
  });

  it("no deja avisos sin resolver", () => {
    const doc = readDesignDocument(carnetDesignDocument());
    if (!doc.ok) throw new Error(doc.errors.join(" | "));
    const r = validateForPublish(doc.value, CARNET_VARIABLE_CONTRACT, { measurer: medidor });
    expect(r.warnings).toEqual([]);
  });

  it("la foto es obligatoria: un carnet sin foto no identifica", () => {
    const foto = CARNET_VARIABLE_CONTRACT.variables.find((v) => v.key === "photo");
    expect(foto?.required).toBe(true);
  });
});

describe("addMonthsUtc", () => {
  it("dos años son 24 meses", () => {
    expect(CARNET_VALIDITY_MONTHS).toBe(24);
    const emitido = new Date(Date.UTC(2026, 7, 26));
    expect(addMonthsUtc(emitido, 24).toISOString()).toBe("2028-08-26T00:00:00.000Z");
  });

  it("un 31 no cae en un mes que no lo tiene", () => {
    const enero31 = new Date(Date.UTC(2026, 0, 31));
    expect(addMonthsUtc(enero31, 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("respeta el año bisiesto", () => {
    const feb29 = new Date(Date.UTC(2028, 1, 29));
    expect(addMonthsUtc(feb29, 24).toISOString().slice(0, 10)).toBe("2030-02-28");
  });

  it("no depende de la zona horaria del servidor", () => {
    const d = new Date("2026-08-26T23:30:00.000Z");
    expect(addMonthsUtc(d, 24).toISOString()).toBe("2028-08-26T23:30:00.000Z");
  });
});
