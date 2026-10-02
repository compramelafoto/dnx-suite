import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ role: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
// Sólo lo que usa el `resolveActiveWorkspace` real (lo ejercitan las guardas de módulo de abajo).
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: {
      findMany: async () => [{ workspaceId: "ws-1", workspace: { id: "ws-1", name: "Mi Estudio" } }],
    },
    fotofficeWorkspaceBranding: { findUnique: async () => null },
  },
}));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ id: 7 }), getAuthUser: async () => ({ id: 7 }) }));
vi.mock("@/lib/workspace", () => ({
  requireActiveWorkspace: async () => ({ user: { id: 7 }, workspace: { id: "ws-1" } }),
  resolveActiveWorkspace: async () => ({ id: "ws-1" }),
}));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async () => true }));

const { requireBookingsStaff } = await import("@/lib/bookings/access");
const { requireCashStaff } = await import("@/lib/cash/access");
const { requireClientsStaff } = await import("@/lib/clients/access");
const { requireRafflesStaff } = await import("@/lib/raffles/access");
const { requireCoveragesReviewer, requireCoveragesCoordinator } = await import("@/lib/coverages/access");
const { requireMembersContext } = await import("@/lib/members/access");
const { requireServiceLeadsStaff } = await import("@/lib/service-leads/access");
// `@/lib/workspace` está simulado arriba para las demás guardas; éstas viven en el módulo real.
const {
  requireCoursesSalesContext,
  requireCoursesSalesSettingsContext,
  requireEvaluacionesContext,
  requireWebsiteContext,
} = await vi.importActual<typeof import("@/lib/workspace")>("@/lib/workspace");

const GUARDAS: [string, () => Promise<unknown>][] = [
  ["reservas", requireBookingsStaff],
  ["caja", requireCashStaff],
  ["clientes", requireClientsStaff],
  ["sorteos", requireRafflesStaff],
  ["coberturas (revisar)", requireCoveragesReviewer],
  ["coberturas (coordinar)", requireCoveragesCoordinator],
  ["socios", requireMembersContext],
  ["captación", requireServiceLeadsStaff],
  ["cursos", requireCoursesSalesContext],
  ["evaluaciones", requireEvaluacionesContext],
  ["sitio web", requireWebsiteContext],
];

beforeEach(() => H.role.mockReset());

describe.each(GUARDAS)("guarda de %s", (_nombre, guarda) => {
  it("deja pasar a Equipo", async () => {
    H.role.mockResolvedValue("STAFF");
    await expect(guarda()).resolves.toBeDefined();
  });
  it("deja pasar a MEMBER (legacy de Equipo)", async () => {
    H.role.mockResolvedValue("MEMBER");
    await expect(guarda()).resolves.toBeDefined();
  });
  it("deja afuera al Colaborador", async () => {
    H.role.mockResolvedValue("COLLABORATOR");
    await expect(guarda()).rejects.toThrow("REDIRECT:");
  });
  it("deja afuera a quien no tiene rol", async () => {
    H.role.mockResolvedValue(null);
    await expect(guarda()).rejects.toThrow("REDIRECT:");
  });
});

describe("guarda de la configuración de cursos", () => {
  it("deja pasar al dueño y al administrador", async () => {
    for (const r of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]) {
      H.role.mockResolvedValue(r);
      await expect(requireCoursesSalesSettingsContext()).resolves.toBeDefined();
    }
  });
  it("deja afuera a Equipo", async () => {
    H.role.mockResolvedValue("STAFF");
    await expect(requireCoursesSalesSettingsContext()).rejects.toThrow("REDIRECT:/dashboard");
  });
  it("deja afuera al Colaborador", async () => {
    H.role.mockResolvedValue("COLLABORATOR");
    await expect(requireCoursesSalesSettingsContext()).rejects.toThrow("REDIRECT:/dashboard");
  });
});
