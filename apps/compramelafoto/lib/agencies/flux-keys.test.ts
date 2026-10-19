import { beforeEach, describe, expect, it, vi } from "vitest";

const codeFindUnique = vi.fn();
const codeUpdateMany = vi.fn();
const codeUpdate = vi.fn();
const codeCreate = vi.fn();
const keyCount = vi.fn();
const keyCreate = vi.fn();
const keyFindUnique = vi.fn();
const keyFindMany = vi.fn();
const keyUpdateMany = vi.fn();
const memberCount = vi.fn();
vi.mock("@/lib/prisma", () => {
  const client = {
    agencyLinkCode: {
      findUnique: (...a: unknown[]) => codeFindUnique(...a),
      updateMany: (...a: unknown[]) => codeUpdateMany(...a),
      update: (...a: unknown[]) => codeUpdate(...a),
      create: (...a: unknown[]) => codeCreate(...a),
    },
    agencyDeviceKey: {
      count: (...a: unknown[]) => keyCount(...a),
      create: (...a: unknown[]) => keyCreate(...a),
      findUnique: (...a: unknown[]) => keyFindUnique(...a),
      findMany: (...a: unknown[]) => keyFindMany(...a),
      updateMany: (...a: unknown[]) => keyUpdateMany(...a),
    },
    agencyMember: { count: (...a: unknown[]) => memberCount(...a) },
  };
  return {
    prisma: {
      ...client,
      $transaction: (arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: unknown) => unknown)(client) : Promise.all(arg as unknown[]),
    },
  };
});

import {
  authenticateAgencyDevice,
  generateDeviceKey,
  generateLinkCode,
  issueLinkCode,
  normalizeLinkCode,
  redeemLinkCode,
  revokeDeviceKey,
  sha256Hex,
} from "./flux-keys";

const NOW = new Date("2027-01-18T13:00:00Z");

beforeEach(() => {
  for (const f of [codeFindUnique, codeUpdateMany, codeUpdate, codeCreate, keyCount, keyCreate, keyFindUnique, keyFindMany, keyUpdateMany, memberCount]) f.mockReset();
  codeUpdateMany.mockResolvedValue({ count: 1 });
  codeCreate.mockResolvedValue({ id: 1 });
  codeUpdate.mockResolvedValue({});
  keyCount.mockResolvedValue(0);
  keyCreate.mockResolvedValue({ id: 33 });
  keyUpdateMany.mockResolvedValue({ count: 1 });
});

describe("códigos", () => {
  it("8 caracteres sin letras confusas, mostrados con guion, guardados con SHA-256", () => {
    const c = generateLinkCode();
    expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(c.display).toBe(`${c.code.slice(0, 4)}-${c.code.slice(4)}`);
    expect(c.hash).toBe(sha256Hex(c.code));
  });
  it("normaliza lo que tipea el fotógrafo y rechaza lo que no puede ser un código", () => {
    expect(normalizeLinkCode(" k7qm-4pxt ")).toBe("K7QM4PXT");
    expect(normalizeLinkCode("K7QM 4PXT")).toBe("K7QM4PXT");
    expect(normalizeLinkCode("K7QM-4PX0")).toBe(null); // 0 no está en el alfabeto
    expect(normalizeLinkCode("K7QM4PX")).toBe(null);
    expect(normalizeLinkCode(12345678)).toBe(null);
  });
  it("issueLinkCode anula los códigos vigentes sin usar y guarda sólo el hash, con 10 minutos", async () => {
    const r = await issueLinkCode(20, NOW);
    expect(codeUpdateMany).toHaveBeenCalledWith({
      where: { userId: 20, usedAt: null, expiresAt: { gt: NOW } },
      data: { expiresAt: NOW },
    });
    const data = codeCreate.mock.calls[0][0].data;
    expect(data.userId).toBe(20);
    expect(data.codeHash).toBe(sha256Hex(normalizeLinkCode(r.code) as string));
    expect(data.expiresAt.toISOString()).toBe("2027-01-18T13:10:00.000Z");
    expect(r.expiresAt.toISOString()).toBe("2027-01-18T13:10:00.000Z");
    expect(JSON.stringify(codeCreate.mock.calls[0][0])).not.toContain(normalizeLinkCode(r.code) as string);
  });
});

