import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/token-hash";

const requireAuth = vi.fn();
const inviteFindUnique = vi.fn();
const inviteUpdate = vi.fn();
const memberFindUnique = vi.fn();
const memberCreate = vi.fn();
const memberUpdate = vi.fn();
const transaction = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyInvite: { findUnique: (...a: unknown[]) => inviteFindUnique(...a), update: (...a: unknown[]) => inviteUpdate(...a) },
    agencyMember: {
      findUnique: (...a: unknown[]) => memberFindUnique(...a),
      create: (...a: unknown[]) => memberCreate(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET, POST } from "./route";

const agency = { id: 3, ownerUserId: 10, name: "Fotoshow", logoUrl: null, description: null, defaultCommissionBps: 3000, termsText: null, termsVersion: 2 };
const validInvite = { id: "i1", revokedAt: null, agency };
const getReq = (token: string) => ({ nextUrl: new URL(`http://x/api?token=${token}`) }) as any;
const postReq = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  for (const f of [requireAuth, inviteFindUnique, inviteUpdate, memberFindUnique, memberCreate, memberUpdate, transaction]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
  transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

describe("unirse", () => {
  it("GET busca por hash del token y muestra condiciones", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue(null);
    const body = await (await GET(getReq("tok"))).json();
    expect(inviteFindUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashToken("tok") });
    expect(body.agency).toMatchObject({ name: "Fotoshow", commissionLabel: "30 %" });
    expect(body.agency.terms).toContain("Al sumarte");
    expect(body).toMatchObject({ alreadyActive: false, isOwner: false });
  });
  it("link revocado o inexistente: 404", async () => {
    inviteFindUnique.mockResolvedValue({ ...validInvite, revokedAt: new Date() });
    expect((await GET(getReq("tok"))).status).toBe(404);
    inviteFindUnique.mockResolvedValue(null);
    expect((await POST(postReq({ token: "tok", acceptTerms: true }))).status).toBe(404);
  });
  it("POST exige aceptar las condiciones", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    const res = await POST(postReq({ token: "tok" }));
    expect(res.status).toBe(400);
    expect(memberCreate).not.toHaveBeenCalled();
  });
  it("el dueño no se une a su propia agencia", async () => {
    requireAuth.mockResolvedValue({ error: null, user: { id: 10 } });
    inviteFindUnique.mockResolvedValue(validInvite);
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(res.status).toBe(409);
    expect(memberCreate).not.toHaveBeenCalled();
  });
  it("POST crea el miembro activo con las condiciones vigentes", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue(null);
    memberCreate.mockResolvedValue({});
    inviteUpdate.mockResolvedValue({});
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(await res.json()).toEqual({ outcome: "joined" });
    const data = memberCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ agencyId: 3, userId: 20, status: "ACTIVE", termsVersionAccepted: 2 });
    expect(data.termsAcceptedText).toContain("Al sumarte");
    expect(inviteUpdate.mock.calls[0][0]).toEqual({ where: { id: "i1" }, data: { useCount: { increment: 1 } } });
  });
  it("un dado de baja vuelve como solicitud", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue({ id: 7, status: "REMOVED" });
    memberUpdate.mockResolvedValue({});
    inviteUpdate.mockResolvedValue({});
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(await res.json()).toEqual({ outcome: "requested" });
    expect(memberCreate).not.toHaveBeenCalled();
    expect(memberUpdate.mock.calls[0][0].where).toEqual({ id: 7 });
    expect(memberUpdate.mock.calls[0][0].data).toMatchObject({ status: "REQUESTED", termsVersionAccepted: 2 });
  });
  it("un rechazado vuelve activo por link", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue({ id: 7, status: "REJECTED" });
    memberUpdate.mockResolvedValue({});
    inviteUpdate.mockResolvedValue({});
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(await res.json()).toEqual({ outcome: "joined" });
    expect(memberCreate).not.toHaveBeenCalled();
    expect(memberUpdate.mock.calls[0][0].where).toEqual({ id: 7 });
    expect(memberUpdate.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", removedAt: null, termsVersionAccepted: 2 });
  });
  it("POST si ya es activo no toca nada", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue({ id: 7, status: "ACTIVE" });
    expect(await (await POST(postReq({ token: "tok", acceptTerms: true }))).json()).toEqual({ outcome: "already_active" });
    expect(memberUpdate).not.toHaveBeenCalled();
  });
  it("P2002 (race condition) → already_active", async () => {
    inviteFindUnique.mockResolvedValue(validInvite);
    memberFindUnique.mockResolvedValue(null);
    const prismaErr = new Error("Unique constraint failed") as any;
    prismaErr.code = "P2002";
    memberCreate.mockRejectedValue(prismaErr);
    const res = await POST(postReq({ token: "tok", acceptTerms: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "already_active" });
  });
});
