import { describe, expect, it } from "vitest";
import { MARCAS } from "@/lib/marca";
import { casaDePerfil, decidirCasaDePerfil, rutaDePerfil } from "./casa";

const PROD = { VERCEL_ENV: "production" };
const LOCAL = { APP_URL: "http://localhost:3031" };

describe("casaDePerfil", () => {
  it("sólo fotografía, o nada, es fotografía", () => {
    expect(casaDePerfil(["FOTOGRAFIA"])).toBe("FOTOGRAFIA");
    expect(casaDePerfil([])).toBe("FOTOGRAFIA");
    expect(casaDePerfil(null)).toBe("FOTOGRAFIA");
  });
  it("cualquier otra disciplina es arte", () => {
    expect(casaDePerfil(["FOTOGRAFIA", "PINTURA"])).toBe("ARTE");
    expect(casaDePerfil(["ESCULTURA"])).toBe("ARTE");
  });
});

describe("rutaDePerfil", () => {
  it("usa la ruta de autores de la marca", () => {
    expect(rutaDePerfil(MARCAS.FOTOGRAFIA, "ana")).toBe("/fotografos/ana");
    expect(rutaDePerfil(MARCAS.ARTE, "ana")).toBe("/artistas/ana");
  });
});

describe("decidirCasaDePerfil", () => {
  it("un perfil de arte pedido en fotografía redirige a /artistas en el dominio de arte", () =>
    expect(decidirCasaDePerfil("FOTOGRAFIA", ["PINTURA"], "ana", PROD)).toEqual({ tipo: "redirigir", destino: "https://muestrasdearte.com/artistas/ana" }));
  it("un perfil de fotografía pedido en arte se muestra con canonical a fotografía", () =>
    expect(decidirCasaDePerfil("ARTE", ["FOTOGRAFIA"], "ana", PROD)).toEqual({ tipo: "mostrar", canonical: "https://muestrasfotograficas.com/fotografos/ana" }));
  it("cada perfil en su casa se muestra con su canonical", () => {
    expect(decidirCasaDePerfil("FOTOGRAFIA", ["FOTOGRAFIA"], "ana", PROD)).toEqual({ tipo: "mostrar", canonical: "https://muestrasfotograficas.com/fotografos/ana" });
    expect(decidirCasaDePerfil("ARTE", ["PINTURA"], "ana", PROD)).toEqual({ tipo: "mostrar", canonical: "https://muestrasdearte.com/artistas/ana" });
  });
  it("fuera de producción usa los orígenes locales", () =>
    expect(decidirCasaDePerfil("FOTOGRAFIA", ["GRABADO"], "ana", LOCAL)).toEqual({ tipo: "redirigir", destino: "http://muestrasdearte.localhost:3031/artistas/ana" }));
  it("sin un host de arte no redirige (sería un bucle)", () =>
    expect(decidirCasaDePerfil("FOTOGRAFIA", ["PINTURA"], "ana", { APP_URL: "https://x.vercel.app" })).toEqual({ tipo: "mostrar", canonical: "https://x.vercel.app/artistas/ana" }));
});
