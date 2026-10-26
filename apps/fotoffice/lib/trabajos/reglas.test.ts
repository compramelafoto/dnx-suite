import { describe, expect, it } from "vitest";
import { MAX_FOTOS_POR_TRABAJO, fechaLarga, medidasReducidas, nombreParaKey, slugDeTitulo, validarSlugTrabajo } from "./reglas";

describe("validarSlugTrabajo", () => {
  it("acepta letras minúsculas, números y guiones", () => {
    expect(validarSlugTrabajo("casamiento-sofi-y-juan-2025", [])).toBeNull();
  });

  it("rechaza mayúsculas, espacios, guiones al borde y vacío", () => {
    for (const malo of ["Casamiento", "con espacio", "-borde", "borde-", "dos--guiones", ""]) {
      expect(validarSlugTrabajo(malo, [])).not.toBeNull();
    }
  });

  it("rechaza más de 80 caracteres", () => {
    expect(validarSlugTrabajo("a".repeat(80), [])).toBeNull();
    expect(validarSlugTrabajo("a".repeat(81), [])).not.toBeNull();
  });

  it("rechaza una dirección que ya usa otro trabajo", () => {
    expect(validarSlugTrabajo("boda", ["boda", "xv"])).toMatch(/ya hay otro trabajo/i);
  });
});

describe("slugDeTitulo", () => {
  it("saca tildes y signos", () => {
    expect(slugDeTitulo("Casamiento de Sofi & Juan · Año 2025")).toBe("casamiento-de-sofi-juan-ano-2025");
  });

  it("nunca pasa de 80 y no termina en guion", () => {
    const s = slugDeTitulo("palabra ".repeat(40));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });

  it("título sin letras da vacío", () => {
    expect(slugDeTitulo("¡¡¡")).toBe("");
  });
});

describe("fechaLarga", () => {
  it("escribe el día calendario sin correrlo por la zona horaria", () => {
    expect(fechaLarga(new Date("2025-03-14T00:00:00.000Z"))).toBe("14 de marzo de 2025");
    expect(fechaLarga(new Date("2025-01-01T00:00:00.000Z"))).toBe("1 de enero de 2025");
    expect(fechaLarga(new Date("2025-12-31T00:00:00.000Z"))).toBe("31 de diciembre de 2025");
  });
});

it("tope de fotos por trabajo", () => {
  expect(MAX_FOTOS_POR_TRABAJO).toBe(300);
});

describe("medidasReducidas", () => {
  it("lleva el lado más largo a 2560 y conserva la proporción", () => {
    expect(medidasReducidas(6000, 4000)).toEqual({ ancho: 2560, alto: 1707 });
    expect(medidasReducidas(4000, 6000)).toEqual({ ancho: 1707, alto: 2560 });
  });

  it("nunca agranda", () => {
    expect(medidasReducidas(1200, 800)).toEqual({ ancho: 1200, alto: 800 });
    expect(medidasReducidas(2560, 2560)).toEqual({ ancho: 2560, alto: 2560 });
  });

  it("respeta otro máximo y no da cero en una tira finísima", () => {
    expect(medidasReducidas(1000, 500, 100)).toEqual({ ancho: 100, alto: 50 });
    expect(medidasReducidas(100000, 2)).toEqual({ ancho: 2560, alto: 1 });
  });
});

describe("nombreParaKey", () => {
  it("la extensión sale del tipo, no del nombre del archivo", () => {
    expect(nombreParaKey("image/jpeg")).toBe("foto.jpg");
    expect(nombreParaKey("image/png")).toBe("foto.png");
    expect(nombreParaKey("image/webp")).toBe("foto.webp");
    expect(nombreParaKey("text/html")).toBe("foto");
  });
});
