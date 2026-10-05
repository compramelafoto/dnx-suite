import { describe, expect, it } from "vitest";
import { MAX_VARIANTS_PER_PRODUCT, parseVariantsForm } from "./variant-form";

type Fila = Partial<Record<"id" | "name" | "sku" | "barcode" | "price" | "isActive", string>>;

function form(filas: Fila[]): FormData {
  const fd = new FormData();
  filas.forEach((fila, i) => {
    for (const [campo, valor] of Object.entries(fila)) {
      fd.append(`variants.${i}.${campo}`, valor as string);
    }
  });
  return fd;
}

describe("parseVariantsForm", () => {
  it("lee las filas con sus campos, recortados, y vacío queda null", () => {
    const r = parseVariantsForm(
      form([{ id: "v1", name: "  M ", sku: " REM-M ", barcode: "779 1234 5678 9", price: "" }]),
    );
    expect(r).toEqual({
      ok: true,
      variants: [
        {
          id: "v1",
          name: "M",
          sku: "REM-M",
          barcode: "779123456789",
          priceMinor: null,
          isActive: true,
          sortOrder: 0,
        },
      ],
    });
  });

  it("una fila nueva no trae id: queda null", () => {
    const r = parseVariantsForm(form([{ name: "S" }]));
    expect(r.ok && r.variants[0].id).toBe(null);
  });

  it("precio vacío es null (hereda el del producto) y un precio escrito se pasa a centavos", () => {
    const r = parseVariantsForm(form([{ name: "S", price: "" }, { name: "XL", price: "12.500,50" }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.variants[0].priceMinor).toBeNull();
    expect(r.variants[1].priceMinor).toBe(1_250_050);
  });

  it("un precio negativo es un error", () => {
    expect(parseVariantsForm(form([{ name: "S", price: "-1" }]))).toEqual({
      ok: false,
      error: "El precio de un talle no puede ser negativo.",
    });
  });

  it("un precio que no se entiende es un error", () => {
    expect(parseVariantsForm(form([{ name: "S", price: "caro" }]))).toEqual({
      ok: false,
      error: "El precio del talle S no se entiende.",
    });
  });

  it("dos nombres iguales sin distinguir mayúsculas son un error", () => {
    expect(parseVariantsForm(form([{ name: "M" }, { name: "m" }]))).toEqual({
      ok: false,
      error: "Hay dos talles con el mismo nombre.",
    });
  });

  it("una fila con datos pero sin nombre es un error", () => {
    expect(parseVariantsForm(form([{ id: "v1", name: "  ", sku: "X" }]))).toEqual({
      ok: false,
      error: "Cada talle necesita un nombre.",
    });
  });

  it("una fila nueva totalmente vacía se ignora (la fila en blanco del final de la tabla)", () => {
    const r = parseVariantsForm(form([{ name: "S" }, { name: "", sku: "", barcode: "", price: "" }]));
    expect(r.ok && r.variants.map((v) => v.name)).toEqual(["S"]);
  });

  it(`más de ${MAX_VARIANTS_PER_PRODUCT} talles es un error`, () => {
    const filas = Array.from({ length: 31 }, (_, i) => ({ name: `T${i}` }));
    expect(parseVariantsForm(form(filas))).toEqual({
      ok: false,
      error: `Un producto puede tener hasta ${MAX_VARIANTS_PER_PRODUCT} talles.`,
    });
  });

  it("30 talles todavía se aceptan", () => {
    const filas = Array.from({ length: 30 }, (_, i) => ({ name: `T${i}` }));
    expect(parseVariantsForm(form(filas)).ok).toBe(true);
  });

  it("el orden es el del formulario, no el del índice ni el alfabético", () => {
    const fd = new FormData();
    fd.append("variants.7.name", "XL");
    fd.append("variants.2.name", "S");
    fd.append("variants.5.name", "M");
    const r = parseVariantsForm(fd);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.variants.map((v) => [v.name, v.sortOrder])).toEqual([
      ["XL", 0],
      ["S", 1],
      ["M", 2],
    ]);
  });

  it("isActive 'off' desactiva; ausente queda activo", () => {
    const r = parseVariantsForm(form([{ name: "S", isActive: "off" }, { name: "M" }]));
    expect(r.ok && r.variants.map((v) => v.isActive)).toEqual([false, true]);
  });

  it("un código de barras con letras es un error", () => {
    expect(parseVariantsForm(form([{ name: "S", barcode: "ABC" }]))).toEqual({
      ok: false,
      error: "El código de barras del talle S no se entiende: son sólo números.",
    });
  });

  it("dos talles con el mismo código interno o de barras son un error", () => {
    expect(parseVariantsForm(form([{ name: "S", sku: "A1" }, { name: "M", sku: "A1" }]))).toEqual({
      ok: false,
      error: "Hay dos talles con el mismo código.",
    });
    expect(parseVariantsForm(form([{ name: "S", barcode: "123" }, { name: "M", barcode: "1-23" }]))).toEqual({
      ok: false,
      error: "Hay dos talles con el mismo código de barras.",
    });
  });

  it("sin filas da una lista vacía", () => {
    expect(parseVariantsForm(new FormData())).toEqual({ ok: true, variants: [] });
  });
});
