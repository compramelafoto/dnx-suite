import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  rol: vi.fn<(userId?: number, workspaceId?: string) => Promise<string | null>>(),
  modulo: vi.fn<() => Promise<boolean>>(),
  misTareas: vi.fn(),
  niveles: null as Record<string, string> | null,
}));

vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: vi.fn() }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: M.rol }));
// El acceso se resuelve con el modelo de main: niveles de un rol sin roles de la comisión.
vi.mock("@/lib/access/acceso", async () => {
  const { nivelesPorRol } = await import("@/lib/access/niveles-de-prueba");
  return {
    resolverAcceso: async (userId: number, workspaceId: string) => {
      const role = (await M.rol(userId, workspaceId)) as string | null;
      return { role, levels: { ...nivelesPorRol(role), ...(M.niveles ?? {}) } };
    },
  };
});
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: M.modulo }));
vi.mock("./tareas", () => ({ misTareas: M.misTareas }));

const { misTareasDelInicio } = await import("./inicio");

const USUARIO = { id: 7, name: "Ana Gómez", email: "ana@example.com" };
const AHORA = new Date("2026-10-15T13:00:00.000Z");
const tarea = (id: string, vence: string) => ({
  id, titulo: "Llamar", vence: new Date(vence), obligatoria: false, etapa: "Nueva",
  sujeto: { titulo: "Laura", href: "/consultas/l1" },
});

beforeEach(() => {
  M.niveles = null;
  M.rol.mockResolvedValue("STAFF");
  M.modulo.mockResolvedValue(true);
  M.misTareas.mockResolvedValue({ vencidas: [], hoy: [], proximas: [] });
});
afterEach(() => vi.clearAllMocks());

describe("misTareasDelInicio", () => {
  it("sin `operar` no se muestra y no se lee nada", async () => {
    M.rol.mockResolvedValue("COLLABORATOR");
    expect(await misTareasDelInicio(USUARIO, "ws-1", AHORA)).toBeNull();
    M.rol.mockResolvedValue(null);
    expect(await misTareasDelInicio(USUARIO, "ws-1", AHORA)).toBeNull();
    expect(M.misTareas).not.toHaveBeenCalled();
  });

  it("con el módulo de Captación apagado no se muestra", async () => {
    M.modulo.mockResolvedValue(false);
    expect(await misTareasDelInicio(USUARIO, "ws-1", AHORA)).toBeNull();
    expect(M.modulo).toHaveBeenCalledWith("ws-1", "service-leads");
    expect(M.misTareas).not.toHaveBeenCalled();
  });

  it("sin tareas no hay bloque", async () => {
    expect(await misTareasDelInicio(USUARIO, "ws-1", AHORA)).toBeNull();
  });

  it("pide las tareas de quien opera en el workspace activo y devuelve fechas ISO", async () => {
    M.misTareas.mockResolvedValue({ vencidas: [tarea("a", "2026-10-14T02:59:59.999Z")], hoy: [], proximas: [tarea("b", "2026-10-18T02:59:59.999Z")] });
    const r = await misTareasDelInicio(USUARIO, "ws-1", AHORA);
    expect(M.misTareas).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws-1", userId: 7, role: "STAFF" }), AHORA, ["CAPTACION"]);
    expect(r!.vencidas[0]!.vence).toBe("2026-10-14T02:59:59.999Z");
    expect(r!.proximas.map((t) => t.id)).toEqual(["b"]);
  });

  it("sólo con Gestionar en Proyectos (y el módulo) se muestra, con las tareas de proyectos", async () => {
    // Un rol con Gestionar en Proyectos pero sin Consultas.
    M.rol.mockResolvedValue("ALGUIEN");
    M.niveles = { "service-leads": "NONE", projects: "MANAGE" };
    M.misTareas.mockResolvedValue({ vencidas: [tarea("p", "2026-10-14T02:59:59.999Z")], hoy: [], proximas: [] });
    const r = await misTareasDelInicio(USUARIO, "ws-1", AHORA);
    expect(r!.vencidas.map((t) => t.id)).toEqual(["p"]);
    expect(M.misTareas).toHaveBeenCalledWith(expect.anything(), AHORA, ["PROYECTO"]);
    expect(M.modulo).toHaveBeenCalledWith("ws-1", "projects");
    expect(M.modulo).not.toHaveBeenCalledWith("ws-1", "service-leads");
  });

  it("con los dos permisos pide las tareas de los dos tipos; con un módulo apagado, sólo las del otro", async () => {
    M.niveles = { "service-leads": "MANAGE", projects: "MANAGE" };
    M.misTareas.mockResolvedValue({ vencidas: [tarea("a", "2026-10-14T02:59:59.999Z")], hoy: [], proximas: [] });
    await misTareasDelInicio(USUARIO, "ws-1", AHORA);
    expect(M.misTareas).toHaveBeenLastCalledWith(expect.anything(), AHORA, ["CAPTACION", "PROYECTO"]);
    M.modulo.mockImplementation(async (_ws?: unknown, clave?: unknown) => clave !== "projects");
    await misTareasDelInicio(USUARIO, "ws-1", AHORA);
    expect(M.misTareas).toHaveBeenLastCalledWith(expect.anything(), AHORA, ["CAPTACION"]);
  });

  it("con Ver en Proyectos (sin Gestionar) y sin Consultas no se muestra el bloque", async () => {
    M.rol.mockResolvedValue("ALGUIEN");
    M.niveles = { "service-leads": "NONE", projects: "VIEW" };
    expect(await misTareasDelInicio(USUARIO, "ws-1", AHORA)).toBeNull();
    expect(M.misTareas).not.toHaveBeenCalled();
  });

  it("un error no rompe el inicio y se registra sin datos personales", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    M.misTareas.mockRejectedValue(Object.assign(new Error("fallo con ana@example.com"), { code: "P1001" }));
    expect(await misTareasDelInicio(USUARIO, "ws-1", AHORA)).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    const registrado = JSON.stringify(log.mock.calls[0]);
    expect(registrado).toContain("P1001");
    expect(registrado).not.toContain("ana@example.com");
    expect(registrado).not.toContain("Ana");
    log.mockRestore();
  });
});
