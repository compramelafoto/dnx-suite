import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ auth: vi.fn(), tarea: vi.fn(), r2: vi.fn() }));
vi.mock("@/lib/security/cron-auth", () => ({ isAuthorizedCronRequest: H.auth }));
vi.mock("@/lib/galerias/fotos", () => ({ reintentarYLimpiarFotos: H.tarea }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ adjuntosR2Configurado: H.r2 }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const R = await import("./route");
const req = () => new Request("https://x.test/api/cron/galerias", { headers: { authorization: "Bearer s" } });

beforeEach(() => {
  H.auth.mockReset().mockReturnValue(true);
  H.r2.mockReset().mockReturnValue(true);
  H.tarea.mockReset().mockResolvedValue({ procesadas: 2, fallidas: 0, limpiadas: 1, pendientes: 0 });
});

describe("cron de galerías", () => {
  it("sin autorización: 401 y no hace nada", async () => {
    H.auth.mockReturnValue(false);
    expect((await R.GET(req())).status).toBe(401);
    expect(H.tarea).not.toHaveBeenCalled();
  });
  it("GET y POST corren la misma tarea", async () => {
    expect(await (await R.GET(req())).json()).toEqual({ ok: true, procesadas: 2, fallidas: 0, limpiadas: 1, pendientes: 0 });
    expect((await R.POST(req())).status).toBe(200);
    expect(H.tarea).toHaveBeenCalledTimes(2);
  });
  it("sin R2 configurado se omite", async () => {
    H.r2.mockReturnValue(false);
    expect((await (await R.GET(req())).json()).omitido).toBeTruthy();
    expect(H.tarea).not.toHaveBeenCalled();
  });
  it("si falla, 500", async () => {
    H.tarea.mockRejectedValue(new Error("x"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await R.GET(req())).status).toBe(500);
  });
  it("maxDuration 300", () => expect(R.maxDuration).toBe(300));
});