describe("redeemLinkCode", () => {
  const valid = { id: 5, userId: 20, usedAt: null, expiresAt: new Date("2027-01-18T13:05:00Z") };

  it("canje válido: crea la llave con su hash y devuelve la llave completa una vez", async () => {
    codeFindUnique.mockResolvedValue(valid);
    const r = await redeemLinkCode("K7QM-4PXT", "  Notebook   de Juan ", NOW);
    expect(codeFindUnique.mock.calls[0][0].where).toEqual({ codeHash: sha256Hex("K7QM4PXT") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.key).toMatch(/^clf_dev_[A-Za-z0-9_-]{43}$/);
    const data = keyCreate.mock.calls[0][0].data;
    expect(data).toEqual({ userId: 20, keyHash: sha256Hex(r.key), keyPrefix: r.key.slice(8, 16), label: "Notebook de Juan" });
    expect(codeUpdateMany).toHaveBeenCalledWith({ where: { id: 5, usedAt: null, expiresAt: { gt: NOW } }, data: { usedAt: NOW } });
    expect(codeUpdate).toHaveBeenCalledWith({ where: { id: 5 }, data: { deviceKeyId: 33 } });
    expect(r).toMatchObject({ deviceKeyId: 33, userId: 20 });
  });
  it("sin nombre de computadora usa 'Computadora'", async () => {
    codeFindUnique.mockResolvedValue(valid);
    await redeemLinkCode("K7QM4PXT", undefined, NOW);
    expect(keyCreate.mock.calls[0][0].data.label).toBe("Computadora");
  });
  it("vencido, usado, inexistente o mal formado: 400 sin crear llave", async () => {
    codeFindUnique.mockResolvedValue({ ...valid, expiresAt: new Date("2027-01-18T12:59:59Z") });
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    codeFindUnique.mockResolvedValue({ ...valid, usedAt: new Date() });
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    codeFindUnique.mockResolvedValue(null);
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    expect(await redeemLinkCode("hola", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    expect(keyCreate).not.toHaveBeenCalled();
  });
  it("dos canjes a la vez: el que pierde la marca de usado no crea llave", async () => {
    codeFindUnique.mockResolvedValue(valid);
    codeUpdateMany.mockResolvedValue({ count: 0 });
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    expect(keyCreate).not.toHaveBeenCalled();
  });
  it("con 10 computadoras vinculadas: 409 y el código NO se gasta", async () => {
    codeFindUnique.mockResolvedValue(valid);
    keyCount.mockResolvedValue(10);
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 409 });
    expect(codeUpdateMany).not.toHaveBeenCalled();
    expect(keyCreate).not.toHaveBeenCalled();
  });
});

describe("authenticateAgencyDevice", () => {
  const key = generateDeviceKey().key;
  it("sin encabezado, con otro formato o revocada: null", async () => {
    expect(await authenticateAgencyDevice(null)).toBe(null);
    expect(await authenticateAgencyDevice("Bearer fo_dev_abc")).toBe(null);
    keyFindUnique.mockResolvedValue({ id: 33, userId: 20, revokedAt: new Date(), user: { role: "PHOTOGRAPHER" } });
    expect(await authenticateAgencyDevice(`Bearer ${key}`)).toBe(null);
  });
  it("vigente: busca por hash y devuelve el usuario", async () => {
    keyFindUnique.mockResolvedValue({ id: 33, userId: 20, revokedAt: null, user: { role: "PHOTOGRAPHER" } });
    expect(await authenticateAgencyDevice(`Bearer ${key}`, NOW)).toEqual({ deviceKeyId: 33, userId: 20, role: "PHOTOGRAPHER" });
    expect(keyFindUnique.mock.calls[0][0].where).toEqual({ keyHash: sha256Hex(key) });
  });
});

describe("revokeDeviceKey", () => {
  it("sólo revoca una llave propia y vigente", async () => {
    expect(await revokeDeviceKey(20, 33)).toBe(true);
    expect(keyUpdateMany.mock.calls[0][0].where).toEqual({ id: 33, userId: 20, revokedAt: null });
    keyUpdateMany.mockResolvedValue({ count: 0 });
    expect(await revokeDeviceKey(20, 99)).toBe(false);
  });
});
