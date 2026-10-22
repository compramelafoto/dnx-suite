import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { NIEVE } from "./nieve";

describe("estilos de nieve", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(NIEVE).toHaveLength(10);
    expect(problemasDeEstilos(NIEVE)).toEqual([]);
  });
});
