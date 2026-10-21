import { describe, expect, it } from "vitest";
import { promptParaChatGpt } from "./prompt";
import { ENCABEZADO_CSV } from "./csv";

describe("promptParaChatGpt", () => {
  it("lleva el encabezado exacto y el nombre del proveedor", () => {
    const p = promptParaChatGpt("La Isla");
    expect(p).toContain(ENCABEZADO_CSV.join(","));
    expect(p).toContain("Proveedor: La Isla");
    expect(p).toContain("TAPA");
  });
});
