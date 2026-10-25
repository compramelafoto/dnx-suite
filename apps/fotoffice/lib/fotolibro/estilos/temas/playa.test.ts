import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { PLAYA } from "./playa";

describe("estilos de playa", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(PLAYA).toHaveLength(10);
    expect(problemasDeEstilos(PLAYA)).toEqual([]);
  });
});
