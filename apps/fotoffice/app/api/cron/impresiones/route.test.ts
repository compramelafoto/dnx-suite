import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ procesar: vi.fn(), configurado: vi.fn() }));
vi.mock("@/lib/impresiones/preparar-servidor", () => ({ procesarPedidosDeImpresion: H.procesar }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ adjuntosR2Configurado: H.configurado }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const { POST } = await import("./route");

const pedido = (auth?: string) =>
  new Request("https://fotoffice.test/api/cron/impresiones", { method: "POST", headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  H.procesar.mockReset().mockResolvedValue({ procesados: 0, enviados: 0, fallidos: 0 });
  H.configurado.mockReset().mockReturnValue(true);
  process.env.CRON_SECRET = "s3creto";
  delete process.env.FOTOFFICE_CRON_SECRET;
});

describe("cron de impresiones", () => {
  it("con almacenamiento concilia y prepara", async () => {
    const r = await POST(pedido("Bearer s3creto"));
    expect(r.status).toBe(200);
    expect(H.procesar).toHaveBeenCalledWith({}, { preparar: true });
  });
  it("sin almacenamiento igual concilia los pagos (sólo saltea la preparación)", async () => {
    H.configurado.mockReturnValue(false);
    const r = await POST(pedido("Bearer s3creto"));
    expect(H.procesar).toHaveBeenCalledWith({}, { preparar: false });
    expect(await r.json()).toMatchObject({ ok: true, omitido: "preparación: almacenamiento sin configurar" });
  });
  it("sin autorización no hace nada", async () => {
    expect((await POST(pedido())).status).toBe(401);
    expect(H.procesar).not.toHaveBeenCalled();
  });
});
