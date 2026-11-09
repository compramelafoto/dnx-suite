import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSvix } from "@/lib/mailing/svix";

const h = vi.hoisted(() => ({
  traer: vi.fn(),
  registrar: vi.fn(),
  procesar: vi.fn(),
  despues: [] as Array<() => unknown>,
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => unknown) => void h.despues.push(fn),
}));
vi.mock("@/lib/agentes/vendedor/entrante", () => {
  return {
    leerAvisoEntrante: (p: unknown) => {
      const x = p as { type?: unknown; data?: { email_id?: unknown } } | null;
      return x?.type === "email.received" && typeof x.data?.email_id === "string" ? { emailId: x.data.email_id } : null;
    },
    traerCorreoRecibido: h.traer,
    registrarEntrante: h.registrar,
    procesarEntrantes: h.procesar,
  };
});

const { POST, maxDuration } = await import("./route");

const SECRETO = `whsec_${Buffer.from("clave-entrante-123").toString("base64")}`;
const AVISO = { type: "email.received", created_at: "2026-11-20T15:00:00.000Z", data: { email_id: "4ef9a417" } };

function pedido(cuerpo: unknown = AVISO, firma?: string): Request {
  const body = JSON.stringify(cuerpo);
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request("https://fotoffice.com/api/webhooks/resend-entrante", {
    method: "POST",
    body,
    headers: { "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": firma ?? `v1,${signSvix(SECRETO, "msg_1", ts, body)}` },
  });
}

const CORREO = { id: "4ef9a417", de: "ana@x.com", deNombre: null, para: [], asunto: "Re", texto: "Hola", messageId: null, inReplyTo: null, referencias: [], cabeceras: {} };

beforeEach(() => {
  vi.stubEnv("RESEND_INBOUND_WEBHOOK_SECRET", SECRETO);
  h.traer.mockReset().mockResolvedValue(CORREO);
  h.registrar.mockReset().mockResolvedValue({ correoId: "c1", hiloId: "h1", nuevo: true });
  h.procesar.mockReset().mockResolvedValue({ procesados: 1 });
  h.despues = [];
});
afterEach(() => vi.unstubAllEnvs());

describe("webhook de correo entrante", () => {
  it("dura hasta 300 s", () => {
    expect(maxDuration).toBe(300);
  });

  it("sin secreto la ruta no existe", async () => {
    vi.stubEnv("RESEND_INBOUND_WEBHOOK_SECRET", "");
    expect((await POST(pedido())).status).toBe(404);
  });

  it("firma mala: 401 y no se pide nada a Resend", async () => {
    const r = await POST(pedido(AVISO, "v1,firmamala"));
    expect(r.status).toBe(401);
    expect(h.traer).not.toHaveBeenCalled();
  });

  it("un tipo que no es email.received se confirma y se ignora", async () => {
    const r = await POST(pedido({ type: "email.delivered", data: { email_id: "x" } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, ignored: true });
    expect(h.traer).not.toHaveBeenCalled();
  });

  it("si Resend no devuelve el correo, 500 para que reintente", async () => {
    h.traer.mockResolvedValue({ error: "Resend respondió 500" });
    const r = await POST(pedido());
    expect(r.status).toBe(500);
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it("registra y procesa después de responder", async () => {
    const r = await POST(pedido());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, nuevo: true });
    expect(h.traer).toHaveBeenCalledWith("4ef9a417");
    expect(h.registrar).toHaveBeenCalledWith(CORREO, expect.any(Date));
    expect(h.procesar).not.toHaveBeenCalled();
    expect(h.despues).toHaveLength(1);
    await h.despues[0]!();
    expect(h.procesar).toHaveBeenCalledWith({ hasta: expect.any(Number) });
    const hasta = (h.procesar.mock.calls[0]![0] as { hasta: number }).hasta;
    expect(hasta - Date.now()).toBeGreaterThan(200_000);
    expect(hasta - Date.now()).toBeLessThanOrEqual(240_000);
  });

  it("un error al registrar da 500 para que Resend reintente", async () => {
    h.registrar.mockRejectedValue(new Error("base caída"));
    expect((await POST(pedido())).status).toBe(500);
  });
});
