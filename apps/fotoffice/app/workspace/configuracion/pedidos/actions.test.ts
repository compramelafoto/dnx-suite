import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acción de Configuración → Pedidos con `guardarAjustesPedidos` real y la base simulada. */
const H = vi.hoisted(() => ({
  role: vi.fn(),
  revalidate: vi.fn(),
  upsert: vi.fn(async (_datos: unknown) => ({ id: "a1" })),
  updateMany: vi.fn(async () => ({ count: 1 })),
  categoria: vi.fn(async (_a: unknown): Promise<{ id: string } | null> => ({ id: "ing" })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficePedidoAjustes: { upsert: H.upsert, updateMany: H.updateMany, findUnique: vi.fn() },
    cashCategory: { findFirst: H.categoria },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: "ws-1", name: "Estudio" },
    role: H.role(),
  })),
}));

const A = await import("./actions");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

const VALIDO = { recordatorioDias: "2", recordatorioActivo: "1", rubroIngresoId: "ing" };

describe("guardarAjustesPedidosAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.role.mockReturnValue("WORKSPACE_OWNER");
    H.categoria.mockResolvedValue({ id: "ing" });
  });

  it("sin `configurar` no escribe nada", async () => {
    H.role.mockReturnValue("WORKSPACE_MEMBER");
    const r = await A.guardarAjustesPedidosAction(undefined, fd(VALIDO));
    expect(r.error).toMatch(/dueño o un administrador/);
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("guarda en el workspace de la sesión y revalida la pantalla", async () => {
    const r = await A.guardarAjustesPedidosAction(undefined, fd({ ...VALIDO, workspaceId: "otro" }));
    expect(r).toEqual({ error: null, ok: "Ajustes guardados." });
    const arg = H.upsert.mock.calls[0]![0] as { where: { workspaceId: string }; update: Record<string, unknown> };
    expect(arg.where.workspaceId).toBe("ws-1");
    expect(arg.update).toEqual({ reminderDays: 2, reminderEnabled: true, incomeCategoryId: "ing" });
    expect(H.categoria.mock.calls[0]![0]).toMatchObject({ where: { id: "ing", workspaceId: "ws-1", kind: "INGRESO" } });
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/pedidos");
  });

  it("sin tildar queda apagado y sin rubro queda null", async () => {
    await A.guardarAjustesPedidosAction(undefined, fd({ recordatorioDias: "0", rubroIngresoId: "" }));
    const arg = H.upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect(arg.update).toEqual({ reminderDays: 0, reminderEnabled: false, incomeCategoryId: null });
  });

  it("rechaza días fuera de rango, que faltan, o un rubro ajeno", async () => {
    for (const malo of [{ recordatorioDias: "31" }, { recordatorioDias: "-1" }, { recordatorioDias: "x" }]) {
      expect((await A.guardarAjustesPedidosAction(undefined, fd({ ...VALIDO, ...malo }))).error, JSON.stringify(malo)).toBeTruthy();
    }
    expect((await A.guardarAjustesPedidosAction(undefined, fd({ recordatorioActivo: "1" }))).error).toBe("Los datos no son válidos.");
    H.categoria.mockResolvedValue(null);
    expect((await A.guardarAjustesPedidosAction(undefined, fd(VALIDO))).error).toBe("Elegí un rubro de ingreso de Caja.");
    expect(H.upsert).not.toHaveBeenCalled();
  });
});
