import { describe, expect, it } from "vitest";
import {
  buildVariantAxes,
  findVariantId,
  imageIndexForModel,
  isModelSoldOut,
  optionForVariant,
  sizesForModel,
  splitVariantName,
  variantAfterModelChange,
} from "./variant-axes";

const v = (id: string, name: string, available: number | null = 5) => ({ id, name, available });

const remeras = [
  v("1", "Oversize negra / S"),
  v("2", "Oversize negra / M", 0),
  v("3", "Clásica blanca / M"),
  v("4", "Oversize negra / L"),
  v("5", "Clásica blanca / XL"),
];

describe("splitVariantName", () => {
  it("parte en el primer separador", () => {
    expect(splitVariantName("Oversize negra / M")).toEqual({ model: "Oversize negra", size: "M" });
    expect(splitVariantName("A / B / C")).toEqual({ model: "A", size: "B / C" });
  });

  it("sin separador o con una mitad vacía no es modelo/talle", () => {
    expect(splitVariantName("M")).toBeNull();
    expect(splitVariantName("Negra/M")).toBeNull();
    expect(splitVariantName(" / M")).toBeNull();
    expect(splitVariantName("Negra / ")).toBeNull();
  });
});

describe("buildVariantAxes", () => {
  it("modelos únicos en el orden de las variantes", () => {
    const axes = buildVariantAxes(remeras)!;
    expect(axes.models).toEqual(["Oversize negra", "Clásica blanca"]);
    expect(sizesForModel(axes, "Oversize negra").map((o) => o.size)).toEqual(["S", "M", "L"]);
    expect(sizesForModel(axes, null)).toEqual([]);
  });

  it("si una sola variante no sigue el formato, no hay ejes", () => {
    expect(buildVariantAxes([...remeras, v("6", "Única")])).toBeNull();
    expect(buildVariantAxes([v("1", "S"), v("2", "M")])).toBeNull();
    expect(buildVariantAxes([])).toBeNull();
  });
});

describe("findVariantId y optionForVariant", () => {
  const axes = buildVariantAxes(remeras)!;
  it("modelo + talle resuelve la variante", () => {
    expect(findVariantId(axes, "Clásica blanca", "XL")).toBe("5");
    expect(findVariantId(axes, "Clásica blanca", "S")).toBeNull();
    expect(findVariantId(axes, null, "S")).toBeNull();
  });
  it("de la variante vuelve a modelo y talle", () => {
    expect(optionForVariant(axes, "3")).toMatchObject({ model: "Clásica blanca", size: "M" });
    expect(optionForVariant(axes, null)).toBeNull();
  });
});

describe("variantAfterModelChange", () => {
  const axes = buildVariantAxes(remeras)!;
  it("conserva el talle si el modelo nuevo lo tiene disponible", () => {
    expect(variantAfterModelChange(axes, "Clásica blanca", "M")).toBe("3");
  });
  it("no conserva un talle agotado", () => {
    expect(variantAfterModelChange(axes, "Oversize negra", "M")).toBeNull();
  });
  it("elige solo si queda un único talle disponible", () => {
    const uno = buildVariantAxes([v("1", "Gorra / Único"), v("2", "Remera / S"), v("3", "Remera / M", 0)])!;
    expect(variantAfterModelChange(uno, "Gorra", null)).toBe("1");
    expect(variantAfterModelChange(uno, "Remera", "XL")).toBe("2");
  });
});

describe("isModelSoldOut", () => {
  it("agotado sólo si todos sus talles lo están", () => {
    const axes = buildVariantAxes([v("1", "A / S", 0), v("2", "A / M", 0), v("3", "B / S", 0), v("4", "B / M", null)])!;
    expect(isModelSoldOut(axes, "A")).toBe(true);
    expect(isModelSoldOut(axes, "B")).toBe(false);
  });
});

describe("imageIndexForModel", () => {
  const images = [{ alt: null }, { alt: "Frente" }, { alt: "  oversize NEGRA " }];
  it("busca por alt sin importar mayúsculas ni espacios", () => {
    expect(imageIndexForModel(images, "Oversize negra")).toBe(2);
  });
  it("-1 si no hay foto para el modelo", () => {
    expect(imageIndexForModel(images, "Clásica blanca")).toBe(-1);
    expect(imageIndexForModel(images, null)).toBe(-1);
  });
});
