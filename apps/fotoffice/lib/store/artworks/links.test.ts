import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Vínculo workspace ↔ organización de FotoRank. Con una base falsa: se mira qué se consulta y
 * qué se escribe. El rol en el workspace sale de `resolveWorkspaceRole` (falso acá).
 */
const h = vi.hoisted(() => ({
  resolveWorkspaceRole: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: h.resolveWorkspaceRole }));

const {
  assertContestLinked,
  ContestNotLinkedError,
  isContestLinked,
  linkOrganization,
  linkedOrganizationIds,
  listLinkableOrganizations,
  listLinkedOrganizations,
  OrganizationLinkError,
  unlinkOrganization,
} = await import("./links");

type Miembro = { organizationId: string; userId: number; role: string; status: string };

function baseFalsa(
  opts: {
    miembros?: Miembro[];
    globalRole?: string;
    organizaciones?: Array<{ id: string; name: string; slug: string }>;
    vinculos?: Array<{ workspaceId: string; organizationId: string; linkedByUserId?: number; createdAt?: Date }>;
    concursos?: Array<{ id: string; organizationId: string }>;
  } = {},
) {
  const miembros = opts.miembros ?? [];
  const organizaciones = opts.organizaciones ?? [
    { id: "org1", name: "Foto Club Santa Fe", slug: "fcsf" },
    { id: "org2", name: "Otra", slug: "otra" },
  ];
  const vinculos = opts.vinculos ?? [];
  const concursos = opts.concursos ?? [];

  const db = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        where.id === 0 ? null : { globalRole: opts.globalRole ?? "USER", role: "USER" },
      ),
      findMany: vi.fn(async ({ where }: { where: { id: { in: number[] } } }) =>
        where.id.in.map((id) => ({ id, name: `Persona ${id}`, email: `p${id}@x.test` })),
      ),
    },
    contestOrganizationMember: {
      findFirst: vi.fn(
        async ({ where }: { where: { organizationId: string; userId: number; status: string; role: { in: string[] } } }) =>
          miembros.find(
            (m) =>
              m.organizationId === where.organizationId &&
              m.userId === where.userId &&
              m.status === where.status &&
              where.role.in.includes(m.role),
          ) ?? null,
      ),
    },
    contestOrganization: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        organizaciones.find((o) => o.id === where.id) ? { id: where.id } : null,
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            id?: { notIn: string[] };
            members?: { some: { userId: number; status: string; role: { in: string[] } } };
          };
        }) =>
          organizaciones.filter((o) => {
            if (where.id?.notIn.includes(o.id)) return false;
            const s = where.members?.some;
            if (!s) return true;
            return miembros.some(
              (m) => m.organizationId === o.id && m.userId === s.userId && m.status === s.status && s.role.in.includes(m.role),
            );
          }),
      ),
    },
    workspaceContestOrganizationLink: {
      createMany: vi.fn(async ({ data }: { data: Array<{ workspaceId: string; organizationId: string }> }) => {
        let count = 0;
        for (const d of data) {
          if (!vinculos.some((v) => v.workspaceId === d.workspaceId && v.organizationId === d.organizationId)) {
            vinculos.push(d);
            count++;
          }
        }
        return { count };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { workspaceId: string; organizationId: string } }) => {
        const antes = vinculos.length;
        for (let i = vinculos.length - 1; i >= 0; i--) {
          if (vinculos[i].workspaceId === where.workspaceId && vinculos[i].organizationId === where.organizationId) {
            vinculos.splice(i, 1);
          }
        }
        return { count: antes - vinculos.length };
      }),
      findMany: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
        vinculos
          .filter((v) => v.workspaceId === where.workspaceId)
          .map((v) => ({
            organizationId: v.organizationId,
            linkedByUserId: v.linkedByUserId ?? 1,
            createdAt: v.createdAt ?? new Date("2026-10-05T12:00:00Z"),
            organization: organizaciones.find((o) => o.id === v.organizationId) ?? null,
          })),
      ),
      findFirst: vi.fn(async ({ where }: { where: { workspaceId: string; organizationId: string } }) =>
        vinculos.find((v) => v.workspaceId === where.workspaceId && v.organizationId === where.organizationId)
          ? { id: "link" }
          : null,
      ),
    },
    fotorankContest: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => concursos.find((c) => c.id === where.id) ?? null),
    },
  };
  return { db: db as never, raw: db, vinculos };
}

beforeEach(() => {
  h.resolveWorkspaceRole.mockReset();
});

