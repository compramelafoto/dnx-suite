import { describe, expect, it } from "vitest";
import { calidadParaMedida, medidasQueAlcanzan } from "./calidad";

describe("calidad de impresión", () => {
  it("foto de celular original (4000×3000) es ideal para 20x30", () => {
    expect(calidadParaMedida(4000, 3000, "20x30")).toBe("ideal");
  });

  it("foto comprimida por WhatsApp (1600×1200) alcanza para 10x15 pero no para 20x30", () => {
    expect(calidadParaMedida(1600, 1200, "10x15")).not.toBe("insuficiente");
    expect(calidadParaMedida(1600, 1200, "20x30")).toBe("insuficiente");
  });

  it("ignora la orientación", () => {
    expect(calidadParaMedida(1200, 1800, "10x15")).toBe(calidadParaMedida(1800, 1200, "10x15"));
  });

  it("medida desconocida → null", () => {
    expect(calidadParaMedida(4000, 3000, "7x9")).toBeNull();
  });

  it("medidasQueAlcanzan lista en orden de la tabla", () => {
    expect(medidasQueAlcanzan(1600, 1200)).toEqual(["10x15", "13x18", "15x20", "15x21"]);
  });
});
