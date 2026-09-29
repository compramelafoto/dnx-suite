import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Comportamiento de `@repo/db/fotoffice-team` con un `tx` simulado. `@repo/db` y el `./client`
 * que importa ese módulo resuelven al mismo archivo, así que este mock alcanza a los dos.
 */
const tx = vi.hoisted(() => ({
  workspaceInvitation: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn() },
  workspaceMembership: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() },
  workspaceAppAccess: { upsert: vi.fn() },
  user: { findUnique: vi.fn(), updateMany: vi.fn() },
  workspaceAdminEvent: { create: vi.fn() },
}));

vi.mock("@repo/db", () => ({
  prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
}));

const { acceptTeamInvitation, revokeTeamInvitation, TeamError } = await import("@repo/db/fotoffice-team");

beforeEach(() => {
  for (const model of Object.values(tx)) for (const fn of Object.values(model)) fn.mockReset();
  tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 1 });
  tx.workspaceInvitation.findUniqueOrThrow.mockResolvedValue({
    workspaceId: "ws-9",
    role: "WORKSPACE_ADMIN",
    email: "ana@example.com",
  });
  tx.user.findUnique.mockResolvedValue({ email: "Ana@Example.com" });
  tx.workspaceMembership.findUnique.mockResolvedValue(null);
});

describe("acceptTeamInvitation", () => {
  it("crea la membresía con el rol invitado y registra ACCEPTED", async () => {
    expect(await acceptTeamInvitation("inv-1", 42)).toEqual({ workspaceId: "ws-9" });
    expect(tx.workspaceMembership.upsert.mock.calls[0]?.[0]).toMatchObject({
      update: {},
      create: { userId: 42, workspaceId: "ws-9", role: "WORKSPACE_ADMIN" },
    });
    const event = tx.workspaceAdminEvent.create.mock.calls[0]?.[0]?.data;
    expect(event).toMatchObject({ kind: "ACCEPTED", toRole: "WORKSPACE_ADMIN", targetUserId: 42 });
    expect(event.detail).toBeUndefined();
  });

  it("email de la cuenta distinto al invitado: INVITATION_INVALID y no crea nada", async () => {
    tx.user.findUnique.mockResolvedValue({ email: "otra@example.com" });
    await expect(acceptTeamInvitation("inv-1", 42)).rejects.toMatchObject({ reason: "INVITATION_INVALID" });
    await expect(acceptTeamInvitation("inv-1", 42)).rejects.toBeInstanceOf(TeamError);
    expect(tx.workspaceMembership.create).not.toHaveBeenCalled();
    expect(tx.workspaceMembership.upsert).not.toHaveBeenCalled();
    expect(tx.workspaceAppAccess.upsert).not.toHaveBeenCalled();
    expect(tx.workspaceAdminEvent.create).not.toHaveBeenCalled();
  });

  it("usuario inexistente: INVITATION_INVALID", async () => {
    tx.user.findUnique.mockResolvedValue(null);
    await expect(acceptTeamInvitation("inv-1", 42)).rejects.toMatchObject({ reason: "INVITATION_INVALID" });
  });

  it("invitación ya reclamada: INVITATION_INVALID", async () => {
    tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(acceptTeamInvitation("inv-1", 42)).rejects.toMatchObject({ reason: "INVITATION_INVALID" });
  });

  it("si ya era miembro conserva su rol, consume la invitación y lo anota", async () => {
    tx.workspaceMembership.findUnique.mockResolvedValue({ role: "STAFF" });
    expect(await acceptTeamInvitation("inv-1", 42)).toEqual({ workspaceId: "ws-9" });
    expect(tx.workspaceMembership.create).not.toHaveBeenCalled();
    // Sin upgrade ni downgrade: la membresía existente no se toca.
    for (const call of tx.workspaceMembership.upsert.mock.calls) expect(call[0].update).toEqual({});
    expect(tx.workspaceInvitation.updateMany).toHaveBeenCalled();
    expect(tx.workspaceAdminEvent.create.mock.calls[0]?.[0]?.data).toMatchObject({
      kind: "ACCEPTED",
      toRole: "STAFF",
      detail: "ya era miembro",
    });
  });
});

describe("revokeTeamInvitation", () => {
  it("sólo toma invitaciones sin aceptar y sin revocar", async () => {
    tx.workspaceInvitation.findFirst.mockResolvedValue({ email: "ana@example.com", role: "STAFF" });
    await revokeTeamInvitation("ws-9", "inv-1", 1);
    expect(tx.workspaceInvitation.findFirst.mock.calls[0]?.[0]?.where).toMatchObject({
      acceptedAt: null,
      revokedAt: null,
    });
    expect(tx.workspaceInvitation.updateMany.mock.calls[0]?.[0]?.where).toMatchObject({
      acceptedAt: null,
      revokedAt: null,
    });
  });

  it("re-revocar: NOT_FOUND, sin pisar la fecha ni duplicar el evento", async () => {
    tx.workspaceInvitation.findFirst.mockResolvedValue(null);
    await expect(revokeTeamInvitation("ws-9", "inv-1", 1)).rejects.toMatchObject({ reason: "NOT_FOUND" });
    expect(tx.workspaceInvitation.updateMany).not.toHaveBeenCalled();
    expect(tx.workspaceAdminEvent.create).not.toHaveBeenCalled();
  });
});
