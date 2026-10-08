import { describe, expect, it } from "vitest";
import {
  agruparRubros,
  compararCodigos,
  etiquetaRubro,
  normalizarCodigo,
  sugerirRubro,
  validarPadre,
} from "./rubros";

describe("normalizarCodigo", () => {
  it("vacío o ausente es sin código", () => {
    expect(normalizarCodigo(undefined)).toEqual({ ok: true, valor: null });
    expect(normalizarCodigo(null)).toEqual({ ok: true, valor: null });
    expect(normalizarCodigo("  ")).toEqual({ ok: true, valor: null });
  });

  it("acepta números separados por puntos y recorta espacios", () => {
    expect(normalizarCodigo(" 3.1.2 ")).toEqual({ ok: true, valor: "3.1.2" });
    expect(normalizarCodigo("4.0")).toEqual({ ok: true, valor: "4.0" });
  });

  it("rechaza formatos raros, largos o que no son texto", () => {
    expect(normalizarCodigo("3..1").ok).toBe(false);
    expect(normalizarCodigo("3.1 2").ok).toBe(false);
    expect(normalizarCodigo("1".repeat(21)).ok).toBe(false);
    expect(normalizarCodigo(31).ok).toBe(false);
  });
});

describe("compararCodigos", () => {
  it("compara parte por parte como números: 3.1.2 antes que 3.1.10", () => {
    const codigos = ["3.1.10", "4.0", "3.1.2", "3.1", null, "3.2"];
    expect([...codigos].sort(compararCodigos)).toEqual(["3.1", "3.1.2", "3.1.10", "3.2", "4.0", null]);
  });
});

describe("validarPadre", () => {
  const base = { categoryId: "hijo", kind: "INGRESO" as const, hijos: [] };

  it("sin padre siempre vale", () => {
    expect(validarPadre({ ...base, parentIdPedido: null, padre: null })).toBeNull();
  });

  it("no puede ser su propio padre", () => {
    expect(
      validarPadre({ ...base, parentIdPedido: "hijo", padre: { id: "hijo", kind: "INGRESO", parentCategoryId: null } }),
    ).toMatch(/propio padre/);
  });

  it("el padre tiene que existir en el workspace", () => {
    expect(validarPadre({ ...base, parentIdPedido: "otro-ws", padre: null })).toMatch(/no existe/);
  });

  it("el padre tiene que ser del mismo lado", () => {
    expect(
      validarPadre({ ...base, parentIdPedido: "p", padre: { id: "p", kind: "EGRESO", parentCategoryId: null } }),
    ).toMatch(/mismo lado/);
  });

  it("un solo nivel: el padre no puede tener padre", () => {
    expect(
      validarPadre({ ...base, parentIdPedido: "p", padre: { id: "p", kind: "INGRESO", parentCategoryId: "abuelo" } }),
    ).toMatch(/un solo nivel/);
  });

  it("un solo nivel: un rubro con hijos no puede tener padre", () => {
    expect(
      validarPadre({
        ...base,
        hijos: [{ kind: "INGRESO" }],
        parentIdPedido: "p",
        padre: { id: "p", kind: "INGRESO", parentCategoryId: null },
      }),
    ).toMatch(/ya tiene subrubros/);
  });

  it("un padre no puede cambiar de lado dejando a sus hijos del otro", () => {
    expect(validarPadre({ ...base, kind: "EGRESO", hijos: [{ kind: "INGRESO" }], parentIdPedido: null, padre: null })).toMatch(
      /otro lado/,
    );
  });

  it("padre válido", () => {
    expect(
      validarPadre({ ...base, parentIdPedido: "p", padre: { id: "p", kind: "INGRESO", parentCategoryId: null } }),
    ).toBeNull();
  });
});

describe("agruparRubros", () => {
  const r = (id: string, code: string | null, parentCategoryId: string | null = null) => ({ id, code, parentCategoryId });

  it("agrupa por padre y ordena por código padres e hijos", () => {
    const grupos = agruparRubros([
      r("bodas", "3.1.1", "estudio"),
      r("ventas", null),
      r("quince", "3.1.10", "estudio"),
      r("eventos", "3.1.2", "estudio"),
      r("estudio", "3.1"),
    ]);
    expect(grupos.map((g) => [g.rubro.id, g.hijos.map((h) => h.id)])).toEqual([
      ["estudio", ["bodas", "eventos", "quince"]],
      ["ventas", []],
    ]);
  });

  it("sin códigos respeta el orden de llegada", () => {
    expect(agruparRubros([r("b", null), r("a", null)]).map((g) => g.rubro.id)).toEqual(["b", "a"]);
  });

  it("un hijo cuyo padre no está en la lista queda suelto en primer nivel", () => {
    expect(agruparRubros([r("hijo", "3.1.1", "ausente")]).map((g) => g.rubro.id)).toEqual(["hijo"]);
  });
});

describe("sugerirRubro y etiquetaRubro", () => {
  const rubros = [
    { id: "a", name: "Sesión fotográfica" },
    { id: "b", name: "Bodas" },
  ];

  it("encuentra el rubro con el mismo nombre sin mirar mayúsculas, tildes ni espacios", () => {
    expect(sugerirRubro("  sesion   FOTOGRAFICA ", rubros)).toBe("a");
    expect(sugerirRubro("Bodas", rubros)).toBe("b");
  });

  it("sin texto o sin coincidencia no sugiere nada", () => {
    expect(sugerirRubro(null, rubros)).toBeNull();
    expect(sugerirRubro("Coberturas", rubros)).toBeNull();
  });

  it("etiqueta con código adelante", () => {
    expect(etiquetaRubro({ name: "Bodas", code: "3.1.1" })).toBe("3.1.1 Bodas");
    expect(etiquetaRubro({ name: "Ventas", code: null })).toBe("Ventas");
  });
});
