import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error { code = "P2002"; } },
}));

const { findOrCreateClient } = await import("./find-or-create");

const tx = {
  client: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  clientAudit: { create: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.client.findMany.mockResolvedValue([]);
  tx.client.findFirst.mockResolvedValue(null);
  tx.client.create.mockResolvedValue({ id: "c-nuevo" });
});

describe("findOrCreateClient — auditoría del alta", () => {
  it("al crear, escribe ClientAudit CREATED como Sistema en la misma transacción", async () => {
    const r = await findOrCreateClient(tx as never, { workspaceId: "ws-1", firstName: "Ana" });
    expect(r).toEqual({ id: "c-nuevo", created: true });
    expect(tx.clientAudit.create).toHaveBeenCalledWith({
      data: { workspaceId: "ws-1", clientId: "c-nuevo", action: "CREATED", actorUserId: null, actorLabel: "Sistema" },
    });
  });

  it("si se pasa un actor, queda registrado", async () => {
    await findOrCreateClient(tx as never, { workspaceId: "ws-1", firstName: "Ana" }, { userId: 7, label: "Lucía" });
    expect(tx.clientAudit.create.mock.calls[0][0].data).toMatchObject({ actorUserId: 7, actorLabel: "Lucía" });
  });

  it("si el cliente ya existía, no escribe auditoría", async () => {
    tx.client.findMany.mockResolvedValue([{ id: "c-viejo", docNumber: null, email: "a@b.com", phone: null }]);
    const r = await findOrCreateClient(tx as never, { workspaceId: "ws-1", email: "a@b.com" });
    expect(r).toEqual({ id: "c-viejo", created: false });
    expect(tx.clientAudit.create).not.toHaveBeenCalled();
  });
});
