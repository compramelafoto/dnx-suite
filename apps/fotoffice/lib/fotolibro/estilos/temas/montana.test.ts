import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { MONTANA } from "./montana";

describe("estilos de montaña", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(MONTANA).toHaveLength(10);
    expect(problemasDeEstilos(MONTANA)).toEqual([]);
  });
});
