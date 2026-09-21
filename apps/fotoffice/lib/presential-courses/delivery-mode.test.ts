import { describe, expect, it } from "vitest";
import { validarModalidad, esGrabado, etiquetaDeModalidad } from "./delivery-mode";

describe("qué puede colgar de cada modalidad", () => {
  it("un curso presencial necesita al menos una edición", () => {
    expect(validarModalidad({ deliveryMode: "PRESENCIAL", tieneEdicion: false })).toEqual({
      ok: false,
      error: "Un curso presencial necesita al menos una edición con fecha y lugar.",
    });
  });

  it("un curso grabado no admite ediciones", () => {
    expect(validarModalidad({ deliveryMode: "RECORDED", tieneEdicion: true })).toEqual({
      ok: false,
      error: "Un curso grabado no tiene ediciones: se organiza en clases.",
    });
  });

  it("presencial con edición y grabado sin ediciones son válidos", () => {
    expect(validarModalidad({ deliveryMode: "PRESENCIAL", tieneEdicion: true })).toEqual({
      ok: true,
    });
    expect(validarModalidad({ deliveryMode: "RECORDED", tieneEdicion: false })).toEqual({
      ok: true,
    });
  });

  it("el curso en vivo se organiza en encuentros, como el presencial", () => {
    expect(validarModalidad({ deliveryMode: "LIVE", tieneEdicion: true })).toEqual({ ok: true });
    expect(validarModalidad({ deliveryMode: "LIVE", tieneEdicion: false }).ok).toBe(false);
  });
});

describe("saber si un curso es grabado", () => {
  it("sólo RECORDED lo es", () => {
    expect(esGrabado("RECORDED")).toBe(true);
    expect(esGrabado("PRESENCIAL")).toBe(false);
    expect(esGrabado("LIVE")).toBe(false);
  });
});

describe("cómo se llama cada modalidad en pantalla", () => {
  it("en español y sin jerga", () => {
    expect(etiquetaDeModalidad("PRESENCIAL")).toBe("Presencial");
    expect(etiquetaDeModalidad("LIVE")).toBe("En vivo");
    expect(etiquetaDeModalidad("RECORDED")).toBe("Grabado");
  });
});
