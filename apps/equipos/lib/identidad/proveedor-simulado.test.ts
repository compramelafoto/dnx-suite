import { describe, expect, it } from "vitest";
import { simuladorPermitido } from "./proveedor-simulado";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("simuladorPermitido", () => {
  it("permite el simulador en desarrollo local", () => {
    expect(simuladorPermitido(env({ IDENTITY_PROVIDER: "simulado", NODE_ENV: "development" }))).toBe(true);
  });
  it("permite el simulador en una vista privada de Vercel", () => {
    expect(
      simuladorPermitido(env({ IDENTITY_PROVIDER: "simulado", NODE_ENV: "production", VERCEL_ENV: "preview" })),
    ).toBe(true);
  });
  it("lo bloquea en producción de Vercel", () => {
    expect(
      simuladorPermitido(env({ IDENTITY_PROVIDER: "simulado", NODE_ENV: "production", VERCEL_ENV: "production" })),
    ).toBe(false);
  });
  it("lo bloquea en un build de producción fuera de Vercel", () => {
    expect(simuladorPermitido(env({ IDENTITY_PROVIDER: "simulado", NODE_ENV: "production" }))).toBe(false);
  });
  it("lo bloquea si el proveedor no es el simulado", () => {
    expect(simuladorPermitido(env({ IDENTITY_PROVIDER: "didit", NODE_ENV: "development" }))).toBe(false);
  });
});
