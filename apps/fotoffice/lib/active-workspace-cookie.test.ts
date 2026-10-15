import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La institución que eligió la persona ("Administración" de SFPR) tiene que ser la que muestra
 * el panel, aunque además sea dueña de su estudio propio. La cookie de institución activa sólo
 * vale si la persona es miembro de esa institución: una cookie ajena se ignora.
 */

const H = vi.hoisted(() => ({
  cookieValue: null as string | null,
  wmFindMany: vi.fn(),
  legacyFindMany: vi.fn(async () => []),
  legacyFindFirst: vi.fn(async () => null),
  brandingFindUnique: vi.fn(),
  brandingCreate: vi.fn(),
  workspaceCreate: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error(`REDIRECT:${path}`), { path });
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "fotoffice_workspace_id" && H.cookieValue ? { value: H.cookieValue } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findMany: H.wmFindMany },
    membership: { findMany: H.legacyFindMany, findFirst: H.legacyFindFirst },
    fotofficeWorkspaceBranding: { findUnique: H.brandingFindUnique, create: H.brandingCreate },
    workspace: { create: H.workspaceCreate },
  },
}));

const { resolveActiveWorkspace } = await import("./workspace");
const { requireOwnWorkspace } = await import("./entrada/require-own-workspace");

const ESTUDIO = {
  workspaceId: "ws-estudio",
  role: "WORKSPACE_OWNER",
  workspace: { id: "ws-estudio", name: "Mi Estudio", fotofficeBranding: { onboardingCompletedAt: null } },
};
const SFPR = {
  workspaceId: "ws-sfpr",
  role: "WORKSPACE_ADMIN",
  workspace: { id: "ws-sfpr", name: "SFPR", fotofficeBranding: { onboardingCompletedAt: new Date("2026-01-01") } },
};

const user = { id: 4, email: "a@b.test", name: "Daniel" };

beforeEach(() => {
  H.cookieValue = null;
  H.wmFindMany.mockReset().mockResolvedValue([ESTUDIO, SFPR]);
  // `dnxestudio` (DNX Estudio) apunta al estudio propio: antes ganaba siempre, incluso contra la cookie.
  H.brandingFindUnique.mockReset().mockResolvedValue({ workspaceId: "ws-estudio" });
  H.brandingCreate.mockReset();
  H.workspaceCreate.mockReset();
});

describe("resolveActiveWorkspace", () => {
  it("la cookie de una institución donde es miembro gana", async () => {
    H.cookieValue = "ws-sfpr";
    expect(await resolveActiveWorkspace(4)).toEqual({ id: "ws-sfpr", name: "SFPR" });
  });

  it("la cookie de una institución ajena se ignora", async () => {
    H.cookieValue = "ws-de-otro";
    expect(await resolveActiveWorkspace(4)).toEqual({ id: "ws-estudio", name: "Mi Estudio" });
  });

  it("sin cookie, el comportamiento de antes (preferencia DNX Estudio)", async () => {
    expect(await resolveActiveWorkspace(4)).toEqual({ id: "ws-estudio", name: "Mi Estudio" });
  });

  it("sin cookie ni DNX Estudio, la primera membresía", async () => {
    H.brandingFindUnique.mockResolvedValue(null);
    H.wmFindMany.mockResolvedValue([SFPR, ESTUDIO]);
    expect(await resolveActiveWorkspace(4)).toEqual({ id: "ws-sfpr", name: "SFPR" });
  });
});

describe("requireOwnWorkspace", () => {
  it("con la cookie en una institución donde es miembro, devuelve ésa (y su onboarding)", async () => {
    H.cookieValue = "ws-sfpr";
    expect(await requireOwnWorkspace(user)).toEqual({
      workspaceId: "ws-sfpr",
      created: false,
      onboardingCompleted: true,
    });
  });

  it("con la cookie ajena, sigue prefiriendo la propia", async () => {
    H.cookieValue = "ws-de-otro";
    expect((await requireOwnWorkspace(user)).workspaceId).toBe("ws-estudio");
  });

  it("sin cookie, la propia como siempre", async () => {
    expect((await requireOwnWorkspace(user)).workspaceId).toBe("ws-estudio");
  });

  it("una institución elegida sin branding no se repara: vale la propia", async () => {
    H.cookieValue = "ws-sfpr";
    H.wmFindMany.mockResolvedValue([ESTUDIO, { ...SFPR, workspace: { ...SFPR.workspace, fotofficeBranding: null } }]);
    expect((await requireOwnWorkspace(user)).workspaceId).toBe("ws-estudio");
    expect(H.brandingCreate).not.toHaveBeenCalled();
  });

  it("nunca crea una institución", async () => {
    H.cookieValue = "ws-sfpr";
    await requireOwnWorkspace(user);
    H.wmFindMany.mockResolvedValue([]);
    await requireOwnWorkspace(user).catch(() => null);
    expect(H.workspaceCreate).not.toHaveBeenCalled();
  });

  it("sin ninguna membresía va a la bienvenida", async () => {
    H.wmFindMany.mockResolvedValue([]);
    H.cookieValue = "ws-sfpr";
    await expect(requireOwnWorkspace(user)).rejects.toMatchObject({ path: "/bienvenida" });
  });
});
