import { describe, expect, it } from "vitest";
import { montosDeCompraSinReparto } from "./compra";

const owner = { workspaceId: "ws-maxi", nombre: "Maxi Oviedo" };

describe("montos de una compra de curso grabado", () => {
  it("el 5% va encima: lista $100.000 → paga $105.000, neto $100.000", () => {
    const r = montosDeCompraSinReparto({ listaArs: "100000", comisionPlataformaBps: 500, owner });
    expect(r).toMatchObject({
      ok: true,
      listPriceArs: "100000.00",
      discountArs: "0.00",
      platformFeeArs: "5000.00",
      amountArs: "105000.00",
      netAmountArs: "100000.00",
    });
  });

  it("con centavos", () => {
    const r = montosDeCompraSinReparto({ listaArs: "45000.50", comisionPlataformaBps: 500, owner });
    expect(r).toMatchObject({ ok: true, platformFeeArs: "2250.03", amountArs: "47250.53" });
  });

  it("devuelve las partes congelables", () => {
    const r = montosDeCompraSinReparto({ listaArs: 1000, comisionPlataformaBps: 500, owner });
    expect(r.ok && r.partes.map((p) => [p.id, p.tipo, p.centavos])).toEqual([
      ["ws-maxi", "BENEFICIARIO", 100_000],
      ["plataforma", "PLATAFORMA", 5_000],
    ]);
  });

  it("sin precio no hay compra", () => {
    expect(montosDeCompraSinReparto({ listaArs: "0", comisionPlataformaBps: 500, owner }).ok).toBe(false);
  });
});
