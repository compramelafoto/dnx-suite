import { describe, expect, test } from "vitest";
import { correoTapado } from "./correo-tapado";

describe("tapar un correo para mostrarlo", () => {
  test("deja las dos primeras y la última del nombre", () => {
    expect(correoTapado("daniel@gmail.com")).toBe("da***l@gmail.com");
  });

  test("el dominio se muestra entero: es lo que sirve para reconocerlo", () => {
    expect(correoTapado("mariana@estudioluna.com.ar")).toBe("ma***a@estudioluna.com.ar");
  });

  test("un nombre cortito no se puede tapar a medias", () => {
    // "juan" quedaría como "ju***n", que es el nombre entero.
    expect(correoTapado("juan@gmail.com")).toBe("***@gmail.com");
    expect(correoTapado("ana@gmail.com")).toBe("***@gmail.com");
    expect(correoTapado("a@gmail.com")).toBe("***@gmail.com");
  });

  test("algo que no es un correo se tapa entero", () => {
    expect(correoTapado("cualquier cosa")).toBe("***");
    expect(correoTapado("")).toBe("***");
    expect(correoTapado(null)).toBe("***");
  });
});
