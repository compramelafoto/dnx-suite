import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `reverseMovementAction` (Caja) de punta a punta con la base simulada: un cobro de pedido y la
 * anulación de un cobro no se anulan desde Caja, y en ese caso no se escribe nada.
 */
const H = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  shiftFindFirst: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));
vi.mock("@/lib/cash/access", () => ({
  requireCashOperator: async () => ({ workspace: { id: "ws-1" }, user: { id: 7 } }),
  requireCashConfigurer: async () => ({ workspace: { id: "ws-1" }, user: { id: 7 } }),
  requireCashViewer: async () => ({ workspace: { id: "ws-1" }, user: { id: 7 } }),
}));
vi.mock("@/lib/governance/money-server", () => ({ canHandleProjectMoney: vi.fn() }));
vi.mock("@/lib/governance/events", () => ({ recordProjectEvent: vi.fn() }));
vi.mock("@/lib/rubros/repositorio", () => ({ escribirPerfilRubro: vi.fn(), validarPerfilRubro: vi.fn() }));
vi.mock("@/lib/rubros/semilla", () => ({ sembrarPlanDnx: vi.fn() }));
vi.mock("@repo/db", () => {
  const prisma = {
    cashMovement: {
      findFirst: (...a: unknown[]) => H.findFirst(...a),
      create: (...a: unknown[]) => H.create(...a),
    },
    cashShift: { findFirst: (...a: unknown[]) => H.shiftFindFirst(...a) },
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma, Prisma: {} };
});

const { reverseMovementAction } = await import("@/app/(shell)/caja/actions");

function original(o: { sourceModule: string; reverses: { sourceModule: string } | null }) {
  return {
    id: "m1",
    kind: "EGRESO",
    amountArs: "1000.00",
    accountId: "c1",
    categoryId: null,
    paymentMethod: "EFECTIVO",
    clientId: null,
    description: "Anulación de: Cobro",
    reversedBy: null,
    transferId: null,
    ...o,
  };
}

async function anular(): Promise<string> {
  const fd = new FormData();
  fd.set("movementId", "m1");
  fd.set("reverseReason", "me equivoqué");
  try {
    await reverseMovementAction(fd);
  } catch (e) {
    return (e as { url: string }).url;
  }
  throw new Error("la acción siempre redirige");
}

beforeEach(() => {
  H.findFirst.mockReset();
  H.create.mockReset();
  H.shiftFindFirst.mockReset().mockResolvedValue(null);
});

describe("reverseMovementAction", () => {
  it("rechaza deshacer la anulación de un cobro de pedido y no escribe", async () => {
    H.findFirst.mockResolvedValue(original({ sourceModule: "manual", reverses: { sourceModule: "pedidos" } }));
    const url = await anular();
    expect(decodeURIComponent(url)).toContain("error=Este cobro se anula desde el pedido.");
    expect(H.create).not.toHaveBeenCalled();
    // Trae el origen del movimiento anulado para poder decidirlo.
    expect(H.findFirst.mock.calls[0][0].select.reverses).toEqual({ select: { sourceModule: true } });
  });

  it("rechaza anular el ingreso de un cobro de pedido", async () => {
    H.findFirst.mockResolvedValue(original({ sourceModule: "pedidos", reverses: null }));
    expect(decodeURIComponent(await anular())).toContain("error=Este cobro se anula desde el pedido.");
    expect(H.create).not.toHaveBeenCalled();
  });

  it("una anulación manual de otro origen sí se deshace", async () => {
    H.findFirst.mockResolvedValue(original({ sourceModule: "manual", reverses: { sourceModule: "manual" } }));
    expect(await anular()).toBe("/caja/movimientos?ok=1");
    expect(H.create).toHaveBeenCalledTimes(1);
    expect(H.create.mock.calls[0][0].data).toMatchObject({ reversesMovementId: "m1", kind: "INGRESO" });
  });
});
