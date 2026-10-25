import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { FAMILIA } from "./familia";

describe("estilos de familia", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(FAMILIA).toHaveLength(10);
    expect(problemasDeEstilos(FAMILIA)).toEqual([]);
  });
});
