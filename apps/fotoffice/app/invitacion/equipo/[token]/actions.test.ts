import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  class TeamError extends Error {
    constructor(readonly reason: "ALREADY_MEMBER" | "INVITATION_INVALID" | "NOT_FOUND") {
      super(reason);
    }
  }
  return {
    TeamError,
    getAuthUser: vi.fn(),
    invitationFindUnique: vi.fn(),
    userFindFirst: vi.fn(),
    userUpsert: vi.fn(),
    findByHash: vi.fn(),
    accept: vi.fn(),
    requestPasswordReset: vi.fn(),
    setContinuity: vi.fn(),
    clearContinuity: vi.fn(),
    cookieSet: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    }),
  };
});

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: m.cookieSet }) }));
vi.mock("@/lib/auth", () => ({ getAuthUser: m.getAuthUser }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceInvitation: { findUnique: m.invitationFindUnique },
    user: { findFirst: m.userFindFirst, upsert: m.userUpsert },
  },
}));
vi.mock("@repo/db/fotoffice-team", () => ({
  TeamError: m.TeamError,
  acceptTeamInvitation: m.accept,
  findTeamInvitationByTokenHash: m.findByHash,
}));
vi.mock("@repo/auth", () => ({ requestPasswordReset: m.requestPasswordReset }));
vi.mock("@/lib/team/continuity", () => ({
  setTeamInvitationContinuity: m.setContinuity,
  clearTeamInvitationContinuity: m.clearContinuity,
}));

const { acceptTeamInvitationAction, startTeamActivationAction } = await import("./actions");
const { hashInvitationToken } = await import("@/lib/members/invitation-tokens");

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const NO_DISPONIBLE = "Esta invitación ya no está disponible.";

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    workspaceId: "ws-9",
    email: "ana@example.com",
    role: "STAFF",
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    workspace: { name: "Estudio Luz" },
    ...overrides,
  };
}

function acceptForm(id = "inv-1") {
  const fd = new FormData();
  fd.set("invitationId", id);
  return fd;
}

function tokenForm(token = "tok-crudo") {
  const fd = new FormData();
  fd.set("token", token);
  return fd;
}

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://fotoffice.com");
  m.getAuthUser.mockReset().mockResolvedValue({ id: 42, email: "Ana@Example.com" });
  m.invitationFindUnique.mockReset().mockResolvedValue(invitation());
  m.findByHash.mockReset().mockResolvedValue(invitation());
  m.accept.mockReset().mockResolvedValue({ workspaceId: "ws-9" });
  m.userFindFirst.mockReset().mockResolvedValue(null);
  m.userUpsert.mockReset().mockResolvedValue({ id: 50 });
  m.requestPasswordReset.mockReset().mockResolvedValue({
    ok: true,
    emailResult: { sent: true, skipped: false },
  });
  m.setContinuity.mockReset();
  m.clearContinuity.mockReset();
  m.cookieSet.mockReset();
  m.redirect.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

