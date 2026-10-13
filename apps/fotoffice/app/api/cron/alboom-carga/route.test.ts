import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ auth: vi.fn(), tarea: vi.fn() }));
vi.mock("@/lib/security/cron-auth", () => ({ isAuthorizedCronRequest: H.auth }));
vi.mock("@/lib/alboom/carga/servidor", () => ({ correrCargasAlboom: H.tarea }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const R = await import("./route");
const req = () => new Request("https://x.test/api/cron/alboom-carga", { headers: { authorization: "Bearer s" } });
const RESULTADOS = [{ cargaId: "c1", workspaceId: "ws-1", resultado: "PAUSADA" }];

beforeEach(() => {
  H.auth.mockReset().mockReturnValue(true);
  H.tarea.mockReset().mockResolvedValue(RESULTADOS);
});

describe("cron de la carga desde Alboom", () => {
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
  it("GET y POST corren la misma tanda y devuelven sólo ids y resultados", async () => {
    expect(await (await R.GET(req())).json()).toEqual({ ok: true, resultados: RESULTADOS });
    expect((await R.POST(req())).status).toBe(200);
    expect(H.tarea).toHaveBeenCalledTimes(2);
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
    expect(cfg.crons.find((c) => c.path === "/api/cron/alboom-carga")?.schedule).toBe("*/5 * * * *");
  });
});
