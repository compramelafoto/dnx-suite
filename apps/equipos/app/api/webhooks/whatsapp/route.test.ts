import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: { phoneVerification: { findFirst: m.findFirst, update: m.update } },
}));

import { GET, POST } from "./route";

const SECRET = "app-secret";
const firmar = (b: string) => "sha256=" + createHmac("sha256", SECRET).update(b).digest("hex");
const payload = (from: string, text: string) =>
  JSON.stringify({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "1" },
              messages: [{ id: "wamid.1", from, timestamp: "1", type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  });
const pedido = (body: string, sig?: string) =>
  new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    body,
    headers: sig ? { "x-hub-signature-256": sig } : {},
  });
const pendiente = (over = {}) => ({
  id: 7,
  userId: 1,
  phone: "543415551234",
  code: "EQ-123456",
  codeExpiresAt: new Date(Date.now() + 5 * 60_000),
  verifiedAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET);
  vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "tok");
  m.update.mockResolvedValue({});
});

describe("GET", () => {
  it("verifica el token", async () => {
    const ok = await GET(new Request("http://x/?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=abc"));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("abc");
    const mal = await GET(new Request("http://x/?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=abc"));
    expect(mal.status).toBe(403);
  });
});

describe("POST", () => {
  it("firma inválida -> 401 y sin lecturas ni escrituras", async () => {
    const body = payload("5493415551234", "EQ-123456");
    for (const sig of [undefined, "sha256=abc", "sha256=" + "0".repeat(64)]) {
      expect((await POST(pedido(body, sig))).status).toBe(401);
    }
    expect(m.findFirst).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });

  it("código y número correctos -> marca verifiedAt", async () => {
    m.findFirst.mockResolvedValue(pendiente());
    const body = payload("5493415551234", "hola EQ-123456");
    const res = await POST(pedido(body, firmar(body)));
    expect(res.status).toBe(200);
    expect(m.findFirst).toHaveBeenCalledTimes(1);
    const where = m.findFirst.mock.calls[0][0].where;
    expect(where.code).toBe("EQ-123456");
    expect(where.verifiedAt).toBeNull();
    expect(where.codeExpiresAt.gt).toBeInstanceOf(Date);
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.update.mock.calls[0][0].where).toEqual({ id: 7 });
    expect(m.update.mock.calls[0][0].data.verifiedAt).toBeInstanceOf(Date);
  });

  it("código desde otro número -> 200 sin marcar", async () => {
    m.findFirst.mockResolvedValue(pendiente());
    const body = payload("5493419999999", "EQ-123456");
    expect((await POST(pedido(body, firmar(body)))).status).toBe(200);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("vencido o sin fila -> 200 sin marcar", async () => {
    const body = payload("5493415551234", "EQ-123456");
    m.findFirst.mockResolvedValue(pendiente({ codeExpiresAt: new Date(Date.now() - 1000) }));
    expect((await POST(pedido(body, firmar(body)))).status).toBe(200);
    m.findFirst.mockResolvedValue(null);
    expect((await POST(pedido(body, firmar(body)))).status).toBe(200);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("mensaje sin código -> 200 sin consultar", async () => {
    const body = payload("5493415551234", "hola");
    expect((await POST(pedido(body, firmar(body)))).status).toBe(200);
    expect(m.findFirst).not.toHaveBeenCalled();
  });
});
