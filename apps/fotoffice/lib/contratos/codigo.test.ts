import { describe, expect, it } from "vitest";
import {
  generarCodigo, hashCodigo, MAX_CODIGOS_POR_VENTANA, MAX_INTENTOS_CODIGO, puedeEmitirCodigo, validarCodigo,
  VENTANA_CODIGOS_MS,
} from "./codigo";

const SECRETO = "secreto-de-prueba";
const T0 = new Date("2026-10-10T12:00:00.000Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

describe("generarCodigo", () => {
  it("son seis dígitos, con ceros a la izquierda si hace falta", () => {
    for (let i = 0; i < 300; i++) expect(generarCodigo()).toMatch(/^[0-9]{6}$/);
  });
});

describe("hashCodigo", () => {
  it("es HMAC hexadecimal, determinista y depende del secreto, del código y del firmante", () => {
    const h = hashCodigo("123456", SECRETO);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCodigo("123456", SECRETO)).toBe(h);
    expect(hashCodigo("123457", SECRETO)).not.toBe(h);
    expect(hashCodigo("123456", "otro")).not.toBe(h);
    expect(hashCodigo("123456", SECRETO, "f1")).not.toBe(hashCodigo("123456", SECRETO, "f2"));
    expect(h).not.toContain("123456");
  });
});

describe("puedeEmitirCodigo", () => {
  it("el primero abre la ventana y vence a los 15 minutos, con intentos en cero", () => {
    const r = puedeEmitirCodigo({ codesSentInWindow: 0, codeWindowStart: null }, T0);
    expect(r).toEqual({ ok: true, siguiente: { codesSentInWindow: 1, codeWindowStart: T0, codeExpiresAt: min(15), codeAttempts: 0 } });
  });
  it("permite tres por hora y frena el cuarto, diciendo cuándo", () => {
    let est = { codesSentInWindow: 0, codeWindowStart: null as Date | null };
    for (let i = 0; i < MAX_CODIGOS_POR_VENTANA; i++) {
      const r = puedeEmitirCodigo(est, min(i * 10));
      expect(r.ok).toBe(true);
      if (r.ok) est = { codesSentInWindow: r.siguiente.codesSentInWindow, codeWindowStart: r.siguiente.codeWindowStart };
    }
    expect(est.codesSentInWindow).toBe(3);
    expect(est.codeWindowStart).toEqual(T0);
    const cuarto = puedeEmitirCodigo(est, min(40));
    expect(cuarto).toEqual({ ok: false, motivo: "TOPE_HORARIO", reintentarDesde: new Date(T0.getTime() + VENTANA_CODIGOS_MS) });
  });
  it("pasada la hora arranca una ventana nueva", () => {
    const est = { codesSentInWindow: 3, codeWindowStart: T0 };
    const r = puedeEmitirCodigo(est, min(60));
    expect(r.ok && r.siguiente.codesSentInWindow).toBe(1);
    expect(r.ok && r.siguiente.codeWindowStart).toEqual(min(60));
    expect(puedeEmitirCodigo(est, min(59)).ok).toBe(false);
  });
});

describe("validarCodigo", () => {
  const guardado = (over: Partial<{ codeAttempts: number; codeExpiresAt: Date | null; codeHash: string | null }> = {}) => ({
    codeHash: hashCodigo("246810", SECRETO, "f1"), codeExpiresAt: min(15), codeAttempts: 0, ...over,
  });

  it("acepta el código correcto", () => {
    expect(validarCodigo("246810", guardado(), SECRETO, min(5), "f1")).toEqual({ ok: true, codeAttempts: 0 });
  });
  it("uno incorrecto gasta un intento y avisa cuántos quedan", () => {
    expect(validarCodigo("000000", guardado(), SECRETO, min(5), "f1")).toEqual({
      ok: false, motivo: "INCORRECTO", codeAttempts: 1, intentosRestantes: 4,
    });
  });
  it("después de cinco incorrectos queda agotado, aunque el sexto sea el bueno", () => {
    let intentos = 0;
    for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
      const r = validarCodigo("000000", guardado({ codeAttempts: intentos }), SECRETO, min(5), "f1");
      expect(r.ok).toBe(false);
      intentos = r.codeAttempts;
    }
    expect(intentos).toBe(5);
    expect(validarCodigo("246810", guardado({ codeAttempts: 5 }), SECRETO, min(5), "f1")).toMatchObject({ ok: false, motivo: "AGOTADO" });
  });
  it("vencido a los 15 minutos exactos, sin gastar intentos", () => {
    expect(validarCodigo("246810", guardado(), SECRETO, min(15), "f1")).toEqual({ ok: false, motivo: "VENCIDO", codeAttempts: 0 });
    expect(validarCodigo("246810", guardado(), SECRETO, new Date(min(15).getTime() - 1), "f1").ok).toBe(true);
  });
  it("sin código pedido, o con forma inválida, no gasta intentos", () => {
    expect(validarCodigo("246810", guardado({ codeHash: null }), SECRETO, min(1))).toMatchObject({ ok: false, motivo: "SIN_CODIGO", codeAttempts: 0 });
    for (const malo of ["24681", "2468100", "24681a", " 246810", "", null, 246810]) {
      expect(validarCodigo(malo, guardado(), SECRETO, min(1), "f1")).toEqual({ ok: false, motivo: "FORMATO", codeAttempts: 0 });
    }
  });
  it("el código de un firmante no vale para otro", () => {
    expect(validarCodigo("246810", guardado(), SECRETO, min(1), "f2")).toMatchObject({ ok: false, motivo: "INCORRECTO" });
  });
});
