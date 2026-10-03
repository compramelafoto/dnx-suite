import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  const fn = () => vi.fn();
  const db = {
    workspaceCustomRole: { findFirst: fn(), findMany: fn(), create: fn(), update: fn() },
    workspaceRolePermission: { deleteMany: fn(), createMany: fn() },
    workspaceRoleAssignment: { findMany: fn(), createMany: fn(), updateMany: fn() },
    workspaceOffice: { findFirst: fn(), findMany: fn(), create: fn(), update: fn() },
    workspaceOfficeTerm: { findMany: fn(), create: fn(), updateMany: fn() },
    member: { findFirst: fn() },
    $transaction: vi.fn(),
  };
  return {
    db,
    requireCommissionAdmin: vi.fn(),
    sendAndLogEmail: vi.fn(),
    ensureStaffMembership: vi.fn(),
    releaseStaffMembershipIfNoRoles: vi.fn(),
    findLinkableUserByEmail: vi.fn(),
    getEnabledModuleKeysForWorkspace: vi.fn(),
    loadWorkspaceEmailContext: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: H.revalidatePath }));
vi.mock("@repo/db", () => ({ prisma: H.db }));
vi.mock("@repo/db/fotoffice-user-lookup", () => ({ findLinkableUserByEmail: H.findLinkableUserByEmail }));
vi.mock("@/lib/commission/access", () => ({ requireCommissionAdmin: H.requireCommissionAdmin }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: H.sendAndLogEmail }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: H.loadWorkspaceEmailContext,
}));
vi.mock("@/lib/commission/team-membership", () => ({
  ensureStaffMembership: H.ensureStaffMembership,
  releaseStaffMembershipIfNoRoles: H.releaseStaffMembershipIfNoRoles,
}));
vi.mock("@/lib/modules/gating", () => ({
  getEnabledModuleKeysForWorkspace: H.getEnabledModuleKeysForWorkspace,
}));

const actions = await import("./actions");
const {
  addCommissionMemberAction,
  archiveOfficeAction,
  archiveRoleAction,
  createOfficeAction,
  createRoleAction,
  duplicateRoleAction,
  moveOfficeAction,
  removeCommissionMemberAction,
  updateCommissionMemberAction,
  updateRoleAction,
} = actions;

const NOT_FOUND = "No encontrado.";
const NO_ACCOUNT =
  "No encontramos una cuenta con ese correo. Pedile que se registre en FOTOFFICE y volvé a intentar.";

function form(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    for (const value of Array.isArray(v) ? v : [v]) fd.append(k, value);
  }
  return fd;
}

function allDbMocks() {
  const out: ReturnType<typeof vi.fn>[] = [];
  for (const [key, model] of Object.entries(H.db)) {
    if (key === "$transaction") continue;
    out.push(...Object.values(model as Record<string, ReturnType<typeof vi.fn>>));
  }
  return out;
}

const ROLE = { id: "r1", workspaceId: "ws-1", name: "Tesorería", description: null, archivedAt: null };

beforeEach(() => {
  for (const m of allDbMocks()) m.mockReset();
  H.db.$transaction.mockReset().mockImplementation(async (cb: (tx: typeof H.db) => unknown) => cb(H.db));
  H.requireCommissionAdmin
    .mockReset()
    .mockResolvedValue({ user: { id: 1, email: "owner@sfpr.test", name: "Owner" }, workspaceId: "ws-1" });
  H.sendAndLogEmail.mockReset().mockResolvedValue({ status: "SENT", providerId: "p-1" });
  H.ensureStaffMembership.mockReset().mockResolvedValue("created");
  H.releaseStaffMembershipIfNoRoles.mockReset().mockResolvedValue("removed");
  H.findLinkableUserByEmail.mockReset().mockResolvedValue(null);
  H.getEnabledModuleKeysForWorkspace.mockReset().mockResolvedValue(new Set(["members", "bookings"]));
  H.loadWorkspaceEmailContext.mockReset().mockResolvedValue({ organizationName: "SFPR", signature: null });
  H.revalidatePath.mockReset();
  // Valores neutros: nada existente salvo que el caso diga otra cosa.
  H.db.workspaceCustomRole.findMany.mockResolvedValue([]);
  H.db.workspaceRoleAssignment.findMany.mockResolvedValue([]);
  H.db.workspaceOfficeTerm.findMany.mockResolvedValue([]);
  H.db.workspaceOffice.findMany.mockResolvedValue([]);
  H.db.workspaceRoleAssignment.updateMany.mockResolvedValue({ count: 0 });
  H.db.workspaceOfficeTerm.updateMany.mockResolvedValue({ count: 0 });
  process.env.NEXT_PUBLIC_APP_URL = "https://app.fotoffice.test";
});

