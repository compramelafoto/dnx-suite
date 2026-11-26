import { describe, expect, it } from "vitest";
import { listoParaCobrar, pasoSiguiente, pasosDelAlta } from "./pasos";

const nuevo = { basePriceCents: 0, mpConnected: false, isPublished: false };

describe("pasosDelAlta", () => {
  it("un perfil recién nacido no tiene ningún paso hecho", () => {
    const pasos = pasosDelAlta(nuevo);
    expect(pasos.map((p) => p.hecho)).toEqual([false, false, false]);
    expect(pasoSiguiente(pasos)?.clave).toBe("ficha");
  });

  it("publicado sin precio no cuenta como publicado: la vitrina da 404", () => {
    const pasos = pasosDelAlta({ ...nuevo, isPublished: true });
    expect(pasos.find((p) => p.clave === "publicar")?.hecho).toBe(false);
  });

  it("el siguiente paso es el primero que falta, aunque uno posterior esté hecho", () => {
    const pasos = pasosDelAlta({ basePriceCents: 100_000_00, mpConnected: false, isPublished: true });
    expect(pasoSiguiente(pasos)?.clave).toBe("mercado-pago");
  });

  it("sólo está listo para cobrar con los tres pasos", () => {
    expect(listoParaCobrar({ basePriceCents: 100_000_00, mpConnected: false, isPublished: true })).toBe(false);
    expect(listoParaCobrar({ basePriceCents: 100_000_00, mpConnected: true, isPublished: true })).toBe(true);
    expect(pasoSiguiente(pasosDelAlta({ basePriceCents: 1, mpConnected: true, isPublished: true }))).toBeNull();
  });
});
