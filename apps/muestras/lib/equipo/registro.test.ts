import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, culturalActivity: { count: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));
const { datosDeCambio, nombreDeUsuario, textoDelUltimoCambio } = await import("./registro");

const cuando = new Date("2026-11-14T21:40:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.count.mockResolvedValue(1);
});

describe("registro del último cambio", () => {
  it("las tres columnas", () => {
    expect(datosDeCambio(7, "TEXTOS", cuando)).toEqual({ lastEditedByUserId: 7, lastEditedAt: cuando, lastEditedPart: "TEXTOS" });
  });
  it("texto con el nombre; sin nombre, nunca el email", async () => {
    db.user.findUnique.mockResolvedValueOnce({ name: "Ana Pérez" });
    expect(await textoDelUltimoCambio({ id: "a1", lastEditedByUserId: 7, lastEditedAt: cuando, lastEditedPart: "TEXTOS" }))
      .toBe("Último cambio: Ana Pérez, en los textos, el 14 nov a las 18:40.");
    db.user.findUnique.mockResolvedValueOnce({ name: "  " });
    expect(await textoDelUltimoCambio({ id: "a1", lastEditedByUserId: 7, lastEditedAt: cuando, lastEditedPart: "MONTAJE" }))
      .toBe("Último cambio: alguien del equipo, en el plano de montaje, el 14 nov a las 18:40.");
    expect(db.user.findUnique.mock.calls[0]![0].select).toEqual({ name: true });
  });
  it("sin registro, nada (y no consulta la base)", async () => {
    expect(await textoDelUltimoCambio({ id: "a1", lastEditedByUserId: null, lastEditedAt: null, lastEditedPart: null })).toBeNull();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("nombreDeUsuario", () => {
  it("dueño o integrante (aunque ya no esté): su nombre", async () => {
    db.user.findUnique.mockResolvedValueOnce({ name: "Ana Pérez" });
    expect(await nombreDeUsuario(7, "a1")).toBe("Ana Pérez");
    expect(db.culturalActivity.count.mock.calls[0]![0].where).toEqual({
      id: "a1", OR: [{ proposedByUserId: 7 }, { members: { some: { userId: 7 } } }],
    });
  });
  it("sin nombre o sin usuario: alguien del equipo (nunca el email)", async () => {
    db.user.findUnique.mockResolvedValueOnce({ name: null });
    expect(await nombreDeUsuario(7, "a1")).toBe("alguien del equipo");
    db.user.findUnique.mockResolvedValueOnce(null);
    expect(await nombreDeUsuario(7, "a1")).toBe("alguien del equipo");
  });
  it("quien no es dueño ni del equipo (super admin): el equipo de Muestras Fotográficas", async () => {
    db.culturalActivity.count.mockResolvedValue(0);
    db.user.findUnique.mockResolvedValueOnce({ name: "Daniel" });
    expect(await nombreDeUsuario(1, "a1")).toBe("el equipo de Muestras Fotográficas");
  });
});
