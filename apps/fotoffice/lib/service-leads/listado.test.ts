import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leadFindMany = vi.fn();
const leadCount = vi.fn();
const journeyFindMany = vi.fn();
const circuitFindMany = vi.fn();
const circuitFindFirst = vi.fn();
const stageFindMany = vi.fn();
const stageFindFirst = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    serviceSalesLead: { findMany: (...a: unknown[]) => leadFindMany(...a), count: (...a: unknown[]) => leadCount(...a) },
    fotofficeJourney: { findMany: (...a: unknown[]) => journeyFindMany(...a) },
    fotofficeCircuit: { findMany: (...a: unknown[]) => circuitFindMany(...a), findFirst: (...a: unknown[]) => circuitFindFirst(...a) },
    fotofficeStage: { findMany: (...a: unknown[]) => stageFindMany(...a), findFirst: (...a: unknown[]) => stageFindFirst(...a) },
  },
}));

import { diasEnEtapa, listadoCaptacion, resolverWhere, whereCaptacion, whereRecorridos } from "./listado";
import { PARAMETROS_RESERVADOS, type ConsultaResuelta, type ContextoListado } from "@/lib/listado/tipos";

const base = { q: "", filtros: {}, periodos: {}, etiquetasRelacion: {}, orden: { campo: "alta", desc: true }, pagina: 1, filas: 25, ver: null } as ConsultaResuelta;
const ctx: ContextoListado = { workspaceId: "w1", workspaceName: "W", userId: 1, userLabel: "u", role: "WORKSPACE_OWNER" };
const ahora = new Date("2026-09-30T15:00:00.000Z");

beforeEach(() => vi.clearAllMocks());

describe("whereCaptacion", () => {
  it("siempre filtra por workspace", () => expect(whereCaptacion("w1", base, null)).toEqual({ workspaceId: "w1" }));
  it("busca por nombre, correo, teléfono y tipo de evento (también por su etiqueta)", () => {
    const w = whereCaptacion("w1", { ...base, q: "boda" }, null);
    expect(w.workspaceId).toBe("w1");
    expect(w.OR).toContainEqual({ name: { contains: "boda", mode: "insensitive" } });
    expect(w.OR).toContainEqual({ email: { contains: "boda", mode: "insensitive" } });
    expect(w.OR).toContainEqual({ phone: { contains: "boda" } });
    expect(w.OR).toContainEqual({ eventType: { in: ["BODA"] } });
  });
  it("períodos de evento y alta", () => {
    const evento = { desde: new Date("2026-10-01T03:00:00Z"), hasta: new Date("2026-10-31T02:59:59.999Z") };
    const alta = { desde: new Date("2026-09-01T03:00:00Z"), hasta: new Date("2026-09-30T02:59:59.999Z") };
    const w = whereCaptacion("w1", { ...base, periodos: { evento, alta } }, null);
    expect(w.eventDate).toEqual({ gte: evento.desde, lte: evento.hasta });
    expect(w.createdAt).toEqual({ gte: alta.desde, lte: alta.hasta });
  });
  it("los ids de la subconsulta acotan la consulta", () => {
    expect(whereCaptacion("w1", base, ["a", "b"]).id).toEqual({ in: ["a", "b"] });
  });
});

describe("whereRecorridos", () => {
  it("siempre acota a workspace, Captación y venta", () => {
    expect(whereRecorridos("w1", base, ahora)).toEqual({ workspaceId: "w1", subjectType: "CAPTACION", kind: "VENTA" });
  });
  it("traduce circuito, etapa y resultado", () => {
    const w = whereRecorridos("w1", { ...base, filtros: { circuito: "c1", etapa: "e1", resultado: "GANADA" } }, ahora);
    expect(w).toMatchObject({ workspaceId: "w1", circuitId: "c1", stageId: "e1", outcome: "GANADA" });
    expect(whereRecorridos("w1", { ...base, filtros: { resultado: "abierta" } }, ahora).outcome).toBeNull();
  });
  it("vencidas: abiertas con vencimiento pasado; en plazo: sin vencimiento o futuro", () => {
    expect(whereRecorridos("w1", { ...base, filtros: { vencidas: "si" } }, ahora)).toMatchObject({ outcome: null, stageDueAt: { lt: ahora } });
    expect(whereRecorridos("w1", { ...base, filtros: { vencidas: "no" } }, ahora)).toMatchObject({
      outcome: null,
      OR: [{ stageDueAt: null }, { stageDueAt: { gte: ahora } }],
    });
  });
});

describe("resolverWhere", () => {
  it("sin filtros de recorrido no hay subconsulta", async () => {
    expect(await resolverWhere(ctx, base, ahora)).toEqual({ workspaceId: "w1" });
    expect(journeyFindMany).not.toHaveBeenCalled();
  });
  it("con filtros resuelve los ids con una subconsulta acotada al workspace", async () => {
    journeyFindMany.mockResolvedValue([{ subjectId: "a" }, { subjectId: "b" }, { subjectId: "a" }]);
    const w = await resolverWhere(ctx, { ...base, filtros: { etapa: "e1" } }, ahora);
    expect(journeyFindMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "w1", subjectType: "CAPTACION", stageId: "e1" });
    expect(journeyFindMany.mock.calls[0][0].select).toEqual({ subjectId: true });
    expect(w).toEqual({ workspaceId: "w1", id: { in: ["a", "b"] } });
  });
  it("si ningún recorrido coincide, la lista queda vacía", async () => {
    journeyFindMany.mockResolvedValue([]);
    expect((await resolverWhere(ctx, { ...base, filtros: { resultado: "PERDIDA" } }, ahora)).id).toEqual({ in: [] });
  });
});

