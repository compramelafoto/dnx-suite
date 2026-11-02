import { describe, expect, it } from "vitest";
import { codigoDeReferidoParaReportar } from "./referido-suite";

describe("codigoDeReferidoParaReportar", () => {
  it("reporta el código normalizado cuando la cuenta se acaba de crear", () => {
    expect(codigoDeReferidoParaReportar(true, " abc123 ")).toBe("ABC123");
  });
  it("no reporta nada si la cuenta ya existía (sólo inició sesión)", () => {
    expect(codigoDeReferidoParaReportar(false, "ABC123")).toBeNull();
  });
  it("no reporta nada sin cookie o con un código inválido", () => {
    expect(codigoDeReferidoParaReportar(true, undefined)).toBeNull();
    expect(codigoDeReferidoParaReportar(true, null)).toBeNull();
    expect(codigoDeReferidoParaReportar(true, "x")).toBeNull();
    expect(codigoDeReferidoParaReportar(true, "<script>")).toBeNull();
  });
});
