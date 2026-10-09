import { describe, expect, test } from "vitest";
import {
  EMOJIS,
  TOPE_POR_INVITADO,
  esEmojiValido,
  puedeReaccionar,
  totalesOrdenados,
} from "./reacciones";

describe("qué emojis se aceptan", () => {
  test("los de la barra, sí", () => {
    for (const emoji of EMOJIS) expect(esEmojiValido(emoji)).toBe(true);
  });

  test("cualquier otra cosa, no", () => {
    /*
      La lista es cerrada a propósito. Si se aceptara cualquier texto, la pantalla del
      salón sería un cartel abierto donde cualquiera con el QR escribe lo que quiera,
      proyectado en grande y sin moderación. Los emojis pasan sin revisar justamente
      porque no pueden decir nada.
    */
    expect(esEmojiValido("🖕")).toBe(false);
    expect(esEmojiValido("puto")).toBe(false);
    expect(esEmojiValido("<script>alert(1)</script>")).toBe(false);
    expect(esEmojiValido("")).toBe(false);
    expect(esEmojiValido("❤️❤️❤️")).toBe(false);
  });
});

describe("el freno al que aprieta sin parar", () => {
  const ahora = new Date("2026-10-10T22:00:00Z");

  test("la primera siempre pasa", () => {
    expect(puedeReaccionar({ enviadas: 0, ultimaEl: null, ahora }).ok).toBe(true);
  });

  test("dos seguidas en el mismo segundo, no", () => {
    const hace200ms = new Date(ahora.getTime() - 200);

    expect(puedeReaccionar({ enviadas: 3, ultimaEl: hace200ms, ahora }).ok).toBe(false);
  });

  test("esperando un momento, sí", () => {
    const hace2s = new Date(ahora.getTime() - 2_000);

    expect(puedeReaccionar({ enviadas: 3, ultimaEl: hace2s, ahora }).ok).toBe(true);
  });

  test("hay un tope por invitado para toda la noche", () => {
    const hace1h = new Date(ahora.getTime() - 3_600_000);
    const veredicto = puedeReaccionar({ enviadas: TOPE_POR_INVITADO, ultimaEl: hace1h, ahora });

    expect(veredicto.ok).toBe(false);
    // El motivo se le muestra al invitado: tiene que decirle por qué, no sólo que no.
    if (veredicto.ok) throw new Error("se esperaba un rechazo");
    expect(veredicto.motivo).toContain("tope");
  });

  test("justo debajo del tope todavía pasa", () => {
    const hace1h = new Date(ahora.getTime() - 3_600_000);

    expect(
      puedeReaccionar({ enviadas: TOPE_POR_INVITADO - 1, ultimaEl: hace1h, ahora }).ok,
    ).toBe(true);
  });
});

describe("el contador que ve el salón", () => {
  test("ordena de más votado a menos", () => {
    const totales = totalesOrdenados({ "❤️": 3, "🔥": 12, "👏": 7 });

    expect(totales.map((t) => t.emoji)).toEqual(["🔥", "👏", "❤️"]);
    expect(totales.map((t) => t.total)).toEqual([12, 7, 3]);
  });

  test("los que nadie mandó no ocupan lugar en la pantalla", () => {
    const totales = totalesOrdenados({ "❤️": 2, "🔥": 0 });

    expect(totales).toHaveLength(1);
    expect(totales[0]!.emoji).toBe("❤️");
  });

  test("sin reacciones todavía, la lista va vacía", () => {
    expect(totalesOrdenados({})).toEqual([]);
  });

  test("ante un empate, el orden es estable y no baila en la pantalla", () => {
    /*
      En un televisor que nadie toca, un contador que reordena sus columnas cada segundo
      porque dos emojis empataron se ve roto. Con empate se respeta el orden de la barra.
    */
    const unaVez = totalesOrdenados({ "🔥": 5, "❤️": 5, "👏": 5 });
    const otraVez = totalesOrdenados({ "👏": 5, "❤️": 5, "🔥": 5 });

    expect(unaVez.map((t) => t.emoji)).toEqual(otraVez.map((t) => t.emoji));
  });
});
