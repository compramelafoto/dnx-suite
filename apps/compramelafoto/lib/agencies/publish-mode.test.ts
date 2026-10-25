import { beforeEach, describe, expect, it, vi } from "vitest";

const agencyFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { agency: { findUnique: (...a: unknown[]) => agencyFindUnique(...a) } } }));

import { agencyAwaitsFilter, awaitsFilter } from "./publish-mode";

beforeEach(() => {
  agencyFindUnique.mockReset();
});

describe("modo de publicación", () => {
  it("sólo AWAIT_FILTER espera; cualquier otro valor publica en el acto", () => {
    expect(awaitsFilter("AWAIT_FILTER")).toBe(true);
    for (const v of ["IMMEDIATE", "await_filter", "", null, undefined]) expect(awaitsFilter(v)).toBe(false);
  });
  it("agencia inexistente: no espera", async () => {
    agencyFindUnique.mockResolvedValue(null);
    expect(await agencyAwaitsFilter(3)).toBe(false);
    agencyFindUnique.mockResolvedValue({ publishMode: "AWAIT_FILTER" });
    expect(await agencyAwaitsFilter(3)).toBe(true);
    expect(agencyFindUnique.mock.calls[1][0]).toEqual({ where: { id: 3 }, select: { publishMode: true } });
  });
});
