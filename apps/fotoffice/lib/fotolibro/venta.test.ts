import { describe, expect, it } from "vitest";
import { TAPA_FLEXIBLE } from "./cotizar";
import { esSkuCajaFotolibro, leerFotolibroVendido, medidaPliegoDe, tipoTapaDeSku } from "./venta";

describe("productos de fotolibro por código", () => {
  it("reconoce los dos tipos de tapa y la caja, sin importar mayúsculas", () => {
    expect(tipoTapaDeSku("FOTOLIBRO-FLEXIBLE")).toBe("FLEXIBLE");
    expect(tipoTapaDeSku(" fotolibro-rigida ")).toBe("RIGIDA");
    expect(tipoTapaDeSku("INS-10x15")).toBeNull();
    expect(tipoTapaDeSku(null)).toBeNull();
    expect(esSkuCajaFotolibro("fotolibro-caja")).toBe(true);
  });
});

describe("medidaPliegoDe", () => {
  it("flexible usa su pliego; rígida el de hojas rígidas", () => {
    expect(medidaPliegoDe(TAPA_FLEXIBLE, "30x45")).toBe("flexible-30x45");
    expect(medidaPliegoDe("Gold Collection", "30x45")).toBe("rigido-30x45");
  });
  it("sin pliego flexible en esa medida, el rígido; medida desconocida, nada", () => {
    expect(medidaPliegoDe(TAPA_FLEXIBLE, "30x90")).toBe("rigido-30x90");
    expect(medidaPliegoDe("Gold Collection", "13x36")).toBeNull();
  });
});

describe("leerFotolibroVendido", () => {
  const base = { proveedorId: "prov1", modelo: "Gold", medida: "30x45", hojas: 20, fotos: 180, costoMinor: 100, cajaCostoMinor: null, templateId: null };
  it("acepta lo bien formado", () => {
    expect(leerFotolibroVendido(base)).toEqual(base);
  });
  it("rechaza hojas fuera de rango, ids raros y montos negativos", () => {
    expect(leerFotolibroVendido({ ...base, hojas: 0 })).toBeNull();
    expect(leerFotolibroVendido({ ...base, templateId: "../x" })).toBeNull();
    expect(leerFotolibroVendido({ ...base, costoMinor: -1 })).toBeNull();
    expect(leerFotolibroVendido(null)).toBeNull();
  });
});