describe("sin permiso de admin", () => {
  it.each([
    ["roles", () => createRoleAction(undefined, form({ name: "Prensa" }))],
    ["cargos", () => createOfficeAction(undefined, form({ name: "Vocal" }))],
    ["integrantes", () => addCommissionMemberAction(undefined, form({ memberId: "m1", officeId: "o1" }))],
    ["quitar", () => removeCommissionMemberAction(undefined, form({ memberId: "m1" }))],
  ])("%s: termina en el redirect y no toca la base", async (_grupo, run) => {
    H.requireCommissionAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/workspace/configuracion"));
    await expect(run()).rejects.toThrow("NEXT_REDIRECT:/workspace/configuracion");
    for (const m of allDbMocks()) expect(m).not.toHaveBeenCalled();
  });
});

describe("createRoleAction", () => {
  it("crea el rol con la grilla de los módulos editables, sin filas NONE", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue(null);
    H.db.workspaceCustomRole.create.mockResolvedValue({ id: "r-new" });
    const res = await createRoleAction(
      undefined,
      form({ name: "Prensa", description: "Difusión", "level:members": "VIEW", "level:governance": "MANAGE" }),
    );
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.workspaceCustomRole.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws-1",
        name: "Prensa",
        description: "Difusión",
        permissions: { create: [{ moduleKey: "members", level: "VIEW", actions: [] }] },
      },
    });
    expect(H.revalidatePath).toHaveBeenCalledWith("/workspace/configuracion/comision", "layout");
  });

  it("nombre repetido entre los no archivados → error", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue({ id: "r1" });
    const res = await createRoleAction(undefined, form({ name: "Tesorería" }));
    expect(res.error).toBe("Ya existe un rol con ese nombre.");
    expect(H.db.workspaceCustomRole.create).not.toHaveBeenCalled();
  });
});

describe("updateRoleAction", () => {
  it("reemplaza sólo los permisos de módulos editables; los no editables se conservan", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValueOnce(ROLE).mockResolvedValueOnce(null);
    const res = await updateRoleAction(
      undefined,
      form({
        roleId: "r1",
        name: "Tesorería",
        "level:members": "MANAGE",
        "action:members:export": "on",
        "level:bookings": "NONE",
        "level:governance": "VIEW",
      }),
    );
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.workspaceCustomRole.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "r1", workspaceId: "ws-1", archivedAt: null },
    });
    expect(H.db.workspaceRolePermission.deleteMany).toHaveBeenCalledWith({
      // Cuotas entra por el alias: con Socios habilitado, también es editable.
      where: { roleId: "r1", moduleKey: { in: ["bookings", "members", "membership-dues"] } },
    });
    expect(H.db.workspaceRolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: "r1", moduleKey: "members", level: "MANAGE", actions: ["export"] }],
    });
    const deleted = H.db.workspaceRolePermission.deleteMany.mock.calls[0]?.[0] as {
      where: { moduleKey: { in: string[] } };
    };
    expect(deleted.where.moduleKey.in).not.toContain("governance");
  });

  it("un rol de otro workspace → No encontrado.", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue(null);
    const res = await updateRoleAction(undefined, form({ roleId: "r-otro", name: "X Y" }));
    expect(res.error).toBe(NOT_FOUND);
    expect(H.db.workspaceRolePermission.deleteMany).not.toHaveBeenCalled();
  });
});

describe("duplicateRoleAction", () => {
  it("copia permisos con el siguiente nombre libre", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue({
      ...ROLE,
      permissions: [{ moduleKey: "governance", level: "VIEW", actions: [] }],
    });
    H.db.workspaceCustomRole.findMany.mockResolvedValue([{ name: "Tesorería" }, { name: "Tesorería (copia)" }]);
    const res = await duplicateRoleAction(undefined, form({ roleId: "r1" }));
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.workspaceCustomRole.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "ws-1",
        name: "Tesorería (copia 2)",
        description: null,
        permissions: { create: [{ moduleKey: "governance", level: "VIEW", actions: [] }] },
      },
    });
  });
});

