import { describe, expect, it } from "vitest";
import { debeVolverAlInput } from "./foco";

const base = { ventanaAbierta: true, punteroTactil: false, veniaEscribiendo: false, focoEnOtroCampo: false };

describe("debeVolverAlInput", () => {
  it("en computadora vuelve siempre al renglón con la ventana abierta", () => {
    expect(debeVolverAlInput(base)).toBe(true);
    expect(debeVolverAlInput({ ...base, veniaEscribiendo: true })).toBe(true);
  });
  it("con la ventana cerrada, nunca", () => {
    expect(debeVolverAlInput({ ...base, ventanaAbierta: false, veniaEscribiendo: true })).toBe(false);
  });
  it("en celular sólo si venía escribiendo (no abre el teclado sola)", () => {
    expect(debeVolverAlInput({ ...base, punteroTactil: true })).toBe(false);
    expect(debeVolverAlInput({ ...base, punteroTactil: true, veniaEscribiendo: true })).toBe(true);
  });
  it("no le saca el foco a otro campo de la página", () => {
    expect(debeVolverAlInput({ ...base, focoEnOtroCampo: true })).toBe(false);
  });
});
