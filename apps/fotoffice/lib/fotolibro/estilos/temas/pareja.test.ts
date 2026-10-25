import { describe, expect, it } from "vitest";
import { problemasDeEstilos } from "../comprobar";
import { PAREJA } from "./pareja";

describe("estilos de pareja", () => {
  it("son 10 y cumplen las reglas", () => {
    expect(PAREJA).toHaveLength(10);
    expect(problemasDeEstilos(PAREJA)).toEqual([]);
  });
});