describe("definición", () => {
  it("ninguna clave de filtro está reservada", () => {
    for (const f of listadoCaptacion.filtros) expect(PARAMETROS_RESERVADOS as readonly string[]).not.toContain(f.clave);
  });
  it("los órdenes incluyen el de por defecto y los de las columnas", () => {
    expect(listadoCaptacion.ordenes).toContain(listadoCaptacion.ordenPorDefecto.campo);
    for (const c of listadoCaptacion.columnas) if (c.orden) expect(listadoCaptacion.ordenes).toContain(c.orden);
  });
  it("no tiene acciones en lote y exporta correo y teléfono", () => {
    expect(listadoCaptacion.acciones).toEqual([]);
    const titulos = listadoCaptacion.exportar.columnas.map((c) => c.titulo);
    expect(titulos).toEqual(expect.arrayContaining(["Correo", "Teléfono"]));
  });
  it("días en la etapa", () => {
    expect(diasEnEtapa(new Date("2026-09-27T12:00:00Z"), ahora)).toBe(3);
    expect(diasEnEtapa(new Date("2026-10-05T12:00:00Z"), ahora)).toBe(0);
  });
});

describe("acceso a filas", () => {
  it("contar, traer y traerIds filtran por workspace", async () => {
    leadCount.mockResolvedValue(0);
    leadFindMany.mockResolvedValue([]);
    await listadoCaptacion.contar(ctx, base);
    await listadoCaptacion.traer(ctx, base, { skip: 0, take: 25 });
    await listadoCaptacion.traerIds(ctx, base, 100);
    expect(leadCount.mock.calls[0][0].where.workspaceId).toBe("w1");
    for (const call of leadFindMany.mock.calls) expect(call[0].where.workspaceId).toBe("w1");
  });
  it("traerPorIds conserva el orden, filtra por workspace e ignora ids mal formados", async () => {
    const fila = (id: string) => ({ id, name: id, email: null, phone: null, eventType: "BODA", eventDate: null, createdAt: ahora });
    leadFindMany.mockResolvedValue([fila("a"), fila("b"), fila("c")]);
    journeyFindMany.mockResolvedValue([
      { subjectId: "a", outcome: null, enteredStageAt: ahora, stageDueAt: null, circuit: { name: "Ventas" }, stage: { name: "Nuevo", color: "azul" } },
    ]);
    const filas = await listadoCaptacion.traerPorIds(ctx, ["c", "no valido!", "a", "b", "../x"]);
    expect(filas.map((f) => f.id)).toEqual(["c", "a", "b"]);
    expect(filas.find((f) => f.id === "a")?.recorrido?.etapa?.nombre).toBe("Nuevo");
    expect(filas.find((f) => f.id === "b")?.recorrido).toBeNull();
    expect(leadFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", id: { in: ["c", "a", "b"] } });
    expect(journeyFindMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "w1", subjectType: "CAPTACION" });
  });
  it("traerPorIds sin ids válidos no consulta", async () => {
    expect(await listadoCaptacion.traerPorIds(ctx, ["!!"])).toEqual([]);
    expect(leadFindMany).not.toHaveBeenCalled();
  });
  it("validarRelacion acota circuitos y etapas al workspace y a ventas", async () => {
    circuitFindFirst.mockResolvedValue(null);
    stageFindFirst.mockResolvedValue({ name: "Nuevo" });
    expect(await listadoCaptacion.validarRelacion!(ctx, "circuito", "ajeno")).toBeNull();
    expect(circuitFindFirst.mock.calls[0][0].where).toEqual({ id: "ajeno", workspaceId: "w1", kind: "VENTA" });
    expect(await listadoCaptacion.validarRelacion!(ctx, "etapa", "e1")).toBe("Nuevo");
    expect(stageFindFirst.mock.calls[0][0].where).toEqual({ id: "e1", circuit: { workspaceId: "w1", kind: "VENTA" } });
    expect(await listadoCaptacion.validarRelacion!(ctx, "etapa", "no valido!")).toBeNull();
  });
  it("las opciones de circuito y etapa salen del workspace", async () => {
    circuitFindMany.mockResolvedValue([{ id: "c1", name: "Bodas" }]);
    stageFindMany.mockResolvedValue([{ id: "e1", name: "Nuevo", circuit: { name: "Bodas" } }]);
    expect(await listadoCaptacion.opcionesRelacion!(ctx, "circuito")).toEqual([{ valor: "c1", etiqueta: "Bodas" }]);
    expect(await listadoCaptacion.opcionesRelacion!(ctx, "etapa")).toEqual([{ valor: "e1", etiqueta: "Nuevo" }]);
    expect(circuitFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", kind: "VENTA" });
    expect(stageFindMany.mock.calls[0][0].where).toEqual({ circuit: { workspaceId: "w1", kind: "VENTA" } });
  });
});

describe("rutas y guarda (prueba de fuente)", () => {
  const leer = (ruta: string) => readFileSync(resolve(__dirname, "../..", ruta), "utf8");
  it("/dashboard/service-leads redirige a /captacion", () => {
    expect(leer("app/dashboard/service-leads/page.tsx")).toContain('redirect("/captacion")');
  });
  it("el guarda exige el módulo encendido", () => {
    const fuente = leer("lib/service-leads/access.ts");
    expect(fuente).toContain("isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY)");
  });
  it("el menú y el registro de módulos apuntan a /captacion", () => {
    expect(leer("components/shell/shell-nav.tsx")).toContain('href: "/captacion"');
    expect(leer("lib/modules/registry.ts")).toContain('route: "/captacion"');
  });
});
