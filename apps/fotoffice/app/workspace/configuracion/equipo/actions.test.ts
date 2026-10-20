import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  role: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  assignmentCount: vi.fn(),
  invFindFirst: vi.fn(),
  invite: vi.fn(),
  remove: vi.fn(),
  revoke: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: m.findUnique, count: m.count },
    workspaceRoleAssignment: { count: m.assignmentCount },
    workspaceInvitation: { findFirst: m.invFindFirst },
  },
}));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 1, email: "daniel@x.test", name: "Daniel" },
    workspace: { id: "ws1", name: "DNX Estudio" },
    role: m.role(),
  })),
}));
const { FakeTeamError } = vi.hoisted(() => ({ FakeTeamError: class extends Error {} }));
vi.mock("@repo/db/fotoffice-team", () => ({
  TeamError: FakeTeamError,
  removeMember: m.remove,
  revokeTeamInvitation: m.revoke,
}));
vi.mock("@/lib/team/invite", () => ({ inviteTeamMember: m.invite }));

const { resetRateLimit } = await import("@/lib/geocode/rate-limit");
const { inviteTeamAction, removeMemberAction, resendInvitationAction, revokeInvitationAction } = await import(
  "./actions"
);

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const SIN_PERMISO = { error: "No tenés permiso para gestionar el equipo." };
const ENLACE = "https://fotoffice.test/invitacion/equipo/tok";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  resetRateLimit();
  m.invite.mockResolvedValue({ ok: true, sentTo: "sabi@x.test", url: ENLACE });
  m.count.mockResolvedValue(1);
  m.assignmentCount.mockResolvedValue(0);
});

describe("invitar", () => {
  it.each(["STAFF", "COLLABORATOR", null])("%s no puede invitar", async (rol) => {
    m.role.mockReturnValue(rol);
    expect(await inviteTeamAction(undefined, fd({ email: "a@x.test", role: "STAFF" }))).toEqual(SIN_PERMISO);
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("el dueño invita con rol Equipo y recibe el enlace una sola vez", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    const r = await inviteTeamAction(undefined, fd({ email: "sabi@x.test", role: "STAFF" }));
    expect(r).toEqual({ error: null, ok: "Invitación enviada a sabi@x.test.", warn: undefined, enlace: ENLACE });
    expect(m.invite).toHaveBeenCalledWith({
      workspaceId: "ws1",
      actor: { id: 1, name: "Daniel" },
      email: "sabi@x.test",
      role: "STAFF",
    });
    expect(m.revalidate).toHaveBeenCalledWith("/workspace/configuracion/equipo");
  });

  it("el administrador también puede invitar", async () => {
    m.role.mockReturnValue("WORKSPACE_ADMIN");
    const r = await inviteTeamAction(undefined, fd({ email: "sabi@x.test", role: "WORKSPACE_ADMIN" }));
    expect(r.error).toBeNull();
  });

  it.each(["WORKSPACE_OWNER", "COLLABORATOR", "SUPER_ADMIN", ""])("rechaza el rol %s", async (rol) => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    expect(await inviteTeamAction(undefined, fd({ email: "a@x.test", role: rol }))).toEqual({
      error: "Ese rol no está disponible.",
    });
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("el workspace sale de la sesión, no del formulario", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    await inviteTeamAction(undefined, fd({ email: "a@x.test", role: "STAFF", workspaceId: "otro" }));
    expect(m.invite.mock.calls[0][0].workspaceId).toBe("ws1");
  });

  it("correo inválido: devuelve el error de la validación", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.invite.mockResolvedValue({ ok: false, error: "Revisá el correo." });
    expect(await inviteTeamAction(undefined, fd({ email: "nope", role: "STAFF" }))).toEqual({ error: "Revisá el correo." });
    expect(m.revalidate).not.toHaveBeenCalled();
  });

  it("ya es parte del equipo", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.invite.mockResolvedValue({ ok: false, error: "Esa persona ya es parte del equipo." });
    expect(await inviteTeamAction(undefined, fd({ email: "daniel@x.test", role: "STAFF" }))).toEqual({
      error: "Esa persona ya es parte del equipo.",
    });
  });

  it("el correo no salió: avisa y deja el enlace para mandarlo a mano", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.invite.mockResolvedValue({ ok: true, sentTo: "sabi@x.test", url: ENLACE, warn: "no salió" });
    const r = await inviteTeamAction(undefined, fd({ email: "sabi@x.test", role: "STAFF" }));
    expect(r.warn).toBe("no salió");
    expect(r.enlace).toBe(ENLACE);
  });

  it("frena después de 20 invitaciones en una hora", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    for (let i = 0; i < 20; i++) {
      expect((await inviteTeamAction(undefined, fd({ email: `p${i}@x.test`, role: "STAFF" }))).error).toBeNull();
    }
    const r = await inviteTeamAction(undefined, fd({ email: "p21@x.test", role: "STAFF" }));
    expect(r.error).toMatch(/muchas invitaciones/);
    expect(m.invite).toHaveBeenCalledTimes(20);
  });
});

