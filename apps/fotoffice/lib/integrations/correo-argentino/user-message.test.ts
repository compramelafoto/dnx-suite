import { describe, expect, it } from "vitest";
import { MiCorreoError } from "./errors";
import { maskCustomerId, miCorreoUserMessage } from "./user-message";

describe("miCorreoUserMessage", () => {
  it("BUSINESS repite el texto de Correo", () => {
    const e = new MiCorreoError("BUSINESS", "Usuario no valido o inexistente", 402);
    expect(miCorreoUserMessage(e)).toBe("Correo Argentino rechazó el pedido: Usuario no valido o inexistente");
  });

  it("los demás tipos tienen texto fijo y no repiten el mensaje interno", () => {
    for (const kind of ["AUTH", "RATE_LIMIT", "NETWORK", "UNEXPECTED"] as const) {
      const texto = miCorreoUserMessage(new MiCorreoError(kind, "detalle-interno"));
      expect(texto).not.toContain("detalle-interno");
      expect(texto).toContain("Correo Argentino");
    }
  });
});

describe("maskCustomerId", () => {
  it("deja ver sólo los últimos 4", () => {
    expect(maskCustomerId("0001234567")).toBe("••••••4567");
    expect(maskCustomerId("12345")).toBe("•2345");
    expect(maskCustomerId("123")).toBe("•••");
  });
});
