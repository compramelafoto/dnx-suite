import { describe, expect, it } from "vitest";
import { CSS_MASCOTA, DURACION_ENTRADA, ENTRADA_VISTA_KEY, tipoEntrada } from "./entrada";

function almacen() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("tipoEntrada", () => {
  it("la primera vez de la visita es la grande y queda marcada; después, la corta", () => {
    const a = almacen();
    expect(tipoEntrada(a, false)).toBe("grande");
    expect(a.getItem(ENTRADA_VISTA_KEY)).toBe("1");
    expect(tipoEntrada(a, false)).toBe("corta");
  });

  it("con movimiento reducido no hay entrada, y no gasta la grande", () => {
    const a = almacen();
    expect(tipoEntrada(a, true)).toBe("ninguna");
    expect(a.getItem(ENTRADA_VISTA_KEY)).toBeNull();
  });

  it("sin almacenamiento o si falla, la corta", () => {
    expect(tipoEntrada(null, false)).toBe("corta");
    const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => {}, removeItem: () => {} };
    expect(tipoEntrada(roto, false)).toBe("corta");
  });

  it("las duraciones de las animaciones CSS coinciden con las del código", () => {
    expect(CSS_MASCOTA).toContain(`dnxbot-entrada-grande ${DURACION_ENTRADA.grande}ms`);
    expect(CSS_MASCOTA).toContain(`dnxbot-entrada-corta ${DURACION_ENTRADA.corta}ms`);
    expect(CSS_MASCOTA).toContain("prefers-reduced-motion: reduce");
  });

  it("la pose grande nunca baja de su lugar: ningún desplazamiento vertical positivo", () => {
    for (const m of CSS_MASCOTA.matchAll(/translate\(\s*[-\d.]+(?:px)?,\s*([-\d.]+)(?:px)?\)/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(0);
    }
  });
});
