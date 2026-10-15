import { describe, expect, it } from "vitest";
import { MENSAJES_ALBUM as M, puntoRelativo, rectDeImagenContenida, validarDecision, validarPin } from "./album-reglas";

describe("validarPin", () => {
  it("sin pin es un comentario general", () => {
    expect(validarPin(undefined)).toEqual({ ok: true, pin: null });
    expect(validarPin(null)).toEqual({ ok: true, pin: null });
  });
  it("acepta x e y entre 0 y 1, bordes incluidos", () => {
    expect(validarPin({ x: 0, y: 1 })).toEqual({ ok: true, pin: { x: 0, y: 1 } });
    expect(validarPin({ x: 0.25, y: 0.75, otro: 3 })).toEqual({ ok: true, pin: { x: 0.25, y: 0.75 } });
  });
  it.each([
    [{ x: 1.0001, y: 0.5 }],
    [{ x: -0.01, y: 0.5 }],
    [{ x: 0.5 }],
    [{ y: 0.5 }],
    [{ x: NaN, y: 0.5 }],
    [{ x: Infinity, y: 0.5 }],
    [{ x: "0.5", y: 0.5 }],
    [{ x: null, y: 0.5 }],
    [[0.5, 0.5]],
    ["0.5,0.5"],
    [42],
    [true],
  ])("rechaza %j", (raw) => {
    expect(validarPin(raw)).toEqual({ ok: false, error: M.pinInvalido });
  });
});

describe("la imagen dibujada con object-fit: contain", () => {
  it("una foto apaisada en una caja cuadrada deja bandas arriba y abajo", () => {
    expect(rectDeImagenContenida(400, 400, 2000, 1000)).toEqual({ left: 0, top: 100, width: 400, height: 200 });
  });
  it("una foto vertical en una caja apaisada deja bandas a los costados", () => {
    expect(rectDeImagenContenida(800, 400, 1000, 2000)).toEqual({ left: 300, top: 0, width: 200, height: 400 });
  });
  it("sin medidas válidas no hay rectángulo", () => {
    expect(rectDeImagenContenida(0, 400, 10, 10)).toBeNull();
    expect(rectDeImagenContenida(400, 400, 0, 10)).toBeNull();
    expect(rectDeImagenContenida(400, NaN, 10, 10)).toBeNull();
  });
});

describe("puntoRelativo", () => {
  const rect = { left: 0, top: 100, width: 400, height: 200 };
  it("mide contra la imagen y no contra la caja", () => {
    expect(puntoRelativo(200, 200, rect)).toEqual({ x: 0.5, y: 0.5 });
    expect(puntoRelativo(0, 100, rect)).toEqual({ x: 0, y: 0 });
    expect(puntoRelativo(400, 300, rect)).toEqual({ x: 1, y: 1 });
    expect(puntoRelativo(100, 150, rect)).toEqual({ x: 0.25, y: 0.25 });
  });
  it("un toque en la banda vacía no marca nada", () => {
    expect(puntoRelativo(200, 50, rect)).toBeNull();
    expect(puntoRelativo(200, 350, rect)).toBeNull();
    expect(puntoRelativo(-5, 200, rect)).toBeNull();
  });
  it("coordenadas no finitas o una imagen sin tamaño no marcan nada", () => {
    expect(puntoRelativo(NaN, 200, rect)).toBeNull();
    expect(puntoRelativo(10, 10, { left: 0, top: 0, width: 0, height: 10 })).toBeNull();
  });
  it("el resultado siempre pasa la validación del pin", () => {
    const p = puntoRelativo(399.9, 299.9, rect)!;
    expect(validarPin(p).ok).toBe(true);
  });
});

describe("validarDecision", () => {
  it("aprobar no exige nada; el mensaje es opcional y se recorta", () => {
    expect(validarDecision("APROBADO", undefined, 0)).toEqual({ ok: true, decision: "APROBADO", mensaje: null });
    expect(validarDecision("APROBADO", "  Está genial \r\n", 0)).toEqual({ ok: true, decision: "APROBADO", mensaje: "Está genial" });
    expect(validarDecision("APROBADO", "   ", 0)).toEqual({ ok: true, decision: "APROBADO", mensaje: null });
  });
  it("pedir cambios sin comentarios exige un mensaje", () => {
    expect(validarDecision("CAMBIOS", undefined, 0)).toEqual({ ok: false, error: M.cambiosSinNada });
    expect(validarDecision("CAMBIOS", "   ", 0)).toEqual({ ok: false, error: M.cambiosSinNada });
    expect(validarDecision("CAMBIOS", "Cambiar la tapa", 0)).toMatchObject({ ok: true, mensaje: "Cambiar la tapa" });
  });
  it("pedir cambios con al menos un comentario no exige mensaje", () => {
    expect(validarDecision("CAMBIOS", null, 1)).toEqual({ ok: true, decision: "CAMBIOS", mensaje: null });
  });
  it("rechaza una decisión desconocida, un mensaje que no es texto o demasiado largo", () => {
    for (const d of ["ENVIADO", "aprobado", "", null, undefined, 3, {}]) expect(validarDecision(d, null, 5)).toEqual({ ok: false, error: M.decisionInvalida });
    expect(validarDecision("APROBADO", 12, 0)).toEqual({ ok: false, error: M.decisionInvalida });
    expect(validarDecision("APROBADO", "a".repeat(2001), 0)).toEqual({ ok: false, error: M.mensajeLargo });
    expect(validarDecision("APROBADO", "a".repeat(2000), 0).ok).toBe(true);
  });
});
