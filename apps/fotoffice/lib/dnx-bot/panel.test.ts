import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ resolver: vi.fn() }));
vi.mock("./acceso", () => ({ resolverBot: () => H.resolver() }));
import { botEnPanel } from "./panel";

beforeEach(() => {
  H.resolver.mockReset();
});

describe("botEnPanel", () => {
  it("con alguna puerta cerrada no se pinta nada", async () => {
    H.resolver.mockResolvedValue({ ok: false, motivo: "interruptor" });
    expect(await botEnPanel()).toBeNull();
  });
  it("abierto: los prefijos que la persona puede abrir", async () => {
    H.resolver.mockResolvedValue({ ok: true, ctx: { capacidades: { configurar: false, gestionarPresupuestos: false, verConsultas: true } } });
    const r = await botEnPanel();
    expect(r!.rutas).toContain("/presupuestos");
    expect(r!.rutas).toContain("/consultas");
    expect(r!.rutas).not.toContain("/workspace/configuracion/precios");
    expect(r!.capacidades).toEqual({ configurar: false, gestionarPresupuestos: false, verConsultas: true });
  });
  it("si algo falla, el panel sigue sin la burbuja", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    H.resolver.mockRejectedValue(new Error("db"));
    expect(await botEnPanel()).toBeNull();
    log.mockRestore();
  });
});
