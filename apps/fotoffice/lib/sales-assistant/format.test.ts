import { describe, expect, it } from "vitest";
import { fechaHoraVenta, fechaVenta, filtroDesdeUrl, textoEnDias } from "./format";

describe("filtroDesdeUrl", () => {
  it("sin filtro, o con uno que no existe, abre en HOY", () => {
    expect(filtroDesdeUrl(undefined)).toBe("HOY");
    expect(filtroDesdeUrl("cualquiera")).toBe("HOY");
  });

  it("acepta los cuatro filtros, escritos como vengan", () => {
    expect(filtroDesdeUrl("ESPERANDO")).toBe("ESPERANDO");
    expect(filtroDesdeUrl("para_cerrar")).toBe("PARA_CERRAR");
    expect(filtroDesdeUrl("archivadas")).toBe("ARCHIVADAS");
  });
});

describe("fechas en la hora de Argentina", () => {
  it("las 01:30 UTC del 27 son todavía el 26 en Rosario", () => {
    const d = new Date("2026-09-27T01:30:00Z");
    expect(fechaVenta(d)).toBe("26.09.2026");
    expect(fechaHoraVenta(d)).toBe("26.09.2026, 22:30");
  });
});

describe("textoEnDias", () => {
  it("dice hoy, mañana y ayer con palabras", () => {
    expect(textoEnDias(0)).toBe("hoy");
    expect(textoEnDias(1)).toBe("mañana");
    expect(textoEnDias(-1)).toBe("ayer");
  });

  it("cuenta hacia adelante y hacia atrás", () => {
    expect(textoEnDias(61)).toBe("en 61 días");
    expect(textoEnDias(-3)).toBe("hace 3 días");
  });
});
