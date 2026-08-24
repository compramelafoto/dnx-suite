import { describe, expect, it } from "vitest";
import { decryptPkceVerifier, encryptPkceVerifier } from "./crypto";

const KEY = Buffer.alloc(32, 3).toString("base64");
const OTRA_KEY = Buffer.alloc(32, 9).toString("base64");

describe("cifrado del verificador PKCE", () => {
  it("ida y vuelta devuelve el original", () => {
    const parts = encryptPkceVerifier("verificador-secreto", KEY);
    expect(decryptPkceVerifier(parts, KEY)).toBe("verificador-secreto");
  });

  it("el texto cifrado no contiene el original", () => {
    const parts = encryptPkceVerifier("verificador-secreto", KEY);
    expect(JSON.stringify(parts)).not.toContain("verificador-secreto");
  });

  it("dos cifrados del mismo texto no son iguales", () => {
    const a = encryptPkceVerifier("mismo", KEY);
    const b = encryptPkceVerifier("mismo", KEY);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("con otra clave no se puede descifrar", () => {
    const parts = encryptPkceVerifier("verificador", KEY);
    expect(() => decryptPkceVerifier(parts, OTRA_KEY)).toThrow();
  });

  /** GCM verifica integridad: un texto alterado no se descifra en silencio. */
  it("si alguien altera el texto cifrado, falla en vez de devolver basura", () => {
    const parts = encryptPkceVerifier("verificador", KEY);
    const alterado = {
      ...parts,
      ciphertext: Buffer.from("otra cosa distinta").toString("base64"),
    };
    expect(() => decryptPkceVerifier(alterado, KEY)).toThrow();
  });

  it("si alguien altera la etiqueta de autenticación, falla", () => {
    const parts = encryptPkceVerifier("verificador", KEY);
    const alterado = { ...parts, authTag: Buffer.alloc(16, 1).toString("base64") };
    expect(() => decryptPkceVerifier(alterado, KEY)).toThrow();
  });

  it.each([
    ["muy corta", Buffer.alloc(16, 1).toString("base64")],
    ["muy larga", Buffer.alloc(64, 1).toString("base64")],
    ["vacía", ""],
  ])("rechaza una clave maestra %s", (_label, key) => {
    expect(() => encryptPkceVerifier("x", key)).toThrow(/32 bytes/);
  });

  it("maneja textos largos y con acentos", () => {
    const texto = "á".repeat(500) + "ñÑüÜ";
    const parts = encryptPkceVerifier(texto, KEY);
    expect(decryptPkceVerifier(parts, KEY)).toBe(texto);
  });
});
