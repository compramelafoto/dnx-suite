import { describe, expect, it } from "vitest";

import {
  artworkTitle,
  authorCredit,
  awardLabel,
  bestAward,
  consentLabel,
  isStoreContestStatus,
  listingLabel,
  matchesFilter,
  originalSizeOf,
  parseCatalogFilter,
  parseRoyaltyPercent,
  previewWatermark,
  royaltyPercentText,
} from "./catalog-rules";

const AHORA = new Date("2026-10-05T12:00:00Z");

describe("concursos que se muestran", () => {
  it("sólo los que ya cerraron la carga", () => {
    for (const s of ["COMPLETED", "FINALISTS", "JUDGING", "CLOSED", "ARCHIVED"]) expect(isStoreContestStatus(s)).toBe(true);
    for (const s of ["DRAFT", "PUBLISHED", "ACTIVE", "REGISTRATION_OPEN", "ADMISSION", "CANCELLED", "UPCOMING"]) {
      expect(isStoreContestStatus(s)).toBe(false);
    }
  });
});

describe("premio", () => {
  it("texto: tipo de premio o, si no tiene, el estado", () => {
    expect(awardLabel("WINNER", "FIRST_PLACE")).toBe("Primer premio");
    expect(awardLabel("MENTION", "HONORABLE_MENTION")).toBe("Mención de honor");
    expect(awardLabel("WINNER", null)).toBe("Premiada");
    expect(awardLabel("WINNER", "CUSTOM")).toBe("Premiada");
    expect(awardLabel("FINALIST", null)).toBe("Finalista");
  });
  it("el mejor entre varios resultados; RANKED o NOT_SELECTED no cuentan", () => {
    expect(bestAward([])).toBeNull();
    expect(bestAward([{ resultStatus: "RANKED", awardType: null }, { resultStatus: "NOT_SELECTED", awardType: null }])).toBeNull();
    expect(
      bestAward([
        { resultStatus: "FINALIST", awardType: "FINALIST" },
        { resultStatus: "WINNER", awardType: "THIRD_PLACE" },
        { resultStatus: "WINNER", awardType: "FIRST_PLACE" },
        { resultStatus: "MENTION", awardType: null },
      ]),
    ).toEqual({ kind: "WINNER", label: "Primer premio" });
  });
  it("filtros", () => {
    const ganadora = { kind: "WINNER" as const, label: "x" };
    const mencion = { kind: "MENTION" as const, label: "x" };
    const finalista = { kind: "FINALIST" as const, label: "x" };
    expect(parseCatalogFilter("premiadas")).toBe("premiadas");
    expect(parseCatalogFilter("otra")).toBe("todas");
    expect(parseCatalogFilter(undefined)).toBe("todas");
    expect([ganadora, mencion, finalista, null].map((a) => matchesFilter(a, "premiadas"))).toEqual([true, true, false, false]);
    expect([ganadora, mencion, finalista, null].map((a) => matchesFilter(a, "finalistas"))).toEqual([false, false, true, false]);
    expect([ganadora, mencion, finalista, null].map((a) => matchesFilter(a, "todas"))).toEqual([true, true, true, true]);
  });
});

describe("estado en palabras", () => {
  it("permiso", () => {
    expect(consentLabel(null)).toBe("Sin pedir");
    expect(consentLabel({ basis: "RULES", status: "NOTIFIED", notifiedAt: AHORA })).toBe("Avisado");
    expect(consentLabel({ basis: "RULES", status: "NOTIFIED", notifiedAt: null })).toBe("Correo sin enviar");
    expect(consentLabel({ basis: "EXPLICIT", status: "PENDING", notifiedAt: AHORA })).toBe("Pedido");
    expect(consentLabel({ basis: "EXPLICIT", status: "PENDING", notifiedAt: null })).toBe("Correo sin enviar");
    expect(consentLabel({ basis: "EXPLICIT", status: "GRANTED", notifiedAt: null })).toBe("Aceptó");
    expect(consentLabel({ basis: "EXPLICIT", status: "DECLINED", notifiedAt: AHORA })).toBe("No aceptó");
    expect(consentLabel({ basis: "RULES", status: "WITHDRAWN", notifiedAt: AHORA })).toBe("Retiró");
  });
  it("publicación", () => {
    expect(listingLabel(null)).toBe("Sin publicar");
    expect(listingLabel({ status: "PUBLISHED" })).toBe("Publicada");
    expect(listingLabel({ status: "WITHDRAWN" })).toBe("Despublicada");
  });
});

describe("ficha", () => {
  it("título", () => {
    expect(artworkTitle("  Río quieto ", "SFE-1")).toBe("Río quieto");
    expect(artworkTitle(null, "SFE-1")).toBe("Obra SFE-1");
    expect(artworkTitle(" ", null)).toBe("Obra");
  });
  it("crédito del autor (O13)", () => {
    const base = { profileDisplayName: "Ana P.", userName: "Ana Pérez" };
    const avisado = { basis: "RULES", status: "NOTIFIED" };
    expect(authorCredit({ ...base, attributionRequired: true, consent: avisado })).toBe("Ana P.");
    expect(authorCredit({ ...base, attributionRequired: false, consent: avisado })).toBeNull();
    expect(authorCredit({ ...base, attributionRequired: false, consent: { basis: "EXPLICIT", status: "GRANTED" } })).toBe("Ana P.");
    expect(
      authorCredit({ profileDisplayName: " ", userName: "Ana Pérez", attributionRequired: true, consent: avisado }),
    ).toBe("Ana Pérez");
    expect(authorCredit({ profileDisplayName: null, userName: null, attributionRequired: true, consent: avisado })).toBeNull();
  });
  it("tamaño del original", () => {
    expect(originalSizeOf(null)).toBeNull();
    expect(originalSizeOf({ kind: "ORIGINAL", width: 6000, height: 4000 })).toEqual({ width: 6000, height: 4000 });
    expect(
      originalSizeOf({ kind: "JURY_PREVIEW", width: 1600, height: 1000, sourceOriginal: { kind: "ORIGINAL", width: 6000, height: 3750 } }),
    ).toEqual({ width: 6000, height: 3750 });
    expect(originalSizeOf({ kind: "JURY_PREVIEW", width: 1600, height: 1000, sourceOriginal: null })).toBeNull();
    expect(originalSizeOf({ kind: "ORIGINAL", width: null, height: 4000 })).toBeNull();
  });
  it("marca de agua", () => {
    expect(previewWatermark("Foto Club Santa Fe")).toBe("Muestra · Foto Club Santa Fe");
  });
});

describe("regalía", () => {
  it("porcentaje a bps", () => {
    expect(parseRoyaltyPercent("20")).toEqual({ ok: true, bps: 2000 });
    expect(parseRoyaltyPercent("12,5")).toEqual({ ok: true, bps: 1250 });
    expect(parseRoyaltyPercent("12.75 %")).toEqual({ ok: true, bps: 1275 });
    expect(parseRoyaltyPercent("0")).toEqual({ ok: true, bps: 0 });
    expect(parseRoyaltyPercent("100")).toEqual({ ok: true, bps: 10000 });
    for (const malo of ["", "101", "-1", "abc", "1.234", "1e2"]) expect(parseRoyaltyPercent(malo).ok).toBe(false);
  });
  it("bps a texto", () => {
    expect(royaltyPercentText(2000)).toBe("20");
    expect(royaltyPercentText(1250)).toBe("12,5");
  });
});
