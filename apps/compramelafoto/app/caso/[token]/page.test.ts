import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock("@/lib/soporte/token-caso", () => ({ leerTokenCaso: (...a: unknown[]) => m.token(...a) }));
vi.mock("@/components/bot/CompradorBot", () => ({ CompradorBot: () => createElement("div", null, "BOT") }));
import CasoPage from "./page";

const render = async (token: string) => renderToStaticMarkup(await CasoPage({ params: Promise.resolve({ token }) }));

beforeEach(() => m.token.mockReset());

describe("/caso/[token]", () => {
  it("link vencido o inventado: lo dice y no muestra el bot", async () => {
    m.token.mockResolvedValue(null);
    const html = await render("nada");
    expect(html).toContain("venció");
    expect(html).not.toContain("BOT");
  });
  it("link válido: muestra la consulta y monta el bot (que se abre solo)", async () => {
    m.token.mockResolvedValue({ ticketId: 60 });
    const html = await render("tok");
    expect(html).toContain("Consulta #60");
    expect(html).toContain("BOT");
  });
});
