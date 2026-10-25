import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMock, store } = vi.hoisted(() => {
  const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>();
  return {
    findMock: vi.fn(),
    store: {
      jar,
      get: vi.fn((name: string) => (jar.has(name) ? { value: jar.get(name)!.value } : undefined)),
      set: vi.fn((name: string, value: string, opts?: Record<string, unknown>) => {
        jar.set(name, { value, opts });
      }),
      delete: vi.fn((name: string) => {
        jar.delete(name);
      }),
    },
  };
});

vi.mock("next/headers", () => ({ cookies: async () => store }));
vi.mock("@repo/db/fotoffice-team", () => ({ findTeamInvitationByTokenHash: findMock }));

const {
  TEAM_INVITATION_CONTINUITY_COOKIE,
  clearTeamInvitationContinuity,
  readTeamInvitationContinuity,
  resolveTeamInvitationContinuityPath,
  setTeamInvitationContinuity,
} = await import("./continuity");
const { hashInvitationToken } = await import("@/lib/members/invitation-tokens");

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    workspaceId: "ws-1",
    email: "ana@example.com",
    role: "STAFF",
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    workspace: { name: "Estudio Luz" },
    ...overrides,
  };
}

beforeEach(() => {
  store.jar.clear();
  store.set.mockClear();
  store.delete.mockClear();
  findMock.mockReset().mockResolvedValue(invitation());
});

describe("cookie de continuidad del equipo", () => {
  it("es propia, httpOnly, lax y vive hasta el vencimiento", async () => {
    await setTeamInvitationContinuity("tok", FUTURE);
    expect(TEAM_INVITATION_CONTINUITY_COOKIE).toBe("fotoffice_team_invitation");
    const saved = store.jar.get("fotoffice_team_invitation");
    expect(saved?.value).toBe("tok");
    expect(saved?.opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    const maxAge = saved?.opts?.maxAge as number;
    expect(maxAge).toBeGreaterThan(3500);
    expect(maxAge).toBeLessThanOrEqual(3600);
    // No pisa la cookie de socios.
    expect(store.jar.has("fotoffice_member_invitation")).toBe(false);
  });

  it("no se guarda si la invitación ya venció", async () => {
    await setTeamInvitationContinuity("tok", new Date(Date.now() - 1000));
    expect(store.set).not.toHaveBeenCalled();
  });

  it("se lee y se borra", async () => {
    await setTeamInvitationContinuity("tok", FUTURE);
    expect(await readTeamInvitationContinuity()).toBe("tok");
    await clearTeamInvitationContinuity();
    expect(await readTeamInvitationContinuity()).toBeNull();
  });
});

describe("resolveTeamInvitationContinuityPath", () => {
  beforeEach(() => store.jar.set("fotoffice_team_invitation", { value: "tok/raro" }));

  it("devuelve la ruta si la invitación está pendiente y el email coincide", async () => {
    expect(await resolveTeamInvitationContinuityPath("ANA@example.com")).toBe(
      "/invitacion/equipo/tok%2Fraro",
    );
    expect(findMock).toHaveBeenCalledWith(hashInvitationToken("tok/raro"));
    expect(store.jar.has("fotoffice_team_invitation")).toBe(true);
  });

  it("sin cookie: null y no consulta la base", async () => {
    store.jar.clear();
    expect(await resolveTeamInvitationContinuityPath("ana@example.com")).toBeNull();
    expect(findMock).not.toHaveBeenCalled();
  });

  it.each([
    ["inexistente", null],
    ["aceptada", invitation({ acceptedAt: new Date() })],
    ["revocada", invitation({ revokedAt: new Date() })],
    ["vencida", invitation({ expiresAt: new Date(Date.now() - 1000) })],
  ])("invitación %s: null y se descarta la cookie", async (_label, inv) => {
    findMock.mockResolvedValue(inv);
    expect(await resolveTeamInvitationContinuityPath("ana@example.com")).toBeNull();
    expect(store.jar.has("fotoffice_team_invitation")).toBe(false);
  });

  it("email de otra persona: null y se descarta la cookie", async () => {
    expect(await resolveTeamInvitationContinuityPath("otra@example.com")).toBeNull();
    expect(store.jar.has("fotoffice_team_invitation")).toBe(false);
  });
});
