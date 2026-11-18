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

  it("en Instagram muestra «Instagram @usuario» y nunca el IGSID como si fuera un teléfono", () => {
    const t = textoAvisoNoCliente({ nombre: "Sofi", waId: "17841400000001", motivo: "spam", texto: "hola", canal: "INSTAGRAM", usuarioInstagram: "sofi.rodriguez" });
    expect(t).toContain("Sofi (Instagram @sofi.rodriguez)");
    expect(t).toContain("en el Instagram del estudio");
    expect(t).not.toContain("17841400000001");
    expect(textoAvisoNoCliente({ nombre: null, waId: "17841400000001", motivo: "spam", texto: "hola", canal: "INSTAGRAM" })).toContain("De: Instagram\n");
  });
});