describe("duplicateRoleAction ante un choque de nombre", () => {
  it("P2002 → el mismo mensaje amable que crear o editar", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue({ ...ROLE, permissions: [] });
    H.db.workspaceCustomRole.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const res = await duplicateRoleAction(undefined, form({ roleId: "r1" }));
    expect(res.error).toBe("Ya existe un rol con ese nombre.");
  });
});

describe("archiveRoleAction", () => {
  const assignments = [
    { id: "a1", memberId: "m1", userId: null, startsAt: null, endsAt: null, revokedAt: null, member: { userId: 7 } },
    { id: "a2", memberId: "m2", userId: null, startsAt: null, endsAt: null, revokedAt: null, member: { userId: null } },
  ];

  it("sin confirmación y con asignaciones vigentes → error que dice cuántas personas", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue(ROLE);
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue(assignments);
    const res = await archiveRoleAction(undefined, form({ roleId: "r1" }));
    expect(res.error).toContain("2 personas");
    expect(H.db.workspaceCustomRole.update).not.toHaveBeenCalled();
    expect(H.db.workspaceRoleAssignment.updateMany).not.toHaveBeenCalled();
  });

  it("con confirmación → archiva, renombra, revoca y libera membresías", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue(ROLE);
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue(assignments);
    const res = await archiveRoleAction(undefined, form({ roleId: "r1", confirm: "yes" }));
    expect(res).toEqual({ error: null, ok: true });
    const upd = H.db.workspaceCustomRole.update.mock.calls[0]?.[0] as {
      where: { id: string; workspaceId: string };
      data: { name: string; archivedAt: Date };
    };
    expect(upd.where).toEqual({ id: "r1", workspaceId: "ws-1" });
    expect(upd.data.archivedAt).toBeInstanceOf(Date);
    expect(upd.data.name).toMatch(/^Tesorería \(archivado \d{2}\/\d{2}\/\d{4}\)$/);
    expect(H.db.workspaceRoleAssignment.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", roleId: "r1", revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: expect.any(Date) } }] },
      data: { revokedAt: expect.any(Date) },
    });
    expect(H.releaseStaffMembershipIfNoRoles).toHaveBeenCalledTimes(1);
    expect(H.releaseStaffMembershipIfNoRoles).toHaveBeenCalledWith("ws-1", 7);
  });

  it("si liberar la membresía falla, el archivo ya guardado no tira error", async () => {
    H.db.workspaceCustomRole.findFirst.mockResolvedValue(ROLE);
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue(assignments);
    H.releaseStaffMembershipIfNoRoles.mockRejectedValue(new Error("base caída"));
    const res = await archiveRoleAction(undefined, form({ roleId: "r1", confirm: "yes" }));
    expect(res).toEqual({ error: null, ok: true });
  });
});

describe("cargos", () => {
  it("createOfficeAction lo pone al final", async () => {
    H.db.workspaceOffice.findFirst.mockResolvedValue(null);
    H.db.workspaceOffice.findMany.mockResolvedValue([{ order: 3 }, { order: 8 }]);
    const res = await createOfficeAction(undefined, form({ name: "Vocal suplente" }));
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.workspaceOffice.create).toHaveBeenCalledWith({
      data: { workspaceId: "ws-1", name: "Vocal suplente", votes: false, order: 9 },
    });
  });

  it("archiveOfficeAction sin confirmación con mandatos vigentes → error; con confirmación revoca", async () => {
    H.db.workspaceOffice.findFirst.mockResolvedValue({ id: "o1", name: "Presidencia", archivedAt: null });
    H.db.workspaceOfficeTerm.findMany.mockResolvedValue([
      { id: "t1", startsAt: null, endsAt: null, revokedAt: null },
    ]);
    const sin = await archiveOfficeAction(undefined, form({ officeId: "o1" }));
    expect(sin.error).toContain("1 persona");
    expect(H.db.workspaceOffice.update).not.toHaveBeenCalled();

    const con = await archiveOfficeAction(undefined, form({ officeId: "o1", confirm: "yes" }));
    expect(con).toEqual({ error: null, ok: true });
    expect(H.db.workspaceOfficeTerm.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", officeId: "o1", revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: expect.any(Date) } }] },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("moveOfficeAction intercambia con el anterior", async () => {
    H.db.workspaceOffice.findMany.mockResolvedValue([
      { id: "o1", order: 0 },
      { id: "o2", order: 1 },
    ]);
    const res = await moveOfficeAction(undefined, form({ officeId: "o2", direction: "up" }));
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.workspaceOffice.update).toHaveBeenCalledWith({
      where: { id: "o2", workspaceId: "ws-1" },
      data: { order: 0 },
    });
    expect(H.db.workspaceOffice.update).toHaveBeenCalledWith({
      where: { id: "o1", workspaceId: "ws-1" },
      data: { order: 1 },
    });
  });

  it("moveOfficeAction con un cargo de otro workspace → No encontrado.", async () => {
    H.db.workspaceOffice.findMany.mockResolvedValue([{ id: "o1", order: 0 }]);
    const res = await moveOfficeAction(undefined, form({ officeId: "o-otro", direction: "up" }));
    expect(res.error).toBe(NOT_FOUND);
  });
});

