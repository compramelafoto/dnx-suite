import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  count: vi.fn(),
  invFindFirst: vi.fn(),
  invite: vi.fn(),
  changeRole: vi.fn(),
  remove: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: m.findUnique, count: m.count },
    workspaceInvitation: { findFirst: m.invFindFirst },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: 1, email: "owner@x.test", name: "Owner" })),
}));
vi.mock("@/lib/entrada/require-own-workspace", () => ({
  requireOwnWorkspace: vi.fn(async () => ({ workspaceId: "ws1", created: false, onboardingCompleted: true })),
}));
vi.mock("@repo/db/fotoffice-team", () => ({
  TeamError: class TeamError extends Error {},
  changeMemberRole: m.changeRole,
  removeMember: m.remove,
  revokeTeamInvitation: m.revoke,
}));
vi.mock("@/lib/team/invite", () => ({ inviteTeamMember: m.invite }));

const { inviteTeamAction, changeRoleAction, removeMemberAction, resendInvitationAction } =
  await import("./actions");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

/** Primera lectura = rol del actor; segunda = rol del objetivo. */
function roles(actor: string, objetivo?: string) {
  m.findUnique.mockReset();
  m.findUnique.mockResolvedValueOnce({ role: actor });
  if (objetivo) m.findUnique.mockResolvedValueOnce({ role: objetivo });
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.invite.mockResolvedValue({ ok: true, sentTo: "ana@x.test" });
});

describe("acciones de Equipo", () => {
  it("un miembro del equipo no puede invitar", async () => {
    roles("STAFF");
    const r = await inviteTeamAction(undefined, fd({ email: "ana@x.test", role: "STAFF" }));
    expect(r).toEqual({ error: "No tenés permiso para gestionar el equipo." });
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("no ofrece Colaborador mientras el módulo de proyectos no esté disponible", async () => {
    roles("WORKSPACE_OWNER");
    const r = await inviteTeamAction(undefined, fd({ email: "ana@x.test", role: "COLLABORATOR" }));
    expect(r).toEqual({ error: "Ese rol no está disponible." });
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("el dueño invita a alguien del equipo", async () => {
    roles("WORKSPACE_OWNER");
    const r = await inviteTeamAction(undefined, fd({ email: "ana@x.test", role: "STAFF" }));
    expect(m.invite).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws1", email: "ana@x.test", role: "STAFF" }),
    );
    expect(r).toEqual({ error: null, ok: "Invitación enviada a ana@x.test.", warn: undefined });
  });

  it("el único dueño no puede darse de baja", async () => {
    roles("WORKSPACE_OWNER", "WORKSPACE_OWNER");
    m.count.mockResolvedValue(1);
    const r = await removeMemberAction(undefined, fd({ userId: "1" }));
    expect(r.error).toMatch(/último dueño/);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("un administrador no puede dar de baja a un dueño", async () => {
    roles("WORKSPACE_ADMIN", "WORKSPACE_OWNER");
    m.count.mockResolvedValue(2);
    const r = await removeMemberAction(undefined, fd({ userId: "7" }));
    expect(r.error).toBeTruthy();
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("un administrador no puede nombrar dueño a nadie", async () => {
    roles("WORKSPACE_ADMIN", "STAFF");
    m.count.mockResolvedValue(1);
    const r = await changeRoleAction(undefined, fd({ userId: "7", role: "WORKSPACE_OWNER" }));
    expect(r.error).toBeTruthy();
    expect(m.changeRole).not.toHaveBeenCalled();
  });

  it("el dueño cambia a un administrador a Equipo", async () => {
    roles("WORKSPACE_OWNER");
    m.findUnique.mockResolvedValueOnce({ role: "WORKSPACE_ADMIN" });
    m.count.mockResolvedValue(1);
    const r = await changeRoleAction(undefined, fd({ userId: "7", role: "STAFF" }));
    expect(m.changeRole).toHaveBeenCalledWith("ws1", 7, "STAFF", 1);
    expect(r).toEqual({ error: null, ok: "Rol actualizado." });
  });

  it("reenviar reusa el correo y el rol de la invitación", async () => {
    roles("WORKSPACE_OWNER");
    m.invFindFirst.mockResolvedValue({ email: "ana@x.test", role: "STAFF" });
    const r = await resendInvitationAction(undefined, fd({ invitationId: "inv1" }));
    expect(m.invFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "inv1", workspaceId: "ws1" } }));
    expect(m.invite).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws1", email: "ana@x.test", role: "STAFF" }),
    );
    expect(r.ok).toBe("Invitación reenviada a ana@x.test.");
  });
});
