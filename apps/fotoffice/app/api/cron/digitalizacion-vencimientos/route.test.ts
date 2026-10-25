import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ seguir: vi.fn() }));
vi.mock("@/lib/digitalizacion/servidor/entregas", () => ({ recordatoriosYVencimientos: H.seguir }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const { POST, GET, maxDuration } = await import("./route");

const REPORTE = { revisadas: 3, enviadas: 1 };

function pedido(auth?: string) {
  return new Request("https://fotoffice.test/api/cron/digitalizacion-vencimientos", { method: "POST", headers: auth ? { authorization: auth } : {} });
}

beforeEach(() => {
  H.seguir.mockReset().mockResolvedValue(REPORTE);
  process.env.CRON_SECRET = "s3creto";
  delete process.env.FOTOFFICE_CRON_SECRET;
});

describe("cron de recordatorios y vencimiento de videos (10:00 de Buenos Aires = 13:00 UTC)", () => {
  it("maxDuration 300, como los otros crons", () => expect(maxDuration).toBe(300));

  it("sin secreto o con otro → 401 y no corre", async () => {
    expect((await POST(pedido())).status).toBe(401);
    expect((await POST(pedido("Bearer otro"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await POST(pedido("Bearer s3creto"))).status).toBe(401);
    expect(H.seguir).not.toHaveBeenCalled();
  });

  it("con secreto corre y devuelve sólo contadores", async () => {
    const r = await GET(pedido("Bearer s3creto"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ...REPORTE });
    expect(H.seguir).toHaveBeenCalledTimes(1);
  });

  it("si falla → 500 sin detalle", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    H.seguir.mockRejectedValue(new Error("caída"));
    const r = await POST(pedido("Bearer s3creto"));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, error: "fallaron los recordatorios" });
  });

  it("está en vercel.json con su horario", () => {
    const vercel = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "..", "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(vercel.crons).toContainEqual({ path: "/api/cron/digitalizacion-vencimientos", schedule: "0 13 * * *" });
  });
});
