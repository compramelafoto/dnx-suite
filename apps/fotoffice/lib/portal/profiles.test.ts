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
  resolveEntryProfile,
  counterpartProfile,
  hasProfilesInSeveralWorkspaces,
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

describe("destino del perfil", () => {
  const team = { kind: "TEAM", workspaceId: "ws-a", workspaceName: "A", role: "WORKSPACE_OWNER" } as const;
  const socio = { kind: "MEMBER", workspaceId: "ws-b", workspaceName: "B", memberId: "m", memberNumber: "1" } as const;

  it("equipo va al panel, socio al portal", () => {
    expect(profileDestination(team)).toBe("/workspace");
    expect(profileDestination(socio)).toBe("/portal");
  });
});

/**
 * Con qué perfil se entra.
 *
 * Quien tiene equipo y socio en la MISMA institución no tiene nada que elegir entre
 * instituciones: entra directo (por defecto al portal del socio) y cambia con un botón.
 * Sólo se pregunta cuando los perfiles están repartidos en más de una institución.
 */
describe("resolveEntryProfile", () => {
  const teamA = { kind: "TEAM", workspaceId: "ws-a", workspaceName: "A", role: "WORKSPACE_ADMIN" } as const;
  const socioA = { kind: "MEMBER", workspaceId: "ws-a", workspaceName: "A", memberId: "m", memberNumber: "1" } as const;
  const teamB = { kind: "TEAM", workspaceId: "ws-b", workspaceName: "B", role: "WORKSPACE_OWNER" } as const;

  it("sin perfiles: none", () => {
    expect(resolveEntryProfile([], null)).toEqual({ kind: "none" });
  });

  it("sólo socio: entra como socio", () => {
    expect(resolveEntryProfile([socioA], null)).toEqual({ kind: "go", profile: socioA });
  });

  it("sólo equipo: entra como equipo", () => {
    expect(resolveEntryProfile([teamA], null)).toEqual({ kind: "go", profile: teamA });
  });

  it("equipo y socio de la misma institución, sin recordado: entra como socio", () => {
    expect(resolveEntryProfile([teamA, socioA], null)).toEqual({ kind: "go", profile: socioA });
  });

  it("misma institución con recordado de equipo válido: entra como equipo", () => {
    expect(resolveEntryProfile([teamA, socioA], "TEAM:ws-a")).toEqual({ kind: "go", profile: teamA });
  });

  it("recordado de otra institución que ya no tiene: entra como socio", () => {
    expect(resolveEntryProfile([teamA, socioA], "TEAM:ws-b")).toEqual({ kind: "go", profile: socioA });
  });

  it("recordado manipulado: no se cree", () => {
    expect(resolveEntryProfile([teamA, socioA], "ADMIN:ws-a")).toEqual({ kind: "go", profile: socioA });
  });

  it("dos instituciones sin recordado: pregunta", () => {
    expect(resolveEntryProfile([teamB, socioA], null)).toEqual({ kind: "ask" });
  });

  it("dos instituciones con recordado inválido: pregunta", () => {
    expect(resolveEntryProfile([teamB, socioA], "TEAM:ws-zzz")).toEqual({ kind: "ask" });
  });

  it("dos instituciones con recordado válido: entra con ese", () => {
    expect(resolveEntryProfile([teamB, socioA, teamA], "TEAM:ws-b")).toEqual({ kind: "go", profile: teamB });
  });
});

describe("counterpartProfile", () => {
  const teamA = { kind: "TEAM", workspaceId: "ws-a", workspaceName: "A", role: "WORKSPACE_ADMIN" } as const;
  const socioA = { kind: "MEMBER", workspaceId: "ws-a", workspaceName: "A", memberId: "m", memberNumber: "1" } as const;
  const socioB = { kind: "MEMBER", workspaceId: "ws-b", workspaceName: "B", memberId: "m2", memberNumber: "2" } as const;

  it("desde el portal encuentra el equipo de la misma institución", () => {
    expect(counterpartProfile([teamA, socioA], { kind: "MEMBER", workspaceId: "ws-a" })).toBe(teamA);
  });

  it("desde el panel encuentra la ficha de socio de la misma institución", () => {
    expect(counterpartProfile([teamA, socioA], { kind: "TEAM", workspaceId: "ws-a" })).toBe(socioA);
  });

  it("no cruza instituciones", () => {
    expect(counterpartProfile([teamA, socioB], { kind: "TEAM", workspaceId: "ws-a" })).toBeNull();
  });

  it("sin contraparte: null", () => {
    expect(counterpartProfile([socioA], { kind: "MEMBER", workspaceId: "ws-a" })).toBeNull();
  });
});

describe("hasProfilesInSeveralWorkspaces", () => {
  const teamA = { kind: "TEAM", workspaceId: "ws-a", workspaceName: "A", role: "WORKSPACE_ADMIN" } as const;
  const socioA = { kind: "MEMBER", workspaceId: "ws-a", workspaceName: "A", memberId: "m", memberNumber: "1" } as const;
  const socioB = { kind: "MEMBER", workspaceId: "ws-b", workspaceName: "B", memberId: "m2", memberNumber: "2" } as const;

  it("ninguno o una sola institución: no", () => {
    expect(hasProfilesInSeveralWorkspaces([])).toBe(false);
    expect(hasProfilesInSeveralWorkspaces([teamA, socioA])).toBe(false);
  });

  it("dos instituciones: sí", () => {
    expect(hasProfilesInSeveralWorkspaces([teamA, socioB])).toBe(true);
  });
});
