import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ role: vi.fn(), upsert: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock("@repo/db", () => ({
  prisma: { coverageSettings: { upsert: H.upsert }, workspaceCoverageSettings: { upsert: H.upsert } },
}));
vi.mock("@/lib/workspace", () => ({
  requireActiveWorkspace: async () => ({ user: { id: 7 }, workspace: { id: "ws-1" } }),
}));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async () => true }));

const { saveCoverageSettingsAction } = await import("./actions");

beforeEach(() => {
  H.role.mockReset();
  H.upsert.mockReset().mockResolvedValue({});
});

describe("saveCoverageSettingsAction", () => {
  it("Equipo no puede guardar la configuración (0.1: configurar es de Dueño/Admin)", async () => {
    H.role.mockResolvedValue("STAFF");
    await expect(saveCoverageSettingsAction(undefined, new FormData())).rejects.toThrow(
      "REDIRECT:/coberturas?forbidden=configurar",
    );
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("un Colaborador tampoco", async () => {
    H.role.mockResolvedValue("COLLABORATOR");
    await expect(saveCoverageSettingsAction(undefined, new FormData())).rejects.toThrow("REDIRECT:");
  });

  it("el Dueño pasa la guarda", async () => {
    H.role.mockResolvedValue("WORKSPACE_OWNER");
    await expect(saveCoverageSettingsAction(undefined, new FormData())).resolves.not.toThrow();
  });
});
