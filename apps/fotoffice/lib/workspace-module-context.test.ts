import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Las puertas de Cursos, Evaluaciones, Captación y Sitio web: módulo encendido + nivel.
 *
 * Se prueba `lib/workspace.ts` de verdad (no un mock): lo que se simula es lo de abajo —sesión,
 * base, encendido y nivel—, para que el orden de las comprobaciones quede cubierto.
 */

const H = vi.hoisted(() => ({
  redirect: vi.fn((d: string) => {
    throw new Error(`REDIRECT:${d}`);
  }),
  requireAuth: vi.fn(),
  memberships: vi.fn(),
  enabled: vi.fn(),
  hasLevel: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findMany: H.memberships },
    membership: { findMany: vi.fn().mockResolvedValue([]) },
    fotofficeWorkspaceBranding: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("./auth", () => ({ requireAuth: H.requireAuth }));
vi.mock("./modules/gating", () => ({ isModuleEnabledForWorkspace: H.enabled }));
vi.mock("./permissions/module-access", () => ({ hasModuleLevel: H.hasLevel }));

const {
  requireCoursesSalesContext,
  requireEvaluacionesContext,
  requireServiceLeadsContext,
  requireWebsiteContext,
} = await import("./workspace");

const NIVELES = { NONE: 0, VIEW: 1, MANAGE: 2 } as const;
function conNivel(actual: keyof typeof NIVELES) {
  H.hasLevel.mockImplementation(
    async (_u: number, _w: string, _m: string, required: "VIEW" | "MANAGE") =>
      NIVELES[actual] >= NIVELES[required],
  );
}

beforeEach(() => {
  H.redirect.mockClear();
  H.requireAuth.mockReset().mockResolvedValue({ id: 7 });
  H.memberships
    .mockReset()
    .mockResolvedValue([{ workspaceId: "ws-1", workspace: { id: "ws-1", name: "SFPR" } }]);
  H.enabled.mockReset().mockResolvedValue(true);
  H.hasLevel.mockReset();
  conNivel("MANAGE");
});

describe("requireCoursesSalesContext", () => {
  it("por omisión pide VIEW, de ESTA persona en ESTE workspace", async () => {
    await expect(requireCoursesSalesContext()).resolves.toMatchObject({ workspace: { id: "ws-1" } });
    expect(H.hasLevel).toHaveBeenCalledWith(7, "ws-1", "courses-sales", "VIEW");
  });

  it("con VIEW entra a las páginas pero no pasa la puerta de una acción", async () => {
    conNivel("VIEW");
    await expect(requireCoursesSalesContext()).resolves.toBeTruthy();
    await expect(requireCoursesSalesContext("MANAGE")).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("con MANAGE pasa las dos", async () => {
    await expect(requireCoursesSalesContext("MANAGE")).resolves.toBeTruthy();
    expect(H.hasLevel).toHaveBeenCalledWith(7, "ws-1", "courses-sales", "MANAGE");
  });

  it("sin nivel, al tablero", async () => {
    conNivel("NONE");
    await expect(requireCoursesSalesContext()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("módulo apagado: el aviso de siempre, antes de preguntar el nivel", async () => {
    H.enabled.mockResolvedValue(false);
    await expect(requireCoursesSalesContext("MANAGE")).rejects.toThrow(
      "REDIRECT:/dashboard?courses=off",
    );
    expect(H.hasLevel).not.toHaveBeenCalled();
  });

  it("sin workspace, al tablero", async () => {
    H.memberships.mockResolvedValue([]);
    await expect(requireCoursesSalesContext()).rejects.toThrow("REDIRECT:/dashboard");
  });
});

describe("requireEvaluacionesContext", () => {
  it("VIEW para ver, MANAGE para actuar", async () => {
    conNivel("VIEW");
    await expect(requireEvaluacionesContext()).resolves.toBeTruthy();
    expect(H.hasLevel).toHaveBeenCalledWith(7, "ws-1", "evaluaciones", "VIEW");
    await expect(requireEvaluacionesContext("MANAGE")).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("módulo apagado: su aviso de siempre", async () => {
    H.enabled.mockResolvedValue(false);
    await expect(requireEvaluacionesContext()).rejects.toThrow(
      "REDIRECT:/dashboard?evaluaciones=off",
    );
  });
});

describe("requireServiceLeadsContext (Captación)", () => {
  it("módulo apagado: afuera, aunque sea el dueño", async () => {
    H.enabled.mockResolvedValue(false);
    await expect(requireServiceLeadsContext()).rejects.toThrow("REDIRECT:/dashboard?module=off");
    expect(H.enabled).toHaveBeenCalledWith("ws-1", "service-leads");
  });

  it("VIEW ve la bandeja pero no toca formularios", async () => {
    conNivel("VIEW");
    await expect(requireServiceLeadsContext()).resolves.toBeTruthy();
    await expect(requireServiceLeadsContext("MANAGE")).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("sin nivel, al tablero", async () => {
    conNivel("NONE");
    await expect(requireServiceLeadsContext()).rejects.toThrow("REDIRECT:/dashboard");
  });
});

describe("requireWebsiteContext (sin cambios de la tarea 4)", () => {
  it("sigue pidiendo website VIEW", async () => {
    conNivel("VIEW");
    await expect(requireWebsiteContext()).resolves.toBeTruthy();
    expect(H.hasLevel).toHaveBeenCalledWith(7, "ws-1", "website", "VIEW");
  });

  it("apagado sigue yendo a su aviso", async () => {
    H.enabled.mockResolvedValue(false);
    await expect(requireWebsiteContext()).rejects.toThrow("REDIRECT:/dashboard?website=off");
  });
});
