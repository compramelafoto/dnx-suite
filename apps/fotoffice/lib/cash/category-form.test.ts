import { describe, expect, it } from "vitest";
import { parseCategoryForm } from "./category-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("parseCategoryForm", () => {
  it("una categoría de ingreso se acepta", () => {
    const r = parseCategoryForm(form({ name: "Reparaciones", kind: "INGRESO" }));
    expect(r.ok && r.values.kind).toBe("INGRESO");
  });

  it("una categoría de egreso se acepta", () => {
    const r = parseCategoryForm(form({ name: "Proveedores", kind: "EGRESO" }));
    expect(r.ok && r.values.kind).toBe("EGRESO");
  });

  it("sin lado se rechaza: una categoría sirve para un lado solo", () => {
    expect(parseCategoryForm(form({ name: "Varios" }))).toEqual({
      ok: false,
      error: "Elegí si la categoría es de ingreso o de egreso.",
    });
  });

  it("un nombre vacío se rechaza", () => {
    expect(parseCategoryForm(form({ name: "  ", kind: "INGRESO" }))).toEqual({
      ok: false,
      error: "Poné un nombre para la categoría.",
    });
  });
});
