import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quién edita un proyecto (acción `governance.coordinate`).
 *
 * Todo el que gestiona Gobierno crea proyectos, agrega y reparte tareas, anota y sube archivos.
 * Editar UN proyecto —sus datos, su estado, sus etapas, quitar tareas, la visibilidad de sus
 * archivos— queda para su responsable, quien lo creó o quien coordina. Los tipos de proyecto, sólo
 * quien coordina. Dueño y admin tienen la acción siempre (lo prueba `lib/governance/access.test.ts`
 * con `resolveModuleAction`); acá se simulan como "tiene la acción".
 */

const h = vi.hoisted(() => {
  const redirect = vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  });
  const db = {
    member: { findFirst: vi.fn() },
    govProject: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    govProjectStage: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    govProjectTask: { findFirst: vi.fn(), create: vi.fn(), createMany: vi.fn(), aggregate: vi.fn(), update: vi.fn(), delete: vi.fn() },
    govAttachment: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    govReservation: { create: vi.fn() },
    govProjectType: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), aggregate: vi.fn(), updateMany: vi.fn() },
    govProjectTypeStage: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    redirect,
    db,
    requireActiveWorkspace: vi.fn(),
    level: vi.fn(),
    action: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: h.requireActiveWorkspace }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevel: h.level, hasModuleAction: h.action }));
vi.mock("@repo/db", () => ({ prisma: h.db }));
vi.mock("@/lib/governance/events", () => ({ recordProjectEvent: vi.fn() }));
vi.mock("@/lib/governance/repository", () => ({
  memberBelongs: vi.fn(async (_ws: string, id: string) => ({ id, name: "Ana Pérez" })),
}));
vi.mock("@/lib/governance/files", () => ({ verifyGovernanceUpload: vi.fn() }));
vi.mock("@/lib/governance/money-server", () => ({ remainingOfProject: vi.fn(async () => 0) }));
vi.mock("@/lib/governance/seed", () => ({ stagesCreateInput: vi.fn(() => []) }));

const acciones = await import("./actions");

const YO_USUARIO = 7;
const YO_SOCIO = "m-7";
const NO_EDITA = encodeURIComponent("Ese proyecto lo edita su responsable o quien coordina los proyectos.");

type Quien = "gestiona" | "responsable" | "creador" | "coordina";

/** El proyecto, según quién mira: responsable, creador o ninguno de los dos. */
function proyectoPara(quien: Quien) {
  return {
    id: "p-1",
    workspaceId: "ws-1",
    status: "PROPOSED",
    title: "Muestra anual",
    description: null,
    responsibleMemberId: quien === "responsable" ? YO_SOCIO : "m-otro",
    createdByUserId: quien === "creador" ? YO_USUARIO : 99,
    deadlineAt: null,
    visibleToMembers: false,
  };
}

function preparar(quien: Quien) {
  h.requireActiveWorkspace.mockResolvedValue({ user: { id: YO_USUARIO, name: "Yo" }, workspace: { id: "ws-1" } });
  h.level.mockResolvedValue("MANAGE");
  h.action.mockResolvedValue(quien === "coordina");
  h.db.member.findFirst.mockResolvedValue({ id: YO_SOCIO });
  h.db.govProject.findFirst.mockResolvedValue(proyectoPara(quien));
  h.db.govProject.updateMany.mockResolvedValue({ count: 1 });
  h.db.govProjectStage.aggregate.mockResolvedValue({ _max: { order: 0 } });
  h.db.govProjectStage.findFirst.mockResolvedValue({ id: "s-1", title: "Etapa", order: 0, _count: { tasks: 0 } });
  h.db.govProjectStage.findMany.mockResolvedValue([{ id: "s-1" }, { id: "s-2" }]);
  h.db.govProjectTask.aggregate.mockResolvedValue({ _max: { order: 0 } });
  h.db.govProjectTask.create.mockResolvedValue({ id: "t-nueva" });
  h.db.govProjectTask.findFirst.mockResolvedValue({
    id: "t-1",
    title: "Tarea",
    description: null,
    status: "PENDING",
    assigneeMemberId: null,
    dueAt: null,
    project: { id: "p-1", status: "PROPOSED" },
    _count: { updates: 0 },
  });
  h.db.govAttachment.findFirst.mockResolvedValue({ id: "a-1", filename: "x.pdf", visibleToMembers: false, quoteId: null });
  h.db.govProjectType.findFirst.mockResolvedValue(null);
  h.db.govProjectType.aggregate.mockResolvedValue({ _max: { order: 0 } });
  h.db.govProjectType.updateMany.mockResolvedValue({ count: 1 });
  h.db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof h.db) => unknown)(h.db) : Promise.all(arg as unknown[]),
  );
}

