import { describe, expect, it } from "vitest";
import { fotosOpcionales } from "./fotos-opcionales";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("fotosOpcionales", () => {
  it("se activa en desarrollo local con la variable", () => {
    expect(fotosOpcionales(env({ EQUIPOS_FOTOS_OPCIONALES: "1", NODE_ENV: "development" }))).toBe(true);
  });
  it("se activa en una vista privada de Vercel con la variable", () => {
    expect(
      fotosOpcionales(env({ EQUIPOS_FOTOS_OPCIONALES: "1", NODE_ENV: "production", VERCEL_ENV: "preview" })),
    ).toBe(true);
  });
  it("se bloquea en producción de Vercel", () => {
    expect(
      fotosOpcionales(env({ EQUIPOS_FOTOS_OPCIONALES: "1", NODE_ENV: "production", VERCEL_ENV: "production" })),
    ).toBe(false);
  });
  it("se bloquea en un build de producción fuera de Vercel", () => {
    expect(fotosOpcionales(env({ EQUIPOS_FOTOS_OPCIONALES: "1", NODE_ENV: "production" }))).toBe(false);
  });
  it("se bloquea si la variable no es 1", () => {
    expect(fotosOpcionales(env({ NODE_ENV: "development" }))).toBe(false);
    expect(fotosOpcionales(env({ EQUIPOS_FOTOS_OPCIONALES: "0", NODE_ENV: "development" }))).toBe(false);
  });
});
