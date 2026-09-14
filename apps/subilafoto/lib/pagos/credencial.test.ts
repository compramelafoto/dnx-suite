import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { descifrarCredencial, esCredencial, cifrarCredencial } from "./credencial";

const CLAVE = randomBytes(32).toString("base64");

describe("el token del vendedor se guarda cifrado", () => {
  test("lo que se cifra se recupera igual", () => {
    const guardado = cifrarCredencial({ accessToken: "APP_USR-123", refreshToken: "TG-456" }, CLAVE);
    expect(descifrarCredencial(guardado, CLAVE)).toEqual({
      accessToken: "APP_USR-123",
      refreshToken: "TG-456",
    });
  });

  test("el token no aparece en lo que se guarda", () => {
    // Lo importante: si alguien lee la base, no encuentra el token. Con ese
    // token se puede cobrar en nombre del vendedor.
    const guardado = cifrarCredencial({ accessToken: "APP_USR-secreto", refreshToken: null }, CLAVE);
    expect(JSON.stringify(guardado)).not.toContain("APP_USR-secreto");
  });

  test("dos cifrados del mismo token son distintos", () => {
    const a = cifrarCredencial({ accessToken: "igual", refreshToken: null }, CLAVE);
    const b = cifrarCredencial({ accessToken: "igual", refreshToken: null }, CLAVE);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  test("con otra clave no se puede leer", () => {
    const guardado = cifrarCredencial({ accessToken: "APP_USR-123", refreshToken: null }, CLAVE);
    expect(() => descifrarCredencial(guardado, randomBytes(32).toString("base64"))).toThrow();
  });

  test("un texto cifrado alterado no se acepta", () => {
    // AES-GCM lo detecta: no devuelve basura, falla. Es la diferencia entre
    // cifrar y cifrar con autenticación.
    const guardado = cifrarCredencial({ accessToken: "APP_USR-123", refreshToken: null }, CLAVE);
    const roto = { ...guardado, ciphertext: Buffer.from("otracosa").toString("base64") };
    expect(() => descifrarCredencial(roto, CLAVE)).toThrow();
  });

  test("reconoce lo que guardó y descarta cualquier otra cosa", () => {
    expect(esCredencial(cifrarCredencial({ accessToken: "x", refreshToken: null }, CLAVE))).toBe(true);
    for (const basura of [null, undefined, {}, "texto", 42, { ciphertext: "a" }]) {
      expect(esCredencial(basura)).toBe(false);
    }
  });

  test("una clave que no mide 32 bytes no se acepta", () => {
    expect(() => cifrarCredencial({ accessToken: "x", refreshToken: null }, "corta")).toThrow();
  });
});
