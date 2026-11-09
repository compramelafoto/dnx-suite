import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ auth: vi.fn(), correr: vi.fn() }));
vi.mock("@/lib/security/cron-auth", () => ({ isAuthorizedCronRequest: H.auth }));
vi.mock("@/lib/agentes/vendedor/motor", () => ({ correrVendedor: H.correr }));

const R = await import("./route");
const req = () => new Request("https://x.test/api/cron/agente-vendedor", { headers: { authorization: "Bearer s" } });
const RESUMEN = { respuestas: 1, enviados: 2, recordatorios: 0, propuestos: 0, frenadoPor: null };

beforeEach(() => {
  H.auth.mockReset().mockReturnValue(true);
  H.correr.mockReset().mockResolvedValue(RESUMEN);
});

describe("cron del agente Vendedor", () => {
  it("sin autorización: 401 y no corre", async () => {
    H.auth.mockReturnValue(false);
    expect((await R.GET(req())).status).toBe(401);
    expect((await R.POST(req())).status).toBe(401);
    expect(H.correr).not.toHaveBeenCalled();
  });

  it("acepta el secreto del cron de Vercel y el propio de FOTOFFICE", async () => {
    await R.GET(req());
    expect(H.auth.mock.calls[0]![0]).toMatchObject({ authorizationHeader: "Bearer s" });
    expect(H.auth.mock.calls[0]![0].allowedSecrets).toHaveLength(2);
  });

  it("GET corre el motor con 240 s de presupuesto y devuelve el resumen", async () => {
    expect(await (await R.GET(req())).json()).toEqual({ ok: true, ...RESUMEN });
    expect(H.correr).toHaveBeenCalledWith({ presupuestoMs: 240_000, motivo: "CRON" });
  });

  it("maxDuration 300 y está en vercel.json cada 15 minutos", () => {
    expect(R.maxDuration).toBe(300);
    const cfg = JSON.parse(readFileSync(new URL("../../../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(cfg.crons.find((c) => c.path === "/api/cron/agente-vendedor")?.schedule).toBe("*/15 * * * *");
  });
});
