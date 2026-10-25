import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { EMBARAZO } from "./embarazo";

describe("estilos de embarazo", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(EMBARAZO).toHaveLength(10);
    expect(problemasDeEstilos(EMBARAZO)).toEqual([]);
  });
});
