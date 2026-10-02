import { describe, expect, it } from "vitest";
import { summarizePortfolios, trabadaPorDeuda, type AdminPortfolioRow } from "./admin-queries";

function fila(overrides: Partial<AdminPortfolioRow> = {}): AdminPortfolioRow {
  return {
    memberId: "m-1",
    portfolioId: "p1",
    displayName: "Juan Pérez",
    memberNumber: "100",
    publicSlug: "juan-perez",
    photoCount: 3,
    memberPublished: true,
    hiddenByAdminAt: null,
    hiddenReason: null,
    hiddenByLabel: null,
    adminForcePublish: false,
    overdueCount: 0,
    visibility: { visible: true },
    ...overrides,
  };
}

describe("summarizePortfolios", () => {
  it("cuenta los publicados", () => {
    const r = summarizePortfolios([fila(), fila({ memberId: "m-2" })]);
    expect(r.publicados).toBe(2);
  });

  it("cuenta los que tienen fotos pero no se ven", () => {
    const r = summarizePortfolios([
      fila({ visibility: { visible: false, reason: "NOT_PUBLISHED_BY_MEMBER" } }),
    ]);
    expect(r.armadosSinPublicar).toBe(1);
    expect(r.publicados).toBe(0);
  });

  it("cuenta a quienes todavía no subieron nada: es a quién hay que recordarle", () => {
    const r = summarizePortfolios([
      fila({ photoCount: 0, portfolioId: null, visibility: { visible: false, reason: "NO_PHOTOS" } }),
    ]);
    expect(r.sinPortfolio).toBe(1);
    expect(r.armadosSinPublicar).toBe(0);
  });

  it("sin nadie, los tres números son cero y no rompe", () => {
    expect(summarizePortfolios([])).toEqual({
      publicados: 0,
      armadosSinPublicar: 0,
      sinPortfolio: 0,
    });
  });
});

describe("trabadaPorDeuda", () => {
  it("es verdadero cuando lo único que lo tapa es la deuda", () => {
    expect(
      trabadaPorDeuda(fila({ overdueCount: 4, visibility: { visible: false, reason: "OVERDUE_DUES" } })),
    ).toBe(true);
  });

  it("es falso si lo que falta es otra cosa", () => {
    expect(
      trabadaPorDeuda(fila({ overdueCount: 4, visibility: { visible: false, reason: "NO_PHOTOS" } })),
    ).toBe(false);
  });

  it("es falso si ya se ve", () => {
    expect(trabadaPorDeuda(fila({ overdueCount: 4 }))).toBe(false);
  });

  it("es falso con 2 vencidas: ese umbral todavía no tapa a nadie", () => {
    expect(
      trabadaPorDeuda(fila({ overdueCount: 2, visibility: { visible: false, reason: "OVERDUE_DUES" } })),
    ).toBe(false);
  });
});
