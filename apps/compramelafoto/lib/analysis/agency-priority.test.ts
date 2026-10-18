import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

import { agencyPriorityQuota, claimAgencyPriorityJobs, combineClaims } from "./agency-priority";

beforeEach(() => {
  queryRaw.mockReset();
});

describe("agencyPriorityQuota", () => {
  it("la mitad del lote, nunca todo el lote", () => {
    expect(agencyPriorityQuota(12)).toBe(6);
    expect(agencyPriorityQuota(5)).toBe(3);
    expect(agencyPriorityQuota(2)).toBe(1);
    expect(agencyPriorityQuota(1)).toBe(0);
    expect(agencyPriorityQuota(0)).toBe(0);
  });
});

describe("claimAgencyPriorityJobs", () => {
  it("sin cupo no consulta", async () => {
    expect(await claimAgencyPriorityJobs(new Date(), 0, null)).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
  it("consulta sólo álbumes de agencia con FOR UPDATE SKIP LOCKED", async () => {
    queryRaw.mockResolvedValue([{ id: 1, photoId: 10 }]);
    const out = await claimAgencyPriorityJobs(new Date("2026-10-18T12:00:00Z"), 6, null);
    expect(out).toEqual([{ id: 1, photoId: 10 }]);
    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toContain('INNER JOIN "AgencyAlbum" aa ON aa."albumId" = p."albumId"');
    expect(sql).toContain("FOR UPDATE OF j SKIP LOCKED");
    expect(sql).toContain('p."isRemoved" = false');
  });
});

describe("combineClaims", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("si falla la prioridad, el orden de llegada toma el lote completo", async () => {
    const claimFifo = vi.fn().mockResolvedValue([{ id: 2, photoId: 20 }]);
    const out = await combineClaims({
      batchSize: 12,
      claimPriority: () => Promise.reject(new Error("boom")),
      claimFifo,
    });
    expect(claimFifo).toHaveBeenCalledWith(12);
    expect(out).toEqual({ priority: [], locked: [{ id: 2, photoId: 20 }] });
  });

  it("si falla el orden de llegada tras tomar prioridad, devuelve igual los de prioridad", async () => {
    const rows = [{ id: 1, photoId: 10 }];
    const out = await combineClaims({
      batchSize: 12,
      claimPriority: () => Promise.resolve(rows),
      claimFifo: () => Promise.reject(new Error("boom")),
    });
    expect(out).toEqual({ priority: rows, locked: rows });
  });

  it("sin prioridad y con falla del orden de llegada, el error se propaga", async () => {
    await expect(
      combineClaims({
        batchSize: 12,
        claimPriority: () => Promise.resolve([]),
        claimFifo: () => Promise.reject(new Error("boom")),
      })
    ).rejects.toThrow("boom");
  });

  it("combina prioridad y orden de llegada con el resto del lote", async () => {
    const claimFifo = vi.fn().mockResolvedValue([{ id: 2, photoId: 20 }]);
    const out = await combineClaims({
      batchSize: 12,
      claimPriority: () => Promise.resolve([{ id: 1, photoId: 10 }]),
      claimFifo,
    });
    expect(claimFifo).toHaveBeenCalledWith(11);
    expect(out.locked).toHaveLength(2);
  });
});
