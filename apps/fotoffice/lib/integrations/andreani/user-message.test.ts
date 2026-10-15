import { describe, expect, it } from "vitest";
import { AndreaniError } from "./errors";
import { andreaniUserMessage, maskAndreaniCode, maskAndreaniUser } from "./user-message";

describe("andreaniUserMessage", () => {
  it("BUSINESS repite el texto de Andreani", () => {
    const e = new AndreaniError("BUSINESS", "Andreani: No se pudo obtener la tarifa", 400);
    expect(andreaniUserMessage(e)).toBe("Andreani rechazó el pedido: Andreani: No se pudo obtener la tarifa");
  });

  it("los demás tipos tienen texto fijo y no repiten el mensaje interno", () => {
    for (const kind of ["AUTH", "RATE_LIMIT", "NETWORK", "UNEXPECTED"] as const) {
      const texto = andreaniUserMessage(new AndreaniError(kind, "detalle-interno"));
      expect(texto).not.toContain("detalle-interno");
      expect(texto).toContain("Andreani");
    }
  });
});

describe("máscaras", () => {
  it("contratos y código de cliente: sólo los últimos 4", () => {
    expect(maskAndreaniCode("300006611")).toBe("•••••6611");
    expect(maskAndreaniCode("CL0003750")).toBe("•••••3750");
    expect(maskAndreaniCode("123")).toBe("•••");
  });

  it("usuario: sólo el comienzo", () => {
    expect(maskAndreaniUser("usuario-api")).toBe("us•••");
    expect(maskAndreaniUser("ab")).toBe("••");
  });
});
