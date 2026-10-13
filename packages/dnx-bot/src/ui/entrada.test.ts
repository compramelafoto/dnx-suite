import { describe, expect, it } from "vitest";
import { CSS_MASCOTA, CUADROS, DURACION_ENTRADA, DURACION_FOTO_MS, DURACIONES_CUADROS_MS, ENTRADA_VISTA_KEY, keyframesFoto, tipoEntrada } from "./entrada";

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
    expect(DURACION_FOTO_MS).toBe(2830);
    expect(DURACION_ENTRADA.grande).toBe(300 + 2830 + 450);
    expect(DURACION_ENTRADA.corta).toBe(250 + 2830);
    expect(CSS_MASCOTA).toContain(`dnxbot-entrada-grande ${DURACION_ENTRADA.grande}ms`);
    expect(CSS_MASCOTA).toContain(`dnxbot-foto ${DURACION_FOTO_MS}ms`);
    expect(CSS_MASCOTA).toContain("prefers-reduced-motion: reduce");
  });

  it("la tira pasa por los 24 cuadros en sus instantes reales, sin mezclarlos", () => {
    const kf = keyframesFoto();
    const filas = [...kf.matchAll(/([\d.]+)% \{ background-position: ([\d.]+)% 0; \}/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(filas).toHaveLength(CUADROS + 1);
    let t = 0;
    DURACIONES_CUADROS_MS.forEach((d, i) => {
      expect(filas[i]![0]).toBeCloseTo((t / DURACION_FOTO_MS) * 100, 3);
      expect(filas[i]![1]).toBeCloseTo((i / (CUADROS - 1)) * 100, 3);
      t += d;
    });
    expect(CSS_MASCOTA).toContain("steps(1, end)");
    // El flash (cuadro 13) arranca a los 1700 ms.
    expect(filas[13]![0]).toBeCloseTo((1700 / 2830) * 100, 3);
  });

  it("no queda la coreografía vieja: el robot no se traslada ni se inclina", () => {
    expect(CSS_MASCOTA).not.toMatch(/translate\(|rotate\(/);
  });
});
