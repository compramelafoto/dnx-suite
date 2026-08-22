import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  findInvitationMock,
  userFindUniqueMock,
  userUpsertMock,
  requestPasswordResetMock,
  setContinuityMock,
  clearContinuityMock,
} = vi.hoisted(() => ({
  findInvitationMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userUpsertMock: vi.fn(),
  requestPasswordResetMock: vi.fn(),
  setContinuityMock: vi.fn(),
  clearContinuityMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { user: { findUnique: userFindUniqueMock, upsert: userUpsertMock } },
}));
vi.mock("@repo/auth", () => ({ requestPasswordReset: requestPasswordResetMock }));
vi.mock("@repo/db/fotoffice-member-invitations", () => ({
  findInvitationByTokenHash: findInvitationMock,
}));
vi.mock("@/lib/members/invitation-continuity", () => ({
  setInvitationContinuity: setContinuityMock,
  clearInvitationContinuity: clearContinuityMock,
}));

const { startPasswordActivationAction } = await import("./member-activation");

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

function form(token = "token-crudo") {
  const fd = new FormData();
  fd.set("token", token);
  return fd;
}

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://fotoffice.com");
  findInvitationMock.mockReset().mockResolvedValue(invitation());
  userFindUniqueMock.mockReset().mockResolvedValue(null);
  userUpsertMock.mockReset().mockResolvedValue({ id: 9 });
  requestPasswordResetMock.mockReset().mockResolvedValue({
    ok: true,
    created: true,
    emailResult: { sent: true, skipped: false },
  });
  setContinuityMock.mockReset();
  clearContinuityMock.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe("usuario inexistente", () => {
  it("se crea sin contraseña y sin permisos", async () => {
    const state = await startPasswordActivationAction(undefined, form());
    expect(state.status).toBe("PASSWORD_EMAIL_SENT");

    const args = userUpsertMock.mock.calls[0]?.[0];
    expect(args.create.email).toBe("socio@example.com");
    expect(args.create.password).toBeUndefined();
    expect(args.create.globalRole).toBeUndefined();
    expect(JSON.stringify(args)).not.toContain("workspaceMembership");
    expect(JSON.stringify(args)).not.toContain("WORKSPACE_");
  });

  it("dos solicitudes simultáneas producen un solo usuario", async () => {
    // `upsert` sobre el email único: la segunda no crea, actualiza nada.
    await startPasswordActivationAction(undefined, form());
    expect(userUpsertMock.mock.calls[0]?.[0]?.update).toEqual({});
    expect(userUpsertMock.mock.calls[0]?.[0]?.where).toEqual({ email: "socio@example.com" });
  });

  it("no vincula el socio", async () => {
    const state = await startPasswordActivationAction(undefined, form());
    expect(state.status).toBe("PASSWORD_EMAIL_SENT");
    // No hay ninguna escritura sobre Member en este paso: el mock de prisma solo expone user.
  });

  it("guarda la continuidad acotada al vencimiento de la invitación", async () => {
    await startPasswordActivationAction(undefined, form());
    expect(setContinuityMock).toHaveBeenCalledWith("token-crudo", FUTURE);
  });
});

describe("usuario existente", () => {
  it("sin contraseña se reutiliza, no se crea otro", async () => {
    userFindUniqueMock.mockResolvedValue({ id: 9, password: null });
    const state = await startPasswordActivationAction(undefined, form());
    expect(state.status).toBe("PASSWORD_EMAIL_SENT");
    expect(userUpsertMock).not.toHaveBeenCalled();
  });

  it("con contraseña se lo manda a iniciar sesión y no se crea nada", async () => {
    userFindUniqueMock.mockResolvedValue({ id: 9, password: "scrypt$..." });
    const state = await startPasswordActivationAction(undefined, form());
    expect(state.status).toBe("SIGN_IN_REQUIRED");
    expect(userUpsertMock).not.toHaveBeenCalled();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
    expect(setContinuityMock).not.toHaveBeenCalled();
  });
});

describe("invitación que no habilita nada", () => {
  it.each([
    ["inexistente", null],
    ["revocada", invitation({ revokedAt: new Date() })],
    ["aceptada", invitation({ acceptedAt: new Date() })],
    ["vencida", invitation({ expiresAt: new Date(Date.now() - 1000) })],
    ["de un socio ya vinculado", invitation({ member: { id: "m", userId: 5, status: "ACTIVE" } })],
    ["de un socio suspendido", invitation({ member: { id: "m", userId: null, status: "SUSPENDED" } })],
    ["de un socio dado de baja", invitation({ member: { id: "m", userId: null, status: "INACTIVE" } })],
  ])("%s: no crea usuario ni manda email", async (_label, inv) => {
    findInvitationMock.mockResolvedValue(inv);
    const state = await startPasswordActivationAction(undefined, form());
    expect(state.status).toBe("INVALID");
    expect(userUpsertMock).not.toHaveBeenCalled();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("borra la continuidad guardada", async () => {
    findInvitationMock.mockResolvedValue(null);
    await startPasswordActivationAction(undefined, form());
    expect(clearContinuityMock).toHaveBeenCalledTimes(1);
  });

  it("sin token tampoco hace nada", async () => {
    const state = await startPasswordActivationAction(undefined, new FormData());
    expect(state.status).toBe("INVALID");
    expect(findInvitationMock).not.toHaveBeenCalled();
  });
});

describe("configuración y envío", () => {
  it.each([undefined, "", "/relativa", "fotoffice.com"])(
    "APP_URL inválida (%s) no crea usuario",
    async (value) => {
      vi.stubEnv("APP_URL", value ?? "");
      const state = await startPasswordActivationAction(undefined, form());
      expect(state.status).toBe("CONFIGURATION_ERROR");
      expect(userUpsertMock).not.toHaveBeenCalled();
    },
  );

  it("un fallo de envío se informa y NO vincula el socio", async () => {
    requestPasswordResetMock.mockResolvedValue({
      ok: true,
      created: true,
      emailResult: { sent: false, skipped: true, reason: "sin proveedor" },
    });
    const state = await startPasswordActivationAction(undefined, form());
    expect(state.status).toBe("SEND_FAILED");
  });

  it("nunca muestra el token ni el detalle técnico al socio", async () => {
    requestPasswordResetMock.mockResolvedValue({
      ok: true,
      created: true,
      emailResult: { sent: false, skipped: true, reason: "RESEND_API_KEY no configurada" },
    });
    const state = await startPasswordActivationAction(undefined, form());
    expect(state.message).not.toContain("token-crudo");
    expect(state.message).not.toContain("RESEND_API_KEY");
  });
});
