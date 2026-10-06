import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  requireActiveWorkspace: vi.fn(),
  resolveWorkspaceRole: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
  deleteIntegration: vi.fn(),
  revokeIntegrationToken: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidatePath }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: H.requireActiveWorkspace }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.resolveWorkspaceRole }));
vi.mock("@/lib/workspace-settings-access", () => ({
  canManageWorkspaceSettings: H.canManageWorkspaceSettings,
}));
vi.mock("@/lib/integrations/store", () => ({ deleteIntegration: H.deleteIntegration }));
vi.mock("@/lib/integrations/google-oauth", () => ({ revokeIntegrationToken: H.revokeIntegrationToken }));

const { disconnectIntegrationAction } = await import("./actions");

function form(integrationKey: string): FormData {
  const f = new FormData();
  f.set("integrationKey", integrationKey);
  return f;
}

async function redireccion(p: Promise<unknown>): Promise<string> {
  const e = (await p.catch((x) => x)) as Error;
  return e.message.replace("REDIRECT:", "");
}

describe("desconectar desde la pantalla de Google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.requireActiveWorkspace.mockResolvedValue({ user: { id: 1 }, workspace: { id: "ws-1" } });
    H.resolveWorkspaceRole.mockResolvedValue("OWNER");
    H.canManageWorkspaceSettings.mockReturnValue(true);
    H.deleteIntegration.mockResolvedValue("refresh-token");
    H.revokeIntegrationToken.mockResolvedValue(undefined);
  });

  it.each(["andreani", "correo-argentino", "inventada"])(
    "%s no es de Google: no se borra ni se revoca nada",
    async (key) => {
      expect(await redireccion(disconnectIntegrationAction(form(key)))).toBe(
        "/workspace/configuracion/integraciones?error=integracion_desconocida",
      );
      expect(H.deleteIntegration).not.toHaveBeenCalled();
      expect(H.revokeIntegrationToken).not.toHaveBeenCalled();
    },
  );

  it("una cuenta de Google se borra y se revoca", async () => {
    expect(await redireccion(disconnectIntegrationAction(form("google-calendar")))).toBe(
      "/workspace/configuracion/integraciones?ok=desconectado",
    );
    expect(H.deleteIntegration).toHaveBeenCalledWith("ws-1", "google-calendar");
    expect(H.revokeIntegrationToken).toHaveBeenCalledWith("refresh-token");
  });
});
