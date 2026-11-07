import { describe, expect, it } from "vitest";
import { totalesDelMes, type VentaVista } from "./ventas-vista";

function v(p: Partial<VentaVista>): VentaVista {
  return {
    pagadoEl: new Date("2026-10-15T15:00:00-03:00"),
    validacion: "VALIDADA",
    pagoFamiliaArs: 20000,
    netoFotografoArs: 17391,
    mpComisionPlataformaArs: 2609,
    comisionPlataformaArs: 2609,
    mpComisionMpArs: 1200,
    mpAcreditadoArs: 16191,
    mpReintegradoArs: 0,
    reintegradoEl: null,
    ...p,
  };
}

describe("totalesDelMes", () => {
  it("la venta suma en su mes y el reintegro resta en el mes del reintegro", () => {
    const ventas = [v({ validacion: "REINTEGRADA", mpReintegradoArs: 20000, reintegradoEl: new Date("2026-11-03T10:00:00-03:00") })];
    expect(totalesDelMes(ventas, "2026-10")).toMatchObject({ cantidad: 1, acreditado: 16191, reintegros: 0, cobradoNeto: 16191 });
    expect(totalesDelMes(ventas, "2026-11")).toMatchObject({ cantidad: 0, acreditado: 0, reintegros: 20000, cobradoNeto: -20000 });
  });

  it("lo que no está en el Mercado Pago del espacio no suma", () => {
    expect(totalesDelMes([v({ validacion: "NO_EN_TU_MP", mpAcreditadoArs: null })], "2026-10").cantidad).toBe(0);
  });

  it("una venta todavía sin validar cuenta aparte y no inventa el acreditado", () => {
    expect(totalesDelMes([v({ validacion: "PENDIENTE", mpAcreditadoArs: null, mpComisionMpArs: null })], "2026-10")).toMatchObject({
      cantidad: 1, acreditado: 0, sinValidar: 1, comisionPlataforma: 2609,
    });
  });

  it("borde de mes en hora argentina: el 1/11 a las 23 h UTC-3 menos cuenta en octubre", () => {
    const venta = v({ pagadoEl: new Date("2026-11-01T02:00:00Z") });
    expect(totalesDelMes([venta], "2026-10").cantidad).toBe(1);
    expect(totalesDelMes([venta], "2026-11").cantidad).toBe(0);
  });

  it("suma varias ventas con centavos sin errores de redondeo", () => {
    const t = totalesDelMes([v({ mpAcreditadoArs: 0.1 }), v({ mpAcreditadoArs: 0.2 })], "2026-10");
    expect(t.acreditado).toBe(0.3);
  });
});
