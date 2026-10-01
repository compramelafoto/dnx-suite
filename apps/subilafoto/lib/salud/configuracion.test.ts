import { describe, expect, test } from "vitest";
import { REQUERIDAS, revisarConfiguracion } from "./configuracion";

const COMPLETO: Record<string, string> = Object.fromEntries(
  REQUERIDAS.map((r) => [r.nombre, "x"]),
);

describe("qué le falta a la configuración", () => {
  test("con todo cargado no falta nada", () => {
    expect(revisarConfiguracion(COMPLETO).faltan).toEqual([]);
    expect(revisarConfiguracion(COMPLETO).completa).toBe(true);
  });

  test("dice el nombre de la que falta y para qué era", () => {
    const sinToken = { ...COMPLETO };
    delete sinToken.SUBILAFOTO_MP_ACCESS_TOKEN;
    const r = revisarConfiguracion(sinToken);
    expect(r.completa).toBe(false);
    expect(r.faltan[0]!.nombre).toBe("SUBILAFOTO_MP_ACCESS_TOKEN");
    expect(r.faltan[0]!.sinElla.length).toBeGreaterThan(10);
  });

  test("una variable en blanco cuenta como ausente", () => {
    // Pegar una variable vacía en Vercel es más común que olvidarla.
    const r = revisarConfiguracion({ ...COMPLETO, RESEND_API_KEY: "   " });
    expect(r.faltan.map((f) => f.nombre)).toEqual(["RESEND_API_KEY"]);
  });

  test("nunca devuelve el valor de nada", () => {
    const r = revisarConfiguracion({ ...COMPLETO, RESEND_API_KEY: "re_secreta" });
    expect(JSON.stringify(r)).not.toContain("re_secreta");
  });

  test("el interruptor de los correos se informa aparte, y apagado no es un error", () => {
    expect(revisarConfiguracion(COMPLETO).correosEnVivo).toBe(false);
    expect(revisarConfiguracion({ ...COMPLETO, SUBILAFOTO_CORREOS_EN_VIVO: "true" }).correosEnVivo)
      .toBe(true);
    // Apagado no aparece en "faltan": es una decisión, no un olvido.
    expect(revisarConfiguracion(COMPLETO).completa).toBe(true);
  });
});
