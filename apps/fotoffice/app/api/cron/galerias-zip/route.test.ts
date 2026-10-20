import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ auth: vi.fn(), tarea: vi.fn(), r2: vi.fn() }));
vi.mock("@/lib/security/cron-auth", () => ({ isAuthorizedCronRequest: H.auth }));
vi.mock("@/lib/galerias/descargas", () => ({ procesarDescargas: H.tarea }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ adjuntosR2Configurado: H.r2 }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const R = await import("./route");
const req = () => new Request("https://x.test/api/cron/galerias-zip", { headers: { authorization: "Bearer s" } });
const RESUMEN = { vencidas: 1, tomada: "d1", parteArmada: 1, terminada: false, fallo: false, avisadas: 0 };

beforeEach(() => {
  H.auth.mockReset().mockReturnValue(true);
  H.r2.mockReset().mockReturnValue(true);
  H.tarea.mockReset().mockResolvedValue(RESUMEN);
});

describe("cron de descargas completas de galerías", () => {
  it("sin autorización: 401 y no hace nada", async () => {
    H.auth.mockReturnValue(false);
    expect((await R.GET(req())).status).toBe(401);
    expect((await R.POST(req())).status).toBe(401);
    expect(H.tarea).not.toHaveBeenCalled();
  });
  it("acepta el secreto del cron de Vercel y el propio de FOTOFFICE", async () => {
    await R.GET(req());
    expect(H.auth.mock.calls[0]![0]).toMatchObject({ authorizationHeader: "Bearer s" });
    expect(H.auth.mock.calls[0]![0].allowedSecrets).toHaveLength(2);
  });
  it("GET y POST corren la misma tarea", async () => {
    expect(await (await R.GET(req())).json()).toEqual({ ok: true, ...RESUMEN });
    expect((await R.POST(req())).status).toBe(200);
    expect(H.tarea).toHaveBeenCalledTimes(2);
  });
  it("sin R2 configurado se omite", async () => {
    H.r2.mockReturnValue(false);
    expect((await (await R.GET(req())).json()).omitido).toBeTruthy();
    expect(H.tarea).not.toHaveBeenCalled();
  });
  it("si falla, 500 sin detalles", async () => {
    H.tarea.mockRejectedValue(new Error("secreto interno"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await R.GET(req());
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secreto");
  });
  it("maxDuration 300 y está en vercel.json cada 5 minutos", () => {
    expect(R.maxDuration).toBe(300);
    const cfg = JSON.parse(readFileSync(new URL("../../../../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(cfg.crons.find((c) => c.path === "/api/cron/galerias-zip")?.schedule).toBe("*/5 * * * *");
  });
});
