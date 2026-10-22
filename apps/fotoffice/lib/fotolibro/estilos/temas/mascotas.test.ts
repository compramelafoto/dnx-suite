import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { MASCOTAS } from "./mascotas";

describe("estilos de mascotas", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(MASCOTAS).toHaveLength(10);
    expect(problemasDeEstilos(MASCOTAS)).toEqual([]);
  });
});
