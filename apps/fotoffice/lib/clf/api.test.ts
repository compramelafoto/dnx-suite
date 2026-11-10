import { describe, expect, it, vi } from "vitest";
import { canjearCodigo, pedirVentas, revocarLlave } from "./api";

const ENV = { DNX_CLF_FOTOFFICE_CLIENT_SECRET: "secreto" };
const res = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status });
const f = (r: () => Promise<Response>) => vi.fn(r) as unknown as typeof fetch;

const VENTA = {
  orderId: 5978,
  mpPaymentId: "188336783078",
  estado: "PAID",
  motivo: null,
  pagadoEl: "2026-11-07T15:40:00.000Z",
  actualizadoEl: "2026-11-07T15:43:23.475Z",
  album: { id: 1283, titulo: "Colación 7°" },
  detalle: "Pack: 5 digitales + 5 copias",
  pagoFamilia: 20000,
  comisionPlataforma: 2609,
  descuentoReferidos: 0,
  comisionOrganizador: 0,
  retenidoEsperadoMp: 2609,
  netoFotografo: 17391,
  cobrador: "PHOTOGRAPHER",
  cobradorMpUserId: "97484805",
  buyerEmail: "no@debe.pasar",
};

describe("canjearCodigo", () => {
  it("sin el secreto configurado no llama a CLF", async () => {
    const fetchFalso = vi.fn();
    expect(await canjearCodigo("c", { env: {}, fetch: fetchFalso as unknown as typeof fetch })).toEqual({ ok: false, codigo: "NO_CONFIGURADA" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("200: llave y cuenta, con el secreto en la cabecera", async () => {
    const fetchFalso = vi.fn(async (_u: string, _i?: RequestInit) => res(200, { llave: "clf_fo_abc", cuenta: { id: 79, nombre: "DNX", mpUserId: "97484805" } }));
    const r = await canjearCodigo("c", { env: ENV, fetch: fetchFalso as unknown as typeof fetch, baseUrl: "https://clf.test" });
    expect(r).toEqual({ ok: true, llave: "clf_fo_abc", cuenta: { id: 79, nombre: "DNX", mpUserId: "97484805" } });
    expect(fetchFalso.mock.calls[0]![0]).toBe("https://clf.test/api/integraciones/fotoffice/v1/canjear");
    expect((fetchFalso.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBe("Bearer secreto");
  });

  it("código usado o vencido; red caída; llave con otro formato", async () => {
    expect(await canjearCodigo("c", { env: ENV, fetch: f(async () => res(400, {})) })).toEqual({ ok: false, codigo: "CODIGO_INVALIDO" });
    expect(await canjearCodigo("c", { env: ENV, fetch: f(async () => { throw new Error("x"); }) })).toEqual({ ok: false, codigo: "SIN_CONEXION" });
    expect(await canjearCodigo("c", { env: ENV, fetch: f(async () => res(200, { llave: "otra", cuenta: { id: 1 } })) })).toEqual({ ok: false, codigo: "SIN_CONEXION" });
  });
});

describe("pedirVentas", () => {
  it("convierte las ventas y descarta cualquier campo fuera de la lista", async () => {
    const r = await pedirVentas("clf_fo_x", null, { fetch: f(async () => res(200, { ventas: [VENTA, { orderId: "malo" }], siguiente: "c2", hayMas: true })) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ventas).toHaveLength(1);
    expect(r.ventas[0]).not.toHaveProperty("buyerEmail");
    expect(r.ventas[0]!.pagadoEl).toEqual(new Date("2026-11-07T15:40:00.000Z"));
    expect(r.siguiente).toBe("c2");
    expect(r.hayMas).toBe(true);
  });

  it("401 → la llave fue rechazada; 500 → sin conexión", async () => {
    expect(await pedirVentas("k", null, { fetch: f(async () => res(401, {})) })).toEqual({ ok: false, codigo: "LLAVE_RECHAZADA" });
    expect(await pedirVentas("k", "c", { fetch: f(async () => res(500, {})) })).toEqual({ ok: false, codigo: "SIN_CONEXION" });
  });
});

describe("revocarLlave", () => {
  it("nunca lanza", async () => {
    expect(await revocarLlave("k", { fetch: f(async () => { throw new Error("x"); }) })).toBe(false);
    expect(await revocarLlave("k", { fetch: f(async () => res(200, {})) })).toBe(true);
  });
});
