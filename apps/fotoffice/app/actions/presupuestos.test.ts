import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ guardar: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/presupuestos/contexto", () => ({ contextoDePresupuestos: async () => ({ workspaceId: "ws-1", userId: 1 }) }));
vi.mock("@/lib/presupuestos/presupuestos", () => ({
  guardarBorrador: (...a: unknown[]) => H.guardar(...a),
  crearPresupuesto: vi.fn(),
  marcarVencidos: vi.fn(),
  rechazarPresupuesto: vi.fn(),
}));
vi.mock("@/lib/presupuestos/ajustes", () => ({ guardarAjustes: vi.fn() }));
vi.mock("@/lib/presupuestos/versiones", () => ({ crearNuevaVersion: vi.fn() }));
vi.mock("@/lib/presupuestos/envio", () => ({ enviarPresupuesto: vi.fn() }));

const { guardarBorradorAction } = await import("./presupuestos");

beforeEach(() => {
  H.guardar.mockReset().mockResolvedValue({ ok: true });
  H.revalidate.mockReset();
});

describe("guardarBorradorAction: control de concurrencia del editor", () => {
  it("pasa la versión y la firma que tenía el editor", async () => {
    await guardarBorradorAction({ presupuestoId: "p1", items: [], control: { version: "2026-10-12T15:00:00.123Z", firma: "a-1" } });
    expect(H.guardar.mock.calls[0]![4]).toEqual({ version: new Date("2026-10-12T15:00:00.123Z"), firma: "a-1" });
  });
  it("sin control guarda como siempre", async () => {
    await guardarBorradorAction({ presupuestoId: "p1", items: [] });
    expect(H.guardar.mock.calls[0]![4]).toBeUndefined();
  });
  it("un control mal formado no guarda", async () => {
    expect((await guardarBorradorAction({ presupuestoId: "p1", items: [], control: { version: "ayer", firma: "a" } })).ok).toBe(false);
    expect((await guardarBorradorAction({ presupuestoId: "p1", items: [], control: { version: "2026-10-12T15:00:00.000Z", firma: 3 } as never })).ok).toBe(false);
    expect(H.guardar).not.toHaveBeenCalled();
  });
  it("si el borrador cambió, devuelve el aviso sin revalidar", async () => {
    H.guardar.mockResolvedValue({ ok: false, error: "El presupuesto cambió mientras lo tenías abierto" });
    expect(await guardarBorradorAction({ presupuestoId: "p1", items: [] })).toEqual({ ok: false, error: "El presupuesto cambió mientras lo tenías abierto" });
    expect(H.revalidate).not.toHaveBeenCalled();
  });
});
