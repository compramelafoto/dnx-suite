import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { EGRESADOS } from "./egresados";

describe("estilos de egresados", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(EGRESADOS).toHaveLength(10);
    expect(problemasDeEstilos(EGRESADOS)).toEqual([]);
  });
});
