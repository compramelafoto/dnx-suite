import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  guestbookInput, guestbookProblems, guestbookSignature, guestbookState, hasLinkOrEmail, initialEntryStatus, isTooFast,
  nextEntryStatus,
} from "./guestbook";

describe("entrada del libro", () => {
  it("limpia espacios, invisibles y saltos de más", () => {
    expect(guestbookInput({ name: "  Ana\u200B  ", city: "", comment: " Hermosa\r\n\r\n\r\n\r\nmuestra  ", })).toEqual({
      name: "Ana", city: null, comment: "Hermosa\n\nmuestra",
    });
    expect(guestbookInput({})).toEqual({ name: null, city: null, comment: "" });
  });
  it("problemas: vacío, largo, enlaces y correos", () => {
    expect(guestbookProblems({ name: null, city: null, comment: "" })).toEqual(["Escribí un comentario."]);
    expect(guestbookProblems({ name: "x".repeat(61), city: null, comment: "a".repeat(501) })).toEqual([
      "El comentario puede tener hasta 500 caracteres.", "El nombre puede tener hasta 60 caracteres.",
    ]);
    expect(guestbookProblems({ name: null, city: null, comment: "Mirá www.algo.com" })).toEqual([
      "Los comentarios no pueden llevar enlaces ni direcciones de correo.",
    ]);
    expect(guestbookProblems({ name: "Ana", city: "Rosario", comment: "Me encantó. Vuelvo el sábado." })).toEqual([]);
  });
  it("detecta enlaces y correos sin confundir puntos comunes", () => {
    expect(hasLinkOrEmail("https://x.y")).toBe(true);
    expect(hasLinkOrEmail("escribime a ana@gmail.com")).toBe(true);
    expect(hasLinkOrEmail("compren en spam.ru")).toBe(true);
    expect(hasLinkOrEmail("Qué foto.Arriba la luz")).toBe(false);
    expect(hasLinkOrEmail("Gracias. Felicitaciones")).toBe(false);
  });
  it("demasiado rápido para una persona", () => {
    expect(isTooFast(1000, 2000)).toBe(true);
    expect(isTooFast(1000, 4500)).toBe(false);
    expect(isTooFast(null, 4500)).toBe(true);
    expect(isTooFast(Number.NaN, 4500)).toBe(true);
  });
});

describe("cuándo recibe", () => {
  const base = { reviewStatus: "APPROVED", type: "MUESTRA", isCancelled: false, guestbookMode: "PUBLISH", endsAt: dayEndAr("2026-11-30") };
  const durante = dayStartAr("2026-11-10");
  it("abierto durante la muestra y hasta 15 días después", () => {
    expect(guestbookState(base, durante)).toBe("OPEN");
    expect(guestbookState(base, new Date(dayEndAr("2026-12-15").getTime() - 1))).toBe("OPEN");
    expect(guestbookState(base, dayStartAr("2026-12-16"))).toBe("ENDED");
  });
  it("cerrado por el organizador o cancelada", () => {
    expect(guestbookState({ ...base, guestbookMode: "OFF" }, durante)).toBe("OFF");
    expect(guestbookState({ ...base, isCancelled: true }, durante)).toBe("OFF");
  });
  it("no existe si no está publicada o no es una muestra", () => {
    expect(guestbookState({ ...base, reviewStatus: "UNPUBLISHED" }, durante)).toBe("UNAVAILABLE");
    expect(guestbookState({ ...base, type: "CHARLA" }, durante)).toBe("UNAVAILABLE");
  });
});

describe("moderación y firma", () => {
  it("estado inicial según el modo", () => {
    expect(initialEntryStatus("PUBLISH")).toBe("PUBLISHED");
    expect(initialEntryStatus("REVIEW")).toBe("PENDING");
    expect(initialEntryStatus("raro")).toBe("PUBLISHED");
  });
  it("publicar, ocultar, borrar", () => {
    expect(nextEntryStatus("publish")).toBe("PUBLISHED");
    expect(nextEntryStatus("hide")).toBe("HIDDEN");
    expect(nextEntryStatus("delete")).toBeNull();
  });
  it("firma con lo que haya", () => {
    expect(guestbookSignature({ name: "Ana", city: "Rosario" })).toBe("Ana, de Rosario");
    expect(guestbookSignature({ name: "Ana", city: null })).toBe("Ana");
    expect(guestbookSignature({ name: null, city: "Rosario" })).toBe("Visitante de Rosario");
    expect(guestbookSignature({ name: null, city: null })).toBe("Visitante");
  });
});