const SOCIA_SIN_CUENTA = {
  id: "m1",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@socios.test",
  userId: null,
  user: null,
};

function stubOfficeAndRoles() {
  H.db.workspaceOffice.findFirst.mockResolvedValue({ id: "o1", name: "Tesorera" });
  H.db.workspaceCustomRole.findMany.mockResolvedValue([
    { id: "r1", name: "Tesorería" },
    { id: "r2", name: "Comunicación" },
  ]);
}

describe("addCommissionMemberAction", () => {
  it("socia sin cuenta: mandato y asignaciones por memberId, sin membresía, correo a la ficha", async () => {
    H.db.member.findFirst.mockResolvedValue(SOCIA_SIN_CUENTA);
    stubOfficeAndRoles();
    const res = await addCommissionMemberAction(
      undefined,
      form({ memberId: "m1", officeId: "o1", roleIds: ["r1", "r2"], startsAt: "2026-10-01", endsAt: "2027-12-31" }),
    );
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.member.findFirst.mock.calls[0]?.[0]).toMatchObject({ where: { id: "m1", workspaceId: "ws-1" } });

    const term = H.db.workspaceOfficeTerm.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(term.data).toMatchObject({
      workspaceId: "ws-1",
      officeId: "o1",
      memberId: "m1",
      userId: null,
      assignedById: 1,
    });
    expect(term.data.startsAt).toEqual(new Date("2026-10-01T03:00:00.000Z"));

    const asg = H.db.workspaceRoleAssignment.createMany.mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(asg.data.map((a) => a.roleId)).toEqual(["r1", "r2"]);
    for (const a of asg.data) expect(a).toMatchObject({ workspaceId: "ws-1", memberId: "m1", userId: null });

    expect(H.ensureStaffMembership).not.toHaveBeenCalled();
    expect(H.sendAndLogEmail).toHaveBeenCalledTimes(1);
    const mail = H.sendAndLogEmail.mock.calls[0]?.[0] as { to: string; templateKey: string; userId: number | null };
    expect(mail.to).toBe("ana@socios.test");
    expect(mail.userId).toBeNull();
    expect(H.revalidatePath).toHaveBeenCalledWith("/workspace/configuracion/comision", "layout");
  });

  it("un memberId de otro workspace → No encontrado. y nada creado", async () => {
    H.db.member.findFirst.mockResolvedValue(null);
    stubOfficeAndRoles();
    const res = await addCommissionMemberAction(undefined, form({ memberId: "m-otro", officeId: "o1" }));
    expect(res.error).toBe(NOT_FOUND);
    expect(H.db.member.findFirst.mock.calls[0]?.[0]).toMatchObject({ where: { id: "m-otro", workspaceId: "ws-1" } });
    expect(H.db.workspaceOfficeTerm.create).not.toHaveBeenCalled();
    expect(H.db.workspaceRoleAssignment.createMany).not.toHaveBeenCalled();
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
  });

  it("un correo sin cuenta → el mensaje exacto", async () => {
    H.findLinkableUserByEmail.mockResolvedValue(null);
    const res = await addCommissionMemberAction(undefined, form({ email: "nadie@x.test", officeId: "o1" }));
    expect(res.error).toBe(NO_ACCOUNT);
    expect(H.db.workspaceOfficeTerm.create).not.toHaveBeenCalled();
  });

  it("un usuario no socio: asignaciones por userId y membresía de equipo", async () => {
    H.findLinkableUserByEmail.mockResolvedValue({ id: 42, email: "contadora@x.test", name: "Laura" });
    H.db.member.findFirst.mockResolvedValue(null);
    stubOfficeAndRoles();
    const res = await addCommissionMemberAction(
      undefined,
      form({ email: "contadora@x.test", roleIds: ["r1"] }),
    );
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.member.findFirst.mock.calls[0]?.[0]).toMatchObject({ where: { workspaceId: "ws-1", userId: 42 } });
    const asg = H.db.workspaceRoleAssignment.createMany.mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(asg.data).toEqual([expect.objectContaining({ roleId: "r1", userId: 42, memberId: null })]);
    expect(H.db.workspaceOfficeTerm.create).not.toHaveBeenCalled();
    expect(H.ensureStaffMembership).toHaveBeenCalledWith("ws-1", 42);
    expect(H.sendAndLogEmail.mock.calls[0]?.[0]).toMatchObject({ to: "contadora@x.test", userId: 42 });
  });

  it("un rol archivado o ajeno → No encontrado.", async () => {
    H.db.member.findFirst.mockResolvedValue(SOCIA_SIN_CUENTA);
    H.db.workspaceCustomRole.findMany.mockResolvedValue([{ id: "r1", name: "Tesorería" }]);
    const res = await addCommissionMemberAction(undefined, form({ memberId: "m1", roleIds: ["r1", "r-otro"] }));
    expect(res.error).toBe(NOT_FOUND);
    expect(H.db.workspaceRoleAssignment.createMany).not.toHaveBeenCalled();
  });

  it("sin cargo ni roles → error", async () => {
    H.db.member.findFirst.mockResolvedValue(SOCIA_SIN_CUENTA);
    const res = await addCommissionMemberAction(undefined, form({ memberId: "m1" }));
    expect(res.error).toBe("Elegí un cargo o al menos un rol.");
  });

  it("no duplica un mandato ni un rol que la persona ya tiene vigentes, y lo dice", async () => {
    H.db.member.findFirst.mockResolvedValue(SOCIA_SIN_CUENTA);
    stubOfficeAndRoles();
    H.db.workspaceOfficeTerm.findMany.mockResolvedValue([
      { id: "t1", startsAt: null, endsAt: null, revokedAt: null },
    ]);
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue([
      { id: "a1", roleId: "r1", startsAt: null, endsAt: null, revokedAt: null },
    ]);
    const res = await addCommissionMemberAction(
      undefined,
      form({ memberId: "m1", officeId: "o1", roleIds: ["r1", "r2"] }),
    );
    expect(res.ok).toBe(true);
    expect(res.message).toContain("Tesorera");
    expect(res.message).toContain("Tesorería");
    expect(H.db.workspaceOfficeTerm.create).not.toHaveBeenCalled();
    const asg = H.db.workspaceRoleAssignment.createMany.mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(asg.data.map((a) => a.roleId)).toEqual(["r2"]);
  });

  it("si el correo falla, la acción igual sale bien", async () => {
    H.db.member.findFirst.mockResolvedValue(SOCIA_SIN_CUENTA);
    stubOfficeAndRoles();
    H.sendAndLogEmail.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "rebotó" });
    const res = await addCommissionMemberAction(undefined, form({ memberId: "m1", officeId: "o1" }));
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(H.sendAndLogEmail).toHaveBeenCalledTimes(1);
  });
});

