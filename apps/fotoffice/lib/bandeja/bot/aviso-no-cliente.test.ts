import { describe, expect, it } from "vitest";
import { textoAvisoNoCliente } from "./aviso-no-cliente";

describe("textoAvisoNoCliente", () => {
  it("dice quién escribió, por qué no es cliente y el mensaje, escapado para Telegram", () => {
    const t = textoAvisoNoCliente({ nombre: "KAKTUS <ropa>", waId: "5493410000000", motivo: "publicidad", texto: "Catálogo & precios" });
    expect(t).toContain("KAKTUS &lt;ropa&gt;");
    expect(t).toContain("+5493410000000");
    expect(t).toContain("publicidad");
    expect(t).toContain("Catálogo &amp; precios");
  });

  it("recorta un mensaje muy largo", () => {
    expect(textoAvisoNoCliente({ nombre: null, waId: "1", motivo: "spam", texto: "x".repeat(5000) }).length).toBeLessThan(1500);
  });
});
