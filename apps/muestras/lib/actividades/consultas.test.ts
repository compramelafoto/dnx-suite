import { beforeEach, describe, expect, it, vi } from "vitest";

type Pedido = { where: unknown; select: unknown };
const db = vi.hoisted(() => ({ culturalActivity: { findMany: vi.fn<(q: Pedido) => Promise<unknown[]>>(async () => []) } }));
vi.mock("@repo/db", () => ({ prisma: db }));

const { listarPublicas } = await import("./consultas");

beforeEach(() => vi.clearAllMocks());

describe("listarPublicas", () => {
  it("listarPublicas filtra sólo en fotografía", async () => {
    await listarPublicas("FOTOGRAFIA");
    expect(db.culturalActivity.findMany.mock.calls[0]![0].where).toMatchObject({ reviewStatus: "APPROVED", primaryDiscipline: "FOTOGRAFIA" });
    await listarPublicas("ARTE");
    expect(db.culturalActivity.findMany.mock.calls[1]![0].where).toEqual({ reviewStatus: "APPROVED" });
  });

  it("trae la disciplina de cada muestra", async () => {
    await listarPublicas("ARTE");
    expect(db.culturalActivity.findMany.mock.calls[0]![0].select).toMatchObject({ primaryDiscipline: true, otherDisciplines: true });
  });
});
