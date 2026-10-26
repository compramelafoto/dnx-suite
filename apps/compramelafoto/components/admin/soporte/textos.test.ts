import { describe, expect, it } from "vitest";
import { describirInput } from "./textos";

describe("describirInput", () => {
  it("muestra qué va a tocar cada acción, en palabras", () => {
    expect(describirInput({ albumId: 3, dias: 30 })).toBe("álbum #3 · 30 días");
    expect(describirInput({ albumId: 3, photoId: 9, sellDigital: false })).toBe("álbum #3 · foto #9 · venta digital: no");
    expect(describirInput({ pedido: 4669 })).toBe("pedido #4669");
    expect(describirInput({ orderId: 12 })).toBe("pedido #12");
    expect(describirInput({ packId: 5, precio: 14000, activo: true })).toBe("pack #5 · precio: $14.000 · activo: sí");
  });
  it("el mail no se muestra (siempre se usa el del pedido) y sin datos no dice nada", () => {
    expect(describirInput({ email: "x@y.com" })).toBe("");
    expect(describirInput({})).toBe("");
  });
});
