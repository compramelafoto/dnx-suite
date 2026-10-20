import { describe, expect, it } from "vitest";
import { accionDeTecla, cantidadDesdeTexto } from "./teclas";

const fuera = { tagName: "DIV", isContentEditable: false };
const tecla = (key: string, extra: Partial<Parameters<typeof accionDeTecla>[0]> = {}) => ({
  key,
  target: fuera,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  ...extra,
});
const medio = { primera: false, ultima: false };

describe("accionDeTecla", () => {
  it("flechas, R, E y Enter hacen lo suyo", () => {
    expect(accionDeTecla(tecla("ArrowLeft"), medio)).toBe("ANTERIOR");
    expect(accionDeTecla(tecla("ArrowRight"), medio)).toBe("SIGUIENTE");
    expect(accionDeTecla(tecla("r"), medio)).toBe("RECORTAR");
    expect(accionDeTecla(tecla("R"), medio)).toBe("RECORTAR");
    expect(accionDeTecla(tecla("e"), medio)).toBe("ENCAJAR");
    expect(accionDeTecla(tecla("E"), medio)).toBe("ENCAJAR");
    expect(accionDeTecla(tecla("Enter"), medio)).toBe("CONFIRMAR");
    expect(accionDeTecla(tecla("x"), medio)).toBeNull();
  });

  it("no hay anterior en la primera ni siguiente en la última", () => {
    expect(accionDeTecla(tecla("ArrowLeft"), { primera: true, ultima: false })).toBeNull();
    expect(accionDeTecla(tecla("ArrowRight"), { primera: false, ultima: true })).toBeNull();
  });

  it("no hace nada mientras se escribe en un campo", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      for (const key of ["ArrowLeft", "ArrowRight", "r", "e", "Enter"]) {
        expect(accionDeTecla(tecla(key, { target: { tagName, isContentEditable: false } }), medio)).toBeNull();
      }
    }
    expect(accionDeTecla(tecla("r", { target: { tagName: "DIV", isContentEditable: true } }), medio)).toBeNull();
  });

  it("Enter sobre un botón o un enlace es de ese botón, no confirma dos veces", () => {
    expect(accionDeTecla(tecla("Enter", { target: { tagName: "BUTTON", isContentEditable: false } }), medio)).toBeNull();
    expect(accionDeTecla(tecla("Enter", { target: { tagName: "A", isContentEditable: false } }), medio)).toBeNull();
    // Las letras sí andan con el foco en un botón.
    expect(accionDeTecla(tecla("r", { target: { tagName: "BUTTON", isContentEditable: false } }), medio)).toBe("RECORTAR");
  });

  it("con Ctrl, Cmd o Alt es un atajo del navegador, y una tecla sostenida no repite", () => {
    expect(accionDeTecla(tecla("r", { metaKey: true }), medio)).toBeNull();
    expect(accionDeTecla(tecla("r", { ctrlKey: true }), medio)).toBeNull();
    expect(accionDeTecla(tecla("ArrowLeft", { altKey: true }), medio)).toBeNull();
    expect(accionDeTecla(tecla("Enter", { repeat: true }), medio)).toBeNull();
    expect(accionDeTecla(tecla("ArrowRight", { repeat: true }), medio)).toBeNull();
  });

  it("sin destino (null) cuenta como fuera de un campo", () => {
    expect(accionDeTecla(tecla("e", { target: null }), medio)).toBe("ENCAJAR");
  });
});

describe("cantidadDesdeTexto", () => {
  it("redondea y se queda entre 1 y 50", () => {
    expect(cantidadDesdeTexto("3")).toBe(3);
    expect(cantidadDesdeTexto("2.6")).toBe(3);
    expect(cantidadDesdeTexto("0")).toBe(1);
    expect(cantidadDesdeTexto("-4")).toBe(1);
    expect(cantidadDesdeTexto("80")).toBe(50);
    expect(cantidadDesdeTexto("")).toBe(1);
    expect(cantidadDesdeTexto("abc")).toBe(1);
  });
});