describe("linkOrganization", () => {
  it("vincula si es dueño/admin del workspace y OWNER/ADMIN activo de la organización", async () => {
    h.resolveWorkspaceRole.mockResolvedValue("WORKSPACE_ADMIN");
    const { db, raw, vinculos } = baseFalsa({
      miembros: [{ organizationId: "org1", userId: 7, role: "ADMIN", status: "ACTIVE" }],
    });
    const r = await linkOrganization("ws1", "org1", 7, db);
    expect(r).toEqual({ created: true });
    expect(h.resolveWorkspaceRole).toHaveBeenCalledWith(7, "ws1");
    expect(raw.workspaceContestOrganizationLink.createMany).toHaveBeenCalledWith({
      data: [{ workspaceId: "ws1", organizationId: "org1", linkedByUserId: 7 }],
      skipDuplicates: true,
    });
    expect(vinculos).toHaveLength(1);
  });

  it("es idempotente: vincular dos veces deja un solo vínculo y no falla", async () => {
    h.resolveWorkspaceRole.mockResolvedValue("WORKSPACE_OWNER");
    const { db, vinculos } = baseFalsa({
      miembros: [{ organizationId: "org1", userId: 7, role: "OWNER", status: "ACTIVE" }],
    });
    await linkOrganization("ws1", "org1", 7, db);
    const segunda = await linkOrganization("ws1", "org1", 7, db);
    expect(segunda).toEqual({ created: false });
    expect(vinculos).toHaveLength(1);
  });

  it("rechaza al STAFF del workspace aunque sea dueño de la organización", async () => {
    h.resolveWorkspaceRole.mockResolvedValue("STAFF");
    const { db, raw } = baseFalsa({
      miembros: [{ organizationId: "org1", userId: 7, role: "OWNER", status: "ACTIVE" }],
    });
    await expect(linkOrganization("ws1", "org1", 7, db)).rejects.toMatchObject({ code: "NOT_WORKSPACE_ADMIN" });
    expect(raw.workspaceContestOrganizationLink.createMany).not.toHaveBeenCalled();
  });

  it("rechaza a quien no es miembro del workspace", async () => {
    h.resolveWorkspaceRole.mockResolvedValue(null);
    const { db } = baseFalsa({ miembros: [{ organizationId: "org1", userId: 7, role: "OWNER", status: "ACTIVE" }] });
    await expect(linkOrganization("ws1", "org1", 7, db)).rejects.toBeInstanceOf(OrganizationLinkError);
  });

  it.each([
    ["EDITOR activo", { role: "EDITOR", status: "ACTIVE" }],
    ["JUDGE activo", { role: "JUDGE", status: "ACTIVE" }],
    ["VIEWER activo", { role: "VIEWER", status: "ACTIVE" }],
    ["OWNER pendiente", { role: "OWNER", status: "PENDING" }],
    ["ADMIN invitado", { role: "ADMIN", status: "INVITED" }],
  ])("rechaza en la organización a un %s", async (_n, m) => {
    h.resolveWorkspaceRole.mockResolvedValue("WORKSPACE_OWNER");
    const { db, raw } = baseFalsa({ miembros: [{ organizationId: "org1", userId: 7, ...m }] });
    await expect(linkOrganization("ws1", "org1", 7, db)).rejects.toMatchObject({ code: "NOT_ORGANIZATION_ADMIN" });
    expect(raw.workspaceContestOrganizationLink.createMany).not.toHaveBeenCalled();
  });

  it("rechaza si es admin de OTRA organización", async () => {
    h.resolveWorkspaceRole.mockResolvedValue("WORKSPACE_OWNER");
    const { db } = baseFalsa({ miembros: [{ organizationId: "org2", userId: 7, role: "OWNER", status: "ACTIVE" }] });
    await expect(linkOrganization("ws1", "org1", 7, db)).rejects.toMatchObject({ code: "NOT_ORGANIZATION_ADMIN" });
  });

  it("el super admin de la plataforma puede vincular sin ser miembro de la organización", async () => {
    h.resolveWorkspaceRole.mockResolvedValue("WORKSPACE_OWNER");
    const { db, vinculos } = baseFalsa({ globalRole: "SUPER_ADMIN" });
    await expect(linkOrganization("ws1", "org1", 7, db)).resolves.toEqual({ created: true });
    expect(vinculos).toHaveLength(1);
  });

  it("el super admin igual necesita ser dueño/admin del workspace", async () => {
    h.resolveWorkspaceRole.mockResolvedValue("STAFF");
    const { db } = baseFalsa({ globalRole: "SUPER_ADMIN" });
    await expect(linkOrganization("ws1", "org1", 7, db)).rejects.toMatchObject({ code: "NOT_WORKSPACE_ADMIN" });
  });

  it("organización inexistente", async () => {
    h.resolveWorkspaceRole.mockResolvedValue("WORKSPACE_OWNER");
    const { db } = baseFalsa({ globalRole: "SUPER_ADMIN" });
    await expect(linkOrganization("ws1", "nope", 7, db)).rejects.toMatchObject({ code: "ORGANIZATION_NOT_FOUND" });
  });
});

