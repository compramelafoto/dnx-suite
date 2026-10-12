import { afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { systemSettings: { findUnique: (...a: unknown[]) => m.find(...a) } } }));
import { compradorHabilitado, leerPilotoCompradores, readBuyerBotConfig } from "./config";

afterEach(() => { vi.unstubAllEnvs(); m.find.mockReset(); });
describe("config de compradores", () => {
  it("necesita los dos interruptores", () => {
    vi.stubEnv("CLF_BOT_ENABLED", "1");
    expect(readBuyerBotConfig().enabled).toBe(false);
    vi.stubEnv("CLF_BOT_BUYERS_ENABLED", "1");
    expect(readBuyerBotConfig()).toMatchObject({ enabled: true, effort: "low", maxIterations: 5 });
  });
  it("el de compradores solo no alcanza", () => {
    vi.stubEnv("CLF_BOT_ENABLED", "");
    vi.stubEnv("CLF_BOT_BUYERS_ENABLED", " 1 ");
    expect(readBuyerBotConfig().enabled).toBe(false);
  });
  it("piloto por lista de álbumes; páginas sin álbum sólo con todos", async () => {
    m.find.mockResolvedValue({ isActive: true, value: JSON.stringify({ soloPiloto: true, albumIds: [3] }) });
    const a = await leerPilotoCompradores();
    expect(compradorHabilitado(a, 3)).toBe(true);
    expect(compradorHabilitado(a, 4)).toBe(false);
    expect(compradorHabilitado(a, null)).toBe(false);
    expect(compradorHabilitado({ todos: true }, null)).toBe(true);
    expect(compradorHabilitado(null, 3)).toBe(false);
    expect(m.find).toHaveBeenCalledWith({ where: { key: "dnx_bot_buyers_pilot" } });
  });
  it("soloPiloto false → todos", async () => {
    m.find.mockResolvedValueOnce({ isActive: true, value: JSON.stringify({ soloPiloto: false }) });
    expect(await leerPilotoCompradores()).toEqual({ todos: true });
  });
  it("sin fila, inactiva o JSON roto → apagado", async () => {
    m.find.mockResolvedValueOnce(null);
    expect(await leerPilotoCompradores()).toBeNull();
    m.find.mockResolvedValueOnce({ isActive: false, value: "{}" });
    expect(await leerPilotoCompradores()).toBeNull();
    m.find.mockResolvedValueOnce({ isActive: true, value: "{roto" });
    expect(await leerPilotoCompradores()).toBeNull();
  });
  it("error de lectura → apagado y avisa en consola", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    m.find.mockRejectedValueOnce(new Error("db"));
    expect(await leerPilotoCompradores()).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
