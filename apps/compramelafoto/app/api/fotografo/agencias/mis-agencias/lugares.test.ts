import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const memberFindUnique = vi.fn();
const placeFindMany = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
    agencyPlace: { findMany: (...a: unknown[]) => placeFindMany(...a) },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET } from "./[agencyId]/lugares/route";

const ctx = (agencyId: string) => ({ params: Promise.resolve({ agencyId }) });

beforeEach(() => {
  requireAuth.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
  memberFindUnique.mockReset();
  placeFindMany.mockReset();
});

describe("lugares para el miembro", () => {
  it("miembro activo ve los lugares de su agencia", async () => {
    memberFindUnique.mockResolvedValue({ status: "ACTIVE" });
    placeFindMany.mockResolvedValue([{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }]);
    const res = await GET({} as any, ctx("3"));
    expect(await res.json()).toEqual({ places: [{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }] });
    expect(memberFindUnique.mock.calls[0][0].where).toEqual({ agencyId_userId: { agencyId: 3, userId: 20 } });
    expect(placeFindMany.mock.calls[0][0].where).toEqual({ agencyId: 3 });
  });
  it("no miembro o no activo: 404", async () => {
    memberFindUnique.mockResolvedValue({ status: "REQUESTED" });
    expect((await GET({} as any, ctx("3"))).status).toBe(404);
    memberFindUnique.mockResolvedValue(null);
    expect((await GET({} as any, ctx("3"))).status).toBe(404);
  });
});
