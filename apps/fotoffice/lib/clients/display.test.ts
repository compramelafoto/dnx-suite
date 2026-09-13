import { describe, expect, it } from "vitest";
import { clientDisplayName } from "./display";

describe("clientDisplayName", () => {
  it("una persona se muestra Apellido, Nombre", () => {
    expect(
      clientDisplayName({ kind: "PERSONA", firstName: "Juan", lastName: "Pérez", businessName: null }),
    ).toBe("Pérez, Juan");
  });

  it("una empresa se muestra por su razón social", () => {
    expect(
      clientDisplayName({ kind: "EMPRESA", firstName: null, lastName: null, businessName: "Fotoluz SRL" }),
    ).toBe("Fotoluz SRL");
  });

  it("una persona sin apellido se muestra sólo con el nombre", () => {
    expect(
      clientDisplayName({ kind: "PERSONA", firstName: "Juan", lastName: null, businessName: null }),
    ).toBe("Juan");
  });

  it("sin ningún dato devuelve un texto legible y no una cadena vacía", () => {
    expect(
      clientDisplayName({ kind: "PERSONA", firstName: null, lastName: null, businessName: null }),
    ).toBe("Sin nombre");
  });
});
