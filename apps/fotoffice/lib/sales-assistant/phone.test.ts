import { describe, expect, it } from "vitest";
import { enlaceWhatsapp, normalizarTelefonoArgentino } from "./phone";

describe("normalizarTelefonoArgentino", () => {
  it("completa un celular de 10 dígitos con 549", () => {
    expect(normalizarTelefonoArgentino("3412717813")).toBe("5493412717813");
  });
  it("respeta un número que ya trae +54 9, con espacios y guiones", () => {
    expect(normalizarTelefonoArgentino("+54 9 3416 91-0072")).toBe("5493416910072");
  });
  it("agrega el 9 a un 54 sin 9", () => {
    expect(normalizarTelefonoArgentino("543413748314")).toBe("5493413748314");
  });
  it("saca el 0 del área y el 15 del celular", () => {
    expect(normalizarTelefonoArgentino("0341 15 2717813")).toBe("5493412717813");
  });
  it("rechaza un número corto", () => {
    expect(normalizarTelefonoArgentino("341322858")).toBeNull();
  });
  it("rechaza vacío y null", () => {
    expect(normalizarTelefonoArgentino("")).toBeNull();
    expect(normalizarTelefonoArgentino(null)).toBeNull();
  });
});

describe("enlaceWhatsapp", () => {
  it("arma wa.me con el texto codificado", () => {
    expect(enlaceWhatsapp("3412717813", "Hola Sabri! ¿Cómo va?")).toBe(
      "https://wa.me/5493412717813?text=Hola%20Sabri!%20%C2%BFC%C3%B3mo%20va%3F",
    );
  });
  it("devuelve null si el número no sirve", () => {
    expect(enlaceWhatsapp("341322858", "Hola")).toBeNull();
  });
});
