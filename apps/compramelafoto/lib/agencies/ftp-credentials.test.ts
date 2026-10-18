import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const create = vi.fn();
const findUnique = vi.fn();
const queryRaw = vi.fn();
const tx = { $queryRaw: (...a: unknown[]) => queryRaw(...a), agencyUploadCredential: { updateMany, create, findUnique } };
const transaction = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyUploadCredential: { updateMany: (...a: unknown[]) => updateMany(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));
vi.mock("@/lib/camera-connection/camera-connection-service", () => ({
  generateFtpPassword: () => "abcd1234",
  hashFtpPassword: async (p: string) => `hash(${p})`,
}));

import { agencyFtpUsername, issueAgencyFtpCredential, revokeAgencyFtpCredentials } from "./ftp-credentials";

beforeEach(() => {
  for (const f of [updateMany, create, findUnique, transaction, queryRaw]) f.mockReset();
  transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  findUnique.mockResolvedValue(null);
  updateMany.mockResolvedValue({ count: 0 });
  create.mockResolvedValue({});
});

describe("agencyFtpUsername", () => {
  it("usa el id del miembro en base 36", () => {
    expect(agencyFtpUsername(7)).toBe("ag7");
    expect(agencyFtpUsername(71)).toBe("ag1z");
  });
});

describe("issueAgencyFtpCredential", () => {
  it("revoca las activas antes de crear y guarda sólo el hash", async () => {
    const out = await issueAgencyFtpCredential({ agencyId: 3, memberId: 7, albumId: 9 });
    expect(updateMany.mock.calls[0][0].where).toEqual({ memberId: 7, revokedAt: null });
    expect(updateMany.mock.calls[0][0].data.revokedAt).toBeInstanceOf(Date);
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(updateMany.mock.invocationCallOrder[0]);
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
    expect(create.mock.calls[0][0].data).toMatchObject({ agencyId: 3, memberId: 7, albumId: 9, ftpUsername: "ag7", ftpPasswordHash: "hash(abcd1234)" });
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain('"abcd1234"');
    expect(out).toEqual({ ftpUsername: "ag7", password: "abcd1234" });
    expect(out.password).toHaveLength(8);
  });
  it("si ag7 ya existe (revocado) usa ag7-2", async () => {
    findUnique.mockImplementation(async ({ where }: any) => (where.ftpUsername === "ag7" ? { id: 1 } : null));
    const out = await issueAgencyFtpCredential({ agencyId: 3, memberId: 7, albumId: 9 });
    expect(out.ftpUsername).toBe("ag7-2");
    expect(create.mock.calls[0][0].data.ftpUsername).toBe("ag7-2");
  });
});

describe("revokeAgencyFtpCredentials", () => {
  it("revoca las activas y devuelve cuántas", async () => {
    updateMany.mockResolvedValue({ count: 2 });
    expect(await revokeAgencyFtpCredentials(7)).toBe(2);
    expect(updateMany.mock.calls[0][0].where).toEqual({ memberId: 7, revokedAt: null });
  });
});