const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

/** Cada acción que edita UN proyecto, con un formulario válido y lo que escribe si pasa. */
const EDICIONES: { nombre: string; correr: () => Promise<void>; escribe: () => unknown }[] = [
  {
    nombre: "updateProjectAction (datos y responsable)",
    correr: () => acciones.updateProjectAction(form({ projectId: "p-1", title: "Muestra anual 2027" })),
    escribe: () => h.db.govProject.update,
  },
  {
    nombre: "changeProjectStatusAction",
    correr: () => acciones.changeProjectStatusAction(form({ projectId: "p-1", to: "IN_REVIEW" })),
    escribe: () => h.db.govProject.updateMany,
  },
  {
    nombre: "addStageAction",
    correr: () => acciones.addStageAction(form({ projectId: "p-1", title: "Buffet" })),
    escribe: () => h.db.govProjectStage.create,
  },
  {
    nombre: "renameStageAction",
    correr: () => acciones.renameStageAction(form({ projectId: "p-1", stageId: "s-1", title: "Otra" })),
    escribe: () => h.db.govProjectStage.update,
  },
  {
    nombre: "moveStageAction",
    correr: () => acciones.moveStageAction(form({ projectId: "p-1", stageId: "s-1", direction: "down" })),
    escribe: () => h.db.govProjectStage.update,
  },
  {
    nombre: "removeStageAction",
    correr: () => acciones.removeStageAction(form({ projectId: "p-1", stageId: "s-1" })),
    escribe: () => h.db.govProjectStage.delete,
  },
  {
    nombre: "removeTaskAction",
    correr: () => acciones.removeTaskAction(form({ projectId: "p-1", taskId: "t-1" })),
    escribe: () => h.db.govProjectTask.delete,
  },
  {
    nombre: "setFileVisibilityAction",
    correr: () => acciones.setFileVisibilityAction(form({ projectId: "p-1", attachmentId: "a-1", visible: "1" })),
    escribe: () => h.db.govAttachment.update,
  },
];

