import { Prisma } from "@repo/db";
import { describe, expect, it } from "vitest";
import { esChoqueDeCreacion } from "./choque-de-creacion";

function errorDePrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError("falló", { code, clientVersion: "test" });
}

describe("reconocer el choque de dos creaciones simultáneas", () => {
  it("reconoce el error de índice único (P2002)", () => {
    expect(esChoqueDeCreacion(errorDePrisma("P2002"))).toBe(true);
  });

  it("no confunde otros errores de Prisma", () => {
    expect(esChoqueDeCreacion(errorDePrisma("P2025"))).toBe(false);
  });

  it("no confunde errores que no son de Prisma", () => {
    expect(esChoqueDeCreacion(new Error("boom"))).toBe(false);
    expect(esChoqueDeCreacion({ code: "P2002" })).toBe(false);
    expect(esChoqueDeCreacion(null)).toBe(false);
  });
});
