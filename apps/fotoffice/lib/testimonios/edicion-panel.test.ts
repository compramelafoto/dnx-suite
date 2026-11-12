import { describe, expect, it } from "vitest";
import { MAX_NOMBRE, MAX_TEXTO, MENSAJES_TESTIMONIO, validarEdicionPanel } from "./dominio";

describe("validarEdicionPanel: el admin corrige el testimonio", () => {
  it("sin texto ni nombre en la entrada, no los toca", () => {
    const r = validarEdicionPanel({ extracto: "Hermoso", autorDetalle: "Club" });
    expect(r).toEqual({ ok: true, datos: { extracto: "Hermoso", autorDetalle: "Club" } });
  });

  it("corrige el texto y el nombre, limpiando espacios", () => {
    const r = validarEdicionPanel({ extracto: "", autorDetalle: "", texto: "  Me encantó.\n\n\n\nVuelvo.  ", autorNombre: "  Ana   Pérez " });
    expect(r.ok && r.datos.texto).toBe("Me encantó.\n\nVuelvo.");
    expect(r.ok && r.datos.autorNombre).toBe("Ana Pérez");
  });

  it("no deja el texto ni el nombre vacíos ni demasiado largos", () => {
    expect(validarEdicionPanel({ texto: "   " })).toEqual({ ok: false, error: MENSAJES_TESTIMONIO.texto });
    expect(validarEdicionPanel({ autorNombre: "" })).toEqual({ ok: false, error: MENSAJES_TESTIMONIO.nombre });
    expect(validarEdicionPanel({ texto: "a".repeat(MAX_TEXTO + 1) })).toEqual({ ok: false, error: MENSAJES_TESTIMONIO.textoLargo });
    expect(validarEdicionPanel({ autorNombre: "a".repeat(MAX_NOMBRE + 1) })).toEqual({ ok: false, error: MENSAJES_TESTIMONIO.nombreLargo });
  });
});
