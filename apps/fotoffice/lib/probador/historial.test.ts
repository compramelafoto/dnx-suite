import { describe, expect, it } from "vitest";
import { deshacer, iniciar, puedeDeshacer, puedeRehacer, registrar, rehacer } from "./historial";

describe("el historial para deshacer", () => {
  it("deshacer y rehacer vuelven al mismo estado", () => {
    let h = registrar(registrar(iniciar("a"), "b"), "c");
    h = deshacer(deshacer(h));
    expect(h.actual).toBe("a");
    h = rehacer(rehacer(h));
    expect(h.actual).toBe("c");
  });

  it("hacer algo nuevo después de deshacer descarta lo que se podía rehacer", () => {
    const h = registrar(deshacer(registrar(iniciar("a"), "b")), "x");
    expect(h.actual).toBe("x");
    expect(puedeRehacer(h)).toBe(false);
    expect(deshacer(h).actual).toBe("a");
  });

  it("guarda hasta 50 pasos", () => {
    let h = iniciar(0);
    for (let i = 1; i <= 60; i++) h = registrar(h, i);
    expect(h.pasado).toHaveLength(50);
    for (let i = 0; i < 50; i++) h = deshacer(h);
    expect(h.actual).toBe(10);
    expect(puedeDeshacer(h)).toBe(false);
  });

  it("sin nada para deshacer devuelve el mismo historial", () => {
    const h = iniciar("a");
    expect(deshacer(h)).toBe(h);
    expect(rehacer(h)).toBe(h);
  });

  it("registrar el mismo estado no agrega un paso", () => {
    const h = iniciar("a");
    expect(registrar(h, "a")).toBe(h);
  });
});