describe("reenviar y cancelar", () => {
  it("STAFF no puede reenviar ni cancelar", async () => {
    m.role.mockReturnValue("STAFF");
    expect(await resendInvitationAction(undefined, fd({ invitationId: "i1" }))).toEqual(SIN_PERMISO);
    expect(await revokeInvitationAction(undefined, fd({ invitationId: "i1" }))).toEqual(SIN_PERMISO);
    expect(m.invFindFirst).not.toHaveBeenCalled();
    expect(m.revoke).not.toHaveBeenCalled();
  });

  it("reenviar busca la invitación pendiente en ESTE workspace y arma un enlace nuevo", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.invFindFirst.mockResolvedValue({ email: "sabi@x.test", role: "STAFF" });
    const r = await resendInvitationAction(undefined, fd({ invitationId: "i1" }));
    expect(m.invFindFirst.mock.calls[0][0].where).toEqual({
      id: "i1",
      workspaceId: "ws1",
      acceptedAt: null,
      revokedAt: null,
    });
    expect(r).toMatchObject({ error: null, ok: "Invitación reenviada a sabi@x.test.", enlace: ENLACE });
  });

  it("reenviar una invitación que no existe", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.invFindFirst.mockResolvedValue(null);
    expect((await resendInvitationAction(undefined, fd({ invitationId: "x" }))).error).toMatch(/No se encontró/);
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("cancelar", async () => {
    m.role.mockReturnValue("WORKSPACE_ADMIN");
    expect(await revokeInvitationAction(undefined, fd({ invitationId: "i1" }))).toEqual({
      error: null,
      ok: "Invitación cancelada: el enlace ya no sirve.",
    });
    expect(m.revoke).toHaveBeenCalledWith("ws1", "i1", 1);
  });

  it("cancelar una ya aceptada", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.revoke.mockRejectedValue(new FakeTeamError());
    expect((await revokeInvitationAction(undefined, fd({ invitationId: "i1" }))).error).toMatch(/ya fue aceptada/);
  });
});

describe("dar de baja", () => {
  it("STAFF no puede dar de baja", async () => {
    m.role.mockReturnValue("STAFF");
    expect(await removeMemberAction(undefined, fd({ userId: "7" }))).toEqual(SIN_PERMISO);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("el dueño da de baja a alguien del Equipo", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.findUnique.mockResolvedValue({ role: "STAFF" });
    expect(await removeMemberAction(undefined, fd({ userId: "7" }))).toEqual({
      error: null,
      ok: "Listo: ya no tiene acceso a este espacio.",
    });
    expect(m.remove).toHaveBeenCalledWith("ws1", 7, 1);
  });

  it.each(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "COLLABORATOR"])("nunca a un %s", async (rol) => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.findUnique.mockResolvedValue({ role: rol });
    expect((await removeMemberAction(undefined, fd({ userId: "7" }))).error).toMatch(/sólo se puede dar de baja/);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("nunca a uno mismo", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.findUnique.mockResolvedValue({ role: "WORKSPACE_OWNER" });
    expect((await removeMemberAction(undefined, fd({ userId: "1" }))).error).toBeTruthy();
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("a quien tiene roles de la comisión lo maneja Comisión directiva", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.findUnique.mockResolvedValue({ role: "STAFF" });
    m.assignmentCount.mockResolvedValue(2);
    expect((await removeMemberAction(undefined, fd({ userId: "7" }))).error).toMatch(/Comisión directiva/);
    expect(m.remove).not.toHaveBeenCalled();
  });

  it("alguien que no está en el equipo", async () => {
    m.role.mockReturnValue("WORKSPACE_OWNER");
    m.findUnique.mockResolvedValue(null);
    expect((await removeMemberAction(undefined, fd({ userId: "99" }))).error).toMatch(/No se encontró/);
    expect((await removeMemberAction(undefined, fd({ userId: "abc" }))).error).toMatch(/No se encontró/);
    expect(m.remove).not.toHaveBeenCalled();
  });
});
