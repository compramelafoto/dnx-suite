import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { COMUNION } from "./comunion";

describe("estilos de comunion", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(COMUNION).toHaveLength(10);
    expect(problemasDeEstilos(COMUNION)).toEqual([]);
  });
});
