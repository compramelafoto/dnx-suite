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
  it("saca forzados de dirección, etiquetas y rellenos invisibles, pero conserva los emojis", () => {
    const rlo = "\u202Emoc.mpas\u202C";
    expect(guestbookInput({ comment: `Mirá ${rlo}` }).comment).toBe("Mirá moc.mpas");
    expect(guestbookInput({ comment: "Ho\u{E0041}\u{E0042}la\u3164\u115F\u034F" }).comment).toBe("Hola");
    expect(guestbookInput({ comment: "a\u0085b\u2028c\u2029d\u009Fe" }).comment).toBe("abcde");
    expect(guestbookInput({ comment: "Genial 👩\u200D💻 ❤\uFE0F 1\uFE0F\u20E3 👍🏽" }).comment).toBe("Genial 👩\u200D💻 ❤\uFE0F 1\uFE0F\u20E3 👍🏽");
    expect(guestbookInput({ comment: "ho\u200Dla\uFE0F" }).comment).toBe("hola");
  });
  it("ve el enlace escondido detrás de un forzado de dirección o de etiquetas", () => {
    expect(hasLinkOrEmail("Mirá \u202Emoc.mpas\u202C")).toBe(true);
    expect(hasLinkOrEmail("spam\u{E0020}.\u{E0020}com")).toBe(true);
    expect(hasLinkOrEmail("spam.\u200Bcom")).toBe(true);
    const crudo = "Mirá \u202Emoc.mpas\u202C";
    expect(guestbookProblems(guestbookInput({ comment: crudo }), [crudo])).toEqual([
      "Los comentarios no pueden llevar enlaces ni direcciones de correo.",
    ]);
  });
  it("un punto sin espacio entre oraciones no es un dominio", () => {
    expect(hasLinkOrEmail("Hermosa muestra.Me encantó")).toBe(false);
    expect(hasLinkOrEmail("Gracias.Me voy feliz")).toBe(false);
    expect(hasLinkOrEmail("gracias.me voy feliz")).toBe(false);
    expect(hasLinkOrEmail("Un lindo recorrido.co")).toBe(false);
    expect(hasLinkOrEmail("Leé spam.comentario")).toBe(false);
    expect(hasLinkOrEmail("entrá a spam.com.")).toBe(true);
    expect(hasLinkOrEmail("entrá a spam.com/oferta")).toBe(true);
    expect(hasLinkOrEmail("spam.com, dale")).toBe(true);
    expect(hasLinkOrEmail("spam.com.ar")).toBe(true);
    expect(hasLinkOrEmail("bit.ly/abc")).toBe(true);
    expect(hasLinkOrEmail("x.me/abc")).toBe(true);
    expect(hasLinkOrEmail("WWW.ALGO.COM")).toBe(true);
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
