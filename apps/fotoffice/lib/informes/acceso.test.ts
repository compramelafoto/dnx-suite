import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuthUser: vi.fn(),
  resolveActiveWorkspace: vi.fn(),
  isModuleEnabledForWorkspace: vi.fn(),
  resolverAcceso: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: M.redirect }));
vi.mock("@/lib/auth", () => ({ requireAuth: M.requireAuth, getAuthUser: M.getAuthUser }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: M.resolveActiveWorkspace }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: M.isModuleEnabledForWorkspace }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: M.resolverAcceso }));

const { requireInformes, requireInformesConfigurar, contextoDeInformes, puedeVerInformes, puedeConfigurarInformes } = await import("./acceso");

const user = { id: 7, name: "Ana", email: "ana@x.com" };
function como(role: string | null, levels: Record<string, string> = {}, opciones: { modulo?: boolean; workspace?: boolean } = {}) {
  M.requireAuth.mockResolvedValue(user);
  M.getAuthUser.mockResolvedValue(user);
  M.resolveActiveWorkspace.mockResolvedValue(opciones.workspace === false ? null : { id: "w1" });
  M.isModuleEnabledForWorkspace.mockResolvedValue(opciones.modulo !== false);
  M.resolverAcceso.mockResolvedValue({ role, levels });
}
const redirige = async (f: () => Promise<unknown>) => (await f().then(() => "no", (e: Error) => e.message));

beforeEach(() => vi.clearAllMocks());

describe("requireInformes", () => {
  it("dueño y administrador pasan", async () => {
    como("WORKSPACE_OWNER");
    expect((await requireInformes()).ctx.workspaceId).toBe("w1");
    como("WORKSPACE_ADMIN");
    expect((await requireInformes()).ctx.role).toBe("WORKSPACE_ADMIN");
    expect(M.isModuleEnabledForWorkspace).toHaveBeenCalledWith("w1", "reports");
  });
  it("personal con nivel Ver en Informes o en Caja pasa; solo Cuotas no", async () => {
    como("STAFF", { reports: "VIEW" });
    expect((await requireInformes()).ctx.userId).toBe(7);
    como("STAFF", { cash: "VIEW" });
    expect((await requireInformes()).ctx.userId).toBe(7);
    como("STAFF", { "membership-dues": "VIEW" });
    expect(await redirige(requireInformes)).toBe("REDIRECT:/dashboard");
  });
  it("sin nivel en Informes, redirige", async () => {
    como("STAFF", {});
    expect(await redirige(requireInformes)).toBe("REDIRECT:/dashboard");
    como("COLLABORATOR", {});
    expect(await redirige(requireInformes)).toBe("REDIRECT:/dashboard");
  });
  it("módulo apagado y sin workspace redirigen", async () => {
    como("WORKSPACE_OWNER", {}, { modulo: false });
    expect(await redirige(requireInformes)).toBe("REDIRECT:/dashboard?module=off");
    como("WORKSPACE_OWNER", {}, { workspace: false });
    expect(await redirige(requireInformes)).toBe("REDIRECT:/workspace");
  });
});

describe("requireInformesConfigurar", () => {
  it("exige además configurar", async () => {
    como("WORKSPACE_ADMIN");
    expect((await requireInformesConfigurar()).ctx.workspaceId).toBe("w1");
    como("STAFF", { reports: "MANAGE" });
    expect(await redirige(requireInformesConfigurar)).toBe("REDIRECT:/informes");
  });
});

describe("contextoDeInformes", () => {
  it("devuelve null ante cualquier falta", async () => {
    como("WORKSPACE_OWNER");
    M.getAuthUser.mockResolvedValue(null);
    expect(await contextoDeInformes()).toBeNull();
    como("WORKSPACE_OWNER", {}, { modulo: false });
    expect(await contextoDeInformes()).toBeNull();
    como("STAFF", {});
    expect(await contextoDeInformes()).toBeNull();
    como("STAFF", { reports: "VIEW" });
    expect(await contextoDeInformes("configurar")).toBeNull();
    expect(await contextoDeInformes("ver")).not.toBeNull();
    como("WORKSPACE_OWNER");
    expect((await contextoDeInformes("configurar"))!.workspaceId).toBe("w1");
  });
});

describe("permisos puros", () => {
  it("ver y configurar", () => {
    const owner = { role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: {} as never } };
    const staff = { role: "STAFF", acceso: { role: "STAFF", levels: { reports: "VIEW" } as never } };
    expect(puedeVerInformes(owner)).toBe(true);
    expect(puedeConfigurarInformes(owner)).toBe(true);
    expect(puedeVerInformes(staff)).toBe(true);
    expect(puedeConfigurarInformes(staff)).toBe(false);
  });
});