describe("updateCommissionMemberAction", () => {
  it("cambia fechas del mandato, revoca roles que ya no están y agrega los nuevos", async () => {
    H.db.member.findFirst.mockResolvedValue({ ...SOCIA_SIN_CUENTA, userId: 7 });
    H.db.workspaceCustomRole.findMany.mockResolvedValue([{ id: "r2", name: "Comunicación" }]);
    H.db.workspaceOfficeTerm.findMany.mockResolvedValue([
      { id: "t1", startsAt: null, endsAt: null, revokedAt: null },
    ]);
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue([
      { id: "a1", roleId: "r1", startsAt: null, endsAt: null, revokedAt: null },
    ]);
    const res = await updateCommissionMemberAction(
      undefined,
      form({ memberId: "m1", roleIds: ["r2"], endsAt: "2027-12-31" }),
    );
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.workspaceOfficeTerm.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", id: { in: ["t1"] } },
      data: { startsAt: null, endsAt: new Date("2028-01-01T02:59:59.999Z") },
    });
    expect(H.db.workspaceRoleAssignment.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", id: { in: ["a1"] } },
      data: { revokedAt: expect.any(Date) },
    });
    const asg = H.db.workspaceRoleAssignment.createMany.mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(asg.data).toEqual([expect.objectContaining({ roleId: "r2", memberId: "m1" })]);
    expect(H.ensureStaffMembership).toHaveBeenCalledWith("ws-1", 7);
  });

  it("sin roles: libera la membresía si tiene cuenta", async () => {
    H.db.member.findFirst.mockResolvedValue({ ...SOCIA_SIN_CUENTA, userId: 7 });
    H.db.workspaceRoleAssignment.findMany.mockResolvedValue([
      { id: "a1", roleId: "r1", startsAt: null, endsAt: null, revokedAt: null },
    ]);
    const res = await updateCommissionMemberAction(undefined, form({ memberId: "m1" }));
    expect(res.ok).toBe(true);
    expect(H.releaseStaffMembershipIfNoRoles).toHaveBeenCalledWith("ws-1", 7);
    expect(H.ensureStaffMembership).not.toHaveBeenCalled();
  });

  it("sin roles antes ni después (sólo cargo): no toca la membresía", async () => {
    H.db.member.findFirst.mockResolvedValue({ ...SOCIA_SIN_CUENTA, userId: 7 });
    H.db.workspaceOfficeTerm.findMany.mockResolvedValue([
      { id: "t1", startsAt: null, endsAt: null, revokedAt: null },
    ]);
    const res = await updateCommissionMemberAction(undefined, form({ memberId: "m1", endsAt: "2027-12-31" }));
    expect(res.ok).toBe(true);
    expect(H.releaseStaffMembershipIfNoRoles).not.toHaveBeenCalled();
    expect(H.ensureStaffMembership).not.toHaveBeenCalled();
  });
});

