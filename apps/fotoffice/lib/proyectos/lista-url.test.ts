import { describe, expect, it } from "vitest";
import { reenviarALista } from "./lista-url";

describe("reenviarALista", () => {
  it("sin otros parámetros va a la lista pelada", () => {
    expect(reenviarALista({ vista: "lista" })).toBe("/proyectos/lista");
  });
  it("conserva el resto de los parámetros y descarta vista", () => {
    expect(reenviarALista({ vista: "lista", circuito: "c1", etapa: ["a", "b"], x: undefined })).toBe(
      "/proyectos/lista?circuito=c1&etapa=a&etapa=b",
    );
  });
});
