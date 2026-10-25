import { describe, expect, it } from "vitest";
import { CSS_MASCOTA, CUADROS, DURACION_ENTRADA_MS, DURACION_FOTO_MS, DURACION_LLAMADO_MS, DURACIONES_CUADROS_MS, hayAnimacion, keyframesFoto } from "./entrada";

describe("mascota animada", () => {
  it("anima salvo con movimiento reducido o sin tira; ya no depende de la visita", () => {
    expect(hayAnimacion(false, true)).toBe(true);
    expect(hayAnimacion(true, true)).toBe(false);
    expect(hayAnimacion(false, false)).toBe(false);
    expect(CSS_MASCOTA).not.toContain("entrada-grande");
    expect(CSS_MASCOTA).not.toContain("entrada-corta");
  });

  it("la entrada y cada llamado sacan la foto en grande y después se achican", () => {
    expect(DURACION_FOTO_MS).toBe(2830);
    expect(DURACION_ENTRADA_MS).toBe(300 + 2830 + 450);
    expect(DURACION_LLAMADO_MS).toBe(DURACION_ENTRADA_MS);
    expect(CSS_MASCOTA).toContain(`dnxbot-entrada ${DURACION_ENTRADA_MS}ms`);
    expect(CSS_MASCOTA).toContain(`dnxbot-llamado ${DURACION_LLAMADO_MS}ms`);
    expect(CSS_MASCOTA).toContain(`dnxbot-foto ${DURACION_FOTO_MS}ms 300ms`);
    for (const nombre of ["dnxbot-entrada", "dnxbot-llamado"]) {
      const kf = CSS_MASCOTA.slice(CSS_MASCOTA.indexOf(`@keyframes ${nombre} {`));
      const bloque = kf.slice(0, kf.indexOf("\n}"));
      expect(bloque.match(/scale\(var\(--dnxbot-pico\)\)/g)).toHaveLength(2);
      expect(bloque).toMatch(/100% \{[^}]*scale\(1\)/);
    }
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
