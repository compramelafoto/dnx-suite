import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSvix } from "@/lib/mailing/svix";

const h = vi.hoisted(() => ({
  socios: "UNKNOWN" as "APPLIED" | "DUPLICATE" | "UNKNOWN",
  vendedor: vi.fn(async () => "APLICADO" as const),
}));
vi.mock("@/lib/mailing/webhook", () => ({ applyWebhookEvent: async () => h.socios }));
vi.mock("@/lib/agentes/vendedor/avisos", () => ({ aplicarAvisoVendedor: h.vendedor }));

const { POST } = await import("./route");

const SECRETO = `whsec_${Buffer.from("clave-de-prueba-123").toString("base64")}`;

const SECRETO_VENDEDOR = `whsec_${Buffer.from("otra-cuenta-de-resend-456").toString("base64")}`;

function pedido(secreto = SECRETO): Request {
  const body = JSON.stringify({ type: "email.bounced", created_at: "2026-11-20T15:00:00.000Z", data: { email_id: "re_1" } });
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request("https://fotoffice.com/api/webhooks/resend", {
    method: "POST",
    body,
    headers: { "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": `v1,${signSvix(secreto, "msg_1", ts, body)}` },
  });
}

beforeEach(() => {
  vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRETO);
  h.socios = "UNKNOWN";
  h.vendedor.mockReset();
  h.vendedor.mockResolvedValue("APLICADO");
});
afterEach(() => vi.unstubAllEnvs());

describe("webhook de estados de Resend", () => {
  it("un correo de una campaña a socios no pasa por el Vendedor", async () => {
    h.socios = "APPLIED";
    const r = await POST(pedido());
    expect(await r.json()).toEqual({ ok: true, result: "APPLIED" });
    expect(h.vendedor).not.toHaveBeenCalled();
  });

  it("un correo que no es de socios va al Vendedor", async () => {
    const r = await POST(pedido());
    expect(await r.json()).toEqual({ ok: true, result: "APLICADO" });
    expect(h.vendedor).toHaveBeenCalledWith(expect.objectContaining({ emailId: "re_1", field: "bouncedAt" }), expect.any(Date));
  });

  it("un error del Vendedor da 500 para que Resend reintente", async () => {
    h.vendedor.mockRejectedValue(new Error("base caída"));
    const r = await POST(pedido());
    expect(r.status).toBe(500);
  });

  it("acepta la firma del webhook de la otra cuenta del Vendedor (VENDEDOR_RESEND_WEBHOOK_SECRET)", async () => {
    expect((await POST(pedido(SECRETO_VENDEDOR))).status).toBe(401);
    vi.stubEnv("VENDEDOR_RESEND_WEBHOOK_SECRET", SECRETO_VENDEDOR);
    const r = await POST(pedido(SECRETO_VENDEDOR));
    expect(await r.json()).toEqual({ ok: true, result: "APLICADO" });
    expect((await POST(pedido())).status).toBe(200);
  });

  it("con sólo el secreto del Vendedor también anda; sin ninguno, 404", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    expect((await POST(pedido())).status).toBe(404);
    vi.stubEnv("VENDEDOR_RESEND_WEBHOOK_SECRET", SECRETO_VENDEDOR);
    expect((await POST(pedido(SECRETO_VENDEDOR))).status).toBe(200);
    expect((await POST(pedido())).status).toBe(401);
  });
});
