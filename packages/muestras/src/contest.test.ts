import { describe, expect, it } from "vitest";
import {
  authorCredit, authorPendingCount, contestConsentTransition, contestShareMessage, contestSelections, contestWorkInGallery, distinctionText, exhibitBasisFromRights,
  parseContestTiers, pickResultBatch, planContestImport, rankContestWorks, rightsFromConfigurationJson, tierOf,
} from "./contest";

const d = (s: string) => new Date(s);

describe("lote de resultados", () => {
  it("el último FINALIZED o PUBLISHED", () => {
    const lote = pickResultBatch([
      { id: "a", status: "FINALIZED", finalizedAt: d("2026-09-01"), publishedAt: null, updatedAt: d("2026-09-01") },
      { id: "b", status: "PUBLISHED", finalizedAt: d("2026-09-10"), publishedAt: d("2026-09-11"), updatedAt: d("2026-09-11") },
      { id: "c", status: "REVIEW_REQUIRED", finalizedAt: null, publishedAt: null, updatedAt: d("2026-09-20") },
      { id: "x", status: "CANCELLED", finalizedAt: d("2026-09-30"), publishedAt: null, updatedAt: d("2026-09-30") },
    ]);
    expect(lote?.id).toBe("b");
  });
  it("sin lote cerrado → null", () => {
    expect(pickResultBatch([{ id: "c", status: "DRAFT", finalizedAt: null, publishedAt: null, updatedAt: d("2026-09-20") }])).toBeNull();
  });
});

describe("niveles", () => {
  it("premios, menciones, finalistas y descalificadas", () => {
    expect(tierOf({ resultStatus: "WINNER", awardType: "FIRST_PLACE" })).toBe("WINNER");
    expect(tierOf({ resultStatus: "RANKED", awardType: "SPONSOR_AWARD" })).toBe("WINNER");
    expect(tierOf({ resultStatus: "MENTION", awardType: null })).toBe("MENTION");
    expect(tierOf({ resultStatus: "WINNER", awardType: "HONORABLE_MENTION" })).toBe("MENTION");
    expect(tierOf({ resultStatus: "FINALIST", awardType: null })).toBe("FINALIST");
    expect(tierOf({ resultStatus: "RANKED", awardType: "FINALIST" })).toBe("FINALIST");
    expect(tierOf({ resultStatus: "DISQUALIFIED", awardType: "FIRST_PLACE" })).toBeNull();
    expect(tierOf({ resultStatus: "RANKED", awardType: null })).toBeNull();
    expect(tierOf({ resultStatus: "NOT_SELECTED", awardType: null })).toBeNull();
  });
  it("una obra en dos categorías sale una vez, con el mejor premio", () => {
    const s = contestSelections([
      { snapshotId: "s1", categoryId: "c2", resultStatus: "FINALIST", awardType: null, position: 4 },
      { snapshotId: "s1", categoryId: "c1", resultStatus: "WINNER", awardType: "SECOND_PLACE", position: 2 },
      { snapshotId: "s2", categoryId: "c1", resultStatus: "DISQUALIFIED", awardType: "FIRST_PLACE", position: 1 },
    ]);
    expect(s.map((x) => [x.snapshotId, x.tier, x.categoryId])).toEqual([["s1", "WINNER", "c1"]]);
  });
  it("niveles elegidos", () => expect(parseContestTiers(["WINNER", "x", "FINALIST", "WINNER"])).toEqual(["WINNER", "FINALIST"]));
});

describe("premio", () => {
  it("con y sin categoría", () => {
    expect(distinctionText({ tier: "WINNER", awardType: "FIRST_PLACE", categoryName: "Paisaje", singleCategory: false })).toBe("1.er premio · Paisaje");
    expect(distinctionText({ tier: "MENTION", awardType: "SPECIAL_MENTION", categoryName: "Retrato", singleCategory: false })).toBe("Mención especial · Retrato");
    expect(distinctionText({ tier: "FINALIST", awardType: null, categoryName: "Paisaje", singleCategory: true })).toBe("Preseleccionada");
  });
});

