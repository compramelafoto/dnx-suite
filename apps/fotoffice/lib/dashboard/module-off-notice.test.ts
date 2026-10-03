import { describe, expect, it } from "vitest";
import { moduleOffNotice } from "./module-off-notice";

describe("moduleOffNotice: el aviso del panel cuando una guarda rebota por módulo apagado", () => {
  it("cursos conserva su texto propio", () => {
    expect(moduleOffNotice({ courses: "off" })).toContain("Venta de cursos");
  });
  it("?module=off (Socios, Captación) y ?evaluaciones=off dan el aviso genérico", () => {
    const generico = "Ese módulo no está activado para tu institución.";
    expect(moduleOffNotice({ module: "off" })).toBe(generico);
    expect(moduleOffNotice({ evaluaciones: "off" })).toBe(generico);
  });
  it("sin parámetro, sin aviso", () => {
    expect(moduleOffNotice({})).toBeNull();
    expect(moduleOffNotice({ module: "on" })).toBeNull();
  });
});
