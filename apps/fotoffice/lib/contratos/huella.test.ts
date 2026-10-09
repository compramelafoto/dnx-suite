import { describe, expect, it } from "vitest";
import { esHuella, huellaBytes, huellaTexto } from "./huella";

describe("huella", () => {
  it("SHA-256 en hexadecimal, con vectores conocidos", () => {
    expect(huellaTexto("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(huellaTexto("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("usa UTF-8", () => {
    expect(huellaTexto("ñandú — €")).toBe(huellaBytes(new TextEncoder().encode("ñandú — €")));
    expect(huellaTexto("ñ")).not.toBe(huellaTexto("n"));
  });
  it("esHuella acepta sólo 64 hexadecimales en minúscula", () => {
    expect(esHuella(huellaTexto("x"))).toBe(true);
    expect(esHuella(huellaTexto("x").toUpperCase())).toBe(false);
    expect(esHuella("abc")).toBe(false);
    expect(esHuella(null)).toBe(false);
  });
});
