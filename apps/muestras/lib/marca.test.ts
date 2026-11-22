import { describe, expect, it } from "vitest";
import { MARCAS, esHostDeArte, marcaDeDisciplina, marcaPorHost, marcaPorSegmento, origenPublico } from "./marca";

describe("marcaPorHost", () => {
  it.each(["muestrasdearte.com", "www.muestrasdearte.com", "WWW.MuestrasDeArte.com:443", "muestrasdearte.localhost:3014"])("%s → ARTE", (h) => expect(marcaPorHost(h).id).toBe("ARTE"));
  it.each(["muestrasfotograficas.com", "localhost:3014", "muestras-x.vercel.app", "", null, "muestrasdearte.com.evil.io"])("%s → FOTOGRAFIA", (h) => expect(marcaPorHost(h as string).id).toBe("FOTOGRAFIA"));
});
it("esHostDeArte", () => {
  expect(esHostDeArte("muestrasdearte.com")).toBe(true);
  expect(esHostDeArte("muestrasfotograficas.com")).toBe(false);
});
it("marcaDeDisciplina", () => {
  expect(marcaDeDisciplina("FOTOGRAFIA").id).toBe("FOTOGRAFIA");
  expect(marcaDeDisciplina(null).id).toBe("FOTOGRAFIA");
  expect(marcaDeDisciplina("PINTURA").id).toBe("ARTE");
});
it("marcaPorSegmento", () => {
  expect(marcaPorSegmento("arte")?.id).toBe("ARTE");
  expect(marcaPorSegmento("fotografia")?.id).toBe("FOTOGRAFIA");
  expect(marcaPorSegmento("otra")).toBeNull();
});
describe("origenPublico", () => {
  it("producción usa el dominio de la marca", () => {
    const env = { VERCEL_ENV: "production", APP_URL: "https://muestrasfotograficas.com" };
    expect(origenPublico(MARCAS.ARTE, env)).toBe("https://muestrasdearte.com");
    expect(origenPublico(MARCAS.FOTOGRAFIA, env)).toBe("https://muestrasfotograficas.com");
  });
  it("local respeta APP_URL y arte cambia el host a muestrasdearte.localhost", () => {
    const env = { NODE_ENV: "development", APP_URL: "http://localhost:3014" };
    expect(origenPublico(MARCAS.FOTOGRAFIA, env)).toBe("http://localhost:3014");
    expect(origenPublico(MARCAS.ARTE, env)).toBe("http://muestrasdearte.localhost:3014");
  });
  it("un next start local (NODE_ENV=production sin VERCEL_ENV) sigue usando APP_URL", () => {
    const env = { NODE_ENV: "production", APP_URL: "http://localhost:3014" };
    expect(origenPublico(MARCAS.FOTOGRAFIA, env)).toBe("http://localhost:3014");
  });
});
it("fotografía conserva los textos de hoy", () => {
  expect(MARCAS.FOTOGRAFIA.nombre).toBe("Muestras Fotográficas");
  expect(MARCAS.FOTOGRAFIA.descripcion).toBe("Muestras de fotografía para ver en persona, en todo el país: dónde quedan, fechas, horarios y cómo llegar.");
  expect(MARCAS.FOTOGRAFIA.rutaAutores).toBe("/fotografos");
  expect(MARCAS.FOTOGRAFIA.descriptorTarjeta).toBe("MUESTRAS FOTO");
  expect(MARCAS.ARTE.descriptorTarjeta).toBe("MUESTRAS ARTE");
});
