import { describe, expect, it, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  findUnique: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: m.notFound }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: m.findUnique } } }));
import Page from "./page";

describe("/pago/reintentar/[orderId]", () => {
  beforeEach(() => {
    m.redirect.mockClear();
    m.findUnique.mockReset();
  });

  it("redirige a la página de pago fallido del pedido", async () => {
    m.findUnique.mockResolvedValue({ pricingSnapshot: {} });
    await expect(Page({ params: Promise.resolve({ orderId: "88" }) })).rejects.toThrow("REDIRECT");
    expect(m.redirect).toHaveBeenCalledWith("/pago/failure?orderId=88&orderType=ALBUM_ORDER");
  });

  it("un pedido del piloto Split 1:N va a su página de pago", async () => {
    m.findUnique.mockResolvedValue({ pricingSnapshot: { split1nPiloto: { v: 1, estado: "PENDIENTE" } } });
    await expect(Page({ params: Promise.resolve({ orderId: "88" }) })).rejects.toThrow("REDIRECT");
    expect(m.redirect).toHaveBeenCalledWith("/pagar/88");
  });

  it("si eligió Mercado Pago, se reintenta como siempre", async () => {
    m.findUnique.mockResolvedValue({ pricingSnapshot: { split1nPiloto: { v: 1, estado: "CHECKOUT_PRO" } } });
    await expect(Page({ params: Promise.resolve({ orderId: "88" }) })).rejects.toThrow("REDIRECT");
    expect(m.redirect).toHaveBeenCalledWith("/pago/failure?orderId=88&orderType=ALBUM_ORDER");
  });

  it("número inválido → 404", async () => {
    await expect(Page({ params: Promise.resolve({ orderId: "abc" }) })).rejects.toThrow("NOT_FOUND");
  });
});
