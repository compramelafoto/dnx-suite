import { describe, expect, it, vi } from "vitest";
import { sendTelegramMessage, TELEGRAM_TIMEOUT_MS } from "./telegram";

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
  it("un error de red no filtra el token en el mensaje", async () => {
    const f = vi.fn(async () => { throw new Error("fetch failed: https://api.telegram.org/botSECRETO123/sendMessage"); });
    const r = await sendTelegramMessage({ token: "SECRETO123", chatId: "C" }, "x", f as any);
    expect(r.ok).toBe(false);
    expect(r.error).not.toContain("SECRETO123");
    expect(r.error).toContain("bot***");
  });
  it("corta a los 5 s si Telegram no contesta → timeout, nunca lanza", async () => {
    const ctrl = new AbortController();
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(ctrl.signal);
    const f = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(init.signal!.reason))),
    );
    try {
      const p = sendTelegramMessage({ token: "T", chatId: "C" }, "x", f as unknown as typeof fetch);
      expect(spy).toHaveBeenCalledWith(TELEGRAM_TIMEOUT_MS);
      expect(TELEGRAM_TIMEOUT_MS).toBe(5_000);
      ctrl.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
      expect(await p).toEqual({ ok: false, error: "timeout" });
    } finally {
      spy.mockRestore();
    }
  });
});
