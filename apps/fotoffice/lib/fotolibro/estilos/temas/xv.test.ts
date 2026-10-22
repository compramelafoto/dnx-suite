import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { XV } from "./xv";

describe("estilos de XV", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(XV).toHaveLength(10);
    expect(problemasDeEstilos(XV)).toEqual([]);
  });
});
