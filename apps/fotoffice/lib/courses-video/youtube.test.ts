import { describe, expect, it } from "vitest";
import { esCursoGratuito, leerEnlaceDeYoutube, urlDeInsercionDeYoutube } from "./youtube";

describe("leerEnlaceDeYoutube", () => {
  it("acepta los formatos habituales", () => {
    for (const enlace of [
      "https://youtu.be/LiSZdyznYds",
      "https://www.youtube.com/watch?v=LiSZdyznYds&t=10",
      "https://youtube.com/shorts/LiSZdyznYds",
      "https://www.youtube.com/embed/LiSZdyznYds",
      " youtu.be/LiSZdyznYds?si=abc ",
    ]) {
      expect(leerEnlaceDeYoutube(enlace)).toEqual({ ok: true, id: "LiSZdyznYds" });
    }
  });

  it("rechaza lo que no es un video de YouTube", () => {
    for (const enlace of ["", "https://vimeo.com/12345", "https://www.youtube.com/playlist?list=PLx", "hola"]) {
      expect(leerEnlaceDeYoutube(enlace).ok).toBe(false);
    }
  });
});

describe("esCursoGratuito", () => {
  it("es gratuito el grabado sin precio o con precio cero", () => {
    expect(esCursoGratuito({ deliveryMode: "RECORDED", priceArs: null })).toBe(true);
    expect(esCursoGratuito({ deliveryMode: "RECORDED", priceArs: "0" })).toBe(true);
    expect(esCursoGratuito({ deliveryMode: "RECORDED", priceArs: "0.00" })).toBe(true);
  });

  it("no lo es con precio, ni un presencial", () => {
    expect(esCursoGratuito({ deliveryMode: "RECORDED", priceArs: "75000" })).toBe(false);
    expect(esCursoGratuito({ deliveryMode: "PRESENCIAL", priceArs: null })).toBe(false);
  });
});

it("inserta sin cookies de seguimiento", () => {
  expect(urlDeInsercionDeYoutube("LiSZdyznYds")).toBe(
    "https://www.youtube-nocookie.com/embed/LiSZdyznYds?rel=0&modestbranding=1",
  );
});
