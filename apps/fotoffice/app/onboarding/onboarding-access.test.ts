import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El onboarding escribe sobre la institución activa (nombre, branding, fin del onboarding).
 * Desde que la institución activa sigue a la cookie, alguien dueño de su estudio y STAFF de
 * SFPR podría, con SFPR activa, renombrarla por POST directo. Sólo dueño o admin escribe.
 */

const H = vi.hoisted(() => ({
  role: "WORKSPACE_OWNER" as string | null,
  onboardingCompleted: false,
  userKind: "TEAM",
  brandingUpdate: vi.fn(),
  workspaceUpdate: vi.fn(),
  cookieSet: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error(`REDIRECT:${path}`), { path });
  }),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: H.cookieSet }) }));
vi.mock("@/lib/auth", () => ({
  requireAuth: async () => ({ id: 4, email: "a@b.test", name: "Daniel" }),
}));
vi.mock("@/lib/entrada/require-own-workspace", () => ({
  requireOwnWorkspace: async () => ({
    workspaceId: "ws-sfpr",
    created: false,
    onboardingCompleted: H.onboardingCompleted,
  }),
}));
vi.mock("@/lib/portal/claim", () => ({ findClaimableMembership: async () => null }));
vi.mock("@/lib/portal/user-kind", () => ({ resolveFotofficeUserKind: async () => H.userKind }));
vi.mock("./onboarding-wizard", () => ({ OnboardingWizard: () => null }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: {
      findUnique: async () => (H.role ? { role: H.role } : null),
    },
    fotofficeWorkspaceBranding: {
      update: H.brandingUpdate,
      findUnique: async () => ({ commercialName: "SFPR", activityType: null, specialties: [] }),
    },
    fotofficePhotographerProfile: { findUnique: async () => null },
    workspace: { update: H.workspaceUpdate },
  },
}));

const { saveOnboardingBusinessAction, saveOnboardingSpecialtiesAction, skipOnboardingAction } =
  await import("./actions");
const { default: OnboardingPage } = await import("./page");

// Un tipo de organización válido, sin atarse a cuál es.
const { FOTOFFICE_ORGANIZATION_TYPE_IDS } = await import("@/lib/onboarding-constants");

function businessForm() {
  const fd = new FormData();
  fd.set("commercialName", "Renombrada");
  fd.set("activityType", [...FOTOFFICE_ORGANIZATION_TYPE_IDS][0]!);
  return fd;
}

async function run(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn();
  } catch (e) {
    const path = (e as { path?: string }).path;
    if (path) return { redirected: path };
    throw e;
  }
}

beforeEach(() => {
  H.role = "WORKSPACE_OWNER";
  H.onboardingCompleted = false;
  H.brandingUpdate.mockReset();
  H.workspaceUpdate.mockReset();
  H.cookieSet.mockReset();
});

describe("STAFF no escribe el onboarding de la institución", () => {
  beforeEach(() => {
    H.role = "STAFF";
  });

  it("datos del negocio: no renombra ni toca el branding", async () => {
    const res = await run(() => saveOnboardingBusinessAction(undefined, businessForm()));
    expect(res).toMatchObject({ error: expect.any(String) });
    expect(H.brandingUpdate).not.toHaveBeenCalled();
    expect(H.workspaceUpdate).not.toHaveBeenCalled();
  });

  it("especialidades: no marca el onboarding como terminado", async () => {
    const fd = new FormData();
    fd.append("specialties", "bodas");
    const res = await run(() => saveOnboardingSpecialtiesAction(undefined, fd));
    expect(res).toMatchObject({ error: expect.any(String) });
    expect(H.brandingUpdate).not.toHaveBeenCalled();
  });

  it("saltear: no marca el onboarding y vuelve al panel", async () => {
    expect(await run(() => skipOnboardingAction())).toEqual({ redirected: "/workspace" });
    expect(H.brandingUpdate).not.toHaveBeenCalled();
  });

  it("la página no le muestra el asistente: va al panel", async () => {
    expect(await run(() => OnboardingPage())).toEqual({ redirected: "/workspace" });
  });

  it("sin membresía tampoco escribe", async () => {
    H.role = null;
    await run(() => saveOnboardingBusinessAction(undefined, businessForm())).catch(() => null);
    expect(H.brandingUpdate).not.toHaveBeenCalled();
  });
});

describe("dueño y admin siguen pudiendo", () => {
  it.each(["WORKSPACE_OWNER", "WORKSPACE_ADMIN"])("%s guarda los datos del negocio", async (role) => {
    H.role = role;
    expect(await run(() => saveOnboardingBusinessAction(undefined, businessForm()))).toEqual({
      error: null,
      ok: true,
    });
    expect(H.brandingUpdate).toHaveBeenCalledTimes(1);
    expect(H.workspaceUpdate).toHaveBeenCalledWith({ where: { id: "ws-sfpr" }, data: { name: "Renombrada" } });
  });

  it("el dueño saltea el onboarding", async () => {
    expect(await run(() => skipOnboardingAction())).toEqual({ redirected: "/workspace" });
    expect(H.brandingUpdate).toHaveBeenCalledTimes(1);
  });

  it("el dueño termina con las especialidades", async () => {
    expect(await run(() => saveOnboardingSpecialtiesAction(undefined, new FormData()))).toEqual({
      redirected: "/workspace",
    });
    expect(H.brandingUpdate).toHaveBeenCalledTimes(1);
  });

  it("el dueño ve el asistente", async () => {
    const res = await run(() => OnboardingPage());
    expect(res).not.toHaveProperty("redirected");
  });
});
