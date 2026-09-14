import { describe, expect, test } from "vitest";
import { COMISION_POR_DEFECTO_BPS, repartir } from "./comision";

describe("cómo se reparte una venta", () => {
  test("la comisión por defecto es el 15%", () => {
    expect(COMISION_POR_DEFECTO_BPS).toBe(1500);
    expect(repartir(100_000, COMISION_POR_DEFECTO_BPS)).toEqual({
      plataformaCents: 15_000,
      vendedorCents: 85_000,
    });
  });

  test("lo que va a la plataforma más lo que va al vendedor es exactamente la venta", () => {
    // El invariante que importa: en ningún reparto puede perderse ni inventarse
    // un centavo. Si no cierra, alguien reclama.
    for (const monto of [1, 7, 33, 99, 100, 12_345, 99_999, 1_234_567, 7_777_777]) {
      for (const bps of [0, 1, 250, 1500, 3333, 9999, 10_000]) {
        const r = repartir(monto, bps);
        expect(r.plataformaCents + r.vendedorCents).toBe(monto);
      }
    }
  });

  test("nunca devuelve centavos negativos", () => {
    for (const bps of [0, 1500, 10_000]) {
      const r = repartir(1, bps);
      expect(r.plataformaCents).toBeGreaterThanOrEqual(0);
      expect(r.vendedorCents).toBeGreaterThanOrEqual(0);
    }
  });

  test("el redondeo del medio centavo no se lo queda la plataforma", () => {
    // 15% de 33 son 4,95. Se redondea a 5 y el vendedor se lleva 28. La regla
    // es redondear la comisión al centavo más cercano, no siempre para arriba:
    // hacia arriba, sistemáticamente, es cobrarle de más al vendedor.
    expect(repartir(33, 1500)).toEqual({ plataformaCents: 5, vendedorCents: 28 });
    expect(repartir(10, 1500)).toEqual({ plataformaCents: 2, vendedorCents: 8 });
  });

  test("con 0% la plataforma no cobra nada", () => {
    expect(repartir(50_000, 0)).toEqual({ plataformaCents: 0, vendedorCents: 50_000 });
  });

  test("con 100% se lo lleva todo la plataforma", () => {
    // Es el caso del adicional de descarga: su ingreso es 100% de la plataforma.
    expect(repartir(50_000, 10_000)).toEqual({ plataformaCents: 50_000, vendedorCents: 0 });
  });

  test("un porcentaje fuera de rango no se acepta", () => {
    expect(() => repartir(1000, -1)).toThrow();
    expect(() => repartir(1000, 10_001)).toThrow();
  });

  test("un monto que no es un entero de centavos no se acepta", () => {
    // Un float acá es plata mal contada, y se nota recién en la rendición.
    expect(() => repartir(100.5, 1500)).toThrow();
    expect(() => repartir(-100, 1500)).toThrow();
  });
});
