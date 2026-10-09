import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ correr: vi.fn() }));
vi.mock("@/lib/contratos/recordatorios", () => ({ correrContratosDiario: H.correr }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const { POST, GET, maxDuration } = await import("./route");

const REPORTE = {
  organizaciones: 1,
  recordatorios: { enviados: 2, fallidos: 0, salteados: 1, conTopeDiario: 0, topeCorrida: false },
  pdfs: { revisados: 1, generados: 1, enviados: 1, fallidos: 0 },
};

function pedido(auth?: string) {
  return new Request("https://fotoffice.test/api/cron/contratos-recordatorios", { method: "POST", headers: auth ? { authorization: auth } : {} });
}

beforeEach(() => {
  H.correr.mockReset().mockResolvedValue(REPORTE);
  process.env.CRON_SECRET = "s3creto";
  delete process.env.FOTOFFICE_CRON_SECRET;
});

describe("cron diario de contratos (recordatorios y PDF pendiente)", () => {
  it("maxDuration 300, como los otros crons", () => expect(maxDuration).toBe(300));

  it("sin secreto o con otro → 401 y no corre", async () => {
    expect((await POST(pedido())).status).toBe(401);
    expect((await POST(pedido("Bearer otro"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await POST(pedido("Bearer s3creto"))).status).toBe(401);
    expect(H.correr).not.toHaveBeenCalled();
  });

  it("con FOTOFFICE_CRON_SECRET también entra", async () => {
    delete process.env.CRON_SECRET;
    process.env.FOTOFFICE_CRON_SECRET = "otro-secreto";
    expect((await GET(pedido("Bearer otro-secreto"))).status).toBe(200);
  });

  it("con secreto corre y devuelve sólo contadores", async () => {
    const r = await GET(pedido("Bearer s3creto"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ...REPORTE });
    expect(H.correr).toHaveBeenCalledTimes(1);
  });

  it("si falla → 500 sin detalle", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    H.correr.mockRejectedValue(new Error("caída"));
    const r = await POST(pedido("Bearer s3creto"));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, error: "falló la tarea de contratos" });
  });

  it("está en vercel.json todos los días a las 13:00 UTC (10:00 de Buenos Aires)", () => {
    const vercel = JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "..", "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(vercel.crons).toContainEqual({ path: "/api/cron/contratos-recordatorios", schedule: "0 13 * * *" });
  });
});
