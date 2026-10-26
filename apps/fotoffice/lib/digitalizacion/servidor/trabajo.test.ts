import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findMany: vi.fn(), findFirst: vi.fn() },
  digitalizacionGrabacion: { aggregate: vi.fn(), findMany: vi.fn() },
  digitalizacionDescarga: { groupBy: vi.fn() },
  fotofficeEmailOptOut: { findFirst: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));
const entregas = vi.hoisted(() => ({ resumenDeEntregas: vi.fn(), grabacionesDelPedido: vi.fn() }));
vi.mock("./entregas", () => entregas);
const cargos = vi.hoisted(() => ({ saldoDeVideosMinor: vi.fn() }));
vi.mock("./cargos", () => cargos);

import { entregaDelPedido, trabajoParaGrabar, trabajosDeDigitalizacionDelPedido } from "./trabajo";

const trabajo = (extra: Record<string, unknown> = {}) => ({
  id: "t1", number: "2026-0001", name: "Trabajo", pedidoId: "p1", product: null, _count: { grabaciones: 0 }, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trabajosDeDigitalizacionDelPedido", () => {
  it("se queda con los que tienen grabaciones o hablan de video, siempre dentro del negocio", async () => {
    db.fotofficeProyecto.findMany.mockResolvedValue([
      trabajo({ id: "t1", _count: { grabaciones: 2 } }),
      trabajo({ id: "t2", product: { name: "Digitalización de VHS", category: null } }),
      trabajo({ id: "t3", product: { name: "Copia 15x21", category: { name: "Impresiones" } } }),
      trabajo({ id: "t4", product: { name: "Servicio", category: { name: "Digitalización de video" } } }),
    ]);
    const r = await trabajosDeDigitalizacionDelPedido("ws1", "p1");
    expect(r.map((t) => t.id)).toEqual(["t1", "t2", "t4"]);
    expect(db.fotofficeProyecto.findMany.mock.calls[0][0].where).toEqual({ pedidoId: "p1", workspaceId: "ws1" });
  });

  it("un id con forma rara no consulta", async () => {
    expect(await trabajosDeDigitalizacionDelPedido("ws1", "x' or 1=1")).toEqual([]);
    expect(db.fotofficeProyecto.findMany).not.toHaveBeenCalled();
  });
});

describe("trabajoParaGrabar", () => {
  it("valida que el trabajo sea del negocio y propone el cassette siguiente", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "t1", number: "2026-0001", name: "VHS de Ana", pedido: { number: "P-12" } });
    db.digitalizacionGrabacion.aggregate.mockResolvedValue({ _max: { cassetteNumero: 3 } });
    expect(await trabajoParaGrabar("ws1", "t1")).toEqual({ id: "t1", numero: "2026-0001", nombre: "VHS de Ana", pedidoNumero: "P-12", siguienteCassette: 4 });
    expect(db.fotofficeProyecto.findFirst.mock.calls[0][0].where).toEqual({ id: "t1", workspaceId: "ws1" });
  });

  it("de otro negocio (o inexistente): null", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue(null);
    expect(await trabajoParaGrabar("ws1", "t9")).toBeNull();
  });
});

describe("entregaDelPedido", () => {
  it("suma saldo, descargas por video y la casilla dada de baja", async () => {
    entregas.resumenDeEntregas.mockResolvedValue([{ pedidoId: "p1", email: "Ana@X.com", entrega: { id: "e1" } }]);
    entregas.grabacionesDelPedido.mockResolvedValue([
      { id: "g1", estado: "COMPLETA", conversionEstado: "LISTA", titulo: "Boda", tipo: "VHS", cassetteNumero: 1, descargasExtra: 1 },
      { id: "g2", estado: "DESCARTADA", conversionEstado: "LISTA", titulo: null, tipo: "VHS", cassetteNumero: 2, descargasExtra: 0 },
    ]);
    cargos.saldoDeVideosMinor.mockResolvedValue({ numero: "P-12", saldoMinor: 500000 });
    db.digitalizacionDescarga.groupBy.mockResolvedValue([{ grabacionId: "g1", _count: { _all: 2 } }]);
    db.fotofficeEmailOptOut.findFirst.mockResolvedValue({ id: "o1" });
    const r = await entregaDelPedido("ws1", "p1");
    expect(entregas.resumenDeEntregas).toHaveBeenCalledWith("ws1", { pedidoIds: ["p1"] });
    expect(r).toMatchObject({ saldoMinor: 500000, casillaConProblema: true, videos: [{ id: "g1", titulo: "Boda", descargasExtra: 1 }] });
    expect(r!.descargas.get("g1")).toBe(2);
    expect(db.fotofficeEmailOptOut.findFirst.mock.calls[0][0].where).toEqual({ workspaceId: "ws1", email: "ana@x.com", topic: "all" });
  });

  it("sin grabaciones no hay entrega", async () => {
    entregas.resumenDeEntregas.mockResolvedValue([]);
    expect(await entregaDelPedido("ws1", "p1")).toBeNull();
  });
});
