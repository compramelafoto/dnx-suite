import { beforeEach, describe, expect, it, vi } from "vitest";

const batchSend = vi.fn();
const emailSend = vi.fn();
vi.mock("resend", () => ({ Resend: class { batch = { send: batchSend }; emails = { send: emailSend }; } }));
vi.mock("@repo/db", () => ({ prisma: {} }));

import { enviar, enviarEnLote, type Mensaje } from "./enviar";

const msgs = (n: number): Mensaje[] => Array.from({ length: n }, (_, i) => ({ to: `a${i}@x.com`, subject: "s", parrafos: ["p"] }));

beforeEach(() => {
  batchSend.mockReset();
  emailSend.mockReset();
  vi.stubEnv("RESEND_API_KEY", "k");
  vi.stubEnv("MUESTRAS_CORREOS_EN_VIVO", "true");
  vi.stubEnv("MUESTRAS_EMAIL_FROM", "m@x.com");
});

describe("enviarEnLote", () => {
  it("parte en tandas de 100 y cuenta los aceptados", async () => {
    batchSend.mockResolvedValue({ error: null });
    const r = await enviarEnLote(msgs(250));
    expect(batchSend.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50]);
    expect(r).toEqual({ compuerta: true, total: 250, aceptados: 250 });
  });
  it("no tira si Resend rechaza o se cae, y no cuenta esas tandas", async () => {
    batchSend.mockResolvedValueOnce({ error: { message: "no" } }).mockRejectedValueOnce(new Error("red")).mockResolvedValueOnce({ error: null });
    const r = await enviarEnLote(msgs(250));
    expect(r).toEqual({ compuerta: true, total: 250, aceptados: 50 });
  });
  it("con la compuerta cerrada no manda nada y lo dice", async () => {
    vi.stubEnv("MUESTRAS_CORREOS_EN_VIVO", "false");
    const r = await enviarEnLote(msgs(3));
    expect(batchSend).not.toHaveBeenCalled();
    expect(r).toEqual({ compuerta: false, total: 3, aceptados: 0 });
  });
});

describe("enviar", () => {
  it("true sólo si Resend lo aceptó", async () => {
    emailSend.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "no" } }).mockRejectedValueOnce(new Error("red"));
    expect(await enviar("a@x.com", "s", ["p"])).toBe(true);
    expect(await enviar("a@x.com", "s", ["p"])).toBe(false);
    expect(await enviar("a@x.com", "s", ["p"])).toBe(false);
  });
  it("con la compuerta cerrada devuelve false sin intentar", async () => {
    vi.stubEnv("MUESTRAS_CORREOS_EN_VIVO", "false");
    expect(await enviar("a@x.com", "s", ["p"])).toBe(false);
    expect(emailSend).not.toHaveBeenCalled();
  });
});
