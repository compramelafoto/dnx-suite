import { describe, expect, test } from "vitest";
// @ts-expect-error — el parser es un .mjs compartido, fuera del árbol de tipos de la app.
import { leerEtapas, porcentaje, resumir, sinExplicar } from "../../../../scripts/avance-parser.mjs";

const DOC = `
# Un documento cualquiera

<!-- avance: Etapa 1 -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 1.1 | Lista | ✅ | ✅ | |
| 1.2 | A medias | ✅ | 🟡 | Falta correrlo con datos reales |
| 1.3 | Sin empezar | ⬜ | ⬜ | Espera el split 1:N |

Texto suelto que corta la tabla.

<!-- avance: Etapa 2 -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 2.1 | Depende de un tercero | 🚫 | 🚫 | Lo habilita Mercado Pago |
`;

describe("leer las tablas de avance", () => {
  test("encuentra las dos etapas", () => {
    expect(leerEtapas(DOC).map((e: { nombre: string }) => e.nombre)).toEqual(["Etapa 1", "Etapa 2"]);
  });

  test("no toma la fila de guiones como tarea", () => {
    expect(leerEtapas(DOC)[0].tareas).toHaveLength(3);
  });

  test("lee el estado de las dos columnas", () => {
    const t = leerEtapas(DOC)[0].tareas[1];
    expect(t).toMatchObject({ id: "1.2", codigo: "✅", produccion: "🟡" });
  });

  test("una tabla sin marca no se cuenta", () => {
    const suelta = "| # | Tarea | Código | Producción |\n|---|---|---|---|\n| x | y | ✅ | ✅ |";
    expect(leerEtapas(suelta)).toEqual([]);
  });

  test("un documento sin ninguna marca no da etapas", () => {
    expect(leerEtapas("# Nada\n\ntexto")).toEqual([]);
  });
});

describe("el porcentaje", () => {
  test("todo hecho es 100", () => {
    expect(porcentaje(["✅", "✅"])).toBe(100);
  });

  test("nada hecho es 0", () => {
    expect(porcentaje(["⬜", "⬜"])).toBe(0);
  });

  test("un a medias vale la mitad", () => {
    expect(porcentaje(["✅", "🟡"])).toBe(75);
  });

  test("lo que depende de terceros no cuenta ni a favor ni en contra", () => {
    expect(porcentaje(["✅", "🚫"])).toBe(100);
    expect(porcentaje(["⬜", "🚫"])).toBe(0);
  });

  test("sin nada que contar devuelve null, no cero", () => {
    // No tener el dato es distinto de tener el dato en cero.
    expect(porcentaje([])).toBeNull();
    expect(porcentaje(["🚫", "🚫"])).toBeNull();
  });
});

describe("el resumen", () => {
  test("separa código de producción", () => {
    const r = resumir(leerEtapas(DOC));
    expect(r.tareas).toBe(4);
    // Código: ✅ ✅ ⬜ (el 🚫 no cuenta) → 67. Producción: ✅ 🟡 ⬜ → 50.
    expect(r.codigo).toBe(67);
    expect(r.produccion).toBe(50);
  });
});

describe("las notas obligatorias", () => {
  test("una tarea incompleta sin nota se denuncia", () => {
    const malo = `<!-- avance: X -->\n\n| # | T | Código | Producción | Nota |\n|---|---|---|---|---|\n| 1 | y | ✅ | 🟡 | |`;
    expect(sinExplicar(leerEtapas(malo))).toEqual(["X / 1"]);
  });

  test("una tarea terminada no necesita nota", () => {
    const bueno = `<!-- avance: X -->\n\n| # | T | Código | Producción | Nota |\n|---|---|---|---|---|\n| 1 | y | ✅ | ✅ | |`;
    expect(sinExplicar(leerEtapas(bueno))).toEqual([]);
  });
});
