import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

import { agencyPriorityQuota, claimAgencyPriorityJobs } from "./agency-priority";

beforeEach(() => {
  queryRaw.mockReset();
});

describe("agencyPriorityQuota", () => {
  it("la mitad del lote, redondeando para arriba, nunca todo", () => {
    expect(agencyPriorityQuota(12)).toBe(6);
    expect(agencyPriorityQuota(5)).toBe(3);
    expect(agencyPriorityQuota(1)).toBe(1);
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
