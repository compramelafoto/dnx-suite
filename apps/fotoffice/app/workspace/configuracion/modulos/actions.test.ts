import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  wsFindUnique: vi.fn(),
  upsert: vi.fn(),
  enabled: vi.fn(),
  getType: vi.fn(),
  setType: vi.fn(),
  record: vi.fn(),
  send: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: m.findUnique },
    workspace: { findUnique: m.wsFindUnique },
    workspaceFeatureModule: { upsert: m.upsert },
  },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(async () => ({ id: 1, email: "owner@x.test", name: "Owner" })),
}));
vi.mock("@/lib/entrada/require-own-workspace", () => ({
  requireOwnWorkspace: vi.fn(async () => ({ workspaceId: "ws1", created: false, onboardingCompleted: true })),
}));
vi.mock("@repo/db/fotoffice-team", () => ({ recordAdminEvent: m.record }));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: m.enabled }));
vi.mock("@/lib/workspace-type", () => ({ getOrganizationType: m.getType, setOrganizationType: m.setType }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: m.send }));
vi.mock("@/lib/modules/registry", async (orig) => {
  const real = await orig<typeof import("@/lib/modules/registry")>();
  const ficticio = {
    key: "fake-dep",
    label: "Ficticio",
    description: "x",
    category: "GENERAL",
    order: 999,
    status: "AVAILABLE",
    family: "base",
    dependsOn: ["clients"],
  } as (typeof real.MODULE_REGISTRY)[number];
  const registro = [...real.MODULE_REGISTRY, ficticio];
  return {
    ...real,
    MODULE_REGISTRY: registro,
    getModuleDefinition: (k: string) => registro.find((x) => x.key === k),
  };
});

const { toggleModuleAction, requestModuleAction, chooseOrganizationTypeAction } = await import("./actions");
const { paqueteSugerido } = await import("@/lib/modules/suggested");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const rol = (r: string) => m.findUnique.mockResolvedValue({ role: r });
const encendidos = (...k: string[]) => m.enabled.mockResolvedValue(new Set(k));

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  rol("WORKSPACE_OWNER");
  encendidos();
  m.wsFindUnique.mockResolvedValue({ name: "Mi Sociedad" });
  m.send.mockResolvedValue({ status: "SENT", providerId: "p" });
  delete process.env.FOTOFFICE_PLATFORM_ADMIN_EMAILS;
});

