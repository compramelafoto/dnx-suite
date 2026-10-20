import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const canLink = vi.fn();
const issue = vi.fn();
const list = vi.fn();
const revoke = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({ Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" } }));
vi.mock("@/lib/agencies/flux-keys", () => ({
  FLUX_KEY_MESSAGES: { notMember: "Para vincular DNX FLUX tenés que ser parte del equipo de una agencia." },
  userCanLinkFlux: (...a: unknown[]) => canLink(...a),
  issueLinkCode: (...a: unknown[]) => issue(...a),
  listDeviceKeys: (...a: unknown[]) => list(...a),
  revokeDeviceKey: (...a: unknown[]) => revoke(...a),
}));

import { GET, POST } from "./route";
import { DELETE } from "./[deviceId]/route";

const ctx = (deviceId: string) => ({ params: Promise.resolve({ deviceId }) });

beforeEach(() => {
  for (const f of [requireAuth, canLink, issue, list, revoke]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
});

describe("dispositivos de DNX FLUX del fotógrafo", () => {
  it("sin sesión: 401 en todo", async () => {
    requireAuth.mockResolvedValue({ error: "No autenticado", user: null });
    expect((await GET()).status).toBe(401);
    expect((await POST()).status).toBe(401);
    expect((await DELETE({} as any, ctx("3"))).status).toBe(401);
  });
  it("GET lista sólo las del usuario", async () => {
    list.mockResolvedValue([{ id: 3, label: "Notebook", keyPrefix: "abcdefgh", createdAt: "2027-01-18T13:00:00.000Z", lastUsedAt: null }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).devices).toHaveLength(1);
    expect(list).toHaveBeenCalledWith(20);
  });
  it("POST sin agencia activa: 403 y no genera código", async () => {
    canLink.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(issue).not.toHaveBeenCalled();
  });
  it("POST con agencia activa: devuelve el código y su vencimiento", async () => {
    canLink.mockResolvedValue(true);
    issue.mockResolvedValue({ code: "K7QM-4PXT", expiresAt: new Date("2027-01-18T13:10:00Z") });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "K7QM-4PXT", expiresAt: "2027-01-18T13:10:00.000Z" });
    expect(issue).toHaveBeenCalledWith(20);
  });
  it("DELETE: id inválido 400, ajeno o ya desvinculado 404, propio 200", async () => {
    expect((await DELETE({} as any, ctx("abc"))).status).toBe(400);
    revoke.mockResolvedValue(false);
    expect((await DELETE({} as any, ctx("9"))).status).toBe(404);
    revoke.mockResolvedValue(true);
    const res = await DELETE({} as any, ctx("3"));
    expect(res.status).toBe(200);
    expect(revoke).toHaveBeenLastCalledWith(20, 3);
  });
});
