import { describe, expect, it } from "vitest";
import { describeSeniority } from "./identity";

const hoy = new Date("2026-08-27T12:00:00Z");

describe("describeSeniority", () => {
  it("dice el mes y el año en que se asoció", () => {
    const r = describeSeniority(new Date("2015-06-10T00:00:00Z"), hoy);
    expect(r.desde).toBe("junio de 2015");
  });

  it("cuenta los años cumplidos, no los empezados", () => {
    expect(describeSeniority(new Date("2015-06-10T00:00:00Z"), hoy).anios).toBe(11);
  });

  /** El aniversario cuenta el mismo día, no al día siguiente. */
  it("el día del aniversario ya suma el año", () => {
    expect(describeSeniority(new Date("2025-08-27T00:00:00Z"), hoy).anios).toBe(1);
  });

  it("la víspera del aniversario todavía no lo suma", () => {
    expect(describeSeniority(new Date("2025-08-28T00:00:00Z"), hoy).anios).toBeNull();
  });

  /**
   * Quien se asoció hace meses no tiene antigüedad que mostrar. Decir "0 años" sería
   * subrayarle que es nuevo, justo a quien más conviene hacer sentir parte.
   */
  it("menos de un año no muestra antigüedad", () => {
    expect(describeSeniority(new Date("2026-03-01T00:00:00Z"), hoy).anios).toBeNull();
  });

  /** El padrón viene de una migración: puede haber fechas absurdas y no deben romper el portal. */
  it("una fecha futura no inventa antigüedad", () => {
    const r = describeSeniority(new Date("2030-01-01T00:00:00Z"), hoy);
    expect(r.anios).toBeNull();
    expect(r.desde).toBe("enero de 2030");
  });

  it("una fecha inválida no rompe: no muestra nada", () => {
    const r = describeSeniority(new Date("no-es-fecha"), hoy);
    expect(r.desde).toBeNull();
    expect(r.anios).toBeNull();
  });
});
