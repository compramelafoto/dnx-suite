import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "acceso.ts"), "utf8");
const fn = src.slice(src.indexOf("export async function contextoDeListado"));

describe("contextoDeListado", () => {
  it("nunca redirige (se usa en descargas y acciones)", () => expect(fn).not.toMatch(/redirect\(/));
  it("exige el módulo encendido y la capacidad operar", () => {
    expect(fn).toMatch(/isModuleEnabledForWorkspace/);
    expect(fn).toMatch(/puede\([^)]*"operar"\)/);
  });
  it("el workspace sale de la sesión", () => expect(fn).toMatch(/resolveActiveWorkspace\(/));
});
