import { beforeEach, describe, expect, it, vi } from "vitest";

const { membershipFindManyMock, memberFindManyMock } = vi.hoisted(() => ({
  membershipFindManyMock: vi.fn(),
  memberFindManyMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findMany: membershipFindManyMock },
    member: { findMany: memberFindManyMock },
  },
}));

const {
  listUserProfiles,
  profileKey,
  findProfileByKey,
  profileDestination,
  needsProfileChoice,
} = await import("./profiles");

const TEAM = { role: "WORKSPACE_OWNER", workspace: { id: "ws-dnx", name: "DNX Owner" } };
const SOCIO = {
  id: "mem-1",
  memberNumber: "556",
  workspace: { id: "ws-sfpr", name: "SFPR" },
};

beforeEach(() => {
  membershipFindManyMock.mockReset().mockResolvedValue([]);
  memberFindManyMock.mockReset().mockResolvedValue([]);
});

describe("perfiles disponibles", () => {
  it("solo equipo: un perfil", async () => {
    membershipFindManyMock.mockResolvedValue([TEAM]);
    const p = await listUserProfiles(4);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ kind: "TEAM", workspaceName: "DNX Owner" });
  });

  it("solo socio: un perfil", async () => {
    memberFindManyMock.mockResolvedValue([SOCIO]);
    const p = await listUserProfiles(4);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ kind: "MEMBER", workspaceName: "SFPR", memberNumber: "556" });
  });

  /** El caso del titular: dueño de su negocio y socio de una institución, con el mismo email. */
  it("equipo y socio a la vez: dos perfiles", async () => {
    membershipFindManyMock.mockResolvedValue([TEAM]);
    memberFindManyMock.mockResolvedValue([SOCIO]);
    const p = await listUserProfiles(4);
    expect(p).toHaveLength(2);
    expect(p.map((x) => x.kind)).toEqual(["TEAM", "MEMBER"]);
  });

  it("sin nada: ningún perfil", async () => {
    expect(await listUserProfiles(4)).toHaveLength(0);
  });

  it("solo cuenta las fichas de socio ACTIVE", async () => {
    await listUserProfiles(4);
    expect(memberFindManyMock.mock.calls[0]?.[0]?.where).toEqual({ userId: 4, status: "ACTIVE" });
  });

  it("es socio de dos instituciones: aparecen las dos", async () => {
    memberFindManyMock.mockResolvedValue([
      SOCIO,
      { id: "mem-2", memberNumber: "12", workspace: { id: "ws-otra", name: "Otra Sociedad" } },
    ]);
    const p = await listUserProfiles(4);
    expect(p).toHaveLength(2);
    expect(p.every((x) => x.kind === "MEMBER")).toBe(true);
  });
});

describe("clave del perfil", () => {
  const team = { kind: "TEAM", workspaceId: "ws-a", workspaceName: "A", role: "WORKSPACE_OWNER" } as const;
  const socio = { kind: "MEMBER", workspaceId: "ws-a", workspaceName: "A", memberId: "m", memberNumber: "1" } as const;

  /** Ser equipo de un workspace y socio del MISMO no puede colapsar en la misma clave. */
  it("distingue equipo de socio dentro del mismo workspace", () => {
    expect(profileKey(team)).not.toBe(profileKey(socio));
  });

  it("encuentra el perfil por su clave", () => {
    const profiles = [team, socio];
    expect(findProfileByKey(profiles, profileKey(socio))).toBe(socio);
  });

  it.each([null, "", "TEAM:ws-inexistente", "basura", "MEMBER:"])(
    "una clave inválida o ajena (%s) no devuelve nada",
    (key) => {
      expect(findProfileByKey([team, socio], key)).toBeNull();
    },
  );

  it("una clave de un perfil que ya no se tiene se descarta", () => {
    expect(findProfileByKey([team], profileKey(socio))).toBeNull();
  });
});

describe("destino y necesidad de elegir", () => {
  const team = { kind: "TEAM", workspaceId: "ws-a", workspaceName: "A", role: "WORKSPACE_OWNER" } as const;
  const socio = { kind: "MEMBER", workspaceId: "ws-b", workspaceName: "B", memberId: "m", memberNumber: "1" } as const;

  it("equipo va al panel, socio al portal", () => {
    expect(profileDestination(team)).toBe("/workspace");
    expect(profileDestination(socio)).toBe("/portal");
  });

  it("con un solo perfil no se pregunta nada", () => {
    expect(needsProfileChoice([team])).toBe(false);
    expect(needsProfileChoice([])).toBe(false);
  });

  it("con dos o más, sí", () => {
    expect(needsProfileChoice([team, socio])).toBe(true);
  });
});
