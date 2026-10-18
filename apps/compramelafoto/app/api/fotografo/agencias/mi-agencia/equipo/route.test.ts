import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const agencyFindUnique = vi.fn();
const memberFindMany = vi.fn();
const memberFindFirst = vi.fn();
const memberUpdate = vi.fn();
const inviteUpdateMany = vi.fn();
const inviteCreate = vi.fn();
const transaction = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agency: { findUnique: (...a: unknown[]) => agencyFindUnique(...a) },
    agencyMember: {
      findMany: (...a: unknown[]) => memberFindMany(...a),
      findFirst: (...a: unknown[]) => memberFindFirst(...a),
      update: (...a: unknown[]) => memberUpdate(...a),
    },
    agencyInvite: {
      updateMany: (...a: unknown[]) => inviteUpdateMany(...a),
      create: (...a: unknown[]) => inviteCreate(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET } from "./route";
import { PATCH } from "./[memberId]/route";
import { POST as POST_INVITE } from "../invitacion/route";

const agency = { id: 3, ownerUserId: 10, defaultCommissionBps: 3000, termsVersion: 2, termsText: null };
const req = (body: unknown) => ({ json: async () => body }) as any;
const ctx = (memberId: string) => ({ params: Promise.resolve({ memberId }) });

beforeEach(() => {
  for (const f of [requireAuth, agencyFindUnique, memberFindMany, memberFindFirst, memberUpdate, inviteUpdateMany, inviteCreate, transaction]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 10 } });
  agencyFindUnique.mockResolvedValue(agency);
  transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

describe("equipo", () => {
  it("GET separa miembros y solicitudes y calcula porcentajes", async () => {
    memberFindMany.mockResolvedValue([
      { id: 1, userId: 20, status: "ACTIVE", commissionBps: null, termsVersionAccepted: 1, requestMessage: null, joinedAt: new Date("2026-10-20T12:00:00Z"), user: { name: "Juan", email: "juan@x.com" } },
      { id: 2, userId: 21, status: "REQUESTED", commissionBps: null, termsVersionAccepted: 2, requestMessage: "Hola", joinedAt: null, user: { name: "Pedro", email: "p@x.com" } },
      { id: 3, userId: 22, status: "ACTIVE", commissionBps: 3500, termsVersionAccepted: 2, requestMessage: null, joinedAt: null, user: { name: "Ana", email: "a@x.com" } },
    ]);
    const body = await (await GET()).json();
    expect(body.members.map((m: any) => m.name)).toEqual(["Juan", "Ana"]);
    expect(body.members[0]).toMatchObject({ commissionLabel: "30 %", usesDefault: true, needsTerms: true });
    expect(body.members[1]).toMatchObject({ commissionLabel: "35 %", usesDefault: false, needsTerms: false });
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0]).toMatchObject({ name: "Pedro", requestMessage: "Hola" });
  });
  it("GET sin agencia: 404", async () => {
    agencyFindUnique.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });
  it("PATCH no toca miembros de otra agencia", async () => {
    memberFindFirst.mockResolvedValue(null);
    const res = await PATCH(req({ action: "remove" }), ctx("99"));
    expect(res.status).toBe(404);
    expect(memberFindFirst.mock.calls[0][0].where).toEqual({ id: 99, agencyId: 3 });
  });
  it("PATCH setCommission vacío = usa el general", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    memberUpdate.mockResolvedValue({});
    const res = await PATCH(req({ action: "setCommission", percent: "" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(memberUpdate.mock.calls[0][0].data).toEqual({ commissionBps: null });
  });
  it("PATCH setCommission inválido: 400", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    const res = await PATCH(req({ action: "setCommission", percent: "150" }), ctx("1"));
    expect(res.status).toBe(400);
  });
  it("PATCH accept sólo sobre solicitudes", async () => {
    memberFindFirst.mockResolvedValue({ id: 2, status: "ACTIVE" });
    expect((await PATCH(req({ action: "accept" }), ctx("2"))).status).toBe(409);
    memberFindFirst.mockResolvedValue({ id: 2, status: "REQUESTED" });
    memberUpdate.mockResolvedValue({});
    expect((await PATCH(req({ action: "accept" }), ctx("2"))).status).toBe(200);
    expect(memberUpdate.mock.calls[0][0].data.status).toBe("ACTIVE");
    expect(memberUpdate.mock.calls[0][0].data.joinedAt).toBeInstanceOf(Date);
  });
  it("PATCH remove marca la baja", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    memberUpdate.mockResolvedValue({});
    await PATCH(req({ action: "remove" }), ctx("1"));
    expect(memberUpdate.mock.calls[0][0].data.status).toBe("REMOVED");
    expect(memberUpdate.mock.calls[0][0].data.removedAt).toBeInstanceOf(Date);
  });
  it("PATCH acción desconocida: 400", async () => {
    memberFindFirst.mockResolvedValue({ id: 1, status: "ACTIVE" });
    expect((await PATCH(req({ action: "nada" }), ctx("1"))).status).toBe(400);
  });
  it("POST invitación revoca las anteriores y devuelve el link", async () => {
    inviteUpdateMany.mockResolvedValue({ count: 1 });
    inviteCreate.mockResolvedValue({});
    const res = await POST_INVITE();
    const body = await res.json();
    expect(body.url).toMatch(/\/agencias\/unirse\?token=[a-f0-9]{48}$/);
    expect(inviteUpdateMany.mock.calls[0][0]).toMatchObject({ where: { agencyId: 3, revokedAt: null } });
    expect(inviteCreate.mock.calls[0][0].data).toMatchObject({ agencyId: 3, createdByUserId: 10 });
    expect(inviteCreate.mock.calls[0][0].data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