describe("toggleModuleAction", () => {
  it("el equipo no puede cambiar módulos", async () => {
    rol("STAFF");
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "clients", enabled: "true" }));
    expect(r).toEqual({ error: "No tenés permiso para cambiar los módulos." });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("un módulo con comisión no se enciende desde acá", async () => {
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "membership-dues", enabled: "true" }));
    expect(r).toEqual({ error: "Este módulo cobra una comisión: pedí la activación." });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("si depende de uno con comisión que falta, pide activarlo", async () => {
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "evaluaciones", enabled: "true" }));
    expect(r.error).toBe("Primero hay que activar Cursos presenciales, que cobra comisión: pedí la activación.");
    const c = await toggleModuleAction(undefined, fd({ moduleKey: "evaluaciones", enabled: "true", confirmado: "1" }));
    expect(c.error).toMatch(/Primero hay que activar/);
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("enciende un módulo sin dependencias y registra el evento", async () => {
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "clients", enabled: "true" }));
    expect(r.error).toBeNull();
    expect(m.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_moduleKey: { workspaceId: "ws1", moduleKey: "clients" } },
        update: { enabled: true },
      }),
    );
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws1", actorUserId: 1, kind: "MODULE_ON", moduleKey: "clients" }),
    );
  });

  it("pide confirmar si faltan dependencias sin comisión", async () => {
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "fake-dep", enabled: "true" }));
    expect(r).toEqual({ error: null, confirmar: { tipo: "ENCENDER", faltan: ["clients"] } });
    expect(m.upsert).not.toHaveBeenCalled();
    await toggleModuleAction(undefined, fd({ moduleKey: "fake-dep", enabled: "true", confirmado: "1" }));
    expect(m.upsert).toHaveBeenCalledTimes(2);
  });

  it("no apaga un módulo del que depende uno con comisión", async () => {
    encendidos("members", "membership-dues");
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "members", enabled: "false" }));
    expect(r).toEqual({
      error: "No se puede apagar: Cuotas societarias depende de este módulo y lo gestiona FOTOFFICE.",
    });
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("un módulo con comisión no se apaga desde acá", async () => {
    encendidos("courses-sales");
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "courses-sales", enabled: "false" }));
    expect(r).toEqual({ error: "Este módulo lo gestiona FOTOFFICE: pedí la desactivación." });
  });

  it("apaga directo si nadie depende de él", async () => {
    encendidos("members", "raffles");
    const r = await toggleModuleAction(undefined, fd({ moduleKey: "raffles", enabled: "false" }));
    expect(r.error).toBeNull();
    expect(m.upsert).toHaveBeenCalledTimes(1);
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "MODULE_OFF", moduleKey: "raffles" }));
  });

  it("apagar con dependientes sin comisión pide confirmar y apaga todos", async () => {
    encendidos("clients", "fake-dep");
    const sin = await toggleModuleAction(undefined, fd({ moduleKey: "clients", enabled: "false" }));
    expect(sin).toEqual({ error: null, confirmar: { tipo: "APAGAR", afectados: ["fake-dep"] } });
    expect(m.upsert).not.toHaveBeenCalled();
    await toggleModuleAction(undefined, fd({ moduleKey: "clients", enabled: "false", confirmado: "1" }));
    expect(m.upsert).toHaveBeenCalledTimes(2);
    const offs = m.record.mock.calls.filter(([e]) => e.kind === "MODULE_OFF").map(([e]) => e.moduleKey);
    expect(offs).toEqual(["clients", "fake-dep"]);
  });

  it("rechaza claves inexistentes o planificadas", async () => {
    for (const k of ["nada", "governance"]) {
      const r = await toggleModuleAction(undefined, fd({ moduleKey: k, enabled: "true" }));
      expect(r).toEqual({ error: "Ese módulo no existe o todavía no está disponible." });
    }
  });
});

describe("requestModuleAction", () => {
  it("avisa a cada administrador de plataforma y registra el pedido", async () => {
    process.env.FOTOFFICE_PLATFORM_ADMIN_EMAILS = "a@x.test, b@x.test";
    const r = await requestModuleAction(undefined, fd({ moduleKey: "membership-dues" }));
    expect(r).toEqual({ error: null, ok: "Listo, te avisamos cuando esté activo." });
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(m.send.mock.calls.map(([a]) => a.to)).toEqual(["a@x.test", "b@x.test"]);
    expect(m.send.mock.calls[0][0].body.subject).toBe(
      "FOTOFFICE: Mi Sociedad pide activar Cuotas societarias",
    );
    expect(m.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "MODULE_REQUESTED", moduleKey: "membership-dues" }));
  });

  it("sin destinatarios igual registra el pedido", async () => {
    const r = await requestModuleAction(undefined, fd({ moduleKey: "membership-dues" }));
    expect(r.ok).toBe("Listo, te avisamos cuando esté activo.");
    expect(m.send).not.toHaveBeenCalled();
    expect(m.record).toHaveBeenCalled();
  });
});

describe("chooseOrganizationTypeAction", () => {
  it("elige el tipo y enciende el paquete sin apagar nada", async () => {
    const paquete = paqueteSugerido("estudio");
    encendidos(paquete[0]);
    const r = await chooseOrganizationTypeAction(undefined, fd({ tipo: "estudio", aplicarPaquete: "1" }));
    expect(r.error).toBeNull();
    expect(m.setType).toHaveBeenCalledWith("ws1", "estudio", 1);
    const nuevos = paquete.slice(1);
    expect(m.upsert).toHaveBeenCalledTimes(nuevos.length);
    expect(m.record.mock.calls.filter(([e]) => e.kind === "MODULE_ON").map(([e]) => e.moduleKey)).toEqual(nuevos);
  });

  it("devuelve el mensaje si el tipo no se puede guardar", async () => {
    m.setType.mockRejectedValue(new Error("Completá primero los datos de la institución."));
    const r = await chooseOrganizationTypeAction(undefined, fd({ tipo: "estudio" }));
    expect(r).toEqual({ error: "Completá primero los datos de la institución." });
    expect(m.upsert).not.toHaveBeenCalled();
  });
});
