import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));
const { datosDeCambio, textoDelUltimoCambio } = await import("./registro");

const cuando = new Date("2026-11-14T21:40:00Z");
beforeEach(() => vi.clearAllMocks());

describe("registro del último cambio", () => {
  it("las tres columnas", () => {
    expect(datosDeCambio(7, "TEXTOS", cuando)).toEqual({ lastEditedByUserId: 7, lastEditedAt: cuando, lastEditedPart: "TEXTOS" });
  });
  it("texto con el nombre, o el email si no hay nombre", async () => {
    db.user.findUnique.mockResolvedValueOnce({ name: "Ana Pérez", email: "ana@x" });
    expect(await textoDelUltimoCambio({ lastEditedByUserId: 7, lastEditedAt: cuando, lastEditedPart: "TEXTOS" }))
      .toBe("Último cambio: Ana Pérez, en los textos, el 14 nov a las 18:40.");
    db.user.findUnique.mockResolvedValueOnce({ name: "  ", email: "ana@x" });
    expect(await textoDelUltimoCambio({ lastEditedByUserId: 7, lastEditedAt: cuando, lastEditedPart: "MONTAJE" }))
      .toBe("Último cambio: ana@x, en el plano de montaje, el 14 nov a las 18:40.");
  });
  it("sin registro, nada (y no consulta la base)", async () => {
    expect(await textoDelUltimoCambio({ lastEditedByUserId: null, lastEditedAt: null, lastEditedPart: null })).toBeNull();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
