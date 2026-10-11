import { describe, expect, it, vi } from "vitest";
import { sendTelegramMessage } from "./telegram";

describe("sendTelegramMessage", () => {
  it("sin configuración no hace nada y no falla", async () => {
    expect(await sendTelegramMessage(null, "x")).toEqual({ ok: false, error: "sin_configuracion" });
  });
  it("manda texto plano (sin parse_mode) y recorta a 4000 caracteres", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await sendTelegramMessage({ token: "T", chatId: "C" }, "a".repeat(5000), f as any);
    const [url, init] = (f.mock.calls[0] as any[])!;
    expect(url).toBe("https://api.telegram.org/botT/sendMessage");
    const body = JSON.parse((init as any).body as string);
    expect(body).toMatchObject({ chat_id: "C", disable_web_page_preview: true });
    expect(body).not.toHaveProperty("parse_mode");
    expect(body.text.length).toBe(4000);
  });
  it("error HTTP → ok false, nunca lanza", async () => {
    const f = vi.fn(async () => new Response("no", { status: 500 }));
    expect(await sendTelegramMessage({ token: "T", chatId: "C" }, "x", f as any)).toMatchObject({ ok: false });
  });
});
