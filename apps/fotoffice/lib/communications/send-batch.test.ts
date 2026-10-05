import { describe, expect, it, vi } from "vitest";
import { sendBatchEmails, sendTransactionalEmail } from "./send-email";

const ENV = {
  RESEND_API_KEY: "re_supersecret_value_0123456789",
  FOTOFFICE_NOTIFICATIONS_FROM: "FOTOFFICE <avisos@mail.fotoffice.com>",
};

const msg = (to: string) => ({
  to,
  subject: "Asunto",
  html: "<p>hola</p>",
  text: "hola",
  sender: { name: "SFPR", replyTo: "sfprosario@gmail.com" },
  headers: { "List-Unsubscribe": "<https://fotoffice.com/api/correo/baja?t=x>" },
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("remitente de la institución en el envío suelto", () => {
  it("nombre de la institución, misma casilla y reply-to", async () => {
    const fetchImpl = vi.fn(async () => json(200, { id: "e1" }));
    await sendTransactionalEmail(msg("a@b.com"), { env: ENV, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe('"SFPR" <avisos@mail.fotoffice.com>');
    expect(body.reply_to).toEqual(["sfprosario@gmail.com"]);
    expect(body.headers["List-Unsubscribe"]).toContain("correo/baja");
  });

  it("sin remitente de institución queda como siempre", async () => {
    const fetchImpl = vi.fn(async () => json(200, { id: "e1" }));
    await sendTransactionalEmail({ to: "a@b.com", subject: "s", html: "h", text: "t" }, { env: ENV, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe("FOTOFFICE <avisos@mail.fotoffice.com>");
    expect(body.reply_to).toBeUndefined();
    expect(body.headers).toBeUndefined();
  });
});

describe("envío de a tandas", () => {
  it("manda un arreglo, con clave de idempotencia, y devuelve los ids en orden", async () => {
    const fetchImpl = vi.fn(async () => json(200, { data: [{ id: "x1" }, { id: "x2" }] }));
    const r = await sendBatchEmails([msg("a@b.com"), msg("c@d.com")], { idempotencyKey: "k1" }, { env: ENV, fetchImpl });
    expect(r).toEqual({ status: "SENT", providerIds: ["x1", "x2"] });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails/batch");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
    const body = JSON.parse(String(init.body));
    expect(body).toHaveLength(2);
    expect(body[1].to).toEqual(["c@d.com"]);
  });

  it("vacío no llama al proveedor; más de 100 se rechaza", async () => {
    const fetchImpl = vi.fn();
    expect(await sendBatchEmails([], {}, { env: ENV, fetchImpl })).toEqual({ status: "SENT", providerIds: [] });
    const r = await sendBatchEmails(Array.from({ length: 101 }, (_, i) => msg(`a${i}@b.com`)), {}, { env: ENV, fetchImpl });
    expect(r.status).toBe("INTERNAL_ERROR");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rechazo del proveedor sin filtrar la clave", async () => {
    const fetchImpl = vi.fn(async () => json(422, { name: "validation_error", message: `mala clave ${ENV.RESEND_API_KEY}` }));
    const r = await sendBatchEmails([msg("a@b.com")], {}, { env: ENV, fetchImpl });
    expect(r.status).toBe("PROVIDER_REJECTED");
    if (r.status !== "PROVIDER_REJECTED") return;
    expect(r.detail).toContain("HTTP 422");
    expect(r.detail).not.toContain(ENV.RESEND_API_KEY);
  });

  it("sin configuración no intenta mandar", async () => {
    const fetchImpl = vi.fn();
    const r = await sendBatchEmails([msg("a@b.com")], {}, { env: {}, fetchImpl });
    expect(r.status).toBe("CONFIGURATION_ERROR");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