describe("orden del ranking", () => {
  it("categoría, nivel, premio, puesto", () => {
    const r = rankContestWorks(
      [
        { key: "a", categoryId: "c2", tier: "WINNER", awardType: "FIRST_PLACE", position: 1, title: "A" },
        { key: "b", categoryId: "c1", tier: "FINALIST", awardType: null, position: 5, title: "B" },
        { key: "c", categoryId: "c1", tier: "WINNER", awardType: "SECOND_PLACE", position: 2, title: "C" },
        { key: "d", categoryId: "c1", tier: "WINNER", awardType: "FIRST_PLACE", position: 1, title: "D" },
      ],
      [{ id: "c1", sortOrder: 0 }, { id: "c2", sortOrder: 1 }],
    );
    expect(r.map((x) => [x.key, x.rank])).toEqual([["d", 0], ["c", 1], ["b", 2], ["a", 3]]);
  });
});

describe("bases que firmó el autor", () => {
  it("allowExhibition → RULES (decisión de Daniel)", () => {
    expect(exhibitBasisFromRights(rightsFromConfigurationJson({ rights: { allowExhibition: true, allowPrint: false, allowCommercial: false } }))).toBe("RULES");
    expect(exhibitBasisFromRights(rightsFromConfigurationJson({ rights: { allowExhibition: false } }))).toBe("EXPLICIT");
    expect(exhibitBasisFromRights(rightsFromConfigurationJson({ rights: {} }))).toBe("EXPLICIT");
    expect(exhibitBasisFromRights(rightsFromConfigurationJson(null))).toBe("EXPLICIT");
  });
  it("atribución", () => {
    expect(rightsFromConfigurationJson({ rights: { allowExhibition: true, attributionRequired: true } })?.attributionRequired).toBe(true);
    expect(rightsFromConfigurationJson({ rights: { allowExhibition: true } })?.attributionRequired).toBe(false);
  });
});

