import { afterEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ album: vi.fn(), token: vi.fn(), order: vi.fn(), pack: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findUnique: (...a: unknown[]) => m.album(...a) },
    orderDownloadToken: { findUnique: (...a: unknown[]) => m.token(...a) },
    order: { findUnique: (...a: unknown[]) => m.order(...a) },
  },
}));
vi.mock("@/lib/preventa-canjeable/pack-access-tokens", () => ({ getOrderIdForPackAccessToken: (...a: unknown[]) => m.pack(...a) }));
import { resolverPagina } from "./pagina-datos";

const VACIO = { albumId: null, orderId: null, enlace: null };
const TOKEN = "b".repeat(64);
afterEach(() => { for (const f of Object.values(m)) f.mockReset(); });

describe("resolverPagina", () => {
  it("sin página → todo null", async () => {
    expect(await resolverPagina(null)).toEqual(VACIO);
  });
  it("álbum por slug", async () => {
    m.album.mockResolvedValueOnce({ id: 7 });
    expect(await resolverPagina({ tipo: "album", slug: "x" })).toEqual({ albumId: 7, orderId: null, enlace: null });
    expect(m.album).toHaveBeenCalledWith({ where: { publicSlug: "x" }, select: { id: true } });
    m.album.mockResolvedValueOnce(null);
    expect(await resolverPagina({ tipo: "album", slug: "y" })).toEqual(VACIO);
  });
  it("álbum por número sólo si existe", async () => {
    m.album.mockResolvedValueOnce({ id: 12 });
    expect(await resolverPagina({ tipo: "album_id", albumId: 12, photoId: null })).toEqual({ albumId: 12, orderId: null, enlace: null });
    m.album.mockResolvedValueOnce(null);
    expect(await resolverPagina({ tipo: "album_id", albumId: 13, photoId: null })).toEqual(VACIO);
  });
  it("token de descarga vencido igual da el enlace", async () => {
    m.token.mockResolvedValueOnce({ orderId: 50, albumId: 7, type: "CLIENT_DIGITAL" });
    expect(await resolverPagina({ tipo: "descarga", token: TOKEN })).toEqual({
      albumId: 7, orderId: 50, enlace: { tipo: "descarga", orderId: 50, albumId: 7 },
    });
    expect(m.token).toHaveBeenCalledWith({ where: { token: TOKEN }, select: { orderId: true, albumId: true, type: true } });
  });
  it("token de descarga sin albumId → lo toma del pedido", async () => {
    m.token.mockResolvedValueOnce({ orderId: 50, albumId: null, type: "CLIENT_DIGITAL" });
    m.order.mockResolvedValueOnce({ albumId: 9 });
    expect((await resolverPagina({ tipo: "descarga", token: TOKEN })).enlace).toEqual({ tipo: "descarga", orderId: 50, albumId: 9 });
  });
  it("token LAB_PRINT o inexistente → sin enlace", async () => {
    m.token.mockResolvedValueOnce({ orderId: 50, albumId: 7, type: "LAB_PRINT" });
    expect(await resolverPagina({ tipo: "descarga", token: TOKEN })).toEqual(VACIO);
    m.token.mockResolvedValueOnce(null);
    expect(await resolverPagina({ tipo: "descarga", token: TOKEN })).toEqual(VACIO);
  });
  it("pack válido → enlace de pack", async () => {
    m.pack.mockResolvedValueOnce({ ok: true, orderId: 60 });
    m.order.mockResolvedValueOnce({ albumId: 8 });
    expect(await resolverPagina({ tipo: "pack", token: "t".repeat(30) })).toEqual({
      albumId: 8, orderId: 60, enlace: { tipo: "pack", orderId: 60, albumId: 8 },
    });
  });
  it("pack revocado o vencido → sin enlace", async () => {
    m.pack.mockResolvedValueOnce({ ok: false, error: "revoked" });
    expect(await resolverPagina({ tipo: "pack", token: "t".repeat(30) })).toEqual(VACIO);
    m.pack.mockResolvedValueOnce({ ok: false, error: "expired" });
    expect(await resolverPagina({ tipo: "pack", token: "t".repeat(30) })).toEqual(VACIO);
    expect(m.order).not.toHaveBeenCalled();
  });
  it("pago con pedido → albumId y orderId, sin enlace", async () => {
    m.order.mockResolvedValueOnce({ albumId: 4 });
    expect(await resolverPagina({ tipo: "pago", resultado: "failure", orderId: 88 })).toEqual({ albumId: 4, orderId: 88, enlace: null });
    expect(m.order).toHaveBeenCalledWith({ where: { id: 88 }, select: { albumId: true } });
  });
  it("pago con pedido inexistente o sin número → todo null", async () => {
    m.order.mockResolvedValueOnce(null);
    expect(await resolverPagina({ tipo: "pago", resultado: "failure", orderId: 88 })).toEqual(VACIO);
    expect(await resolverPagina({ tipo: "pago", resultado: "pending", orderId: null })).toEqual(VACIO);
  });
  it("páginas sin datos → todo null", async () => {
    expect(await resolverPagina({ tipo: "mis_pedidos" })).toEqual(VACIO);
    expect(await resolverPagina({ tipo: "soporte" })).toEqual(VACIO);
    expect(await resolverPagina({ tipo: "recuperar_pack" })).toEqual(VACIO);
  });
  it("si la base falla → todo null, sin lanzar", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    m.token.mockRejectedValueOnce(Object.assign(new Error(`Invalid where: { token: "${TOKEN}" }`), { code: "P2023" }));
    expect(await resolverPagina({ tipo: "descarga", token: TOKEN })).toEqual(VACIO);
    expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    expect(spy.mock.calls[0]![1]).toEqual({ name: "Error", code: "P2023" });
    m.pack.mockRejectedValueOnce(new Error("db"));
    expect(await resolverPagina({ tipo: "pack", token: "t".repeat(30) })).toEqual(VACIO);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
