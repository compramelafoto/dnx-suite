import { describe, expect, test } from "vitest";
import {
  DIAS_PARA_ARREPENTIRSE,
  constanciaDesde,
  dentroDelPlazo,
  revisarSolicitud,
} from "./arrepentimiento";

describe("el plazo legal", () => {
  const compra = new Date("2026-10-01T12:00:00Z");

  test("son diez días corridos", () => {
    expect(DIAS_PARA_ARREPENTIRSE).toBe(10);
  });

  test("el mismo día, sí", () => {
    expect(dentroDelPlazo(compra, compra)).toBe(true);
  });

  test("al día diez todavía", () => {
    expect(dentroDelPlazo(compra, new Date("2026-10-11T11:00:00Z"))).toBe(true);
  });

  test("al día once ya no", () => {
    expect(dentroDelPlazo(compra, new Date("2026-10-12T13:00:00Z"))).toBe(false);
  });

  test("sin fecha de compra no se puede afirmar que venció", () => {
    // Ante la duda, se recibe la solicitud igual: el plazo lo resuelve una persona.
    expect(dentroDelPlazo(null, compra)).toBe(true);
  });
});

describe("la constancia", () => {
  test("es corta, se puede dictar por teléfono y no se confunde", () => {
    const c = constanciaDesde("cmu2txi4m0001ky046ztlakhb", new Date("2026-10-05T10:00:00Z"));
    expect(c).toMatch(/^AR-[0-9A-HJ-NP-Z]{6}$/);
  });

  test("la misma solicitud da siempre la misma constancia", () => {
    const f = new Date("2026-10-05T10:00:00Z");
    expect(constanciaDesde("abc", f)).toBe(constanciaDesde("abc", f));
  });

  test("dos solicitudes distintas dan constancias distintas", () => {
    const f = new Date("2026-10-05T10:00:00Z");
    expect(constanciaDesde("abc", f)).not.toBe(constanciaDesde("abd", f));
  });

  test("no tiene letras que se confundan con números", () => {
    for (let i = 0; i < 200; i++) {
      expect(constanciaDesde(`id-${i}`, new Date())).not.toMatch(/[IOU01]/);
    }
  });
});

describe("revisar lo que llega del formulario", () => {
  const BUENO = { email: "ana@ejemplo.com", referencia: "PRB123", motivo: "Me arrepentí." };

  test("con correo y referencia alcanza", () => {
    expect(revisarSolicitud(BUENO).ok).toBe(true);
  });

  test("el motivo es opcional: la ley no obliga a explicar nada", () => {
    expect(revisarSolicitud({ ...BUENO, motivo: "" }).ok).toBe(true);
  });

  test("sin correo no se puede contestar", () => {
    expect(revisarSolicitud({ ...BUENO, email: "" })).toMatchObject({ ok: false });
    expect(revisarSolicitud({ ...BUENO, email: "no-es-correo" })).toMatchObject({ ok: false });
  });

  test("sin referencia no se sabe qué compra cancelar", () => {
    expect(revisarSolicitud({ ...BUENO, referencia: "  " })).toMatchObject({ ok: false });
  });

  test("el correo se guarda en minúscula", () => {
    const r = revisarSolicitud({ ...BUENO, email: "  ANA@Ejemplo.com " });
    expect(r.ok && r.datos.email).toBe("ana@ejemplo.com");
  });

  test("un motivo larguísimo se recorta en vez de rechazarse", () => {
    const r = revisarSolicitud({ ...BUENO, motivo: "a".repeat(9000) });
    expect(r.ok && r.datos.motivo!.length).toBeLessThanOrEqual(2000);
  });
});
