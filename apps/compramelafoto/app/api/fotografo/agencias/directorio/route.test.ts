import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const userFindUnique = vi.fn();
const agencyFindMany = vi.fn();
const agencyFindFirst = vi.fn();
const memberFindMany = vi.fn();
const memberFindUnique = vi.fn();
const memberCreate = vi.fn();
const memberUpdate = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    agency: { findMany: (...a: unknown[]) => agencyFindMany(...a), findFirst: (...a: unknown[]) => agencyFindFirst(...a) },
    agencyMember: {
      findMany: (...a: unknown[]) => memberFindMany(...a),
      findUnique: (...a: unknown[]) => memberFindUnique(...a),
      create: (...a: unknown[]) => memberCreate(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET, POST } from "./route";

const a = (id: number, name: string, lat: number, lng: number) => ({
  id, name, logoUrl: null, description: null, directoryCity: null, directoryLat: lat, directoryLng: lng, defaultCommissionBps: 3000,
});
const post = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  for (const f of [requireAuth, userFindUnique, agencyFindMany, agencyFindFirst, memberFindMany, memberFindUnique, memberCreate, memberUpdate]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
  memberFindMany.mockResolvedValue([]);
});

describe("directorio", () => {
  it("ordena por distancia, saca las de más de 500 km y marca mi estado", async () => {
    userFindUnique.mockResolvedValue({ latitude: -38.0055, longitude: -57.5426 });
    agencyFindMany.mockResolvedValue([a(1, "Porteña", -34.6037, -58.3816), a(2, "Fotoshow", -38.0, -57.55), a(3, "Salta", -24.78, -65.41)]);
    memberFindMany.mockResolvedValue([{ agencyId: 2, status: "ACTIVE" }]);
    const body = await (await GET()).json();
    expect(body.noLocation).toBe(false);
    expect(body.agencies.map((x: any) => x.name)).toEqual(["Fotoshow", "Porteña"]);
    expect(body.agencies[0].myStatus).toBe("ACTIVE");
    expect(body.agencies[1].myStatus).toBe(null);
    expect(agencyFindMany.mock.calls[0][0].where).toMatchObject({ directoryListed: true, ownerUserId: { not: 20 } });
  });
  it("sin ubicación en el perfil: avisa y ordena por nombre", async () => {
    userFindUnique.mockResolvedValue({ latitude: null, longitude: null });
    agencyFindMany.mockResolvedValue([a(1, "Zeta", -34, -58), a(2, "Alfa", -38, -57)]);
    const body = await (await GET()).json();
    expect(body.noLocation).toBe(true);
    expect(body.agencies.map((x: any) => x.name)).toEqual(["Alfa", "Zeta"]);
    expect(body.agencies[0].distanceKm).toBe(null);
  });
  it("POST pide sumarse aceptando condiciones", async () => {
    agencyFindFirst.mockResolvedValue({ id: 2, ownerUserId: 10, termsText: null, termsVersion: 1 });
    memberFindUnique.mockResolvedValue(null);
    memberCreate.mockResolvedValue({});
    const res = await POST(post({ agencyId: 2, message: "Tengo FTP", acceptTerms: true }));
    expect(await res.json()).toEqual({ outcome: "requested" });
    expect(memberCreate.mock.calls[0][0].data).toMatchObject({ agencyId: 2, userId: 20, status: "REQUESTED", requestMessage: "Tengo FTP", termsVersionAccepted: 1 });
  });
  it("POST reabre una solicitud rechazada", async () => {
    agencyFindFirst.mockResolvedValue({ id: 2, ownerUserId: 10, termsText: null, termsVersion: 1 });
    memberFindUnique.mockResolvedValue({ id: 5, status: "REJECTED" });
    memberUpdate.mockResolvedValue({});
    expect(await (await POST(post({ agencyId: 2, acceptTerms: true }))).json()).toEqual({ outcome: "requested" });
    expect(memberUpdate.mock.calls[0][0].data.status).toBe("REQUESTED");
  });
  it("POST sin aceptar o a una agencia no listada", async () => {
    expect((await POST(post({ agencyId: 2 }))).status).toBe(400);
    agencyFindFirst.mockResolvedValue(null);
    expect((await POST(post({ agencyId: 2, acceptTerms: true }))).status).toBe(404);
    expect(agencyFindFirst.mock.calls[0][0].where).toEqual({ id: 2, directoryListed: true });
  });
  it("POST a la propia: 409", async () => {
    agencyFindFirst.mockResolvedValue({ id: 2, ownerUserId: 20, termsText: null, termsVersion: 1 });
    expect((await POST(post({ agencyId: 2, acceptTerms: true }))).status).toBe(409);
  });
});
