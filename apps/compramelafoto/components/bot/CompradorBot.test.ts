import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/dnx-bot/ui", () => ({ DnxBotBubble: () => null }));
const nav = vi.hoisted(() => ({ pathname: "/a/12" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
import { CompradorBot } from "./CompradorBot";
import { BurbujaSobreBotones, CompradorBotBubble } from "./CompradorBotBubble";

afterEach(() => vi.unstubAllEnvs());

describe("CompradorBot", () => {
  it("con los interruptores apagados no monta nada", () => {
    vi.stubEnv("CLF_BOT_ENABLED", "1");
    vi.stubEnv("CLF_BOT_BUYERS_ENABLED", "");
    expect(CompradorBot()).toBeNull();
    vi.stubEnv("CLF_BOT_ENABLED", "");
    vi.stubEnv("CLF_BOT_BUYERS_ENABLED", "1");
    expect(CompradorBot()).toBeNull();
  });

  it("con los dos interruptores monta la burbuja de compradores", () => {
    vi.stubEnv("CLF_BOT_ENABLED", "1");
    vi.stubEnv("CLF_BOT_BUYERS_ENABLED", "1");
    expect(CompradorBot()?.type).toBe(CompradorBotBubble);
  });
});

describe("CompradorBotBubble", () => {
  it("no se monta en comprar, canje ni instructivo (no tapa los botones de pago)", () => {
    for (const p of ["/a/12/comprar", "/a/12/canje", "/a/12/instructivo", "/album/fiesta/comprar", "/pago/reintentar/5"]) {
      nav.pathname = p;
      expect(CompradorBotBubble()).toBeNull();
    }
  });

  it("se vuelve a montar al cambiar de página: la key es la ruta", () => {
    nav.pathname = "/a/12";
    expect(CompradorBotBubble()?.key).toBe("/a/12");
    nav.pathname = "/descargas/0123456789abcdef0123456789abcdef";
    expect(CompradorBotBubble()?.key).toBe("/descargas/0123456789abcdef0123456789abcdef");
  });

  it("en la preventa y el álbum monta la burbuja que se ubica sobre los botones de pago", () => {
    for (const p of ["/album/fiesta/preventa", "/album/fiesta", "/a/12"]) {
      nav.pathname = p;
      expect(CompradorBotBubble()?.type).toBe(BurbujaSobreBotones);
    }
  });
});
