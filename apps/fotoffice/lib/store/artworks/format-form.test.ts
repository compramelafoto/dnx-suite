import { describe, expect, it } from "vitest";
import { parseMinDpi, parsePrintFormatForm } from "./format-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

const base = { name: " Copia 20x30 ", kind: "PRINT", widthCm: "20", heightCm: "30", price: "12.500,50" };

describe("parsePrintFormatForm", () => {
  it("mínimo válido: sin peso avisa pero no falla", () => {
    const r = parsePrintFormatForm(form(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values).toMatchObject({ name: "Copia 20x30", kind: "PRINT", widthCm: 20, heightCm: 30, priceMinor: 1250050, costMinor: null, weightGrams: null, packLengthCm: null });
    expect(r.warnings).toHaveLength(1);
  });
  it("completo: sin avisos; precio con punto decimal", () => {
    const r = parsePrintFormatForm(form({ ...base, kind: "FRAME", price: "3500.50", cost: "0", weightGrams: "800", packLengthCm: "40", packWidthCm: "30", packHeightCm: "5" }));
    expect(r.ok && r.values).toMatchObject({ kind: "FRAME", priceMinor: 350050, costMinor: 0, weightGrams: 800, packLengthCm: 40, packHeightCm: 5 });
    expect(r.ok && r.warnings).toEqual([]);
  });
  it.each([
    ["nombre corto", { name: "a" }],
    ["nombre largo", { name: "x".repeat(81) }],
    ["tipo inválido", { kind: "OTRO" }],
    ["ancho 4", { widthCm: "4" }],
    ["alto 201", { heightCm: "201" }],
    ["medida decimal", { widthCm: "20.5" }],
    ["precio 0", { price: "0" }],
    ["precio vacío", { price: "" }],
    ["costo negativo", { cost: "-5" }],
    ["costo inválido", { cost: "abc" }],
    ["peso 0", { weightGrams: "0" }],
    ["peso 30001", { weightGrams: "30001" }],
    ["embalaje parcial", { packLengthCm: "10" }],
    ["embalaje fuera de rango", { packLengthCm: "10", packWidthCm: "10", packHeightCm: "151" }],
  ])("rechaza %s", (_n, cambio) => {
    expect(parsePrintFormatForm(form({ ...base, ...cambio })).ok).toBe(false);
  });
  it("límites incluidos", () => {
    expect(parsePrintFormatForm(form({ ...base, widthCm: "5", heightCm: "200", weightGrams: "30000" })).ok).toBe(true);
  });
});

describe("parseMinDpi", () => {
  it("72–600", () => {
    expect(parseMinDpi("72")).toEqual({ ok: true, minDpi: 72 });
    expect(parseMinDpi(" 600 ")).toEqual({ ok: true, minDpi: 600 });
    expect(parseMinDpi("71").ok).toBe(false);
    expect(parseMinDpi("601").ok).toBe(false);
    expect(parseMinDpi("150.5").ok).toBe(false);
  });
});