describe("listLinkableOrganizations", () => {
  it("sólo las organizaciones donde es OWNER/ADMIN activo y que todavía no están vinculadas", async () => {
    const { db, raw } = baseFalsa({
      organizaciones: [
        { id: "org1", name: "Uno", slug: "uno" },
        { id: "org2", name: "Dos", slug: "dos" },
        { id: "org3", name: "Tres", slug: "tres" },
        { id: "org4", name: "Cuatro", slug: "cuatro" },
      ],
      miembros: [
        { organizationId: "org1", userId: 7, role: "OWNER", status: "ACTIVE" },
        { organizationId: "org2", userId: 7, role: "ADMIN", status: "ACTIVE" },
        { organizationId: "org3", userId: 7, role: "EDITOR", status: "ACTIVE" },
        { organizationId: "org4", userId: 7, role: "ADMIN", status: "PENDING" },
      ],
      vinculos: [{ workspaceId: "ws1", organizationId: "org2" }],
    });
    const r = await listLinkableOrganizations(7, "ws1", db);
    expect(r.map((o) => o.id)).toEqual(["org1"]);
    expect(raw.contestOrganization.findMany.mock.calls[0]?.[0].where.members?.some).toEqual({
      userId: 7,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    });
  });

  it("al super admin le ofrece todas las no vinculadas", async () => {
    const { db } = baseFalsa({ globalRole: "SUPER_ADMIN", vinculos: [{ workspaceId: "ws1", organizationId: "org1" }] });
    const r = await listLinkableOrganizations(7, "ws1", db);
    expect(r.map((o) => o.id)).toEqual(["org2"]);
  });
});

describe("unlinkOrganization y listados", () => {
  it("desvincula sólo ese par workspace/organización", async () => {
    const { db, vinculos } = baseFalsa({
      vinculos: [
        { workspaceId: "ws1", organizationId: "org1" },
        { workspaceId: "ws2", organizationId: "org1" },
      ],
    });
    await expect(unlinkOrganization("ws1", "org1", db)).resolves.toEqual({ removed: true });
    expect(vinculos).toEqual([{ workspaceId: "ws2", organizationId: "org1" }]);
    await expect(unlinkOrganization("ws1", "org1", db)).resolves.toEqual({ removed: false });
  });

  it("linkedOrganizationIds devuelve las del workspace", async () => {
    const { db } = baseFalsa({
      vinculos: [
        { workspaceId: "ws1", organizationId: "org1" },
        { workspaceId: "ws2", organizationId: "org2" },
      ],
    });
    await expect(linkedOrganizationIds("ws1", db)).resolves.toEqual(["org1"]);
  });

  it("listLinkedOrganizations trae nombre, slug y quién vinculó", async () => {
    const cuando = new Date("2026-10-01T15:00:00Z");
    const { db } = baseFalsa({
      vinculos: [{ workspaceId: "ws1", organizationId: "org1", linkedByUserId: 9, createdAt: cuando }],
    });
    await expect(listLinkedOrganizations("ws1", db)).resolves.toEqual([
      { organizationId: "org1", name: "Foto Club Santa Fe", slug: "fcsf", linkedAt: cuando, linkedByName: "Persona 9" },
    ]);
  });
});

describe("isContestLinked / assertContestLinked", () => {
  const datos = {
    vinculos: [{ workspaceId: "ws1", organizationId: "org1" }],
    concursos: [
      { id: "c1", organizationId: "org1" },
      { id: "c2", organizationId: "org2" },
    ],
  };

  it("true si el concurso es de una organización vinculada al workspace", async () => {
    const { db } = baseFalsa(datos);
    await expect(isContestLinked("ws1", "c1", db)).resolves.toBe(true);
    await expect(assertContestLinked("ws1", "c1", db)).resolves.toBeUndefined();
  });

  it("false si la organización no está vinculada a ESE workspace", async () => {
    const { db } = baseFalsa(datos);
    await expect(isContestLinked("ws1", "c2", db)).resolves.toBe(false);
    await expect(isContestLinked("ws2", "c1", db)).resolves.toBe(false);
    await expect(assertContestLinked("ws1", "c2", db)).rejects.toBeInstanceOf(ContestNotLinkedError);
  });

  it("false si el concurso no existe", async () => {
    const { db } = baseFalsa(datos);
    await expect(isContestLinked("ws1", "nope", db)).resolves.toBe(false);
  });

  it("tras desvincular, el concurso deja de estar habilitado", async () => {
    const { db } = baseFalsa({ ...datos, vinculos: [...datos.vinculos] });
    await unlinkOrganization("ws1", "org1", db);
    await expect(isContestLinked("ws1", "c1", db)).resolves.toBe(false);
  });
});
