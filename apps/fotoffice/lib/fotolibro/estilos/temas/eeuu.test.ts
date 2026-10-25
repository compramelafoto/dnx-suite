import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { EEUU } from "./eeuu";

describe("estilos de Estados Unidos", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(EEUU).toHaveLength(10);
    expect(problemasDeEstilos(EEUU)).toEqual([]);
  });
});
