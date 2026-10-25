import { describe, expect, it } from "vitest";
import {
  editionText, exhibitorCountProblem, exhibitorJoinProblems, exhibitorLinkState, exhibitorWorkProblems,
  exhibitorWorkTransition, fichaDetail, sizeText, toActivityWork,
} from "./exhibitors";

const muestra = { type: "MUESTRA", reviewStatus: "DRAFT", isCancelled: false,
  startsAt: new Date("2026-11-01T03:00:00Z"), endsAt: new Date("2026-11-30T02:59:59.999Z") };
const enlace = { status: "OPEN", closesAt: null as Date | null };
const hoy = new Date("2026-10-20T15:00:00Z");

describe("estado del enlace", () => {
  it("abierto en borrador, rechazada, revisión, publicada y despublicada", () => {
    for (const reviewStatus of ["DRAFT", "REJECTED", "IN_REVIEW", "APPROVED", "UNPUBLISHED"]) {
      expect(exhibitorLinkState(enlace, { ...muestra, reviewStatus }, hoy), reviewStatus).toBe("OPEN");
    }
  });
  it("cerrado, vencido, cancelada, terminada o no es muestra", () => {
    expect(exhibitorLinkState({ ...enlace, status: "CLOSED" }, muestra, hoy)).toBe("CLOSED");
    expect(exhibitorLinkState({ ...enlace, closesAt: new Date("2026-10-19T02:59:59.999Z") }, muestra, hoy)).toBe("EXPIRED");
    expect(exhibitorLinkState(enlace, { ...muestra, isCancelled: true }, hoy)).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(enlace, muestra, new Date("2026-12-01T15:00:00Z"))).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(enlace, { ...muestra, type: "CHARLA" }, hoy)).toBe("UNAVAILABLE");
    expect(exhibitorLinkState(null, muestra, hoy)).toBe("UNAVAILABLE");
  });
});

describe("sumarse", () => {
  const base = { state: "OPEN" as const, exhibitors: 3, maxExhibitors: null as number | null, displayName: "Ana Pérez", rightsAccepted: true };
  it("sin tope de expositores, todo bien", () => expect(exhibitorJoinProblems({ ...base, exhibitors: 250 })).toEqual([]));
  it("motivos", () => {
    expect(exhibitorJoinProblems({ ...base, state: "CLOSED" })).toEqual(["Este enlace ya no recibe expositores. Escribile a quien organiza."]);
    expect(exhibitorJoinProblems({ ...base, maxExhibitors: 3 })).toEqual(["Ya se sumaron todas las personas que esta muestra espera. Escribile a quien organiza."]);
    expect(exhibitorJoinProblems({ ...base, displayName: " " })).toEqual(["Escribí cómo firmás tus obras."]);
    expect(exhibitorJoinProblems({ ...base, rightsAccepted: false })).toEqual(["Para sumarte tenés que confirmar que sos autor/a y aceptar cómo se muestran tus obras."]);
  });
});

describe("cuántas obras", () => {
  it("tope optativo por expositor", () => {
    expect(exhibitorCountProblem({ current: 10, max: null })).toBeNull();
    expect(exhibitorCountProblem({ current: 3, max: 3 })).toBe("Podés cargar hasta 3 obras en esta muestra.");
    expect(exhibitorCountProblem({ current: 0, max: 1 })).toBeNull();
  });
});

