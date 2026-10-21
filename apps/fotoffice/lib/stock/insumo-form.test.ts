import { describe, expect, it } from "vitest";
import { parseInsumoForm } from "./insumo-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("parseInsumoForm", () => {
  it("un kit con su presentación de compra es válido", () => {
    const r = parseInsumoForm(
      form({ unidad: "copias 10x15", unidadCompra: "Kit 305 6R", unidadesPorCompra: "640" }),
    );
    expect(r).toEqual({
      ok: true,
      values: { unidad: "copias 10x15", unidadCompra: "Kit 305 6R", unidadesPorCompra: 640 },
    });
  });

  it("alcanza con la unidad: la presentación de compra es opcional", () => {
    const r = parseInsumoForm(form({ unidad: "sobres" }));
    expect(r).toEqual({ ok: true, values: { unidad: "sobres", unidadCompra: null, unidadesPorCompra: null } });
  });

  it("sin unidad no se puede", () => {
    const r = parseInsumoForm(form({ unidad: "  " }));
    expect(r).toEqual({ ok: false, error: "Decí en qué se cuenta: copias, sobres, ml…" });
  });

  it("una unidad de compra sin cantidad pide la cantidad", () => {
    const r = parseInsumoForm(form({ unidad: "copias", unidadCompra: "Kit" }));
    expect(r).toEqual({ ok: false, error: "Decí cuántas unidades trae cada Kit." });
  });

  it("la cantidad por compra tiene que ser entera y de al menos 1", () => {
    for (const malo of ["0", "-3", "2,5", "abc"]) {
      const r = parseInsumoForm(form({ unidad: "copias", unidadCompra: "Kit", unidadesPorCompra: malo }));
      expect(r.ok, malo).toBe(false);
    }
  });

  it("una cantidad sin unidad de compra se descarta", () => {
    const r = parseInsumoForm(form({ unidad: "copias", unidadesPorCompra: "640" }));
    expect(r).toEqual({ ok: true, values: { unidad: "copias", unidadCompra: null, unidadesPorCompra: null } });
  });
});