describe("removeCommissionMemberAction", () => {
  it("revoca mandatos y asignaciones y, si le sacó roles, libera la membresía", async () => {
    H.db.member.findFirst.mockResolvedValue({ ...SOCIA_SIN_CUENTA, userId: 7 });
    H.db.workspaceRoleAssignment.updateMany.mockResolvedValue({ count: 2 });
    const res = await removeCommissionMemberAction(undefined, form({ memberId: "m1" }));
    expect(res).toEqual({ error: null, ok: true });
    const person = { OR: [{ memberId: "m1" }, { userId: 7 }] };
    expect(H.db.workspaceOfficeTerm.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", revokedAt: null, ...person },
      data: { revokedAt: expect.any(Date) },
    });
    expect(H.db.workspaceRoleAssignment.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", revokedAt: null, ...person },
      data: { revokedAt: expect.any(Date) },
    });
    expect(H.releaseStaffMembershipIfNoRoles).toHaveBeenCalledWith("ws-1", 7);
  });

  it("persona con sólo un cargo (personal sin roles): revoca el mandato y no toca la membresía", async () => {
    H.db.member.findFirst.mockResolvedValue({ ...SOCIA_SIN_CUENTA, userId: 7 });
    H.db.workspaceOfficeTerm.updateMany.mockResolvedValue({ count: 1 });
    H.db.workspaceRoleAssignment.updateMany.mockResolvedValue({ count: 0 });
    const res = await removeCommissionMemberAction(undefined, form({ memberId: "m1" }));
    expect(res).toEqual({ error: null, ok: true });
    expect(H.db.workspaceOfficeTerm.updateMany).toHaveBeenCalledTimes(1);
    expect(H.releaseStaffMembershipIfNoRoles).not.toHaveBeenCalled();
  });

  it("un memberId de otro workspace → No encontrado.", async () => {
    H.db.member.findFirst.mockResolvedValue(null);
    const res = await removeCommissionMemberAction(undefined, form({ memberId: "m-otro" }));
    expect(res.error).toBe(NOT_FOUND);
    expect(H.db.workspaceOfficeTerm.updateMany).not.toHaveBeenCalled();
  });

  it("socia sin cuenta: revoca sin tocar membresías", async () => {
    H.db.member.findFirst.mockResolvedValue(SOCIA_SIN_CUENTA);
    const res = await removeCommissionMemberAction(undefined, form({ memberId: "m1" }));
    expect(res.ok).toBe(true);
    expect(H.releaseStaffMembershipIfNoRoles).not.toHaveBeenCalled();
  });
});
