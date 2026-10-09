import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctxDePrueba } from "./ctx-prueba";

const M = vi.hoisted(() => {
  const d = (v: number) => ({ toString: () => v.toFixed(2) });
  type R = Record<string, unknown>;
  const estado = { leads: [] as R[], journeys: [] as R[], pedidos: [] as R[], categorias: [] as R[], origenes: [] as R[] };
  const wheres: { modelo: string; where: R }[] = [];
  const registrar = (modelo: string, where: R) => wheres.push({ modelo, where });
  const prisma = {
    serviceSalesLead: {
      findMany: vi.fn(async (a: { where: R; take?: number }) => {
        registrar("lead", a.where);
        const r = estado.leads.filter((l) => l.workspaceId === a.where.workspaceId);
        return a.take ? r.slice(0, a.take) : r;
      }),
    },
    fotofficeJourney: {
      findMany: vi.fn(async (a: { where: R }) => {
        registrar("journey", a.where);
        const ids = (a.where.subjectId as { in: string[] }).in;
        return estado.journeys.filter((j) => j.workspaceId === a.where.workspaceId && j.subjectType === a.where.subjectType && j.kind === a.where.kind && ids.includes(j.subjectId as string));
      }),
    },
    fotofficePedido: {
      findMany: vi.fn(async (a: { where: R }) => {
        registrar("pedido", a.where);
        const ids = (a.where.consultaLeadId as { in: string[] }).in;
        return estado.pedidos.filter((p) => p.workspaceId === a.where.workspaceId && p.status !== "CANCELADO" && ids.includes(p.consultaLeadId as string));
      }),
    },
    fotofficeConsultaCategoria: {
      findMany: vi.fn(async (a: { where: R }) => {
        registrar("categoria", a.where);
        return estado.categorias.filter((c) => c.workspaceId === a.where.workspaceId && (a.where.id as { in: string[] }).in.includes(c.id as string));
      }),
    },
    fotofficeOrigen: {
      findMany: vi.fn(async (a: { where: R }) => {
        registrar("origen", a.where);
        return estado.origenes.filter((c) => c.workspaceId === a.where.workspaceId && (a.where.id as { in: string[] }).in.includes(c.id as string));
      }),
    },
  };
  const lead = (id: string, workspaceId: string, extra: R = {}) => ({
    id, workspaceId, createdAt: new Date("2026-10-02T15:00:00Z"),
    fotofficeConsulta: { categoryId: "cat1", originId: "or1", estimatedValue: d(1000) }, ...extra,
  });
  return { prisma, estado, wheres, lead, d };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: M.prisma, Prisma: {} }));

const { cargarEmbudo } = await import("./embudo-datos");
const AHORA = new Date("2026-10-09T15:00:00Z");

beforeEach(() => {
  M.estado.leads = []; M.estado.journeys = []; M.estado.pedidos = [];
  M.estado.categorias = [{ id: "cat1", workspaceId: "w1", name: "Bodas" }];
  M.estado.origenes = [{ id: "or1", workspaceId: "w1", name: "Instagram" }];
  M.wheres.length = 0;
  vi.clearAllMocks();
});

describe("cargarEmbudo", () => {
  it("sin permiso no lee nada", async () => {
    expect(await cargarEmbudo(ctxDePrueba("w1", "STAFF", {}), {}, AHORA)).toBeNull();
    expect(M.prisma.serviceSalesLead.findMany).not.toHaveBeenCalled();
  });

  it("toma ganada / perdida / cierre del recorrido de venta, suma lo vendido sin cancelados y aísla por workspace", async () => {
    M.estado.leads = [M.lead("a", "w1"), M.lead("b", "w1"), M.lead("c", "w1"), M.lead("x", "w2")];
    M.estado.journeys = [
      { workspaceId: "w1", subjectType: "CAPTACION", kind: "VENTA", subjectId: "a", outcome: "GANADA", closedAt: new Date("2026-10-07T15:00:00Z") },
      { workspaceId: "w1", subjectType: "CAPTACION", kind: "VENTA", subjectId: "b", outcome: "PERDIDA", closedAt: new Date("2026-10-03T15:00:00Z") },
      { workspaceId: "w1", subjectType: "CAPTACION", kind: "VENTA", subjectId: "c", outcome: null, closedAt: null },
      { workspaceId: "w2", subjectType: "CAPTACION", kind: "VENTA", subjectId: "x", outcome: "GANADA", closedAt: new Date() },
    ];
    M.estado.pedidos = [
      { workspaceId: "w1", status: "CONFIRMADO", consultaLeadId: "a", totalArs: M.d(2500.5) },
      { workspaceId: "w1", status: "CANCELADO", consultaLeadId: "a", totalArs: M.d(9999) },
      { workspaceId: "w2", status: "CONFIRMADO", consultaLeadId: "x", totalArs: M.d(7777) },
    ];
    const e = await cargarEmbudo(ctxDePrueba("w1"), { periodo: "este-mes", agrupar: "origen" }, AHORA);
    expect(e!.tabla!.filas).toHaveLength(1);
    expect(e!.tabla!.filas[0]).toMatchObject({ etiqueta: "Instagram", entraron: 3, ganadas: 1, perdidas: 1, abiertas: 1, valorEstimado: 300000, vendido: 250050, diasPromedio: 3 });
    expect(M.wheres.length).toBeGreaterThanOrEqual(5);
    for (const w of M.wheres) expect(w.where.workspaceId).toBe("w1");
    expect(M.wheres.find((w) => w.modelo === "journey")!.where).toMatchObject({ subjectType: "CAPTACION", kind: "VENTA" });
  });

  it("una consulta sin recorrido cuenta como abierta; sin ficha cae en 'Sin categoría'", async () => {
    M.estado.leads = [M.lead("a", "w1", { fotofficeConsulta: null })];
    const e = await cargarEmbudo(ctxDePrueba("w1"), {}, AHORA);
    expect(e!.tabla!.filas[0]).toMatchObject({ etiqueta: "Sin categoría", abiertas: 1, idGrupo: null });
  });

  it("pasado el tope devuelve el aviso sin datos parciales", async () => {
    M.estado.leads = Array.from({ length: 20001 }, (_, i) => M.lead(String(i), "w1"));
    const e = await cargarEmbudo(ctxDePrueba("w1"), {}, AHORA);
    expect(M.prisma.serviceSalesLead.findMany.mock.calls[0][0]).toMatchObject({ take: 20001 });
    expect(e!.tabla).toBeNull();
    expect(e!.avisos[e!.avisos.length - 1]).toContain("demasiados datos");
    expect(M.prisma.fotofficeJourney.findMany).not.toHaveBeenCalled();
  });

  it("período vacío: tabla con cero y sin consultar recorridos", async () => {
    const e = await cargarEmbudo(ctxDePrueba("w1"), {}, AHORA);
    expect(e!.tabla!.total.entraron).toBe(0);
    expect(M.prisma.fotofficeJourney.findMany).not.toHaveBeenCalled();
  });
});