describe("crédito del autor (primera vez público)", () => {
  it("bases con atribución, confirmación o autorización escrita", () => {
    expect(authorCredit({ attributionRequired: true, exhibitConsent: "ACCEPTED", consentBy: "RULES", signedName: null, defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana Pérez" });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "RULES", signedName: null, defaultName: "Ana Pérez" })).toEqual({ show: false, name: "Autoría reservada" });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "AUTHOR", signedName: "Ana P.", defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana P." });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "RULES", signedName: "Ana P.", defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana P." });
    expect(authorCredit({ attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "ORGANIZER", signedName: null, defaultName: "Ana Pérez" })).toEqual({ show: true, name: "Ana Pérez" });
  });
});

describe("plan del armado", () => {
  const sel = (entryId: string, tier: "WINNER" | "MENTION" | "FINALIST") => ({ entryId, tier, distinction: tier, rank: 0, categoryId: "c1", categoryName: "P", awardType: null, title: "t", authorUserId: 1, authorName: "Ana" });
  it("idempotente: sólo crea lo que falta y respeta lo sacado", () => {
    const p = planContestImport({
      selected: [sel("e1", "WINNER"), sel("e2", "MENTION"), sel("e3", "FINALIST")],
      existing: new Map([["e1", { include: true, sourceStatus: "CURRENT" }], ["e9", { include: true, sourceStatus: "CURRENT" }]]),
      tiers: ["WINNER", "MENTION"],
      galleryCount: 0,
    });
    expect(p.create.map((x) => x.entryId)).toEqual(["e2"]);
    expect(p.update.map((x) => x.entryId)).toEqual(["e1"]);
    expect(p.gone).toEqual(["e9"]);
    expect(p.problems).toEqual([]);
  });
  it("tope técnico", () => {
    const p = planContestImport({ selected: [sel("e1", "WINNER")], existing: new Map(), tiers: ["WINNER"], galleryCount: 300 });
    expect(p.problems).toEqual(["La muestra admite hasta 300 obras: ya tiene 300 y el concurso suma 1. Elegí menos niveles o sacá obras de la muestra."]);
  });
  it("sin obras", () => {
    expect(planContestImport({ selected: [], existing: new Map(), tiers: ["WINNER"], galleryCount: 0 }).problems)
      .toEqual(["El concurso no tiene obras en los niveles que elegiste."]);
  });
});

describe("qué entra a la galería", () => {
  const ok = { include: true, imageStatus: "COPIED", imageUrl: "https://r2/muestras/1/fr-e1.webp", exhibitConsent: "ACCEPTED" };
  it("casilla, imagen y permiso", () => {
    expect(contestWorkInGallery(ok)).toBe(true);
    expect(contestWorkInGallery({ ...ok, include: false })).toBe(false);
    expect(contestWorkInGallery({ ...ok, imageStatus: "PENDING" })).toBe(false);
    expect(contestWorkInGallery({ ...ok, exhibitConsent: "PENDING" })).toBe(false);
    expect(contestWorkInGallery({ ...ok, exhibitConsent: "WITHDRAWN" })).toBe(false);
  });
});

describe("permisos del autor", () => {
  const abierta = { closed: false };
  it("EXPLICIT: aceptar o no", () => {
    expect(contestConsentTransition("accept", { exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING" }, abierta)).toEqual({ ok: true, next: "ACCEPTED", by: "AUTHOR" });
    expect(contestConsentTransition("decline", { exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING" }, abierta)).toEqual({ ok: true, next: "DECLINED", by: "AUTHOR" });
  });
  it("RULES: sacarla y volver a aceptarla", () => {
    expect(contestConsentTransition("withdraw", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED" }, abierta)).toEqual({ ok: true, next: "WITHDRAWN", by: "AUTHOR" });
    expect(contestConsentTransition("reconsider", { exhibitBasis: "RULES", exhibitConsent: "WITHDRAWN" }, abierta)).toEqual({ ok: true, next: "ACCEPTED", by: "AUTHOR" });
  });
  it("la organización sólo marca autorización escrita en lo pendiente", () => {
    expect(contestConsentTransition("writtenConsent", { exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING" }, abierta)).toEqual({ ok: true, next: "ACCEPTED", by: "ORGANIZER" });
    expect(contestConsentTransition("writtenConsent", { exhibitBasis: "EXPLICIT", exhibitConsent: "DECLINED" }, abierta).ok).toBe(false);
  });
  it("con la muestra cerrada no se cambia nada", () => {
    expect(contestConsentTransition("withdraw", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED" }, { closed: true })).toEqual({ ok: false, reason: "La muestra ya cerró." });
  });
});

describe("venta, pendientes y mensaje", () => {
  const abierta = { closed: false };
  it("la venta siempre pide un clic aparte", () => {
    expect(contestConsentTransition("askSale", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED", saleConsent: "NOT_ASKED" }, abierta)).toEqual({ ok: true, next: "PENDING", by: "ORGANIZER" });
    expect(contestConsentTransition("acceptSale", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED", saleConsent: "PENDING" }, abierta)).toEqual({ ok: true, next: "ACCEPTED", by: "AUTHOR" });
    expect(contestConsentTransition("acceptSale", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED", saleConsent: "NOT_ASKED" }, abierta).ok).toBe(false);
    expect(contestConsentTransition("cancelSale", { exhibitBasis: "RULES", exhibitConsent: "ACCEPTED", saleConsent: "ACCEPTED" }, abierta)).toEqual({ ok: true, next: "NOT_ASKED", by: "ORGANIZER" });
  });
  it("cuenta lo que espera respuesta del autor", () => {
    expect(authorPendingCount([
      { include: true, exhibitConsent: "PENDING", saleConsent: "NOT_ASKED" },
      { include: true, exhibitConsent: "ACCEPTED", saleConsent: "PENDING" },
      { include: false, exhibitConsent: "PENDING", saleConsent: "NOT_ASKED" },
      { include: true, exhibitConsent: "ACCEPTED", saleConsent: "NOT_ASKED" },
    ])).toBe(2);
  });
  it("mensaje listo para mandar", () => {
    expect(contestShareMessage({ name: "Ana", organization: "SFPR", contest: "Paisajes 2026", url: "https://m.com/x" }))
      .toBe("Hola Ana, con SFPR armamos una muestra con obras de Paisajes 2026 y queremos exponer la tuya. Entrá con la misma cuenta de FotoRank y confirmá acá: https://m.com/x");
  });
});
