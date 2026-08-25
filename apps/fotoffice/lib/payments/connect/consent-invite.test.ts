import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  identityFindUnique: vi.fn(),
  accountFindFirst: vi.fn(),
  consentUpsert: vi.fn(),
  invite: vi.fn(),
  getConsent: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    dnxFinancialIdentity: { findUnique: H.identityFindUnique },
    dnxPaymentAccount: { findFirst: H.accountFindFirst },
    dnxSplitConsent: { upsert: H.consentUpsert },
  },
}));

const { requestSplitConsent, refreshSplitConsent } = await import("./consent-invite");

const provider = { invite: H.invite, getConsent: H.getConsent };

beforeEach(() => {
  H.identityFindUnique.mockReset().mockResolvedValue({ id: "fi-1" });
  H.accountFindFirst.mockReset().mockResolvedValue({ providerUserId: "MP-123" });
  H.consentUpsert.mockReset().mockResolvedValue({});
  H.invite.mockReset().mockResolvedValue([
    { sellerEmail: "sfpr@test.com", receiverId: "MP-123", status: "PENDING", inviteUrl: "https://mp/invite/x" },
  ]);
  H.getConsent.mockReset().mockResolvedValue({ receiverId: "MP-123", status: "ACTIVE" });
});

describe("requestSplitConsent", () => {
  it("pide la invitación y devuelve el enlace de MercadoPago", async () => {
    const r = await requestSplitConsent(
      { workspaceId: "ws-sfpr", sellerEmail: "sfpr@test.com" },
      { provider },
    );
    expect(r).toEqual({ ok: true, state: "PENDING", inviteUrl: "https://mp/invite/x" });
  });

  it("normaliza el email antes de enviarlo", async () => {
    await requestSplitConsent(
      { workspaceId: "ws-sfpr", sellerEmail: "  SFPR@Test.COM  " },
      { provider },
    );
    expect(H.invite.mock.calls[0]?.[0].sellerEmails).toEqual(["sfpr@test.com"]);
  });

  it("usa una clave de idempotencia distinta en cada pedido", async () => {
    await requestSplitConsent({ workspaceId: "w", sellerEmail: "a@b.com" }, { provider });
    await requestSplitConsent({ workspaceId: "w", sellerEmail: "a@b.com" }, { provider });
    const [k1, k2] = H.invite.mock.calls.map((c) => c[0].idempotencyKey);
    expect(k1).not.toBe(k2);
  });

  it("guarda el consentimiento con el receptor que informa MercadoPago", async () => {
    H.invite.mockResolvedValue([
      { sellerEmail: "a@b.com", receiverId: "MP-OTRO", status: "PENDING" },
    ]);
    await requestSplitConsent({ workspaceId: "w", sellerEmail: "a@b.com" }, { provider });
    expect(H.consentUpsert.mock.calls[0]?.[0].create.providerReceiverId).toBe("MP-OTRO");
  });

  it.each(["", "sin-arroba", "a@b", "a b@c.com"])("rechaza el email inválido %s", async (mail) => {
    const r = await requestSplitConsent({ workspaceId: "w", sellerEmail: mail }, { provider });
    expect(r.ok).toBe(false);
    expect(H.invite).not.toHaveBeenCalled();
  });

  /** Pedir el consentimiento antes de conectar la cuenta no tiene sentido: no hay receptor. */
  it("exige que la cuenta esté conectada primero", async () => {
    H.identityFindUnique.mockResolvedValue(null);
    const r = await requestSplitConsent({ workspaceId: "w", sellerEmail: "a@b.com" }, { provider });
    expect(r).toEqual({ ok: false, error: "Primero conectá tu cuenta de MercadoPago." });
  });

  it("si MercadoPago falla no se guarda nada y el mensaje es entendible", async () => {
    H.invite.mockRejectedValue(new Error("mp caido"));
    const r = await requestSplitConsent({ workspaceId: "w", sellerEmail: "a@b.com" }, { provider });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).not.toMatch(/mp caido/);
    expect(H.consentUpsert).not.toHaveBeenCalled();
  });

  it("si MercadoPago no acepta el email lo dice sin tecnicismos", async () => {
    H.invite.mockResolvedValue([]);
    const r = await requestSplitConsent({ workspaceId: "w", sellerEmail: "a@b.com" }, { provider });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/email/i);
  });
});

describe("refreshSplitConsent", () => {
  /** El receptor acepta fuera de la app: sin volver a preguntar quedaría pendiente para siempre. */
  it("consulta el estado real y lo guarda", async () => {
    const r = await refreshSplitConsent("ws-sfpr", { provider });
    expect(r).toEqual({ ok: true, state: "ACTIVE" });
    expect(H.consentUpsert).toHaveBeenCalledTimes(1);
  });

  it("si todavía no hay consentimiento no guarda nada", async () => {
    H.getConsent.mockResolvedValue(null);
    const r = await refreshSplitConsent("ws-sfpr", { provider });
    expect(r).toEqual({ ok: true, state: "NONE" });
    expect(H.consentUpsert).not.toHaveBeenCalled();
  });

  it("exige cuenta conectada", async () => {
    H.accountFindFirst.mockResolvedValue(null);
    const r = await refreshSplitConsent("ws-sfpr", { provider });
    expect(r.ok).toBe(false);
  });

  it("un fallo del proveedor no rompe la pantalla", async () => {
    H.getConsent.mockRejectedValue(new Error("timeout"));
    const r = await refreshSplitConsent("ws-sfpr", { provider });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).not.toMatch(/timeout/);
  });
});
