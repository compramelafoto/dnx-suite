import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El panel manda al onboarding sólo a quien puede completarlo (dueño o admin). Un STAFF de una
 * institución con el onboarding sin terminar entra igual al panel: si lo mandara a
 * `/onboarding`, que lo devuelve a `/workspace`, quedaría rebotando.
 */

const H = vi.hoisted(() => ({
  role: "WORKSPACE_OWNER" as string | null,
  onboardingCompletedAt: null as Date | null,
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error(`REDIRECT:${path}`), { path });
  }),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("@/components/shell/admin-shell", () => ({ AdminShell: () => null }));
vi.mock("@/lib/auth", () => ({
  requireAuth: async () => ({ id: 4, email: "a@b.test", name: "Daniel", globalRole: "USER" }),
  hasAppAccess: () => false,
}));
vi.mock("@/lib/portal/user-kind", () => ({ resolveFotofficeUserKind: async () => "TEAM" }));
vi.mock("@/lib/entrada/require-own-workspace", () => ({
  requireOwnWorkspace: async () => ({ workspaceId: "ws-sfpr", created: false, onboardingCompleted: false }),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: async () => (H.role ? { role: H.role } : null) },
    fotofficeWorkspaceBranding: {
      findUnique: async () => ({ onboardingCompletedAt: H.onboardingCompletedAt }),
    },
  },
}));

const { default: WorkspaceLayout } = await import("./layout");

async function run(): Promise<string | null> {
  try {
    await WorkspaceLayout({ children: null });
    return null;
  } catch (e) {
    const path = (e as { path?: string }).path;
    if (path) return path;
    throw e;
  }
}

beforeEach(() => {
  H.role = "WORKSPACE_OWNER";
  H.onboardingCompletedAt = null;
});

describe("panel y onboarding pendiente", () => {
  it("dueño con onboarding pendiente → /onboarding", async () => {
    expect(await run()).toBe("/onboarding");
  });

  it("admin con onboarding pendiente → /onboarding", async () => {
    H.role = "WORKSPACE_ADMIN";
    expect(await run()).toBe("/onboarding");
  });

  it("STAFF con onboarding pendiente entra al panel", async () => {
    H.role = "STAFF";
    expect(await run()).toBeNull();
  });

  it("onboarding terminado: entra al panel", async () => {
    H.onboardingCompletedAt = new Date("2026-01-01");
    expect(await run()).toBeNull();
  });

  it("sin membresía ni acceso: afuera", async () => {
    H.role = null;
    expect(await run()).toBe("/login?forbiddenApp=fotoffice");
  });
});
