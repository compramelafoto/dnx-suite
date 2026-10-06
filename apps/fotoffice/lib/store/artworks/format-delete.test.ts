import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMany, updateMany } = vi.hoisted(() => ({ deleteMany: vi.fn(), updateMany: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: { printFormat: { deleteMany, updateMany } } }));

import { deleteOrDeactivatePrintFormat } from "./format-delete";

beforeEach(() => vi.clearAllMocks());

describe("deleteOrDeactivatePrintFormat", () => {
  it("sin pedidos: borra con una sola sentencia condicional y acotada al workspace", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteOrDeactivatePrintFormat("w1", "f1")).toBe("deleted");
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "f1", workspaceId: "w1", orderItems: { none: {} } } });
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("con pedidos: no borra, desactiva", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    updateMany.mockResolvedValue({ count: 1 });
    expect(await deleteOrDeactivatePrintFormat("w1", "f1")).toBe("deactivated");
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "f1", workspaceId: "w1" }, data: { isActive: false } });
  });
  it("no existe o es de otro workspace", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    updateMany.mockResolvedValue({ count: 0 });
    expect(await deleteOrDeactivatePrintFormat("w1", "f9")).toBe("not_found");
  });
});
