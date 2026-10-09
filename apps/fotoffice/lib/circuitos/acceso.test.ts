import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ usuario: vi.fn(), workspace: vi.fn(), acceso: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getAuthUser: H.usuario }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.workspace }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: H.acceso }));

const { contextoDeCircuitos } = await import("./acceso");

const niveles = (l: Record<string, "NONE" | "VIEW" | "MANAGE">) => ({ role: "STAFF", levels: l });

beforeEach(() => {
  vi.clearAllMocks();
  H.usuario.mockResolvedValue({ id: 7, name: "Ana", email: "ana@example.com" });
  H.workspace.mockResolvedValue({ id: "ws-1" });
});

describe("contextoDeCircuitos", () => {
  it("quien gestiona sólo Proyectos entra al motor (puede mover etapas de un proyecto)", async () => {
    H.acceso.mockResolvedValue(niveles({ projects: "MANAGE", "service-leads": "NONE" }));
    expect(await contextoDeCircuitos()).toMatchObject({ workspaceId: "ws-1", userId: 7 });
  });

  it("quien gestiona sólo Consultas sigue entrando", async () => {
    H.acceso.mockResolvedValue(niveles({ projects: "NONE", "service-leads": "MANAGE" }));
    expect(await contextoDeCircuitos()).toMatchObject({ workspaceId: "ws-1", userId: 7 });
  });

  it("con sólo \"Ver\" en ambos, o sin sesión o workspace, no entra", async () => {
    H.acceso.mockResolvedValue(niveles({ projects: "VIEW", "service-leads": "VIEW" }));
    expect(await contextoDeCircuitos()).toBeNull();
    H.acceso.mockResolvedValue(niveles({ projects: "MANAGE" }));
    H.usuario.mockResolvedValue(null);
    expect(await contextoDeCircuitos()).toBeNull();
    H.usuario.mockResolvedValue({ id: 7 });
    H.workspace.mockResolvedValue(null);
    expect(await contextoDeCircuitos()).toBeNull();
  });
});
