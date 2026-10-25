import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { ADULTOS } from "./adultos";

describe("estilos de cumpleaños de adultos", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(ADULTOS).toHaveLength(10);
    expect(problemasDeEstilos(ADULTOS)).toEqual([]);
  });
});
