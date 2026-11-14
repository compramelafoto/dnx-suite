import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { porcentajeVisto } = await import("./compartidos");

describe("% visto de un alumno de un curso compartido", () => {
  it("clases terminadas sobre clases listas, sin pasar de 100", () => {
    expect(porcentajeVisto(8, 2)).toBe(25);
    expect(porcentajeVisto(3, 3)).toBe(100);
    expect(porcentajeVisto(2, 3)).toBe(100);
  });
  it("sin clases listas es 0", () => {
    expect(porcentajeVisto(0, 0)).toBe(0);
  });
});
