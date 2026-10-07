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
const numeroFindMany = vi.fn();
const categoriaFindFirst = vi.fn();
const categoriaFindMany = vi.fn();
const origenFindFirst = vi.fn();
const origenFindMany = vi.fn();
const miembroFindFirst = vi.fn();
const miembroFindMany = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    serviceSalesLead: { findMany: (...a: unknown[]) => leadFindMany(...a), count: (...a: unknown[]) => leadCount(...a) },
    fotofficeJourney: { findMany: (...a: unknown[]) => journeyFindMany(...a) },
    fotofficeCircuit: { findMany: (...a: unknown[]) => circuitFindMany(...a), findFirst: (...a: unknown[]) => circuitFindFirst(...a) },
    fotofficeStage: { findMany: (...a: unknown[]) => stageFindMany(...a), findFirst: (...a: unknown[]) => stageFindFirst(...a) },
    fotofficeRecordNumber: { findMany: (...a: unknown[]) => numeroFindMany(...a) },
    fotofficeConsultaCategoria: { findFirst: (...a: unknown[]) => categoriaFindFirst(...a), findMany: (...a: unknown[]) => categoriaFindMany(...a) },
    fotofficeOrigen: { findFirst: (...a: unknown[]) => origenFindFirst(...a), findMany: (...a: unknown[]) => origenFindMany(...a) },
    workspaceMembership: { findFirst: (...a: unknown[]) => miembroFindFirst(...a), findMany: (...a: unknown[]) => miembroFindMany(...a) },
  },
}));

import {
  avisoCaptacion,
  AVISO_DEMASIADAS,
  TOPE_SUBCONSULTA,
  diasEnEtapa,
  listadoCaptacion,
  ordenarPorNumero,
  rangoSiguienteAccion,
  resolverWhere,
  SIGUIENTE_ACCION,
  textoDeNumeroBuscado,
  whereCaptacion,
  whereRecorridos,
} from "./listado";
import { PARAMETROS_RESERVADOS, type ConsultaResuelta, type ContextoListado } from "@/lib/listado/tipos";
import { avisoDeCampos } from "@/lib/campos/listado";
import { recortarPorDinero } from "@/lib/listado/dinero";
import { formatoPesos } from "@/lib/consultas/valor";
import { SERVICE_LEADS_MODULE_KEY } from "./constants";
import { renderToStaticMarkup } from "react-dom/server";

const base = { q: "", filtros: {}, periodos: {}, etiquetasRelacion: {}, orden: { campo: "alta", desc: true }, pagina: 1, filas: 25, ver: null } as ConsultaResuelta;
const ctx: ContextoListado = { workspaceId: "w1", workspaceName: "W", userId: 1, userLabel: "u", role: "WORKSPACE_OWNER" };
const ahora = new Date("2026-09-30T15:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  numeroFindMany.mockResolvedValue([]);
});

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
    // Octubre en días de Buenos Aires, como lo da resolverPeriodo.
    const evento = { desde: new Date("2026-10-01T03:00:00Z"), hasta: new Date("2026-11-01T02:59:59.999Z") };
    const alta = { desde: new Date("2026-09-01T03:00:00Z"), hasta: new Date("2026-10-01T02:59:59.999Z") };
    const w = whereCaptacion("w1", { ...base, periodos: { evento, alta } }, null);
    // La fecha del evento es de calendario (medianoche UTC): los mismos días, en UTC.
    expect(w.eventDate).toEqual({ gte: new Date("2026-10-01T00:00:00.000Z"), lte: new Date("2026-10-31T23:59:59.999Z") });
    // El alta es un instante: queda en hora de Buenos Aires.
    expect(w.createdAt).toEqual({ gte: alta.desde, lte: alta.hasta });
  });
  it("un evento del 20/12 guardado a medianoche UTC entra en el filtro del 20/12 y no en el del 19/12", () => {
    const guardado = new Date("2026-12-20"); // así lo guarda el formulario público
    const dentro = (r: { gte?: unknown; lte?: unknown }) => guardado >= (r.gte as Date) && guardado <= (r.lte as Date);
    const del20 = whereCaptacion("w1", { ...base, periodos: { evento: { desde: new Date("2026-12-20T03:00:00Z"), hasta: new Date("2026-12-21T02:59:59.999Z") } } }, null);
    const del19 = whereCaptacion("w1", { ...base, periodos: { evento: { desde: new Date("2026-12-19T03:00:00Z"), hasta: new Date("2026-12-20T02:59:59.999Z") } } }, null);
    expect(dentro(del20.eventDate as { gte: Date; lte: Date })).toBe(true);
    expect(dentro(del19.eventDate as { gte: Date; lte: Date })).toBe(false);
  });
  it("los ids de la subconsulta acotan la consulta", () => {
    expect(whereCaptacion("w1", base, ["a", "b"]).id).toEqual({ in: ["a", "b"] });
  });
});

