import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ create: vi.fn(), rl: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { privacyRequest: { create: (...a: unknown[]) => m.create(...a) } },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => m.rl(...a) }));
vi.mock("@/emails/send", () => ({ sendEmail: (...a: unknown[]) => m.mail(...a) }));
import { POST } from "./route";
import type { NextRequest } from "next/server";

const BODY = {
  type: "OCULTAR_FOTO",
  fullName: "Juana Pérez",
  email: "juana@mail.com",
  albumId: "10",
  photoId: 99,
  isRepresentative: true,
};
const req = (body: string) =>
  new Request("http://x/api/privacy-requests", {
    method: "POST",
    body,
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "UA", referer: "https://x/privacidad" },
  }) as unknown as NextRequest;

const envOriginal = process.env.RESEND_API_KEY;
beforeEach(() => {
  m.create.mockReset();
  m.rl.mockReset();
  m.mail.mockReset();
  m.rl.mockReturnValue({ allowed: true });
  m.create.mockResolvedValue({ id: 12 });
  delete process.env.RESEND_API_KEY;
});
afterEach(() => {
  if (envOriginal === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = envOriginal;
});

describe("POST /api/privacy-requests", () => {
  it("rate limit → 429 con la clave por IP", async () => {
    m.rl.mockReturnValue({ allowed: false });
    const r = await POST(req(JSON.stringify(BODY)));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "Demasiadas solicitudes. Intentá más tarde." });
    expect(m.rl).toHaveBeenCalledWith({ key: "privacy-request:1.2.3.4", limit: 5, windowMs: 3600000 });
  });
  it("cuerpo no JSON → 400 «Cuerpo inválido»", async () => {
    const r = await POST(req("{no"));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Cuerpo inválido" });
  });
  it("body inválido → 400 con el texto de zod", async () => {
    const r = await POST(req(JSON.stringify({ ...BODY, isRepresentative: false })));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Debés declarar ser titular o representante" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("válido → crea RECEIVED con metadata y responde el ticket, sin mail si no hay RESEND_API_KEY", async () => {
    const r = await POST(req(JSON.stringify(BODY)));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      success: true,
      ticketId: 12,
      message: "Solicitud recibida. Ticket #12. Revisá tu email para la confirmación.",
    });
    expect(m.create).toHaveBeenCalledWith({
      data: {
        type: "OCULTAR_FOTO",
        fullName: "Juana Pérez",
        email: "juana@mail.com",
        phone: undefined,
        relationship: "TITULAR",
        description: undefined,
        albumId: 10,
        photoId: 99,
        status: "RECEIVED",
        metadata: { ip: "1.2.3.4", userAgent: "UA", sourcePage: "https://x/privacidad" },
      },
    });
    expect(m.mail).not.toHaveBeenCalled();
  });
  it("con RESEND_API_KEY manda la confirmación con ADMIN_MANUAL", async () => {
    process.env.RESEND_API_KEY = "re_test";
    await POST(req(JSON.stringify(BODY)));
    expect(m.mail).toHaveBeenCalledTimes(1);
    const arg = m.mail.mock.calls[0][0];
    expect(arg.to).toBe("juana@mail.com");
    expect(arg.subject).toBe("ComprameLaFoto - Recibimos tu solicitud #12");
    expect(arg.templateKey).toBe("ADMIN_MANUAL");
    expect(arg.meta).toEqual({});
    expect(arg.html).toContain("<p>Hola Juana Pérez,</p>");
    expect(arg.html).toContain("Recibimos tu solicitud de OCULTAR_FOTO (ticket #12).");
  });
  it("si el mail falla igual responde el ticket", async () => {
    process.env.RESEND_API_KEY = "re_test";
    m.mail.mockRejectedValue(new Error("resend"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req(JSON.stringify(BODY)));
    expect(r.status).toBe(200);
    expect((await r.json()).ticketId).toBe(12);
    spy.mockRestore();
  });
});
