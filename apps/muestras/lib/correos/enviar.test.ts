import { beforeEach, describe, expect, it, vi } from "vitest";

const batchSend = vi.fn();
const emailSend = vi.fn();
vi.mock("resend", () => ({ Resend: class { batch = { send: batchSend }; emails = { send: emailSend }; } }));
vi.mock("@repo/db", () => ({ prisma: {} }));

import { enviar, enviarEnLote, origenDeCorreo, remitente, type Mensaje } from "./enviar";

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

describe("marca de la muestra en el correo (etapa 2 de arte)", () => {
  it("el remitente de una muestra de arte se llama «Muestras de Arte»; el de fotografía queda igual", () => {
    expect(remitente("Muestras <hola@muestrasfotograficas.com>", "ARTE")).toBe("Muestras de Arte <hola@muestrasfotograficas.com>");
    expect(remitente("m@x.com", "ARTE")).toBe("Muestras de Arte <m@x.com>");
    expect(remitente("Muestras <hola@muestrasfotograficas.com>", "FOTOGRAFIA")).toBe("Muestras <hola@muestrasfotograficas.com>");
    expect(remitente("m@x.com")).toBe("m@x.com");
  });
  it("enviar con la marca de arte: remitente y firma de arte", async () => {
    emailSend.mockResolvedValue({ error: null });
    await enviar("a@x.com", "s", ["p"], undefined, "ARTE");
    await enviar("a@x.com", "s", ["p"]);
    const [arte, foto] = emailSend.mock.calls.map((c) => c[0]);
    expect(arte.from).toBe("Muestras de Arte <m@x.com>");
    expect(arte.html).toContain(">Muestras de Arte</p>");
    expect(foto.from).toBe("m@x.com");
    expect(foto.html).toContain(">Muestras Fotográficas</p>");
  });
  it("en lote, cada mensaje con su marca", async () => {
    batchSend.mockResolvedValue({ error: null });
    await enviarEnLote([{ to: "a@x.com", subject: "s", parrafos: ["p"], marca: "ARTE" }, { to: "b@x.com", subject: "s", parrafos: ["p"] }]);
    expect(batchSend.mock.calls[0]![0].map((m: { from: string }) => m.from)).toEqual(["Muestras de Arte <m@x.com>", "m@x.com"]);
  });
  it("los enlaces de una muestra de arte van a muestrasdearte.com; los de fotografía, a APP_URL", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(origenDeCorreo("PINTURA")).toBe("https://muestrasdearte.com");
    expect(origenDeCorreo("FOTOGRAFIA")).toBe((process.env.APP_URL?.trim() || "https://muestrasfotograficas.com").replace(/\/+$/, ""));
    expect(origenDeCorreo(null)).toBe(origenDeCorreo("FOTOGRAFIA"));
    vi.unstubAllEnvs();
  });
});