describe("datos de la obra expuesta", () => {
  const ok = {
    imageUrl: "https://r2/muestras/7/a.webp", title: "Río quieto", year: 2024, technique: "Giclée sobre papel algodón",
    imageWidthCm: 40, imageHeightCm: 60, frameWidthCm: 50, frameHeightCm: 70,
    edition: "LIMITED", editionNumber: 2, editionSize: 10, statement: null, forSale: true, priceArs: 120000, hangingNotes: null,
  };
  it("completa para enviar", () => expect(exhibitorWorkProblems(ok, { forSubmit: true })).toEqual([]));
  it("un borrador se guarda incompleto, pero no se envía", () => {
    const vacia = { ...ok, imageUrl: null, title: "", year: null, technique: null, imageWidthCm: null, imageHeightCm: null, frameWidthCm: null, frameHeightCm: null, edition: null, forSale: false, priceArs: null };
    expect(exhibitorWorkProblems(vacia, { forSubmit: false })).toEqual([]);
    expect(exhibitorWorkProblems(vacia, { forSubmit: true })).toEqual([
      "Subí la foto de la obra.", "Escribí el título.", "Indicá el año.", "Indicá la técnica y el soporte.",
      "Indicá la medida de la imagen (ancho y alto en cm).", "Indicá la medida con marco (ancho y alto en cm).", "Indicá la edición.",
    ]);
  });
  it("medidas, marco, edición y precio", () => {
    expect(exhibitorWorkProblems({ ...ok, imageWidthCm: 400 }, { forSubmit: true })).toEqual(["Las medidas van entre 5 y 300 cm por lado."]);
    expect(exhibitorWorkProblems({ ...ok, frameWidthCm: 30 }, { forSubmit: true })).toEqual(["La medida con marco no puede ser menor que la de la imagen."]);
    expect(exhibitorWorkProblems({ ...ok, editionNumber: 11 }, { forSubmit: true })).toEqual(["En una edición limitada, el número de la copia va de 1 al total."]);
    expect(exhibitorWorkProblems({ ...ok, priceArs: null }, { forSubmit: true })).toEqual(["Si la querés vender, indicá el precio en pesos."]);
    expect(exhibitorWorkProblems({ ...ok, year: 1800 }, { forSubmit: false })).toEqual(["Revisá el año."]);
  });
});

describe("estados", () => {
  it("el recorrido normal", () => {
    expect(exhibitorWorkTransition("submit", "DRAFT", { linkOpen: true, complete: true })).toEqual({ ok: true, next: "SUBMITTED" });
    expect(exhibitorWorkTransition("withdraw", "SUBMITTED", {})).toEqual({ ok: true, next: "DRAFT" });
    expect(exhibitorWorkTransition("requestChanges", "SUBMITTED", {})).toEqual({ ok: true, next: "CHANGES_REQUESTED" });
    expect(exhibitorWorkTransition("submit", "CHANGES_REQUESTED", { linkOpen: false, complete: true })).toEqual({ ok: true, next: "SUBMITTED" });
    expect(exhibitorWorkTransition("approve", "SUBMITTED", {})).toEqual({ ok: true, next: "APPROVED" });
    expect(exhibitorWorkTransition("requestChanges", "APPROVED", {})).toEqual({ ok: true, next: "CHANGES_REQUESTED" });
    expect(exhibitorWorkTransition("remove", "APPROVED", {})).toEqual({ ok: true, next: "REMOVED" });
  });
  it("lo que no se puede", () => {
    expect(exhibitorWorkTransition("submit", "DRAFT", { linkOpen: false, complete: true })).toMatchObject({ ok: false, reason: "El enlace de expositores está cerrado: ya no se reciben obras nuevas." });
    expect(exhibitorWorkTransition("edit", "APPROVED", {})).toMatchObject({ ok: false, reason: "La obra ya está en la muestra. Si hay que cambiar algo, pedíselo a quien organiza." });
    expect(exhibitorWorkTransition("approve", "SUBMITTED", { activityEditable: false })).toMatchObject({ ok: false, reason: "La muestra está en revisión: esperá a que se revise para sumar obras." });
    expect(exhibitorWorkTransition("approve", "DRAFT", {})).toMatchObject({ ok: false });
  });
});

describe("textos y copia a la muestra", () => {
  const w = { title: "Río quieto", year: 2024, technique: "Giclée", imageWidthCm: 40, imageHeightCm: 60.5, edition: "LIMITED", editionNumber: 2, editionSize: 10, imageUrl: "u" };
  it("edición, medidas y ficha", () => {
    expect(editionText(w)).toBe("Edición 2/10");
    expect(editionText({ ...w, edition: "UNIQUE" })).toBe("Pieza única");
    expect(editionText({ ...w, edition: "NA" })).toBeNull();
    expect(sizeText(w)).toBe("40 × 60,5 cm");
    expect(fichaDetail(w)).toBe("2024. Giclée. 40 × 60,5 cm. Edición 2/10");
  });
  it("lo que se copia a CulturalActivityWork (nunca el precio)", () => {
    expect(toActivityWork({ ...w, priceArs: 9 }, { userId: 7, profileId: "p7", displayName: "Ana Pérez" }, 12)).toEqual({
      imageUrl: "u", title: "Río quieto", authorName: "Ana Pérez", authorUserId: 7, authorProfileId: "p7",
      year: 2024, technique: "Giclée", isHighlight: false, sortOrder: 12,
    });
  });
});
