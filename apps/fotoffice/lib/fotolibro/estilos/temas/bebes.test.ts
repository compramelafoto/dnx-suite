import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { BEBES } from "./bebes";

describe("estilos de bebés", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(BEBES).toHaveLength(10);
    expect(problemasDeEstilos(BEBES)).toEqual([]);
  });
});
