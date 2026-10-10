import { describe, expect, it } from "vitest";
import { lineasConParrafos } from "./dibujo";

const medir = (s: string) => s.length;

describe("lineasConParrafos", () => {
  it("respeta los párrafos y deja una línea en blanco entre ellos", () => {
    expect(lineasConParrafos("uno dos tres\n\ncuatro", 7, medir)).toEqual(["uno dos", "tres", "", "cuatro"]);
  });
  it("un salto simple también separa párrafo", () => {
    expect(lineasConParrafos("a\nb", 10, medir)).toEqual(["a", "", "b"]);
  });
  it("vacío, sin líneas", () => expect(lineasConParrafos("  ", 10, medir)).toEqual([]));
});