/** Corre la acción y devuelve adónde redirigió (todas terminan en un redirect). */
async function destinoDe(correr: () => Promise<void>): Promise<string> {
  try {
    await correr();
  } catch (e) {
    const m = e instanceof Error ? /^REDIRECT:(.*)$/.exec(e.message) : null;
    if (m) return m[1]!;
    throw e;
  }
  return "(sin redirect)";
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("editar un proyecto", () => {
  for (const ed of EDICIONES) {
    describe(ed.nombre, () => {
      it("quien sólo gestiona (ni responsable, ni creador, ni coordina) queda afuera y no escribe nada", async () => {
        preparar("gestiona");
        expect(await destinoDe(ed.correr)).toBe(`/gobierno/p-1?error=${NO_EDITA}`);
        expect(ed.escribe()).not.toHaveBeenCalled();
      });
      for (const quien of ["responsable", "creador", "coordina"] as const) {
        it(`${quien === "coordina" ? "quien coordina (o dueño/admin)" : `el ${quien}`} lo hace`, async () => {
          preparar(quien);
          const destino = await destinoDe(ed.correr);
          expect(destino).not.toContain("error=");
          expect(ed.escribe()).toHaveBeenCalled();
        });
      }
    });
  }

  it("una etapa de OTRO proyecto se rechaza aunque se edite el propio, y no se escribe nada", async () => {
    preparar("coordina");
    // La base sólo encuentra la etapa si es de este proyecto (s-1 de p-1); s-ajena es de otro.
    h.db.govProjectStage.findFirst.mockImplementation(async ({ where }: { where: { id: string; projectId: string } }) =>
      where.id === "s-1" && where.projectId === "p-1" ? { id: "s-1", title: "Etapa", order: 0, _count: { tasks: 0 } } : null,
    );
    const noExiste = `/gobierno/p-1?error=${encodeURIComponent("Esa etapa no existe.")}`;
    expect(
      await destinoDe(() => acciones.renameStageAction(form({ projectId: "p-1", stageId: "s-ajena", title: "Otra" }))),
    ).toBe(noExiste);
    expect(await destinoDe(() => acciones.removeStageAction(form({ projectId: "p-1", stageId: "s-ajena" })))).toBe(noExiste);
    expect(
      await destinoDe(() => acciones.moveStageAction(form({ projectId: "p-1", stageId: "s-ajena", direction: "down" }))),
    ).not.toContain("error=");
    expect(
      await destinoDe(() =>
        acciones.addTaskAction(form({ projectId: "p-1", stageId: "s-ajena", title: "Pedir sillas" })),
      ),
    ).toBe(noExiste);
    expect(h.db.govProjectStage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s-ajena", projectId: "p-1" } }),
    );
    expect(h.db.govProjectStage.update).not.toHaveBeenCalled();
    expect(h.db.govProjectStage.delete).not.toHaveBeenCalled();
    expect(h.db.govProjectTask.create).not.toHaveBeenCalled();
  });

  it("updateProjectAction lee el proyecto una sola vez", async () => {
    preparar("responsable");
    await destinoDe(() => acciones.updateProjectAction(form({ projectId: "p-1", title: "Muestra anual 2027" })));
    expect(h.db.govProject.findFirst).toHaveBeenCalledTimes(1);
  });

  it("las etapas buscan el proyecto dentro del workspace", async () => {
    preparar("coordina");
    await destinoDe(() => acciones.addStageAction(form({ projectId: "p-1", title: "Buffet" })));
    expect(h.db.govProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-1", workspaceId: "ws-1" } }),
    );
  });
});

describe("lo que sigue siendo de todos los que gestionan", () => {
  it("agregar una tarea y asignarla a otra persona", async () => {
    preparar("gestiona");
    const destino = await destinoDe(() =>
      acciones.addTaskAction(form({ projectId: "p-1", stageId: "s-1", title: "Pedir sillas", assigneeMemberId: "m-otro" })),
    );
    expect(destino).not.toContain("error=");
    expect(h.db.govProjectTask.create).toHaveBeenCalled();
  });

  it("reasignar o editar una tarea", async () => {
    preparar("gestiona");
    const destino = await destinoDe(() =>
      acciones.updateTaskAction(form({ projectId: "p-1", taskId: "t-1", title: "Tarea", assigneeMemberId: "m-otro" })),
    );
    expect(destino).not.toContain("error=");
    expect(h.db.govProjectTask.update).toHaveBeenCalled();
  });

  it("anotar en el historial", async () => {
    preparar("gestiona");
    const destino = await destinoDe(() => acciones.addProjectNoteAction(form({ projectId: "p-1", body: "Se habló con el club." })));
    expect(destino).not.toContain("error=");
  });
});

describe("tipos de proyecto: sólo quien coordina", () => {
  const TIPOS = [
    {
      nombre: "saveProjectTypeAction",
      correr: () => acciones.saveProjectTypeAction(form({ name: "Muestra", stagesText: "Armado\n- Pedir sala" })),
      escribe: () => h.db.govProjectType.create,
    },
    {
      nombre: "archiveProjectTypeAction",
      correr: () => acciones.archiveProjectTypeAction(form({ typeId: "ty-1", archive: "1" })),
      escribe: () => h.db.govProjectType.updateMany,
    },
  ];
  for (const t of TIPOS) {
    it(`${t.nombre}: quien gestiona sin coordinar queda afuera, aunque haya creado proyectos`, async () => {
      preparar("creador");
      expect(await destinoDe(t.correr)).toMatch(/^\/gobierno\?error=/);
      expect(t.escribe()).not.toHaveBeenCalled();
    });
    it(`${t.nombre}: quien coordina (o dueño/admin) lo hace`, async () => {
      preparar("coordina");
      expect(await destinoDe(t.correr)).not.toContain("error=");
      expect(t.escribe()).toHaveBeenCalled();
    });
  }
});
