import { describe, expect, it } from "vitest";
import {
  DENOMINACIONES,
  leerCantidad,
  leerConteo,
  planearCierreConContador,
  resumenArqueo,
  sumarConteo,
} from "./contador-billetes";

describe("DENOMINACIONES", () => {
  it("trae los billetes argentinos vigentes, de mayor a menor", () => {
    const billetes = DENOMINACIONES.filter((d) => d.tipo === "BILLETE").map((d) => d.pesos);
    expect(billetes).toEqual([20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10]);
  });

  it("las monedas van aparte y los ids no se repiten aunque haya billete y moneda de $10", () => {
    const monedas = DENOMINACIONES.filter((d) => d.tipo === "MONEDA").map((d) => d.pesos);
    expect(monedas).toEqual([10, 5, 2, 1]);
    const ids = DENOMINACIONES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("leerCantidad", () => {
  it("vacío es cero", () => expect(leerCantidad("")).toBe(0));
  it("acepta un entero", () => expect(leerCantidad(" 12 ")).toBe(12));
  it("no acepta negativos, decimales ni texto: cuentan como cero", () => {
    expect(leerCantidad("-3")).toBe(0);
    expect(leerCantidad("2.5")).toBe(0);
    expect(leerCantidad("abc")).toBe(0);
  });
  it("recorta lo absurdo a un tope", () => expect(leerCantidad("99999999")).toBe(100_000));
});

describe("sumarConteo", () => {
  it("multiplica cantidad por denominación y suma, en centavos", () => {
    // El ejemplo de la planilla: 3 de 20.000, 4 de 10.000, 7 de 1.000, 1 de 500 y 3 de 100.
    const r = sumarConteo({ "b-20000": 3, "b-10000": 4, "b-1000": 7, "b-500": 1, "b-100": 3 });
    expect(r.totalMinor).toBe(107_800_00);
  });

  it("separa billetes de monedas", () => {
    const r = sumarConteo({ "b-10": 2, "m-10": 3, "m-2": 1 });
    expect(r.billetesMinor).toBe(20_00);
    expect(r.monedasMinor).toBe(32_00);
    expect(r.totalMinor).toBe(52_00);
  });

  it("ignora denominaciones que no existen y cantidades inválidas", () => {
    const r = sumarConteo({ "b-3": 10, "b-100": -2, "b-200": 1.5, "b-50": 2 });
    expect(r.totalMinor).toBe(100_00);
  });

  it("devuelve sólo las líneas con cantidad, en el orden de la lista", () => {
    const r = sumarConteo({ "b-100": 2, "b-20000": 1 });
    expect(r.lineas).toEqual([
      { id: "b-20000", tipo: "BILLETE", pesos: 20000, cantidad: 1, subtotalMinor: 20_000_00 },
      { id: "b-100", tipo: "BILLETE", pesos: 100, cantidad: 2, subtotalMinor: 200_00 },
    ]);
  });
});

describe("resumenArqueo", () => {
  it("lo que va a la caja fuerte es lo contado menos el cambio (la fila TOTAL de la planilla)", () => {
    const r = resumenArqueo({ contadoMinor: 107_800_00, esperadoMinor: null, cambioMinor: 10_000_00 });
    expect(r.aCajaFuerteMinor).toBe(97_800_00);
    expect(r.diferenciaMinor).toBeNull();
    expect(r.estado).toBe("SIN_ESPERADO");
  });

  it("cuadra cuando lo contado es lo esperado", () => {
    const r = resumenArqueo({ contadoMinor: 50_000_00, esperadoMinor: 50_000_00, cambioMinor: 0 });
    expect(r.diferenciaMinor).toBe(0);
    expect(r.estado).toBe("CUADRA");
  });

  it("sobra cuando hay más de lo esperado", () => {
    const r = resumenArqueo({ contadoMinor: 50_500_00, esperadoMinor: 50_000_00, cambioMinor: 0 });
    expect(r.diferenciaMinor).toBe(500_00);
    expect(r.estado).toBe("SOBRANTE");
  });

  it("falta cuando hay menos de lo esperado", () => {
    const r = resumenArqueo({ contadoMinor: 49_000_00, esperadoMinor: 50_000_00, cambioMinor: 0 });
    expect(r.diferenciaMinor).toBe(-1_000_00);
    expect(r.estado).toBe("FALTANTE");
  });

  it("si el cambio supera lo contado no propone un pase negativo, y lo avisa", () => {
    const r = resumenArqueo({ contadoMinor: 8_000_00, esperadoMinor: null, cambioMinor: 10_000_00 });
    expect(r.aCajaFuerteMinor).toBe(0);
    expect(r.cambioFaltanteMinor).toBe(2_000_00);
  });
});

describe("leerConteo", () => {
  it("lee el JSON de cantidades del formulario", () => {
    expect(leerConteo('{"b-1000":3,"m-1":"2"}')).toEqual({ "b-1000": 3, "m-1": 2 });
  });
  it("un JSON roto o que no es un objeto es un conteo vacío", () => {
    expect(leerConteo("no")).toEqual({});
    expect(leerConteo("[1,2]")).toEqual({});
  });
  it("descarta denominaciones desconocidas", () => {
    expect(leerConteo('{"b-7":3,"b-50":1}')).toEqual({ "b-50": 1 });
  });
});

describe("planearCierreConContador", () => {
  const base = {
    contadoMinor: 60_000_00,
    esperadoMinor: 60_000_00,
    cambioMinor: 10_000_00,
    nota: null,
    registrarAjuste: true,
    pasarACajaFuerte: true,
    hayCajaFuerte: true,
    saldoCuentaMinor: 60_000_00,
  };

  it("sin diferencia, pasa lo contado menos el cambio y no ajusta nada", () => {
    const r = planearCierreConContador(base);
    expect(r).toEqual({ ok: true, ajuste: null, paseMinor: 50_000_00 });
  });

  it("una diferencia sin explicar no se puede guardar", () => {
    const r = planearCierreConContador({ ...base, contadoMinor: 59_000_00 });
    expect(r.ok).toBe(false);
  });

  it("un faltante explicado se asienta como egreso por la diferencia", () => {
    const r = planearCierreConContador({ ...base, contadoMinor: 59_000_00, nota: "Vuelto de más" });
    expect(r).toEqual({
      ok: true,
      ajuste: { kind: "EGRESO", amountMinor: 1_000_00 },
      paseMinor: 49_000_00,
    });
  });

  it("un sobrante explicado se asienta como ingreso, y el pase puede usar esa plata", () => {
    const r = planearCierreConContador({ ...base, contadoMinor: 61_000_00, nota: "Seña sin cargar" });
    expect(r).toEqual({
      ok: true,
      ajuste: { kind: "INGRESO", amountMinor: 1_000_00 },
      paseMinor: 51_000_00,
    });
  });

  it("si no se pide el ajuste, la diferencia queda sólo explicada", () => {
    const r = planearCierreConContador({
      ...base,
      contadoMinor: 59_000_00,
      nota: "Vuelto de más",
      registrarAjuste: false,
      saldoCuentaMinor: 60_000_00,
    });
    expect(r).toEqual({ ok: true, ajuste: null, paseMinor: 49_000_00 });
  });

  it("sin caja fuerte o sin pedirlo no hay pase", () => {
    expect(planearCierreConContador({ ...base, hayCajaFuerte: false })).toMatchObject({ ok: true, paseMinor: null });
    expect(planearCierreConContador({ ...base, pasarACajaFuerte: false })).toMatchObject({ ok: true, paseMinor: null });
  });

  it("un pase de cero no se hace", () => {
    const r = planearCierreConContador({ ...base, contadoMinor: 10_000_00, esperadoMinor: 10_000_00 });
    expect(r).toMatchObject({ ok: true, paseMinor: null });
  });

  it("no deja pasar más de lo que el libro dice que hay en la cuenta", () => {
    const r = planearCierreConContador({ ...base, saldoCuentaMinor: 20_000_00 });
    expect(r.ok).toBe(false);
  });

  it("sin esperado (no hay contra qué comparar) no exige explicación ni ajusta", () => {
    const r = planearCierreConContador({ ...base, esperadoMinor: null, contadoMinor: 30_000_00 });
    expect(r).toEqual({ ok: true, ajuste: null, paseMinor: 20_000_00 });
  });

  it("el cambio no puede ser negativo", () => {
    expect(planearCierreConContador({ ...base, cambioMinor: -1 }).ok).toBe(false);
  });
});
