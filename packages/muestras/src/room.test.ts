import { describe, expect, it } from "vitest";
import {
  ROOM_PASS_HOURS, decodeRoomPass, encodeRoomPass, isRoomCode, mergeRoomPass, roomCodeFrom, roomPassCookieName,
  roomPassValid, saleState, showBuyButton,
} from "./room";

const ahora = new Date("2026-11-10T20:00:00Z");

describe("código de sala", () => {
  it("12 símbolos del alfabeto, sin ambiguos", () => {
    const c = roomCodeFrom(new Uint8Array([0, 1, 2, 30, 31, 62, 100, 200, 255, 7, 8, 9]));
    expect(c).toHaveLength(12);
    expect(isRoomCode(c)).toBe(true);
    expect(isRoomCode("0123456789ab")).toBe(false);
    expect(isRoomCode("clx9a8b7c6d5e4f3g2h1i0j9")).toBe(false); // un id de obra no es un código
  });
});

describe("pase de sala", () => {
  it("se arma, se lee y vence a las 8 horas", () => {
    const p = mergeRoomPass(null, { activityId: "a1", workId: "w1", now: ahora });
    expect(p).toEqual({ v: 1, a: "a1", exp: ahora.getTime() + ROOM_PASS_HOURS * 3600_000, w: ["w1"] });
    expect(decodeRoomPass(encodeRoomPass(p))).toEqual(p);
    expect(roomPassValid(p, "a1", ahora)).toBe(true);
    expect(roomPassValid(p, "a2", ahora)).toBe(false);
    expect(roomPassValid(p, "a1", new Date(p.exp + 1))).toBe(false);
  });
  it("cada escaneo suma la obra y renueva; uno de otra muestra empieza de cero", () => {
    const p1 = mergeRoomPass(null, { activityId: "a1", workId: "w1", now: ahora });
    const luego = new Date(ahora.getTime() + 3600_000);
    const p2 = mergeRoomPass(p1, { activityId: "a1", workId: "w2", now: luego });
    expect(p2.w).toEqual(["w1", "w2"]);
    expect(p2.exp).toBe(luego.getTime() + ROOM_PASS_HOURS * 3600_000);
    expect(mergeRoomPass(p2, { activityId: "b9", workId: "x", now: luego }).w).toEqual(["x"]);
  });
  it("tope de 60 obras: quedan las últimas", () => {
    let p = null;
    for (let i = 0; i < 65; i++) p = mergeRoomPass(p, { activityId: "a1", workId: `w${i}`, now: ahora });
    expect(p!.w).toHaveLength(60);
    expect(p!.w[0]).toBe("w5");
  });
  it("basura no se lee", () => {
    for (const s of ["", "x", encodeRoomPass({ v: 2 } as never)]) expect(decodeRoomPass(s), s).toBeNull();
  });
  it("nombre de la cookie", () => expect(roomPassCookieName("ck1")).toBe("mf_sala_ck1"));
});

describe("adquirir obra", () => {
  it("el botón aparece con la opción de sala y la obra a la venta", () => {
    expect(showBuyButton({ roomBuy: true, forSale: true })).toBe(true);
    expect(showBuyButton({ roomBuy: false, forSale: true })).toBe(false);
    expect(showBuyButton({ roomBuy: true, forSale: false })).toBe(false);
  });
  it("mientras no hay venta, la página dice que no está disponible", () => {
    expect(saleState({ salesEnabled: false, forSale: true })).toBe("UNAVAILABLE");
    expect(saleState({ salesEnabled: false, forSale: false })).toBe("NOT_FOR_SALE");
  });
});
