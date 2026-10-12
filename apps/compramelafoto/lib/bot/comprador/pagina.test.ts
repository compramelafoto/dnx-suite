import { describe, expect, it } from "vitest";
import { contextoDePagina, esRutaClienteConBot, pagePathSeguro } from "./pagina";

const TOKEN = "a".repeat(64);
describe("contextoDePagina", () => {
  it.each([
    ["/album/egresados-2026", { tipo: "album", slug: "egresados-2026" }],
    ["/album/Egresados-2026/preventa", { tipo: "album", slug: "egresados-2026" }],
    ["/a/12", { tipo: "album_id", albumId: 12, photoId: null }],
    ["/a/12/remover/99", { tipo: "album_id", albumId: 12, photoId: 99 }],
    [`/descargas/${TOKEN}`, { tipo: "descarga", token: TOKEN }],
    ["/cliente/pack/AbC_def-1234567890xyz", { tipo: "pack", token: "AbC_def-1234567890xyz" }],
    ["/cliente/pack/345", { tipo: "mis_pedidos" }],
    ["/pago/failure?orderId=88&orderType=ALBUM_ORDER", { tipo: "pago", resultado: "failure", orderId: 88 }],
    ["/pago/pending", { tipo: "pago", resultado: "pending", orderId: null }],
    ["/cliente/pedidos", { tipo: "mis_pedidos" }],
    ["/cliente/soporte", { tipo: "soporte" }],
    ["/cliente/recuperar-pack", { tipo: "recuperar_pack" }],
  ])("%s", (path, esperado) => expect(contextoDePagina(path)).toEqual(esperado));
  it.each(["/a/12/comprar", "/album/x/comprar", "/a/12/canje/abc", "/fotografo/dashboard", "/descargas/zzz", "/", "/cliente/dashboard"])(
    "%s no tiene bot", (path) => expect(contextoDePagina(path)).toBeNull(),
  );
  it.each([
    "/a/12/instructivo",
    "/album/x/comprar/resumen",
    "/a/0",
    "/a/12/remover/abc",
    "/cliente/pack/corto",
    "/pago/otro",
  ])("%s tampoco", (path) => expect(contextoDePagina(path)).toBeNull());
  it("orderId inválido en la consulta queda en null", () => {
    expect(contextoDePagina("/pago/success?orderId=-3")).toEqual({ tipo: "pago", resultado: "success", orderId: null });
    expect(contextoDePagina("/pago/success?orderId=1.5")).toEqual({ tipo: "pago", resultado: "success", orderId: null });
  });
  it("más de 300 caracteres → null", () => {
    expect(contextoDePagina("/album/x?" + "a".repeat(300))).toBeNull();
  });
  it("pagePathSeguro nunca incluye el token", () => {
    expect(pagePathSeguro({ tipo: "descarga", token: TOKEN })).toBe("/descargas/[token]");
    expect(pagePathSeguro({ tipo: "pack", token: "AbC_def-1234567890xyz" })).toBe("/cliente/pack/[token]");
  });
  it("pagePathSeguro del resto", () => {
    expect(pagePathSeguro({ tipo: "album", slug: "x" })).toBe("/album/x");
    expect(pagePathSeguro({ tipo: "album_id", albumId: 4, photoId: 9 })).toBe("/a/4");
    expect(pagePathSeguro({ tipo: "pago", resultado: "pending", orderId: 7 })).toBe("/pago/pending");
    expect(pagePathSeguro({ tipo: "mis_pedidos" })).toBe("/cliente/pedidos");
    expect(pagePathSeguro({ tipo: "soporte" })).toBe("/cliente/soporte");
    expect(pagePathSeguro({ tipo: "recuperar_pack" })).toBe("/cliente/recuperar-pack");
  });
  it("esRutaClienteConBot", () => {
    expect(esRutaClienteConBot("/cliente/pedidos")).toBe(true);
    expect(esRutaClienteConBot("/cliente/pack/AbC_def-1234567890xyz")).toBe(true);
    expect(esRutaClienteConBot("/cliente/dashboard")).toBe(false);
  });
});