describe("campos personalizados en whereCaptacion", () => {
  it("la búsqueda suma los ids de los campos al OR y los filtros se intersecan con los recorridos", () => {
    const w = whereCaptacion("w1", { ...base, q: "boda", campos: { soloIds: ["l2", "l3"], buscarIds: ["l1", "l3"] } }, ["l2", "l3", "l4"]);
    expect(w.workspaceId).toBe("w1");
    // Fuera de la intersección (l1) igual quedaría afuera: no viaja.
    expect(w.OR).toContainEqual({ id: { in: ["l3"] } });
    expect(w.OR).toContainEqual({ name: { contains: "boda", mode: "insensitive" } });
    expect(w.id).toEqual({ in: ["l2", "l3"] });
    expect(w.AND).toBeUndefined();
  });
  it("sin recorridos, la búsqueda por número y la de campos van en una sola lista del OR", () => {
    const w = whereCaptacion("w1", { ...base, q: "42", campos: { soloIds: null, buscarIds: ["b", "c"] } }, null, ["a", "b"]);
    expect(w.OR).toContainEqual({ id: { in: ["a", "b", "c"] } });
    expect(w.id).toBeUndefined();
  });
  it("ninguna clave propia usa el prefijo de los campos personalizados", () => {
    for (const f of listadoCaptacion.filtros) expect(f.clave.startsWith("cf_")).toBe(false);
    for (const c of listadoCaptacion.columnas) expect(c.clave.startsWith("cf_")).toBe(false);
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
    expect(whereRecorridos("w1", { ...base, filtros: { vencidas: "si" } }, ahora).AND).toEqual([{ outcome: null }, { stageDueAt: { lt: ahora } }]);
    expect(whereRecorridos("w1", { ...base, filtros: { vencidas: "no" } }, ahora).AND).toEqual([
      { outcome: null },
      { OR: [{ stageDueAt: null }, { stageDueAt: { gte: ahora } }] },
    ]);
  });
  it("vencidas se combina con resultado en vez de pisarlo", () => {
    const abiertas = whereRecorridos("w1", { ...base, filtros: { resultado: "abierta", vencidas: "si" } }, ahora);
    expect(abiertas.outcome).toBeNull();
    expect(abiertas.AND).toContainEqual({ stageDueAt: { lt: ahora } });
    // Ganada + vencidas: outcome = GANADA y AND outcome = null no pueden cumplirse a la vez.
    const ganadas = whereRecorridos("w1", { ...base, filtros: { resultado: "GANADA", vencidas: "si" } }, ahora);
    expect(ganadas.outcome).toBe("GANADA");
    expect(ganadas.AND).toContainEqual({ outcome: null });
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
  it("pasado el tope no devuelve resultados parciales y avisa", async () => {
    journeyFindMany.mockResolvedValue(Array.from({ length: TOPE_SUBCONSULTA + 1 }, (_, i) => ({ subjectId: `s${i}` })));
    const c = { ...base, filtros: { resultado: "abierta" } };
    expect(await resolverWhere(ctx, c, ahora)).toEqual({ workspaceId: "w1", id: { in: [] } });
    expect(journeyFindMany.mock.calls[0][0].take).toBe(TOPE_SUBCONSULTA + 1);
    expect(journeyFindMany.mock.calls[0][0].orderBy).toBeDefined();
    expect(await avisoCaptacion(ctx, c, ahora)).toBe(AVISO_DEMASIADAS);
  });
  it("dentro del tope no hay aviso", async () => {
    journeyFindMany.mockResolvedValue([{ subjectId: "a" }]);
    expect(await avisoCaptacion(ctx, { ...base, filtros: { resultado: "abierta" } }, ahora)).toBeNull();
    expect(await avisoCaptacion(ctx, base, ahora)).toBeNull();
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
  it("acciones en lote con Gestionar (tope 200) y exporta correo y teléfono", () => {
    expect(listadoCaptacion.acciones.map((a) => a.clave)).toEqual(["responsable", "siguiente", "perdida", "circuito"]);
    for (const a of listadoCaptacion.acciones) {
      expect(a.capacidad).toBe("operar");
      expect(a.maximo).toBe(200);
    }
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
  it("/dashboard/service-leads redirige a /consultas", () => {
    expect(leer("app/dashboard/service-leads/page.tsx")).toContain('redirect("/consultas")');
  });
  it("el guarda es la puerta de main: módulo encendido y nivel por módulo", () => {
    const fuente = leer("lib/service-leads/access.ts");
    expect(fuente).toContain('requireServiceLeadsContext("VIEW")');
  });
  it("el menú y el registro de módulos apuntan a /consultas", () => {
    expect(leer("components/shell/shell-nav.tsx")).toContain('href: "/consultas"');
    expect(leer("lib/modules/registry.ts")).toContain('route: "/consultas"');
  });
  it("el grupo del menú se llama Consultas y su ítem no repite el nombre", () => {
    const nav = leer("components/shell/shell-nav.tsx");
    expect(nav).toContain('{ title: "Consultas", items: captacion');
    expect(nav).toContain('label: "Bandeja"');
    expect(nav).not.toContain('label: "Consultas"');
    expect(nav).not.toContain('title: "Captación"');
  });
});

describe("fecha del evento en la lista y en la exportación", () => {
  // El formulario público guarda `new Date("2026-12-20")`: medianoche UTC, que en Buenos Aires
  // es el 19/12 a las 21. Se tiene que ver 20/12.
  const fila = { id: "a", name: "Ana", email: null, phone: null, eventType: "BODA", eventDate: new Date("2026-12-20"), createdAt: ahora } as unknown as Parameters<typeof listadoCaptacion.exportar.columnas[number]["valor"]>[0];
  it("la celda muestra el día elegido, no el anterior", () => {
    const col = listadoCaptacion.columnas.find((c) => c.clave === "evento")!;
    expect(col.celda(fila)).toBe("20/12/2026");
  });
  it("la exportación también", () => {
    const col = listadoCaptacion.exportar.columnas.find((c) => c.titulo === "Fecha del evento")!;
    expect(col.valor(fila)).toBe("20/12/2026");
    expect(col.valor({ ...fila, eventDate: null } as typeof fila)).toBeNull();
  });
});

describe("número de consulta en la lista", () => {
  const fila = (id: string, createdAt = ahora) => ({ id, name: id, email: null, phone: null, eventType: "BODA", eventDate: null, createdAt });

  it("columna N° ordenable y exportada; búsqueda que nombra el número", () => {
    const col = listadoCaptacion.columnas.find((c) => c.clave === "numero");
    expect(col).toMatchObject({ titulo: "N°", orden: "numero" });
    expect(listadoCaptacion.ordenes).toContain("numero");
    expect(listadoCaptacion.exportar.columnas.map((c) => c.titulo)).toContain("N°");
    expect(listadoCaptacion.placeholderBusqueda).toMatch(/número/);
  });

  it("cada fila trae su número con una sola lectura por página; sin número, null", async () => {
    leadFindMany.mockResolvedValue([fila("a"), fila("b")]);
    journeyFindMany.mockResolvedValue([]);
    numeroFindMany.mockResolvedValue([{ entityId: "a", display: "2026-0042" }]);
    const filas = await listadoCaptacion.traer(ctx, base, { skip: 0, take: 25 });
    expect(filas.map((f) => [f.id, f.numero])).toEqual([["a", "2026-0042"], ["b", null]]);
    expect(numeroFindMany).toHaveBeenCalledTimes(1);
    expect(numeroFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", entityType: "CONSULTA", entityId: { in: ["a", "b"] } });
  });

  it("texto buscado: con dígitos, sin el «N°» de adelante", () => {
    expect(textoDeNumeroBuscado("2026-0042")).toBe("2026-0042");
    expect(textoDeNumeroBuscado(" 42 ")).toBe("42");
    expect(textoDeNumeroBuscado("N° 42")).toBe("42");
    expect(textoDeNumeroBuscado("nº0042")).toBe("0042");
    expect(textoDeNumeroBuscado("Nro. 7")).toBe("7");
    expect(textoDeNumeroBuscado("Nicolás")).toBeNull();
    expect(textoDeNumeroBuscado("")).toBeNull();
  });

  it("buscar por el número mostrado («2026-0042» o «42») suma esas consultas a la búsqueda", async () => {
    numeroFindMany.mockResolvedValue([{ entityId: "l42" }]);
    for (const q of ["2026-0042", "42"]) {
      numeroFindMany.mockClear();
      const w = await resolverWhere(ctx, { ...base, q }, ahora);
      expect(numeroFindMany.mock.calls[0][0].where).toEqual({
        workspaceId: "w1",
        entityType: "CONSULTA",
        display: { contains: q, mode: "insensitive" },
      });
      expect(w.workspaceId).toBe("w1");
      expect(w.OR).toContainEqual({ id: { in: ["l42"] } });
      expect(w.OR).toContainEqual({ name: { contains: q, mode: "insensitive" } });
    }
  });

  it("sin dígitos no busca números; si coinciden demasiados, no suma nada", async () => {
    await resolverWhere(ctx, { ...base, q: "boda" }, ahora);
    expect(numeroFindMany).not.toHaveBeenCalled();
    numeroFindMany.mockResolvedValue(Array.from({ length: TOPE_SUBCONSULTA + 1 }, (_, i) => ({ entityId: `n${i}` })));
    const w = await resolverWhere(ctx, { ...base, q: "2" }, ahora);
    expect(numeroFindMany.mock.calls[0][0].take).toBe(TOPE_SUBCONSULTA + 1);
    expect(w.OR).not.toContainEqual(expect.objectContaining({ id: expect.anything() }));
  });

  it("ordenar por número: año y valor; las sin número al final, en su orden", () => {
    const numeros = new Map([
      ["a", { year: 2026, value: 2 }],
      ["b", { year: 2025, value: 9 }],
      ["c", { year: 2026, value: 10 }],
    ]);
    // Llegan en orden de alta; "x" e "y" no tienen número.
    expect(ordenarPorNumero(["x", "b", "a", "y", "c"], numeros, false)).toEqual(["b", "a", "c", "x", "y"]);
    expect(ordenarPorNumero(["y", "c", "a", "x", "b"], numeros, true)).toEqual(["c", "a", "b", "y", "x"]);
  });

  it("traer con orden por número pagina sobre el orden por número y acota todo al workspace", async () => {
    // 1ª lectura: ids del resultado; 2ª: las filas de la página.
    leadFindMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }, { id: "c" }]).mockResolvedValueOnce([fila("a"), fila("c")]);
    journeyFindMany.mockResolvedValue([]);
    numeroFindMany
      .mockResolvedValueOnce([
        { entityId: "a", year: 2026, value: 3 },
        { entityId: "b", year: 2026, value: 1 },
        { entityId: "c", year: 2026, value: 2 },
      ])
      .mockResolvedValueOnce([
        { entityId: "a", display: "2026-0003" },
        { entityId: "c", display: "2026-0002" },
      ]);
    const filas = await listadoCaptacion.traer(ctx, { ...base, orden: { campo: "numero", desc: false } }, { skip: 1, take: 2 });
    expect(filas.map((f) => [f.id, f.numero])).toEqual([["c", "2026-0002"], ["a", "2026-0003"]]);
    expect(leadFindMany.mock.calls[0][0]).toMatchObject({ where: { workspaceId: "w1" }, select: { id: true }, take: TOPE_SUBCONSULTA + 1 });
    expect(leadFindMany.mock.calls[1][0].where).toEqual({ workspaceId: "w1", id: { in: ["c", "a"] } });
    expect(numeroFindMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "w1", entityType: "CONSULTA" });
  });

  it("traerIds con orden por número; pasado el tope, ordena por alta", async () => {
    leadFindMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    numeroFindMany.mockResolvedValueOnce([
      { entityId: "a", year: 2026, value: 5 },
      { entityId: "b", year: 2026, value: 4 },
    ]);
    expect(await listadoCaptacion.traerIds(ctx, { ...base, orden: { campo: "numero", desc: false } }, 10)).toEqual(["b", "a"]);

    leadFindMany.mockReset();
    leadFindMany
      .mockResolvedValueOnce(Array.from({ length: TOPE_SUBCONSULTA + 1 }, (_, i) => ({ id: `s${i}` })))
      .mockResolvedValueOnce([{ id: "s0" }]);
    expect(await listadoCaptacion.traerIds(ctx, { ...base, orden: { campo: "numero", desc: true } }, 10)).toEqual(["s0"]);
    expect(leadFindMany.mock.calls[1][0]).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10 });
  });

  it("con recorridos, la búsqueda por número sólo lleva los ids que están en ellos; juntas no pasan el tope", () => {
    const rango = (pre: string, n: number) => Array.from({ length: n }, (_, i) => `${pre}${i}`);
    const q = { ...base, q: "2026" };
    // Intersección: sólo viajan los números que están entre los recorridos.
    const chica = whereCaptacion("w1", q, ["a", "b", "c"], ["b", "z", "c", "y"]);
    expect(chica.OR).toContainEqual({ id: { in: ["b", "c"] } });

    // Debajo del tope, las dos listas viajan (sin los ajenos a los recorridos).
    const media = whereCaptacion("w1", q, rango("r", 10_000), [...rango("r", 5_000), ...rango("n", 20_000)]);
    expect(parametros(media)).toBe(15_000);

    // Listas grandes: recorridos al tope y números que también caen en ellos → vacía, nunca parcial.
    const grande = whereCaptacion("w1", q, rango("r", TOPE_SUBCONSULTA), rango("r", TOPE_SUBCONSULTA / 2));
    expect(grande).toEqual({ workspaceId: "w1", id: { in: [] } });
  });

  it("listas de 15.000 y 18.000: ninguna consulta pasa el presupuesto y aparece el aviso", async () => {
    const rango = (pre: string, n: number) => Array.from({ length: n }, (_, i) => `${pre}${i}`);
    const recorridos = rango("x", 15_000);
    const camposBusqueda = rango("x", 18_000);
    journeyFindMany.mockResolvedValue(recorridos.map((subjectId) => ({ subjectId })));
    leadFindMany.mockResolvedValue([]);
    leadCount.mockResolvedValue(0);

    // Recorridos (AND, 15.000) + búsqueda en campos (OR, 18.000; 15.000 dentro de los recorridos).
    const c = { ...base, q: "boda", filtros: { etapa: "e1" }, campos: { soloIds: null, buscarIds: camposBusqueda } };
    expect(await listadoCaptacion.contar(ctx, c)).toBe(0);
    await listadoCaptacion.traer(ctx, c, { skip: 0, take: 25 });
    await listadoCaptacion.traerIds(ctx, { ...c, orden: { campo: "numero", desc: false } }, 10);
    for (const [args] of [...leadCount.mock.calls, ...leadFindMany.mock.calls]) {
      expect(parametros(args.where)).toBeLessThanOrEqual(TOPE_SUBCONSULTA);
      expect(args.where).toEqual({ workspaceId: "w1", id: { in: [] } });
    }
    expect(await avisoCaptacion(ctx, c, ahora)).toBe(AVISO_DEMASIADAS);

    // Sin recorridos: 15.000 números + 18.000 de campos, disjuntos → 33.000.
    numeroFindMany.mockResolvedValue(rango("n", 15_000).map((entityId) => ({ entityId })));
    const sinRecorridos = { ...base, q: "2", campos: { soloIds: null, buscarIds: camposBusqueda } };
    const w = await resolverWhere(ctx, sinRecorridos, ahora);
    expect(w).toEqual({ workspaceId: "w1", id: { in: [] } });
    expect(await avisoCaptacion(ctx, sinRecorridos, ahora)).toBe(avisoDeCampos("consultas"));

    // Dentro del presupuesto no hay aviso.
    expect(await avisoCaptacion(ctx, { ...sinRecorridos, campos: { soloIds: null, buscarIds: rango("x", 4_000) } }, ahora)).toBeNull();
  });
});

/** Parámetros de ids de un `where` de Captación: el `id IN` y los del OR de la búsqueda. */
function parametros(w: { id?: unknown; OR?: unknown[]; AND?: unknown }): number {
  const enId = (w.id as { in?: string[] } | undefined)?.in?.length ?? 0;
  const enOr = (w.OR ?? []).reduce<number>((n, o) => n + ((o as { id?: { in?: string[] } }).id?.in?.length ?? 0), 0);
  const enAnd = ((w.AND as { id?: { in?: string[] } }[] | undefined) ?? []).reduce<number>((n, o) => n + (o.id?.in?.length ?? 0), 0);
  return enId + enOr + enAnd;
}

describe("etapa 1: columnas y filtros de Consultas", () => {
  // Miércoles 07/10/2026, 12:00 en Buenos Aires.
  const miercoles = new Date("2026-10-07T15:00:00.000Z");
  const fila = (extra: Record<string, unknown> = {}) =>
    ({ id: "a", name: "Ana", email: null, phone: null, eventType: "BODA", eventDate: null, createdAt: ahora, fotofficeConsulta: null, recorrido: null, numero: null, ...extra }) as never;
  const columna = (clave: string) => listadoCaptacion.columnas.find((c) => c.clave === clave)!;

  it("columnas nuevas: categoría (o el tipo viejo), origen, valor en pesos y responsable", () => {
    expect(listadoCaptacion.columnas.map((c) => c.clave)).toEqual(expect.arrayContaining(["categoria", "origen", "valor", "responsable"]));
    const conFicha = fila({ fotofficeConsulta: { estimatedValue: { toString: () => "1250000.50" }, category: { name: "Boda civil" }, origin: { name: "Instagram" } } });
    expect(columna("categoria").celda(conFicha)).toBe("Boda civil");
    expect(columna("categoria").celda(fila())).toBe("Boda");
    expect(columna("origen").celda(conFicha)).toBe("Instagram");
    expect(columna("origen").celda(fila())).toBe("—");
    expect(renderToStaticMarkup(columna("valor").celda(conFicha) as never)).toContain(formatoPesos(1250000.5));
    expect(columna("valor").celda(fila())).toBe("—");
    expect(columna("responsable").celda(fila({ recorrido: { responsable: "Beto" } }))).toBe("Beto");
    expect(columna("responsable").celda(fila())).toBe("—");
  });

  it("el valor se ve y se exporta con Ver en Consultas, sin permiso de plata", () => {
    const soloVer: ContextoListado = { ...ctx, role: "STAFF", acceso: { role: "STAFF", levels: { [SERVICE_LEADS_MODULE_KEY]: "VIEW" } } };
    const def = recortarPorDinero(listadoCaptacion, soloVer);
    expect(def.columnas.map((c) => c.clave)).toContain("valor");
    expect(def.exportar.columnas.map((c) => c.titulo)).toEqual(expect.arrayContaining(["Categoría", "Origen", "Valor estimado", "Responsable"]));
  });

  it("filtros nuevos declarados sin claves reservadas", () => {
    const claves = listadoCaptacion.filtros.map((f) => f.clave);
    expect(claves).toEqual(expect.arrayContaining(["categoria", "origen", "responsable", "siguiente"]));
    expect(listadoCaptacion.filtros.find((f) => f.clave === "siguiente")).toMatchObject({ tipo: "opcion", opciones: SIGUIENTE_ACCION });
  });

  it("categoría y origen filtran por la ficha de la consulta, acotada al workspace", () => {
    const w = whereCaptacion("w1", { ...base, filtros: { categoria: "cat1", origen: "or1" } }, null);
    expect(w).toEqual({ workspaceId: "w1", fotofficeConsulta: { is: { workspaceId: "w1", categoryId: "cat1", originId: "or1" } } });
  });

  it("siguiente acción: vencida antes de ahora; hoy y esta semana (lunes a domingo, hora AR) desde ahora", () => {
    expect(rangoSiguienteAccion("vencida", miercoles)).toEqual({ lt: miercoles });
    expect(rangoSiguienteAccion("hoy", miercoles)).toEqual({ gte: miercoles, lte: new Date("2026-10-08T02:59:59.999Z") });
    // Domingo 11/10 a las 23:59:59.999 de Buenos Aires.
    expect(rangoSiguienteAccion("semana", miercoles)).toEqual({ gte: miercoles, lte: new Date("2026-10-12T02:59:59.999Z") });
    // Domingo a la noche: la semana termina ese mismo día.
    const domingo = new Date("2026-10-12T01:00:00.000Z");
    expect(rangoSiguienteAccion("semana", domingo)).toEqual({ gte: domingo, lte: new Date("2026-10-12T02:59:59.999Z") });
    expect(rangoSiguienteAccion("otra", miercoles)).toBeNull();
  });

  it("responsable y siguiente acción van por la subconsulta de recorridos abiertos del workspace", async () => {
    const c = { ...base, filtros: { responsable: "8", siguiente: "hoy" } };
    expect(whereRecorridos("w1", c, miercoles)).toEqual({
      workspaceId: "w1",
      subjectType: "CAPTACION",
      kind: "VENTA",
      AND: [
        { outcome: null, ownerUserId: 8 },
        { outcome: null, stageDueAt: { gte: miercoles, lte: new Date("2026-10-08T02:59:59.999Z") } },
      ],
    });
    journeyFindMany.mockResolvedValue([{ subjectId: "a" }]);
    expect(await resolverWhere(ctx, c, miercoles)).toEqual({ workspaceId: "w1", id: { in: ["a"] } });
    expect(journeyFindMany.mock.calls[0][0].where.workspaceId).toBe("w1");
  });

  it("presupuesto de ids conjunto: el filtro de responsable comparte el tope con la búsqueda en campos", async () => {
    const rango = (pre: string, n: number) => Array.from({ length: n }, (_, i) => `${pre}${i}`);
    journeyFindMany.mockResolvedValue(rango("x", 12_000).map((subjectId) => ({ subjectId })));
    // AND: 12.000 (recorridos ∩ campos) + OR: 9.000 dentro de ellos = 21.000 > 20.000.
    const c = { ...base, q: "boda", filtros: { responsable: "8" }, campos: { soloIds: rango("x", 12_000), buscarIds: rango("x", 9_000) } };
    expect(await resolverWhere(ctx, c, ahora)).toEqual({ workspaceId: "w1", id: { in: [] } });
    expect(await avisoCaptacion(ctx, c, ahora)).toBe(AVISO_DEMASIADAS);
  });

  it("validarRelacion: categoría, origen y responsable sólo del workspace", async () => {
    categoriaFindFirst.mockResolvedValue({ name: "Boda" });
    expect(await listadoCaptacion.validarRelacion!(ctx, "categoria", "cat1")).toBe("Boda");
    expect(categoriaFindFirst.mock.calls[0][0].where).toEqual({ id: "cat1", workspaceId: "w1" });
    origenFindFirst.mockResolvedValue(null);
    expect(await listadoCaptacion.validarRelacion!(ctx, "origen", "ajeno")).toBeNull();
    expect(origenFindFirst.mock.calls[0][0].where).toEqual({ id: "ajeno", workspaceId: "w1" });
    miembroFindFirst.mockResolvedValue({ user: { name: " Beto ", email: null } });
    expect(await listadoCaptacion.validarRelacion!(ctx, "responsable", "8")).toBe("Beto");
    expect(miembroFindFirst.mock.calls[0][0].where).toEqual({ workspaceId: "w1", userId: 8 });
    miembroFindFirst.mockClear();
    expect(await listadoCaptacion.validarRelacion!(ctx, "responsable", "abc")).toBeNull();
    expect(await listadoCaptacion.validarRelacion!(ctx, "responsable", "0")).toBeNull();
    expect(miembroFindFirst).not.toHaveBeenCalled();
  });

  it("opciones de categoría y origen del workspace (las archivadas, marcadas)", async () => {
    categoriaFindMany.mockResolvedValue([{ id: "c1", name: "Boda", archivedAt: null }, { id: "c2", name: "XV", archivedAt: ahora }]);
    expect(await listadoCaptacion.opcionesRelacion!(ctx, "categoria")).toEqual([
      { valor: "c1", etiqueta: "Boda" },
      { valor: "c2", etiqueta: "XV (archivada)" },
    ]);
    expect(categoriaFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1" });
    origenFindMany.mockResolvedValue([]);
    await listadoCaptacion.opcionesRelacion!(ctx, "origen");
    expect(origenFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1" });
  });

  it("el responsable de cada fila sale de una sola lectura del equipo del workspace", async () => {
    leadFindMany.mockResolvedValue([fila({ id: "a" }), fila({ id: "b" })]);
    journeyFindMany.mockResolvedValue([
      { subjectId: "a", outcome: null, enteredStageAt: ahora, stageDueAt: null, ownerUserId: 8, circuit: { name: "V" }, stage: null },
      { subjectId: "b", outcome: null, enteredStageAt: ahora, stageDueAt: null, ownerUserId: 99, circuit: { name: "V" }, stage: null },
    ]);
    miembroFindMany.mockResolvedValue([{ userId: 8, user: { name: "Beto", email: null } }]);
    const filas = await listadoCaptacion.traer(ctx, base, { skip: 0, take: 25 });
    expect(filas.map((f) => f.recorrido?.responsable)).toEqual(["Beto", "Usuario 99"]);
    expect(miembroFindMany).toHaveBeenCalledTimes(1);
    expect(miembroFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", userId: { in: [8, 99] } });
  });
});
