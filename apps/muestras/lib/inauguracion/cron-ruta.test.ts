import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limpieza = vi.hoisted(() => ({ barrerAsistenciasVencidas: vi.fn() }));
vi.mock("@/lib/inauguracion/limpieza", () => limpieza);
const { GET } = await import("@/app/api/cron/asistencias/route");

const pedir = (auth?: string) => GET(new Request("http://localhost:3014/api/cron/asistencias", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  vi.clearAllMocks();
  limpieza.barrerAsistenciasVencidas.mockResolvedValue(3);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/asistencias", () => {
  it("sin CRON_SECRET → 503 y no borra nada", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await pedir("Bearer x")).status).toBe(503);
    expect(limpieza.barrerAsistenciasVencidas).not.toHaveBeenCalled();
  });
  it("llave equivocada → 401", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
    expect((await pedir("Bearer otra")).status).toBe(401);
    expect((await pedir()).status).toBe(401);
    expect(limpieza.barrerAsistenciasVencidas).not.toHaveBeenCalled();
  });
  it("correcta → 200 con la cantidad de muestras", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
    const r = await pedir("Bearer secreto-de-prueba");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ muestras: 3 });
    expect(limpieza.barrerAsistenciasVencidas).toHaveBeenCalledWith(expect.any(Date), { tope: 500 });
  });
});
