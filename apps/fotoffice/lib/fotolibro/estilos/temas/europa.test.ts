import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { EUROPA } from "./europa";

describe("estilos de europa", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(EUROPA).toHaveLength(10);
    expect(problemasDeEstilos(EUROPA)).toEqual([]);
  });
});
