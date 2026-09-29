import { describe, expect, it } from "vitest";
import { alApagar, alEncender } from "./dependencies";

describe("dependencias de módulos", () => {
  it("encender cuotas sin socios pide socios", () => {
    expect(alEncender("membership-dues", new Set())).toEqual(["members"]);
  });
  it("encender cuotas con socios no pide nada", () => {
    expect(alEncender("membership-dues", new Set(["members"]))).toEqual([]);
  });
  it("evaluaciones pide cursos", () => {
    expect(alEncender("evaluaciones", new Set())).toEqual(["courses-sales"]);
  });
  it("apagar socios avisa que cuotas deja de funcionar", () => {
    expect(alApagar("members", new Set(["members", "membership-dues", "cash"]))).toEqual(["membership-dues"]);
  });
  it("apagar algo sin dependientes no avisa", () => {
    expect(alApagar("cash", new Set(["cash", "clients"]))).toEqual([]);
  });
  it("no hay ciclos en el catálogo", () => {
    for (const k of ["membership-dues", "evaluaciones", "members", "cash"]) expect(Array.isArray(alEncender(k, new Set()))).toBe(true);
  });
});
