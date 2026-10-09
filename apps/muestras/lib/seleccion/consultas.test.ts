import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCallWork: { findMany: vi.fn(), count: vi.fn() },
  culturalCallScore: { findMany: vi.fn() },
  culturalCallCurator: { findMany: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));

const { rankingDeLaConvocatoria } = await import("./consultas");
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
