import { describe, expect, it } from "vitest";
import { parseCategoryForm } from "./category-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("parseCategoryForm", () => {
  it("un nombre alcanza", () => {
    const r = parseCategoryForm(form({ name: "Marcos" }));
    expect(r.ok && r.values.name).toBe("Marcos");
  });

  it("sin nombre se rechaza", () => {
    expect(parseCategoryForm(form({ name: "  " }))).toEqual({
      ok: false,
      error: "Poné un nombre para la categoría.",
    });
  });

  it("el orden es cero por omisión", () => {
    const r = parseCategoryForm(form({ name: "Marcos" }));
    expect(r.ok && r.values.order).toBe(0);
  });

  it("un orden no numérico cae a cero", () => {
    const r = parseCategoryForm(form({ name: "Marcos", order: "no es un número" }));
    expect(r.ok && r.values.order).toBe(0);
  });

  it("isActive es verdadero por omisión", () => {
    const r = parseCategoryForm(form({ name: "Marcos" }));
    expect(r.ok && r.values.isActive).toBe(true);
  });

  it("isActive se puede apagar", () => {
    const r = parseCategoryForm(form({ name: "Marcos", isActive: "off" }));
    expect(r.ok && r.values.isActive).toBe(false);
  });
});
