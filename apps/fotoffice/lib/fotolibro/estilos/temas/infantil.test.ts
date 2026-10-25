import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { INFANTIL } from "./infantil";

describe("estilos de cumpleaños infantil", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(INFANTIL).toHaveLength(10);
    expect(problemasDeEstilos(INFANTIL)).toEqual([]);
  });
});
