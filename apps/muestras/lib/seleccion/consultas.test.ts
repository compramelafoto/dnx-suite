import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCallWork: { findMany: vi.fn(), count: vi.fn() },
  culturalCallScore: { findMany: vi.fn() },
  culturalCallCurator: { findMany: vi.fn() },
  culturalActivityWork: { findMany: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));

const { avanceDelEquipo, elegidasFueraDeLaGaleria, rankingDeLaConvocatoria } = await import("./consultas");
const obra = { id: "w1", anonymousCode: "O-001", decision: "PENDING", title: "Uno", year: null, technique: null, statement: null, submission: { authorName: "Ana Pérez" } };

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalCallWork.findMany.mockResolvedValue([obra]);
  db.culturalCallScore.findMany.mockResolvedValue([{ callWorkId: "w1", score: 4, note: "buena" }]);
});

describe("rankingDeLaConvocatoria", () => {
  it.each(["CURATING", "CLOSED", "OPEN"])("con la convocatoria en %s ni pide ni devuelve el autor", async (status) => {
    const filas = await rankingDeLaConvocatoria("c1", status);
    const select = db.culturalCallWork.findMany.mock.calls[0][0].select;
    expect(select.submission).toBeUndefined();
    expect(filas[0].authorName).toBeNull();
    expect(JSON.stringify(filas)).not.toContain("Ana");
    expect(filas[0].imagePath).toBe("/api/curaduria/obras/w1/imagen");
  });
  it("con la selección cerrada devuelve el autor", async () => {
    const filas = await rankingDeLaConvocatoria("c1", "DONE");
    expect(db.culturalCallWork.findMany.mock.calls[0][0].select.submission).toBeDefined();
    expect(filas[0].authorName).toBe("Ana Pérez");
  });
  it("cuenta sólo puntajes de curadores activos y de esa convocatoria", async () => {
    await rankingDeLaConvocatoria("c1", "CURATING");
    expect(db.culturalCallScore.findMany.mock.calls[0][0].where).toEqual({ callWork: { callId: "c1" }, curator: { status: "ACTIVE" } });
    expect(db.culturalCallWork.findMany.mock.calls[0][0].where.callId).toBe("c1");
  });
});

describe("avanceDelEquipo", () => {
  it("no cuenta como puntuadas las obras de envíos retirados", async () => {
    db.culturalCallCurator.findMany.mockResolvedValue([{ id: "k1", email: "k@x", _count: { scores: 2 } }]);
    db.culturalCallWork.count.mockResolvedValue(3);
    expect(await avanceDelEquipo("c1")).toEqual([{ id: "k1", email: "k@x", puntuadas: 2, total: 3 }]);
    expect(db.culturalCallCurator.findMany.mock.calls[0][0].select._count).toEqual({
      select: { scores: { where: { callWork: { anonymousCode: { not: null }, submission: { status: "ACTIVE" } } } } },
    });
  });
});

describe("elegidasFueraDeLaGaleria", () => {
  it("cuenta las nunca copiadas y las copiadas que se borraron", async () => {
    db.culturalCallWork.findMany.mockResolvedValue([{ activityWorkId: null }, { activityWorkId: "aw-1" }, { activityWorkId: "aw-borrada" }]);
    db.culturalActivityWork.findMany.mockResolvedValue([{ id: "aw-1" }]);
    expect(await elegidasFueraDeLaGaleria("c1", "a1")).toBe(2);
  });
});
