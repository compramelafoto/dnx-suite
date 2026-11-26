import { describe, expect, it } from "vitest";
import { rolSegunRespuesta } from "./rol-al-registrarse";

describe("rolSegunRespuesta", () => {
  it("sí -> fotógrafo, no -> cliente", () => {
    expect(rolSegunRespuesta("si")).toBe("PHOTOGRAPHER");
    expect(rolSegunRespuesta("no")).toBe("CUSTOMER");
  });
  it("sin respuesta o inválida -> null (no se crea la cuenta)", () => {
    expect(rolSegunRespuesta(undefined)).toBeNull();
    expect(rolSegunRespuesta("ADMIN")).toBeNull();
  });
});
