import { describe, expect, it } from "vitest";
import { validarProveedor } from "./datos";

describe("validarProveedor", () => {
  it("alcanza con el nombre", () => {
    expect(validarProveedor({ name: "  Fotolag " })).toEqual({
      ok: true,
      valor: { name: "Fotolag", email: null, phone: null, notes: null },
    });
  });

  it("el correo se guarda en minúsculas y tiene que entenderse", () => {
    expect(validarProveedor({ name: "La Isla", email: "Pedidos@LaIsla.com" })).toMatchObject({ ok: true, valor: { email: "pedidos@laisla.com" } });
    expect(validarProveedor({ name: "La Isla", email: "no-es-correo" })).toEqual({ ok: false, error: "Ese correo no se entiende." });
  });

  it("sin nombre no", () => {
    expect(validarProveedor({ name: "  " })).toEqual({ ok: false, error: "Poné el nombre del proveedor." });
  });
});
