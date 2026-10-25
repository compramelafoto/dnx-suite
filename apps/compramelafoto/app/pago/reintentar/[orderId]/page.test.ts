import { describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error("REDIRECT"); }), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));
import Page from "./page";

describe("/pago/reintentar/[orderId]", () => {
  it("redirige a la página de pago fallido del pedido", async () => {
    await expect(Page({ params: Promise.resolve({ orderId: "88" }) })).rejects.toThrow("REDIRECT");
    expect(m.redirect).toHaveBeenCalledWith("/pago/failure?orderId=88&orderType=ALBUM_ORDER");
  });
  it("número inválido → 404", async () => {
    await expect(Page({ params: Promise.resolve({ orderId: "abc" }) })).rejects.toThrow("NOT_FOUND");
  });
});
