import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { BAUTISMO } from "./bautismo";

describe("estilos de bautismo", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(BAUTISMO).toHaveLength(10);
    expect(problemasDeEstilos(BAUTISMO)).toEqual([]);
  });
});
