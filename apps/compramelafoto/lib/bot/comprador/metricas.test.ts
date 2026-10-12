import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";

const m = vi.hoisted(() => ({
  conv: { groupBy: vi.fn(), findMany: vi.fn() },
  action: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  code: { count: vi.fn() },
  order: { findMany: vi.fn() },
  usage: { aggregate: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { botConversation: m.conv, botAction: m.action, botEmailCode: m.code, order: m.order, botUsageDaily: m.usage },
}));
import {
  categoriaDePagina,
  gastoCompradoresMes,
  lineasCompradores,
  ventasPosteriores,
  type ConvParaVentas,
  type PedidoParaVentas,
} from "./metricas";

const H = 60 * 60 * 1000;
const T0 = new Date("2026-10-10T12:00:00Z");
const en = (horas: number) => new Date(T0.getTime() + horas * H);
const conv = (extra: Partial<ConvParaVentas> = {}): ConvParaVentas => ({
  guestKey: "g1", buyerEmail: null, albumId: 7, createdAt: T0, ...extra,
});
const pedido = (extra: Partial<PedidoParaVentas> = {}): PedidoParaVentas => ({
  albumId: 7, botGuestKey: "g1", buyerEmail: "otra@x.com", totalCents: 5_000, createdAt: en(2), ...extra,
});

describe("categoriaDePagina", () => {
  it("clasifica las rutas guardadas (sin tokens)", () => {
    expect(categoriaDePagina("/descargas/[token]")).toBe("descarga");
    expect(categoriaDePagina("/album/fiesta-2026")).toBe("album");
    expect(categoriaDePagina("/a/123")).toBe("album");
    expect(categoriaDePagina("/pago/failure")).toBe("pago");
    expect(categoriaDePagina("/pago/success")).toBe("pago");
    expect(categoriaDePagina("/cliente/pack/[token]")).toBe("preventa");
    expect(categoriaDePagina("/cliente/recuperar-pack")).toBe("preventa");
    expect(categoriaDePagina("/album/fiesta-2026/preventa")).toBe("preventa");
    expect(categoriaDePagina("/cliente/pedidos")).toBe("mis_pedidos");
    expect(categoriaDePagina("/cliente/soporte")).toBe("otra");
    expect(categoriaDePagina(null)).toBe("otra");
    expect(categoriaDePagina("/dashboard")).toBe("otra");
  });
});

describe("ventasPosteriores", () => {
  it("mismo navegador dentro de las 48 h cuenta", () => {
    expect(ventasPosteriores([conv()], [pedido({ createdAt: en(47) })])).toEqual({ pedidos: 1, pesos: 5_000 });
    expect(ventasPosteriores([conv()], [pedido({ createdAt: en(48) })])).toEqual({ pedidos: 1, pesos: 5_000 });
  });
  it("49 h después no cuenta", () => {
    expect(ventasPosteriores([conv()], [pedido({ createdAt: en(49) })])).toEqual({ pedidos: 0, pesos: 0 });
  });
  it("un pedido anterior a la conversación no cuenta", () => {
    expect(ventasPosteriores([conv()], [pedido({ createdAt: en(-1) })])).toEqual({ pedidos: 0, pesos: 0 });
  });
  it("otro álbum no cuenta", () => {
    expect(ventasPosteriores([conv()], [pedido({ albumId: 8 })])).toEqual({ pedidos: 0, pesos: 0 });
  });
  it("otro navegador sin mail en común no cuenta; sin cookie en ninguno de los dos tampoco", () => {
    expect(ventasPosteriores([conv()], [pedido({ botGuestKey: "g2" })])).toEqual({ pedidos: 0, pesos: 0 });
    expect(ventasPosteriores([conv({ guestKey: null })], [pedido({ botGuestKey: null })])).toEqual({ pedidos: 0, pesos: 0 });
  });
  it("mismo mail verificado cuenta aunque sea otro navegador (mail normalizado)", () => {
    const r = ventasPosteriores(
      [conv({ guestKey: "g1", buyerEmail: "juana@gmail.com" })],
      [pedido({ botGuestKey: null, buyerEmail: "  Juana@Gmail.com " })],
    );
    expect(r).toEqual({ pedidos: 1, pesos: 5_000 });
  });
  it("un pedido no se cuenta dos veces aunque coincidan dos conversaciones", () => {
    const r = ventasPosteriores(
      [conv(), conv({ guestKey: "g9", buyerEmail: "otra@x.com", createdAt: en(1) })],
      [pedido(), pedido({ totalCents: 1_000, botGuestKey: "g3", buyerEmail: "nadie@x.com" })],
    );
    expect(r).toEqual({ pedidos: 1, pesos: 5_000 });
  });
  it("suma pesos enteros de varios pedidos", () => {
    const r = ventasPosteriores([conv()], [pedido({ totalCents: 27_000 }), pedido({ totalCents: 9_000, createdAt: en(30) })]);
    expect(r).toEqual({ pedidos: 2, pesos: 36_000 });
  });
});

describe("gastoCompradoresMes", () => {
  it("suma sólo las filas de invitados (g:) del mes argentino", async () => {
    m.usage.aggregate.mockResolvedValue({ _sum: { costMicroUsd: 420_000 } });
    // 1/11 01:00 UTC = 31/10 22:00 en Argentina
    expect(await gastoCompradoresMes(new Date("2026-11-01T01:00:00Z"))).toBe(420_000);
    expect(m.usage.aggregate.mock.calls[0]![0].where).toEqual({
      platform: "CLF", day: { startsWith: "2026-10" }, actorKey: { startsWith: "g:" },
    });
  });
  it("sin filas devuelve 0", async () => {
    m.usage.aggregate.mockResolvedValue({ _sum: { costMicroUsd: null } });
    expect(await gastoCompradoresMes(new Date())).toBe(0);
  });
});

describe("lineasCompradores", () => {
  const NOW = new Date("2026-10-12T12:00:00Z");
  const SINCE = new Date("2026-10-11T12:00:00Z");

  beforeEach(() => {
    Object.values(m).forEach((g) => Object.values(g).forEach((f) => f.mockReset()));
    m.conv.groupBy.mockResolvedValue([]);
    m.conv.findMany.mockResolvedValue([]);
    m.action.findMany.mockResolvedValue([]);
    m.action.groupBy.mockResolvedValue([]);
    m.action.count.mockResolvedValue(0);
    m.code.count.mockResolvedValue(0);
    m.order.findMany.mockResolvedValue([]);
  });

  it("sin actividad: todas las líneas en cero y no consulta pedidos", async () => {
    expect(await lineasCompradores(SINCE, NOW)).toEqual([
      "Compradores: 0 conversaciones (álbum 0, descarga 0, pago 0, preventa 0, mis pedidos 0), 0 resueltas sin caso.",
      "Casos de compradores: 0.",
      "Códigos: 0 pedidos, 0 verificados.",
      "Reenvíos: 0 de descargas, 0 de packs.",
      "Pedidos para quitar fotos: 0.",
      `Ventas después del bot (48 h): 0 pedidos, ${formatPurchaseArs(0)}.`,
    ]);
    expect(m.order.findMany).not.toHaveBeenCalled();
  });

  it("arma las seis líneas con los filtros de compradores", async () => {
    m.conv.groupBy.mockResolvedValue([
      { pagePath: "/album/fiesta", status: "OPEN", _count: { _all: 3 } },
      { pagePath: "/a/7", status: "ESCALATED", _count: { _all: 1 } },
      { pagePath: "/descargas/[token]", status: "OPEN", _count: { _all: 2 } },
      { pagePath: "/pago/failure", status: "ESCALATED", _count: { _all: 1 } },
      { pagePath: "/cliente/pack/[token]", status: "CLOSED", _count: { _all: 1 } },
      { pagePath: "/cliente/pedidos", status: "OPEN", _count: { _all: 1 } },
      { pagePath: "/cliente/soporte", status: "OPEN", _count: { _all: 1 } },
    ]);
    m.action.findMany.mockResolvedValue([
      { input: { motivo: "pago_duplicado", emailHash: "h" } },
      { input: { motivo: "descarga" } },
      { input: { motivo: "pago_duplicado" } },
      { input: null },
    ]);
    m.code.count.mockImplementation(async (q: { where: { usedAt?: unknown } }) => (q.where.usedAt ? 2 : 5));
    m.action.groupBy.mockResolvedValue([
      { toolName: "reenviar_descarga", _count: { _all: 4 } },
      { toolName: "reenviar_link_pack", _count: { _all: 1 } },
    ]);
    m.action.count.mockResolvedValue(2);
    m.conv.findMany.mockResolvedValue([
      { guestKey: "g1", buyerEmail: null, albumId: 7, createdAt: new Date("2026-10-11T10:00:00Z") },
      { guestKey: "g2", buyerEmail: "juana@gmail.com", albumId: 8, createdAt: new Date("2026-10-11T20:00:00Z") },
      { guestKey: "g3", buyerEmail: null, albumId: 7, createdAt: new Date("2026-10-11T11:00:00Z") },
    ]);
    m.order.findMany.mockResolvedValue([
      { albumId: 7, botGuestKey: "g1", buyerEmail: "a@x.com", totalCents: 12_000, createdAt: new Date("2026-10-12T09:00:00Z") },
      { albumId: 8, botGuestKey: null, buyerEmail: "Juana@gmail.com", totalCents: 3_500, createdAt: new Date("2026-10-12T10:00:00Z") },
      { albumId: 7, botGuestKey: "g5", buyerEmail: "b@x.com", totalCents: 99_000, createdAt: new Date("2026-10-12T10:00:00Z") },
    ]);

    const lineas = await lineasCompradores(SINCE, NOW);
    expect(lineas).toEqual([
      "Compradores: 10 conversaciones (álbum 4, descarga 2, pago 1, preventa 1, mis pedidos 1, otras 1), 8 resueltas sin caso.",
      "Casos de compradores: 4 (pago duplicado: 2, descarga: 1, otro: 1).",
      "Códigos: 5 pedidos, 2 verificados.",
      "Reenvíos: 4 de descargas, 1 de packs.",
      "Pedidos para quitar fotos: 2.",
      `Ventas después del bot (48 h): 2 pedidos, ${formatPurchaseArs(15_500)}.`,
    ]);

    expect(m.conv.groupBy.mock.calls[0]![0].where).toEqual({ platform: "CLF", audience: "BUYER", createdAt: { gt: SINCE } });
    expect(m.action.findMany.mock.calls[0]![0].where).toEqual({
      platform: "CLF", userId: null, toolName: "abrir_caso", createdAt: { gt: SINCE },
    });
    const codigos = m.code.count.mock.calls.map((c) => c[0].where);
    expect(codigos).toEqual([{ createdAt: { gt: SINCE } }, { createdAt: { gt: SINCE }, usedAt: { not: null } }]);
    expect(m.action.groupBy.mock.calls[0]![0].where).toEqual({
      platform: "CLF", userId: null, toolName: { in: ["reenviar_descarga", "reenviar_link_pack"] }, createdAt: { gt: SINCE },
    });
    expect(m.action.count.mock.calls[0]![0].where).toEqual({
      platform: "CLF", userId: null, toolName: "solicitar_quitar_foto", status: "EXECUTED", decidedAt: { gt: SINCE },
    });
    const convVentas = m.conv.findMany.mock.calls[0]![0].where;
    expect(convVentas).toEqual({
      platform: "CLF", audience: "BUYER", albumId: { not: null }, createdAt: { gt: new Date(SINCE.getTime() - 48 * H) },
    });
    const pedidos = m.order.findMany.mock.calls[0]![0].where;
    expect(pedidos).toEqual({ status: "PAID", isTest: false, createdAt: { gt: SINCE }, albumId: { in: [7, 8] } });
  });

  it("singular para una conversación y un pedido", async () => {
    m.conv.groupBy.mockResolvedValue([{ pagePath: "/a/7", status: "OPEN", _count: { _all: 1 } }]);
    m.conv.findMany.mockResolvedValue([{ guestKey: "g1", buyerEmail: null, albumId: 7, createdAt: new Date("2026-10-11T10:00:00Z") }]);
    m.order.findMany.mockResolvedValue([
      { albumId: 7, botGuestKey: "g1", buyerEmail: "a@x.com", totalCents: 1_000, createdAt: new Date("2026-10-12T09:00:00Z") },
    ]);
    const lineas = await lineasCompradores(SINCE, NOW);
    expect(lineas[0]).toBe("Compradores: 1 conversación (álbum 1, descarga 0, pago 0, preventa 0, mis pedidos 0), 1 resuelta sin caso.");
    expect(lineas[5]).toBe(`Ventas después del bot (48 h): 1 pedido, ${formatPurchaseArs(1_000)}.`);
  });
});
