import { describe, expect, it } from "vitest";
import { deliveryTermsParagraphs } from "./terms";

const soloRetiro = { pickup: true, home: false, branch: false, handlingNote: null };
const sede = { pickupAddress: "Córdoba 721, Rosario", pickupHours: "lunes a viernes de 9 a 18" };

describe("deliveryTermsParagraphs", () => {
  it("sin envíos: el texto de retiro de siempre, sin costo de envío", () => {
    expect(deliveryTermsParagraphs(soloRetiro, sede)).toEqual([
      "Los pedidos se retiran en la sede, sin costo de envío: Córdoba 721, Rosario (lunes a viernes de 9 a 18). Te avisamos por email cuando tu pedido está listo para retirar.",
    ]);
    expect(deliveryTermsParagraphs(soloRetiro, { pickupAddress: null, pickupHours: null })).toEqual([
      "Los pedidos se retiran en la sede, sin costo de envío. Te avisamos por email cuando tu pedido está listo para retirar.",
    ]);
  });

  it("con envíos: las formas activas, el costo según destino y peso antes de pagar, el aviso y el seguimiento", () => {
    const p = deliveryTermsParagraphs({ pickup: true, home: true, branch: true, handlingNote: "Despachamos en 48 h hábiles." }, sede);
    const texto = p.join("\n");
    expect(texto).toContain("retiro en la sede (Córdoba 721, Rosario, lunes a viernes de 9 a 18), sin costo");
    expect(texto).toContain("envío a domicilio");
    expect(texto).toContain("envío a una sucursal de Correo Argentino");
    expect(texto).toContain("se calcula según el destino y el peso del pedido");
    expect(texto).toContain("antes de pagar");
    expect(texto).toContain("Despachamos en 48 h hábiles.");
    expect(texto).toContain("número de seguimiento");
    expect(texto).not.toMatch(/se retiran en la sede, sin costo de envío/);
  });

  it("sólo lo que está activo", () => {
    const texto = deliveryTermsParagraphs({ pickup: false, home: true, branch: false, handlingNote: null }, sede).join("\n");
    expect(texto).toContain("envío a domicilio");
    expect(texto).not.toContain("retiro en la sede");
    expect(texto).not.toContain("Correo Argentino");
  });

  it("con Andreani lo nombra en el domicilio y en la sucursal", () => {
    const texto = deliveryTermsParagraphs(
      { pickup: false, home: true, branch: true, handlingNote: null, carrier: "ANDREANI" },
      sede,
    ).join("\n");
    expect(texto).toContain("envío a domicilio por Andreani");
    expect(texto).toContain("envío a una sucursal de Andreani");
    expect(texto).not.toContain("Correo Argentino");
  });
});
