import { describe, expect, test } from "vitest";
import { puedeSubirOtra, LIMITE_POR_DEFECTO } from "./sesion-invitado";

describe("cuántas fotos puede subir un invitado", () => {
  test("con el límite por defecto, la primera pasa", () => {
    expect(puedeSubirOtra({ subidas: 0, limite: null }).ok).toBe(true);
  });

  test("justo en el límite ya no puede subir otra", () => {
    const r = puedeSubirOtra({ subidas: LIMITE_POR_DEFECTO, limite: null });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain(String(LIMITE_POR_DEFECTO));
  });

  test("una anterior al límite sí puede", () => {
    expect(puedeSubirOtra({ subidas: LIMITE_POR_DEFECTO - 1, limite: null }).ok).toBe(true);
  });

  test("el evento puede fijar su propio límite", () => {
    expect(puedeSubirOtra({ subidas: 5, limite: 5 }).ok).toBe(false);
    expect(puedeSubirOtra({ subidas: 4, limite: 5 }).ok).toBe(true);
  });

  test("un límite de cero es sin límite, no 'no puede subir nada'", () => {
    // Cero en la configuración significa 'no pusimos tope', que es lo que espera
    // quien deja el campo vacío. Bloquear todo sería lo contrario de lo pedido.
    expect(puedeSubirOtra({ subidas: 500, limite: 0 }).ok).toBe(true);
  });

  test("el mensaje le habla al invitado, no al programador", () => {
    const r = puedeSubirOtra({ subidas: 30, limite: 30 });
    expect(r.motivo).toMatch(/ya subiste/i);
    expect(r.motivo).not.toMatch(/límite excedido|error|quota/i);
  });
});
