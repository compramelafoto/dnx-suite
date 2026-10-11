import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ ctx: vi.fn(), confirmar: vi.fn() }));
vi.mock("@/lib/galerias/contexto", () => ({ contextoDeGalerias: H.ctx }));
vi.mock("@/lib/galerias/fotos", () => ({ confirmarFoto: H.confirmar }));

const R = await import("./route");
const pedido = (cuerpo: unknown, tipo = "application/json") =>
  new Request("https://x.test/api/galerias/g1/fotos/confirmar", { method: "POST", headers: { "content-type": tipo }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) });
const params = { params: Promise.resolve({ id: "g1" }) };

beforeEach(() => {
  H.ctx.mockReset().mockResolvedValue({ workspaceId: "ws1", userId: 1 });
  H.confirmar.mockReset().mockResolvedValue({ ok: true });
});

describe("POST /api/galerias/[id]/fotos/confirmar", () => {
  it("exige Gestionar: sin contexto, 403 y no procesa nada", async () => {
    H.ctx.mockResolvedValue(null);
    const r = await R.POST(pedido({ fotoId: "f1" }), params);
    expect(r.status).toBe(403);
    expect(H.ctx).toHaveBeenCalledWith("operar");
    expect(H.confirmar).not.toHaveBeenCalled();
  });
  it("confirma con el workspace de la sesión", async () => {
    const r = await R.POST(pedido({ fotoId: "f1" }), params);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(H.confirmar).toHaveBeenCalledWith({ workspaceId: "ws1", userId: 1 }, "g1", "f1");
  });
  it("rechaza cuerpo que no es JSON y JSON roto", async () => {
    expect((await R.POST(pedido("fotoId=f1", "text/plain"), params)).status).toBe(415);
    expect((await R.POST(pedido("{", "application/json"), params)).status).toBe(400);
    expect(H.confirmar).not.toHaveBeenCalled();
  });
  it("devuelve el motivo si no se pudo", async () => {
    H.confirmar.mockResolvedValue({ ok: false, error: "La subida no se completó. Probá de nuevo." });
    const r = await R.POST(pedido({ fotoId: "f1" }), params);
    expect(r.status).toBe(422);
    expect((await r.json()).error).toContain("subida");
  });
  it("declara maxDuration 60", () => {
    expect(R.maxDuration).toBe(60);
  });
});
