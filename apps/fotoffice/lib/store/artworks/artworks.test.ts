import { describe, expect, it } from "vitest";
import { eligibleFormats, minLongSidePx, needsBorders } from "./resolution";
import { applyAuthorAction, consentBasisFromRights, isSellable } from "./consent-basis";
import { royaltyMinor } from "./royalty";
import { artworkSlug } from "./slug";

describe("resolución", () => {
  it("20x30 a 300 dpi pide 3544 px de lado mayor", () => {
    expect(minLongSidePx({ widthCm: 20, heightCm: 30 }, 300)).toBe(3544);
    expect(minLongSidePx({ widthCm: 30, heightCm: 20 }, 300)).toBe(3544);
  });
  it("filtra los formatos que alcanza", () => {
    const f = [{ widthCm: 10, heightCm: 15 }, { widthCm: 40, heightCm: 60 }];
    expect(eligibleFormats({ width: 2000, height: 3000 }, f, 300)).toEqual([f[0]]);
    expect(eligibleFormats({ width: 3544, height: 2362 }, [{ widthCm: 20, heightCm: 30 }], 300)).toHaveLength(1);
  });
  it("bordes cuando la proporción difiere más de 2 %", () => {
    expect(needsBorders({ width: 3000, height: 2000 }, { widthCm: 20, heightCm: 30 })).toBe(false);
    expect(needsBorders({ width: 3000, height: 3000 }, { widthCm: 20, heightCm: 30 })).toBe(true);
    expect(needsBorders({ width: 2000, height: 3000 }, { widthCm: 30, heightCm: 20 })).toBe(false);
  });
});

describe("consentimiento", () => {
  it("base según derechos", () => {
    expect(consentBasisFromRights(null)).toBe("EXPLICIT");
    expect(consentBasisFromRights({ allowPrint: true, allowCommercial: false })).toBe("EXPLICIT");
    expect(consentBasisFromRights({ allowPrint: true, allowCommercial: true })).toBe("RULES");
  });
  it("vendible", () => {
    expect(isSellable(null)).toBe(false);
    expect(isSellable({ basis: "RULES", status: "NOTIFIED" })).toBe(true);
    expect(isSellable({ basis: "RULES", status: "WITHDRAWN" })).toBe(false);
    expect(isSellable({ basis: "EXPLICIT", status: "GRANTED" })).toBe(true);
    expect(isSellable({ basis: "EXPLICIT", status: "PENDING" })).toBe(false);
  });
  it("transiciones del autor", () => {
    expect(applyAuthorAction({ basis: "RULES", status: "NOTIFIED" }, "withdraw")).toEqual({ ok: true, status: "WITHDRAWN" });
    expect(applyAuthorAction({ basis: "RULES", status: "NOTIFIED" }, "accept")).toEqual({ ok: false });
    expect(applyAuthorAction({ basis: "EXPLICIT", status: "PENDING" }, "accept")).toEqual({ ok: true, status: "GRANTED" });
    expect(applyAuthorAction({ basis: "EXPLICIT", status: "PENDING" }, "decline")).toEqual({ ok: true, status: "DECLINED" });
    expect(applyAuthorAction({ basis: "EXPLICIT", status: "PENDING" }, "withdraw")).toEqual({ ok: false });
    expect(applyAuthorAction({ basis: "EXPLICIT", status: "GRANTED" }, "withdraw")).toEqual({ ok: true, status: "WITHDRAWN" });
    expect(applyAuthorAction({ basis: "EXPLICIT", status: "DECLINED" }, "accept")).toEqual({ ok: false });
    expect(applyAuthorAction({ basis: "EXPLICIT", status: "WITHDRAWN" }, "accept")).toEqual({ ok: false });
  });
});

describe("regalía", () => {
  it("redondea y no es negativa", () => {
    expect(royaltyMinor(10000, 2000)).toBe(2000);
    expect(royaltyMinor(1999, 2000)).toBe(400);
    expect(royaltyMinor(-500, 2000)).toBe(0);
    expect(royaltyMinor(5000, 0)).toBe(0);
    expect(royaltyMinor(5000, 10000)).toBe(5000);
  });
  it("bps inválidos", () => {
    expect(() => royaltyMinor(100, -1)).toThrow();
    expect(() => royaltyMinor(100, 10001)).toThrow();
    expect(() => royaltyMinor(100, 1.5)).toThrow();
  });
});

describe("slug de obra", () => {
  it("del título, único", () => {
    expect(artworkSlug("Atardecer en el río", "SANTAF-000083", new Set())).toBe("atardecer-en-el-rio");
    expect(artworkSlug("Atardecer en el río", "X", new Set(["atardecer-en-el-rio"]))).toBe("atardecer-en-el-rio-2");
  });
  it("sin título usable, del número de obra", () => {
    expect(artworkSlug("???", "SANTAF-000083", new Set())).toBe("obra-santaf-000083");
    expect(artworkSlug("", "SANTAF-000083", new Set(["obra-santaf-000083"]))).toBe("obra-santaf-000083-2");
  });
  it("no pisa las reservadas", () => {
    expect(artworkSlug("Carrito", "A", new Set())).toBe("carrito-2");
  });
});
