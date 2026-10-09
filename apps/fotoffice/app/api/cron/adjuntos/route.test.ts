import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ purgar: vi.fn(), purgarProy: vi.fn(), configurado: vi.fn() }));
vi.mock("@/lib/proyectos/adjuntos", () => ({ purgarAdjuntos: H.purgarProy }));
vi.mock("@/lib/ficha/adjuntos", () => ({ purgarAdjuntos: H.purgar }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ adjuntosR2Configurado: H.configurado }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const { POST, GET, maxDuration } = await import("./route");

function pedido(auth?: string) {
  return new Request("https://fotoffice.test/api/cron/adjuntos", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  H.purgar.mockReset().mockResolvedValue({ purgados: 2, pendientesLimpios: 1, fallidos: 0 });
  H.purgarProy.mockReset().mockResolvedValue({ purgados: 0, pendientesLimpios: 0, fallidos: 0 });
  H.configurado.mockReset().mockReturnValue(true);
  process.env.CRON_SECRET = "s3creto";
  delete process.env.FOTOFFICE_CRON_SECRET;
});

describe("cron de adjuntos", () => {
  it("maxDuration 300", () => expect(maxDuration).toBe(300));
  it("sin secreto → 401 y no purga", async () => {
    const r = await POST(pedido());
    expect(r.status).toBe(401);
    expect(H.purgar).not.toHaveBeenCalled();
  });
  it("secreto equivocado → 401", async () => {
    expect((await POST(pedido("Bearer otro"))).status).toBe(401);
    expect(H.purgar).not.toHaveBeenCalled();
  });
  it("sin CRON_SECRET configurado no entra nadie", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(pedido("Bearer s3creto"))).status).toBe(401);
  });
  it("con secreto purga y devuelve los números", async () => {
    const r = await GET(pedido("Bearer s3creto"));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, purgados: 2, pendientesLimpios: 1, fallidos: 0 });
    expect(H.purgar).toHaveBeenCalledTimes(1);
  });
  it("suma también lo purgado de los adjuntos de proyectos", async () => {
    H.purgarProy.mockResolvedValue({ purgados: 3, pendientesLimpios: 2, fallidos: 1 });
    const r = await GET(pedido("Bearer s3creto"));
    expect(await r.json()).toEqual({ ok: true, purgados: 5, pendientesLimpios: 3, fallidos: 1 });
  });
  it("bucket sin configurar → no hace nada", async () => {
    H.configurado.mockReturnValue(false);
    const r = await POST(pedido("Bearer s3creto"));
    expect(r.status).toBe(200);
    expect(H.purgar).not.toHaveBeenCalled();
  });
  it("si la purga revienta → 500 sin detalles", async () => {
    H.purgar.mockRejectedValue(new Error("db adjuntos/ws/x"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(pedido("Bearer s3creto"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("adjuntos/ws");
  });
});