describe("acceptTeamInvitationAction", () => {
  it("sin sesión pide iniciar sesión y no acepta nada", async () => {
    m.getAuthUser.mockResolvedValue(null);
    expect(await acceptTeamInvitationAction(undefined, acceptForm())).toEqual({
      error: "Iniciá sesión para aceptar.",
    });
    expect(m.accept).not.toHaveBeenCalled();
  });

  it.each([
    ["vencida", { expiresAt: new Date(Date.now() - 1000) }],
    ["revocada", { revokedAt: new Date() }],
    ["aceptada", { acceptedAt: new Date() }],
  ])("invitación %s: no disponible", async (_l, over) => {
    m.invitationFindUnique.mockResolvedValue(invitation(over));
    expect(await acceptTeamInvitationAction(undefined, acceptForm())).toEqual({ error: NO_DISPONIBLE });
    expect(m.accept).not.toHaveBeenCalled();
  });

  it("invitación inexistente: no disponible", async () => {
    m.invitationFindUnique.mockResolvedValue(null);
    expect(await acceptTeamInvitationAction(undefined, acceptForm())).toEqual({ error: NO_DISPONIBLE });
  });

  it("email distinto: lo dice con los dos correos y no acepta", async () => {
    m.getAuthUser.mockResolvedValue({ id: 42, email: "otro@example.com" });
    expect(await acceptTeamInvitationAction(undefined, acceptForm())).toEqual({
      error: "Esta invitación es para ana@example.com. Entraste como otro@example.com.",
    });
    expect(m.accept).not.toHaveBeenCalled();
  });

  it("OK: acepta, borra la continuidad, activa el workspace invitado y va a /workspace", async () => {
    await expect(acceptTeamInvitationAction(undefined, acceptForm())).rejects.toThrow(
      "NEXT_REDIRECT:/workspace",
    );
    expect(m.accept).toHaveBeenCalledWith("inv-1", 42);
    expect(m.clearContinuity).toHaveBeenCalled();
    expect(m.cookieSet).toHaveBeenCalledWith(
      "fotoffice_workspace_id",
      "ws-9",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(m.redirect).toHaveBeenCalledWith("/workspace");
  });

  it("TeamError INVITATION_INVALID concurrente: no disponible, sin redirigir", async () => {
    m.accept.mockRejectedValue(new m.TeamError("INVITATION_INVALID"));
    expect(await acceptTeamInvitationAction(undefined, acceptForm())).toEqual({ error: NO_DISPONIBLE });
    expect(m.redirect).not.toHaveBeenCalled();
    expect(m.cookieSet).not.toHaveBeenCalled();
  });

  it("error inesperado: mensaje genérico", async () => {
    m.accept.mockRejectedValue(new Error("db caída"));
    const res = await acceptTeamInvitationAction(undefined, acceptForm());
    expect(res.error).toBe("No pudimos completar el ingreso. Intentá de nuevo.");
  });

  it("sin invitationId: no disponible", async () => {
    expect(await acceptTeamInvitationAction(undefined, new FormData())).toEqual({ error: NO_DISPONIBLE });
  });
});

describe("startTeamActivationAction", () => {
  it("crea el usuario, guarda la continuidad y manda el correo para crear contraseña", async () => {
    expect(await startTeamActivationAction(undefined, tokenForm())).toEqual({ error: null, sent: true });
    expect(m.findByHash).toHaveBeenCalledWith(hashInvitationToken("tok-crudo"));
    expect(m.userUpsert).toHaveBeenCalledWith({
      where: { email: "ana@example.com" },
      update: {},
      create: { email: "ana@example.com", role: "CUSTOMER" },
    });
    expect(m.setContinuity).toHaveBeenCalledWith("tok-crudo", FUTURE);
    expect(m.requestPasswordReset).toHaveBeenCalledWith({
      email: "ana@example.com",
      appBaseUrl: "https://fotoffice.com",
      appLabel: "FotoOffice",
      resetPath: "/recuperar",
    });
    // La continuidad se guarda antes de mandar el correo.
    expect(m.setContinuity.mock.invocationCallOrder[0]).toBeLessThan(
      m.requestPasswordReset.mock.invocationCallOrder[0]!,
    );
  });

  it("invitación que ya no sirve: no crea nada y descarta la continuidad", async () => {
    m.findByHash.mockResolvedValue(invitation({ revokedAt: new Date() }));
    expect(await startTeamActivationAction(undefined, tokenForm())).toEqual({ error: NO_DISPONIBLE });
    expect(m.userUpsert).not.toHaveBeenCalled();
    expect(m.requestPasswordReset).not.toHaveBeenCalled();
    expect(m.clearContinuity).toHaveBeenCalled();
  });

  it("sin token: no disponible", async () => {
    expect(await startTeamActivationAction(undefined, new FormData())).toEqual({ error: NO_DISPONIBLE });
    expect(m.findByHash).not.toHaveBeenCalled();
  });

  it("si ya tiene contraseña, no toca nada y le pide iniciar sesión", async () => {
    m.userFindFirst.mockResolvedValue({ id: 3, email: "ana@example.com", password: "hash" });
    const res = await startTeamActivationAction(undefined, tokenForm());
    expect(res.error).toMatch(/Ya tenés una cuenta/);
    expect(m.userUpsert).not.toHaveBeenCalled();
    expect(m.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("cuenta existente sin contraseña (otro casing): usa su email, no crea otra", async () => {
    m.userFindFirst.mockResolvedValue({ id: 3, email: "Ana@Example.com", password: null });
    expect(await startTeamActivationAction(undefined, tokenForm())).toEqual({ error: null, sent: true });
    expect(m.userUpsert).not.toHaveBeenCalled();
    expect(m.requestPasswordReset).toHaveBeenCalledWith(expect.objectContaining({ email: "Ana@Example.com" }));
  });

  it("sin APP_URL no crea nada", async () => {
    vi.stubEnv("APP_URL", "");
    const res = await startTeamActivationAction(undefined, tokenForm());
    expect(res.error).toBeTruthy();
    expect(m.userUpsert).not.toHaveBeenCalled();
  });

  it("si el correo no sale, lo dice", async () => {
    m.requestPasswordReset.mockResolvedValue({ ok: true, emailResult: { sent: false, skipped: false } });
    const res = await startTeamActivationAction(undefined, tokenForm());
    expect(res.sent).toBeFalsy();
    expect(res.error).toBe("No pudimos enviarte el correo. Intentá de nuevo en unos minutos.");
  });
});
