import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  blockFindUnique: vi.fn(),
  blockFindMany: vi.fn(),
  blockCreate: vi.fn(),
  blockUpdateMany: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    portalAccountBlock: {
      findUnique: m.blockFindUnique,
      findMany: m.blockFindMany,
      create: m.blockCreate,
      updateMany: m.blockUpdateMany,
    },
    user: { findUnique: m.userFindUnique, findFirst: m.userFindFirst },
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));

import {
  CUENTA_SIN_BLOQUEO,
  MENSAJE_CUENTA_SUSPENDIDA,
  blockAccount,
  blockedUserIds,
  findAccountByEmail,
  isBlocked,
  unblockAccount,
} from "./bloqueo";

const MOTIVO = "Vendió un equipo robado y no responde.";

beforeEach(() => {
  vi.clearAllMocks();
  m.blockFindUnique.mockResolvedValue(null);
  m.blockCreate.mockResolvedValue({ id: 1 });
  m.blockUpdateMany.mockResolvedValue({ count: 1 });
  m.userFindUnique.mockResolvedValue({ id: 9, email: "persona@e.test", name: "Juan Pérez" });
  m.email.mockResolvedValue({ success: true });
});

describe("isBlocked", () => {
  it("sin bloqueo -> false", async () => {
    expect(await isBlocked(9)).toBe(false);
  });

  it("bloqueo activo -> true", async () => {
    m.blockFindUnique.mockResolvedValue({ liftedAt: null });
    expect(await isBlocked(9)).toBe(true);
  });

  it("bloqueo levantado -> false", async () => {
    m.blockFindUnique.mockResolvedValue({ liftedAt: new Date() });
    expect(await isBlocked(9)).toBe(false);
  });
});

describe("blockedUserIds", () => {
  it("sólo los bloqueos activos", async () => {
    m.blockFindMany.mockResolvedValue([{ userId: 3 }, { userId: 8 }]);
    expect(await blockedUserIds()).toEqual([3, 8]);
    expect(m.blockFindMany.mock.calls[0][0].where).toEqual({ liftedAt: null });
  });
});

describe("CUENTA_SIN_BLOQUEO", () => {
  it("excluye a quien tiene un bloqueo sin levantar", () => {
    expect(CUENTA_SIN_BLOQUEO).toEqual({ NOT: { portalAccountBlock: { is: { liftedAt: null } } } });
  });
});

describe("blockAccount", () => {
  it("crea el bloqueo y avisa a la persona sin el motivo interno", async () => {
    await blockAccount(1, 9, `  ${MOTIVO}  `);
    expect(m.blockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: 9, reason: MOTIVO, blockedById: 1 } }),
    );
    expect(m.email).toHaveBeenCalledTimes(1);
    const [to, template, data] = m.email.mock.calls[0];
    expect(to).toBe("persona@e.test");
    expect(template).toBe("cuenta_bloqueada");
    expect(JSON.stringify(data)).not.toContain("robado");
  });

  it("con CONTACTO_EMAIL: responde a esa casilla y el texto invita a responder", async () => {
    vi.stubEnv("CONTACTO_EMAIL", "ayuda@mercadofotoraw.test");
    await blockAccount(1, 9, MOTIVO);
    const [, , data, opciones] = m.email.mock.calls[0];
    expect(data.conRespuesta).toBe("1");
    expect(opciones).toEqual({ replyTo: "ayuda@mercadofotoraw.test" });
    vi.unstubAllEnvs();
  });

  it("sin CONTACTO_EMAIL: sin replyTo y sin invitar a responder", async () => {
    vi.stubEnv("CONTACTO_EMAIL", "");
    await blockAccount(1, 9, MOTIVO);
    const [, , data, opciones] = m.email.mock.calls[0];
    expect(data.conRespuesta).toBe("");
    expect(opciones).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("motivo corto o largo -> error y no bloquea", async () => {
    await expect(blockAccount(1, 9, "corto")).rejects.toThrow(
      "El motivo tiene que tener entre 10 y 500 caracteres.",
    );
    await expect(blockAccount(1, 9, "x".repeat(501))).rejects.toThrow(/entre 10 y 500/);
    expect(m.blockCreate).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("no se puede bloquear la propia cuenta", async () => {
    await expect(blockAccount(9, 9, MOTIVO)).rejects.toThrow("No podés bloquear tu propia cuenta.");
  });

  it("cuenta inexistente -> NO_ENCONTRADO", async () => {
    m.userFindUnique.mockResolvedValue(null);
    await expect(blockAccount(1, 9, MOTIVO)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
  });

  it("ya bloqueada -> error y no reavisa", async () => {
    m.blockFindUnique.mockResolvedValue({ id: 4, liftedAt: null });
    await expect(blockAccount(1, 9, MOTIVO)).rejects.toThrow("Esta cuenta ya está bloqueada.");
    expect(m.email).not.toHaveBeenCalled();
  });

  it("bloqueo levantado antes: actualiza la misma fila (userId es único)", async () => {
    m.blockFindUnique.mockResolvedValue({ id: 4, liftedAt: new Date("2026-10-01") });
    await blockAccount(2, 9, MOTIVO);
    expect(m.blockCreate).not.toHaveBeenCalled();
    const args = m.blockUpdateMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 9, liftedAt: { not: null } });
    expect(args.data).toMatchObject({ reason: MOTIVO, blockedById: 2, liftedAt: null });
    expect(args.data.createdAt).toBeInstanceOf(Date);
    expect(m.email).toHaveBeenCalledTimes(1);
  });

  it("dos bloqueos a la vez: el segundo choca con el único y queda como ya bloqueada", async () => {
    m.blockCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(blockAccount(1, 9, MOTIVO)).rejects.toThrow("Esta cuenta ya está bloqueada.");
    expect(m.email).not.toHaveBeenCalled();
  });

  it("si el correo falla, el bloqueo igual queda", async () => {
    m.email.mockRejectedValue(new Error("caído"));
    await expect(blockAccount(1, 9, MOTIVO)).resolves.toBeUndefined();
    expect(m.blockCreate).toHaveBeenCalled();
  });
});

describe("unblockAccount", () => {
  it("levanta el bloqueo activo", async () => {
    await unblockAccount(1, 9);
    const args = m.blockUpdateMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 9, liftedAt: null });
    expect(args.data.liftedAt).toBeInstanceOf(Date);
  });

  it("sin bloqueo activo -> error", async () => {
    m.blockUpdateMany.mockResolvedValue({ count: 0 });
    await expect(unblockAccount(1, 9)).rejects.toThrow("Esta cuenta no está bloqueada.");
  });
});

describe("findAccountByEmail", () => {
  it("busca sin distinguir mayúsculas y dice si está bloqueada", async () => {
    m.userFindFirst.mockResolvedValue({
      id: 9,
      email: "persona@e.test",
      name: "Juan",
      portalAccountBlock: { liftedAt: null },
    });
    expect(await findAccountByEmail("  Persona@E.test ")).toEqual({
      id: 9,
      email: "persona@e.test",
      name: "Juan",
      blocked: true,
    });
    expect(m.userFindFirst.mock.calls[0][0].where).toEqual({
      email: { equals: "persona@e.test", mode: "insensitive" },
    });
  });

  it("correo vacío no consulta", async () => {
    expect(await findAccountByEmail("  ")).toBeNull();
    expect(m.userFindFirst).not.toHaveBeenCalled();
  });
});

it("el texto para quien está suspendido es fijo", () => {
  expect(MENSAJE_CUENTA_SUSPENDIDA).toBe("Tu cuenta está suspendida.");
});
