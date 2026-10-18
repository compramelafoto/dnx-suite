import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const userFindUnique = vi.fn();
const memberFindMany = vi.fn();
const memberFindUnique = vi.fn();
const memberUpdate = vi.fn();
const photoGroupBy = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    agencyMember: {
      findMany: (...a: unknown[]) => memberFindMany(...a),
      findUnique: (...a: unknown[]) => memberFindUnique(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
    photo: { groupBy: (...a: unknown[]) => photoGroupBy(...a) },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET } from "./route";
import { POST as ACCEPT } from "./[agencyId]/condiciones/route";

beforeEach(() => {
  for (const f of [requireAuth, userFindUnique, memberFindMany, memberFindUnique, memberUpdate, photoGroupBy]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
});

describe("mis-agencias", () => {
  it("lista agencias con porcentaje, condiciones y fotos propias, sin datos de clientes", async () => {
    userFindUnique.mockResolvedValue({ mpAccessToken: "APP_USR-x" });
    memberFindMany.mockResolvedValue([
      {
        agencyId: 3, status: "ACTIVE", commissionBps: null, termsVersionAccepted: 1,
        agency: {
          name: "Fotoshow", logoUrl: null, defaultCommissionBps: 3000, termsText: null, termsVersion: 2,
          albums: [{ albumId: 50, album: { title: "Temporada 2027", publicSlug: "temporada-2027-ab" } }],
        },
      },
    ]);
    photoGroupBy.mockResolvedValue([{ albumId: 50, _count: { _all: 12 } }]);
    const body = await (await GET()).json();
    expect(body.mpConnected).toBe(true);
    expect(body.agencies[0]).toMatchObject({
      agencyId: 3, name: "Fotoshow", status: "ACTIVE", commissionLabel: "30 %", needsTerms: true, myPhotosCount: 12,
      albums: [{ title: "Temporada 2027", publicSlug: "temporada-2027-ab" }],
    });
    // Verifica que no se exponen datos de clientes
    expect(Object.keys(memberFindMany.mock.calls[0][0].select).sort()).toEqual(["agencyId", "agency", "commissionBps", "status", "termsVersionAccepted"].sort());
    expect(memberFindMany.mock.calls[0][0].where).toEqual({ userId: 20, status: { in: ["ACTIVE", "REQUESTED"] } });
    expect(photoGroupBy.mock.calls[0][0].where).toEqual({ albumId: { in: [50] }, userId: 20, isRemoved: false });
  });
  it("aceptar condiciones guarda la versión vigente", async () => {
    memberFindUnique.mockResolvedValue({ id: 7, status: "ACTIVE", agency: { termsVersion: 2, termsText: null } });
    memberUpdate.mockResolvedValue({});
    const res = await ACCEPT({ json: async () => ({ acceptTerms: true }) } as any, { params: Promise.resolve({ agencyId: "3" }) });
    expect(res.status).toBe(200);
    expect(memberUpdate.mock.calls[0][0].data).toMatchObject({ termsVersionAccepted: 2 });
  });
  it("aceptar sin tilde: 400; sin membresía: 404", async () => {
    expect((await ACCEPT({ json: async () => ({}) } as any, { params: Promise.resolve({ agencyId: "3" }) })).status).toBe(400);
    memberFindUnique.mockResolvedValue(null);
    expect((await ACCEPT({ json: async () => ({ acceptTerms: true }) } as any, { params: Promise.resolve({ agencyId: "3" }) })).status).toBe(404);
  });
});
