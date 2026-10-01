import { describe, expect, test } from "vitest";
import { debeCerrarse } from "./cierre";

const AHORA = new Date("2026-10-11T08:00:00Z");
const ANTES = new Date("2026-10-11T07:59:00Z");
const DESPUES = new Date("2026-10-11T08:01:00Z");

describe("cerrar un evento automáticamente", () => {
  test("uno activo cuya ventana ya venció, se cierra", () => {
    expect(debeCerrarse({ status: "ACTIVE", deactivationAt: ANTES }, AHORA)).toBe(true);
  });

  test("justo en la hora de cierre, se cierra", () => {
    // El borde va cerrado, igual que en `acceso-evento`: a las 12 horas exactas
    // se terminó. Las dos reglas tienen que decir lo mismo o el invitado ve una
    // cosa y la base dice otra.
    expect(debeCerrarse({ status: "ACTIVE", deactivationAt: AHORA }, AHORA)).toBe(true);
  });

  test("uno cuya ventana sigue abierta, no", () => {
    expect(debeCerrarse({ status: "ACTIVE", deactivationAt: DESPUES }, AHORA)).toBe(false);
  });

  test("uno programado que ya venció también se cierra", () => {
    // Se creó, nunca se usó y pasó la fecha. No tiene sentido dejarlo esperando.
    expect(debeCerrarse({ status: "SCHEDULED", deactivationAt: ANTES }, AHORA)).toBe(true);
  });

  test("uno sin fecha de cierre no se toca", () => {
    expect(debeCerrarse({ status: "ACTIVE", deactivationAt: null }, AHORA)).toBe(false);
  });

  test.each(["CLOSED", "ARCHIVED", "CANCELLED"])("uno %s no se vuelve a cerrar", (status) => {
    expect(debeCerrarse({ status, deactivationAt: ANTES }, AHORA)).toBe(false);
  });

  test("uno que todavía se está configurando no se cierra solo", () => {
    // Sin publicar y sin vender. Cerrarlo sería confundir al que lo está armando.
    expect(debeCerrarse({ status: "CONFIGURING", deactivationAt: ANTES }, AHORA)).toBe(false);
  });
});
