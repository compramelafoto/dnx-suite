import { describe, expect, it } from "vitest";
import { leerReferencia, opcionesDeImportacion } from "./cli";

describe("opcionesDeImportacion", () => {
  it("en seco por omisión, con varios CSV y meses", () => {
    const r = opcionesDeImportacion(["--csv", "a.csv", "--csv", "b.csv", "--mapeo", "m.json", "--mes", "2026-01", "--mes", "2026-02"]);
    expect(r).toEqual({
      ok: true,
      opciones: {
        csv: ["a.csv", "b.csv"],
        mapeo: "m.json",
        meses: ["2026-01", "2026-02"],
        reporte: null,
        referencia: null,
        aplicar: false,
        workspace: null,
        reemplazarConfirmado: false,
        mesActual: null,
      },
    });
  });

  it("aplicar exige workspace", () => {
    const r = opcionesDeImportacion(["--csv", "a.csv", "--mapeo", "m.json", "--aplicar"]);
    expect(r.ok).toBe(false);
  });

  it("aplicar exige elegir los meses: se confirma de a uno", () => {
    expect(opcionesDeImportacion(["--csv", "a.csv", "--mapeo", "m.json", "--aplicar", "--workspace", "dnx-estudio"]).ok).toBe(false);
    expect(opcionesDeImportacion(["--csv", "a.csv", "--mapeo", "m.json", "--aplicar", "--workspace", "dnx-estudio", "--todos"]).ok).toBe(true);
  });

  it("faltan csv o mapeo, o un mes mal escrito", () => {
    expect(opcionesDeImportacion(["--mapeo", "m.json"]).ok).toBe(false);
    expect(opcionesDeImportacion(["--csv", "a.csv"]).ok).toBe(false);
    expect(opcionesDeImportacion(["--csv", "a.csv", "--mapeo", "m.json", "--mes", "2026-13"]).ok).toBe(false);
  });
});

describe("leerReferencia", () => {
  it("lee mes, ingresos y egresos del resumen mensual", () => {
    const r = leerReferencia("mes,dias_trabajados,ingresos_total,egresos_total\n2024-01,26,1057260.0,-85284.0\n2025-03,23,4980915.5,-112750.0\n");
    expect(r.get("2024-01")).toEqual({ ingresosCentavos: 105_726_000, egresosCentavos: -8_528_400 });
    expect(r.get("2025-03")?.ingresosCentavos).toBe(498_091_550);
  });
});
