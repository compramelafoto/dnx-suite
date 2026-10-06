import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveModuleAction } from "@/lib/permissions/levels";

const { redirectMock, requireActiveWorkspaceMock, levelMock, actionMock, memberFindFirst, projectFindFirst } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((destino: string) => {
      throw new Error(`REDIRECT:${destino}`);
    }),
    requireActiveWorkspaceMock: vi.fn(),
    levelMock: vi.fn(),
    actionMock: vi.fn(),
    memberFindFirst: vi.fn(),
    projectFindFirst: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: requireActiveWorkspaceMock }));
vi.mock("@/lib/permissions/module-access", () => ({
  getModuleLevel: levelMock,
  hasModuleAction: actionMock,
}));
vi.mock("@repo/db", () => ({
  prisma: {
    member: { findFirst: memberFindFirst },
    govProject: { findFirst: projectFindFirst },
  },
}));

const {
  canEditProject,
  requireGovernanceViewer,
  requireGovernanceCoordinator,
  requireProjectEditor,
} = await import("./access");

const ws = { id: "ws-1", name: "SFPR" };
const NO_EDITA = "Ese proyecto lo edita su responsable o quien coordina los proyectos.";

beforeEach(() => {
  redirectMock.mockClear();
  requireActiveWorkspaceMock.mockReset().mockResolvedValue({ user: { id: 7 }, workspace: ws });
  levelMock.mockReset().mockResolvedValue("MANAGE");
  actionMock.mockReset().mockResolvedValue(false);
  memberFindFirst.mockReset().mockResolvedValue({ id: "m-7" });
  projectFindFirst.mockReset().mockResolvedValue({
    id: "p-1",
    status: "PROPOSED",
    title: "Muestra anual",
    responsibleMemberId: "m-otro",
    createdByUserId: 99,
  });
});

/** El contexto mínimo que mira `canEditProject`. */
const ctx = (over: Partial<{ canManage: boolean; canCoordinate: boolean; viewerMemberId: string | null; userId: number }> = {}) => ({
  canManage: over.canManage ?? true,
  canCoordinate: over.canCoordinate ?? false,
  viewerMemberId: over.viewerMemberId === undefined ? "m-7" : over.viewerMemberId,
  user: { id: over.userId ?? 7 },
});
const proyecto = (responsibleMemberId: string | null, createdByUserId: number | null) => ({
  responsibleMemberId,
  createdByUserId,
});

describe("canEditProject (regla pura)", () => {
  it("quien gestiona pero no coordina, ni es responsable ni lo creó, no edita", () => {
    expect(canEditProject(ctx(), proyecto("m-otro", 99))).toBe(false);
  });
  it("el responsable general del proyecto lo edita", () => {
    expect(canEditProject(ctx(), proyecto("m-7", 99))).toBe(true);
  });
  it("quien lo creó lo edita", () => {
    expect(canEditProject(ctx(), proyecto("m-otro", 7))).toBe(true);
  });
  it("quien coordina edita cualquier proyecto", () => {
    expect(canEditProject(ctx({ canCoordinate: true }), proyecto(null, null))).toBe(true);
  });
  it("sin ficha de socio, un proyecto sin responsable no lo vuelve responsable", () => {
    expect(canEditProject(ctx({ viewerMemberId: null }), proyecto(null, 99))).toBe(false);
  });
  it("un proyecto sin creador (propuesta de socio) no lo edita cualquiera", () => {
    expect(canEditProject(ctx(), proyecto("m-otro", null))).toBe(false);
  });
  it("sin gestionar no edita nada, aunque sea responsable o creador", () => {
    expect(canEditProject(ctx({ canManage: false }), proyecto("m-7", 7))).toBe(false);
  });
});

describe("el contexto de Gobierno", () => {
  it("pregunta la acción governance.coordinate de ESTA persona en ESTE workspace", async () => {
    await requireGovernanceViewer();
    expect(actionMock).toHaveBeenCalledWith(7, "ws-1", "governance", "governance.coordinate");
  });
  it("con MANAGE y la acción coordina", async () => {
    actionMock.mockResolvedValue(true);
    await expect(requireGovernanceViewer()).resolves.toMatchObject({ canManage: true, canCoordinate: true });
  });
  it("con VIEW no coordina aunque la acción figure", async () => {
    levelMock.mockResolvedValue("VIEW");
    actionMock.mockResolvedValue(true);
    await expect(requireGovernanceViewer()).resolves.toMatchObject({ canManage: false, canCoordinate: false });
  });
  it("dueño y admin tienen governance.coordinate siempre (resolveModuleAction)", () => {
    for (const workspaceRole of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]) {
      expect(
        resolveModuleAction({
          moduleKey: "governance",
          action: "governance.coordinate",
          moduleEnabled: true,
          workspaceRole,
          assignments: [],
          now: new Date(),
        }),
      ).toBe(true);
    }
  });
});

describe("requireGovernanceCoordinator", () => {
  it("sin la acción, vuelve a la lista con el motivo", async () => {
    await expect(requireGovernanceCoordinator()).rejects.toThrow(/^REDIRECT:\/gobierno\?error=/);
  });
  it("con la acción, pasa", async () => {
    actionMock.mockResolvedValue(true);
    await expect(requireGovernanceCoordinator()).resolves.toMatchObject({ canCoordinate: true });
  });
  it("con VIEW, ni siquiera llega a preguntar la acción: afuera", async () => {
    levelMock.mockResolvedValue("VIEW");
    actionMock.mockResolvedValue(true);
    await expect(requireGovernanceCoordinator()).rejects.toThrow(/^REDIRECT:\/gobierno\?error=/);
  });
});

describe("requireProjectEditor", () => {
  it("busca el proyecto dentro del workspace", async () => {
    actionMock.mockResolvedValue(true);
    await requireProjectEditor("p-1");
    expect(projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-1", workspaceId: "ws-1" } }),
    );
  });
  it("si el proyecto no existe (o es de otra institución), vuelve a la lista", async () => {
    projectFindFirst.mockResolvedValue(null);
    actionMock.mockResolvedValue(true);
    await expect(requireProjectEditor("p-x")).rejects.toThrow(
      "REDIRECT:/gobierno?error=" + encodeURIComponent("Ese proyecto no existe."),
    );
  });
  it("quien gestiona sin ser responsable, creador ni coordinador vuelve al proyecto con el motivo", async () => {
    await expect(requireProjectEditor("p-1")).rejects.toThrow(
      "REDIRECT:/gobierno/p-1?error=" + encodeURIComponent(NO_EDITA),
    );
  });
  it("el responsable pasa y recibe el proyecto", async () => {
    projectFindFirst.mockResolvedValue({ id: "p-1", status: "PROPOSED", title: "x", responsibleMemberId: "m-7", createdByUserId: 99 });
    await expect(requireProjectEditor("p-1")).resolves.toMatchObject({ project: { id: "p-1", status: "PROPOSED" } });
  });
  it("con VIEW, ni responsable ni creador: afuera antes de buscar", async () => {
    levelMock.mockResolvedValue("VIEW");
    await expect(requireProjectEditor("p-1")).rejects.toThrow(/^REDIRECT:\/gobierno\?error=/);
    expect(projectFindFirst).not.toHaveBeenCalled();
  });
});
