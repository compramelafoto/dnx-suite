import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
const H = vi.hoisted(() => ({
  db: {
    fotofficePrintOrder: {
      updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
      findFirst: vi.fn(async (..._a: unknown[]) => null as unknown),
    },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: H.db }));
const T = await import("./trabajo-servidor");
const ctx = { workspaceId: "ws", userId: 1, userLabel: "Dani", role: "OWNER" };
const orden = H.db.fotofficePrintOrder;

beforeEach(() => {
  vi.clearAllMocks();
  orden.updateMany.mockResolvedValue({ count: 1 });
  orden.findFirst.mockResolvedValue(null);
});

describe("reintentarEnvio", () => {
  it("vuelve a PAGADO un pedido sin enviar de la misma organización", async () => {
    expect(await T.reintentarEnvio(ctx, "ord1")).toEqual({ ok: true });
    expect(orden.updateMany).toHaveBeenCalledWith({
      where: { id: "ord1", workspaceId: "ws", status: "PAGADO_SIN_ENVIAR" },
      data: { status: "PAGADO", lastError: null, lockedAt: null },
    });
  });
  it("un pedido de otra organización o en otro estado no se toca", async () => {
    orden.updateMany.mockResolvedValue({ count: 0 });
    expect(await T.reintentarEnvio(ctx, "ord1")).toEqual({ ok: false, error: "Este pedido ya no está esperando un reintento." });
  });
  it("un id inválido ni se consulta", async () => {
    expect(await T.reintentarEnvio(ctx, "../x")).toEqual({ ok: false, error: "Pedido inválido." });
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
});

describe("pedidoDelTrabajo", () => {
  it("resume el pedido de impresión del trabajo: copias por tamaño, cobro, costo y ganancia", async () => {
    orden.findFirst.mockResolvedValue({
      id: "ord1", number: 8, status: "PAGADO_SIN_ENVIAR", lastError: "Fotolag no tiene correo cargado.", paper: "BRILLO",
      totalArs: "10000", costTotalArs: "4000.5",
      items: [
        { widthCm: "13", heightCm: "18", quantity: 2 },
        { widthCm: "18", heightCm: "13", quantity: 1 },
        { widthCm: "10", heightCm: "15", quantity: 3 },
      ],
    });
    const r = await T.pedidoDelTrabajo("ws", "p-f");
    expect(orden.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws", items: { some: { proyectoId: "p-f" } } } }));
    expect(r).toEqual({
      pedidoId: "ord1", numero: 8, estado: "PAGADO_SIN_ENVIAR", lastError: "Fotolag no tiene correo cargado.",
      copias: [{ tamano: "10x15", papel: "Brillo", cantidad: 3 }, { tamano: "13x18", papel: "Brillo", cantidad: 3 }],
      totalCents: 1000000, costoCents: 400050, gananciaCents: 599950,
    });
  });
  it("un trabajo que no viene de un pedido de impresión devuelve null", async () => {
    expect(await T.pedidoDelTrabajo("ws", "p-x")).toBeNull();
  });
});
