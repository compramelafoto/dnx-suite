import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ fotorankResultBatch: { findMany: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));
const { loteVigente } = await import("./fotorank");

const d = (s: string) => new Date(s);
beforeEach(() => vi.resetAllMocks());

describe("loteVigente", () => {
  it("el último FINALIZED o PUBLISHED, con su versión, sin leer nada más", async () => {
    db.fotorankResultBatch.findMany.mockResolvedValue([
      { id: "b1", status: "PUBLISHED", finalizedAt: d("2026-09-01"), publishedAt: d("2026-09-02"), updatedAt: d("2026-09-02") },
      { id: "b2", status: "FINALIZED", finalizedAt: d("2026-09-20"), publishedAt: null, updatedAt: d("2026-09-21") },
    ]);
    expect(await loteVigente("c1")).toEqual({ id: "b2", version: d("2026-09-21") });
    expect(db.fotorankResultBatch.findMany.mock.calls[0][0]).toEqual({
      where: { contestId: "c1", status: { in: ["FINALIZED", "PUBLISHED"] } },
      select: { id: true, status: true, finalizedAt: true, publishedAt: true, updatedAt: true },
    });
  });
  it("sin lote usable: null; id raro: null sin consultar", async () => {
    db.fotorankResultBatch.findMany.mockResolvedValue([]);
    expect(await loteVigente("c1")).toBeNull();
    expect(await loteVigente("../x")).toBeNull();
    expect(db.fotorankResultBatch.findMany).toHaveBeenCalledTimes(1);
  });
  it("un error no rompe la página: undefined", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.fotorankResultBatch.findMany.mockRejectedValue(new Error("caída"));
    expect(await loteVigente("c1")).toBeUndefined();
  });
});
