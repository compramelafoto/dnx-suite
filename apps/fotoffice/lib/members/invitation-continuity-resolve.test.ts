import { beforeEach, describe, expect, it, vi } from "vitest";

const { findInvitationMock, readMock, clearMock } = vi.hoisted(() => ({
  findInvitationMock: vi.fn(),
  readMock: vi.fn(),
  clearMock: vi.fn(),
}));

vi.mock("@repo/db/fotoffice-member-invitations", () => ({
  findInvitationByTokenHash: findInvitationMock,
}));
vi.mock("./invitation-continuity", () => ({
  readInvitationContinuity: readMock,
  clearInvitationContinuity: clearMock,
}));

const { resolveInvitationContinuityPath } = await import("./invitation-continuity-resolve");

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    email: "socio@example.com",
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    member: { id: "mem-1", userId: null, status: "ACTIVE" },
    workspace: { id: "ws-1", name: "Club SFPR" },
    ...overrides,
  };
}

beforeEach(() => {
  readMock.mockReset().mockResolvedValue("token-crudo");
  clearMock.mockReset();
  findInvitationMock.mockReset().mockResolvedValue(invitation());
});

describe("continuidad después de autenticar", () => {
  it("devuelve a la invitación cuando todo coincide", async () => {
    expect(await resolveInvitationContinuityPath("socio@example.com")).toBe(
      "/invitacion/token-crudo",
    );
    expect(clearMock).not.toHaveBeenCalled();
  });

  it("sin cookie no hay continuidad y no se consulta nada", async () => {
    readMock.mockResolvedValue(null);
    expect(await resolveInvitationContinuityPath("socio@example.com")).toBeNull();
    expect(findInvitationMock).not.toHaveBeenCalled();
  });

  /** El caso que la cookie NO puede resolver por sí sola: ser otra persona. */
  it("un email distinto no llega a la invitación y descarta la cookie", async () => {
    expect(await resolveInvitationContinuityPath("otro@example.com")).toBeNull();
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["manipulada / inexistente", null],
    ["revocada", invitation({ revokedAt: new Date() })],
    ["ya aceptada", invitation({ acceptedAt: new Date() })],
    ["vencida", invitation({ expiresAt: new Date(Date.now() - 1000) })],
    ["socio ya vinculado", invitation({ member: { id: "m", userId: 5, status: "ACTIVE" } })],
    ["socio suspendido", invitation({ member: { id: "m", userId: null, status: "SUSPENDED" } })],
  ])("%s: se ignora y se borra la cookie", async (_label, inv) => {
    findInvitationMock.mockResolvedValue(inv);
    expect(await resolveInvitationContinuityPath("socio@example.com")).toBeNull();
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it("la invitación no se consume: solo devuelve la ruta", async () => {
    const path = await resolveInvitationContinuityPath("socio@example.com");
    expect(path).toContain("/invitacion/");
    // Ninguna escritura: el módulo solo lee y, a lo sumo, borra la cookie.
    expect(clearMock).not.toHaveBeenCalled();
  });

  it("busca por el hash, nunca por el token en claro", async () => {
    await resolveInvitationContinuityPath("socio@example.com");
    const arg = findInvitationMock.mock.calls[0]?.[0];
    expect(arg).not.toBe("token-crudo");
    expect(arg).toMatch(/^[a-f0-9]{64}$/);
  });
});
