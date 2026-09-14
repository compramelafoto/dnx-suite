import { describe, expect, it } from "vitest";
import { PUBLIC_FORM_LIMIT, decidirEnvio } from "./rate-limit";

/**
 * El freno del formulario público.
 *
 * Hoy NINGÚN formulario público de FotoOffice tiene uno — el de asociarse tampoco. Este es el
 * primero. Un formulario abierto a internet sin límite es una invitación a llenarlo de basura,
 * y cada fila falsa es trabajo de secretaría después.
 *
 * La decisión es pura: recibe cuántos envíos hubo en la ventana y responde. Quién los cuenta
 * es problema del repositorio, y así el caso que importa se puede probar sin base de datos.
 */
describe("decidirEnvio", () => {
  it("el primero entra", () => {
    expect(decidirEnvio({ recientes: 0 })).toEqual({ ok: true });
  });

  it("hasta el tope, entra", () => {
    expect(decidirEnvio({ recientes: PUBLIC_FORM_LIMIT - 1 })).toEqual({ ok: true });
  });

  it("llegado al tope, se rechaza", () => {
    const r = decidirEnvio({ recientes: PUBLIC_FORM_LIMIT });
    expect(r.ok).toBe(false);
  });

  it("el mensaje no dice cuántos van ni cuánto falta", () => {
    // Decirle a quien automatiza envíos cuál es el tope y cuándo se libera le facilita el
    // trabajo. A una persona real le alcanza con saber que espere un rato.
    const r = decidirEnvio({ recientes: PUBLIC_FORM_LIMIT + 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toMatch(/\d/);
      expect(r.error.toLowerCase()).toContain("más tarde");
    }
  });

  it("el tope se puede ajustar por llamada", () => {
    expect(decidirEnvio({ recientes: 2, tope: 5 })).toEqual({ ok: true });
    expect(decidirEnvio({ recientes: 5, tope: 5 }).ok).toBe(false);
  });
});
