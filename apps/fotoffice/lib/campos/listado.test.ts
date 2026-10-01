import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: async () => ({ plural: "socios" }) }));

const L = await import("./listado");
const { PARAMETROS_RESERVADOS } = await import("@/lib/listado/tipos");
const { resolverPeriodo } = await import("@/lib/listado/periodos");
import type { ConsultaResuelta, ContextoListado, DefinicionListado } from "@/lib/listado/tipos";

const CTX: ContextoListado = { workspaceId: "ws-1", workspaceName: "W", userId: 1, userLabel: "Ana", role: "STAFF" };
const OTRO: ContextoListado = { ...CTX, workspaceId: "ws-2" };
const BASE: ConsultaResuelta = {
  q: "", filtros: {}, periodos: {}, etiquetasRelacion: {}, orden: { campo: "numero", desc: true }, pagina: 1, filas: 25, ver: null,
};

function campo(id: string, extra: Record<string, unknown>) {
  B.agregar("fotofficeCustomField", { id, workspaceId: "ws-1", entityType: "CLIENTE", key: id, name: id, type: "TEXTO", ...extra });
}
function valor(entityId: string, fieldId: string, extra: Record<string, unknown>, workspaceId = "ws-1") {
  B.agregar("fotofficeCustomValue", { workspaceId, fieldId, entityType: "CLIENTE", entityId, ...extra });
}

function sembrar() {
  campo("archivos", { name: "Archivos", type: "ENLACE", order: 0, showInList: true });
  campo("estilo", { name: "Estilo", type: "LISTA", order: 1, showInList: true });
  campo("monto", { name: "Monto", type: "NUMERO", order: 2 });
  campo("boda", { name: "Boda", type: "FECHA", order: 3, showInList: true });
  campo("vip", { name: "VIP", type: "SI_NO", order: 4 });
  campo("notas", { name: "Notas", type: "TEXTO_LARGO", order: 5 });
  campo("viejo", { name: "Viejo", type: "LISTA", order: 6, showInList: true, archivedAt: new Date("2026-01-01T00:00:00Z") });
  // Otro tipo de registro y otro workspace: nunca aparecen.
  campo("socio", { name: "Del socio", entityType: "SOCIO", showInList: true });
  B.agregar("fotofficeCustomField", { id: "ajeno", workspaceId: "ws-2", entityType: "CLIENTE", key: "ajeno", name: "Ajeno", type: "SI_NO", showInList: true });
  B.agregar("fotofficeCustomFieldOption", { id: "o-clasico", fieldId: "estilo", label: "Clásico", order: 0 });
  B.agregar("fotofficeCustomFieldOption", { id: "o-moderno", fieldId: "estilo", label: "Moderno", order: 1 });
  B.agregar("fotofficeCustomFieldOption", { id: "o-retro", fieldId: "estilo", label: "Retro", order: 2, archivedAt: new Date() });
  B.agregar("fotofficeCustomFieldOption", { id: "o-viejo", fieldId: "viejo", label: "Viejo", order: 0 });

  valor("c1", "archivos", { valueText: "https://drive.example.com/Boda-Ana" });
  valor("c1", "estilo", { optionId: "o-clasico" });
  valor("c1", "monto", { valueNumber: "1500.5" });
  valor("c1", "boda", { valueDate: new Date("2026-10-01T00:00:00Z") });
  valor("c1", "vip", { valueBool: true });
  valor("c2", "estilo", { optionId: "o-moderno" });
  valor("c2", "notas", { valueText: "Pidió álbum de BODA en cuero" });
  valor("c2", "boda", { valueDate: new Date("2026-09-30T00:00:00Z") });
  valor("c2", "vip", { valueBool: false });
  valor("c3", "estilo", { optionId: "o-retro" });
  valor("c3", "monto", { valueNumber: "999" });
  // Un valor de otro workspace colgado del mismo campo y la misma opción: la subconsulta no lo ve.
  valor("cx", "estilo", { optionId: "o-clasico" }, "ws-2");
  valor("cx", "archivos", { valueText: "https://boda.example.com" }, "ws-2");
}

/** La subconsulta del campo VIP con "Sí" devuelve una fila más que el tope. */
function demasiados() {
  const original = B.tablas.fotofficeCustomValue.findMany;
  vi.spyOn(B.tablas.fotofficeCustomValue, "findMany").mockImplementation((async (a: { where?: Record<string, unknown>; take?: number }) => {
    if (a.where?.fieldId === "vip" && a.where?.valueBool === true) {
      return Array.from({ length: a.take ?? 0 }, (_, i) => ({ entityId: `m${i}` }));
    }
    return original(a);
  }) as typeof original);
}

beforeEach(() => {
  vi.restoreAllMocks();
  B.vaciar();
  sembrar();
});

describe("camposParaListado", () => {
  it("columnas: sólo campos activos con 'mostrar en el listado', del workspace y del tipo, en orden", async () => {
    const c = await L.camposParaListado(CTX, "CLIENTE");
    expect(c.columnas.map((x) => x.clave)).toEqual(["cf_archivos", "cf_estilo", "cf_boda"]);
    expect(c.columnas.every((x) => x.secundaria)).toBe(true);
    expect(c.campos.map((x) => x.id)).not.toContain("viejo");
    expect((await L.camposParaListado(OTRO, "CLIENTE")).columnas.map((x) => x.titulo)).toEqual(["Ajeno"]);
  });

  it("filtros: Lista con sus opciones activas, Sí/No y Fecha; Número y textos no filtran", async () => {
    const { filtros } = await L.camposParaListado(CTX, "CLIENTE");
    expect(filtros).toEqual([
      { tipo: "opcion", clave: "cf_estilo", etiqueta: "Estilo", opciones: [{ valor: "o-clasico", etiqueta: "Clásico" }, { valor: "o-moderno", etiqueta: "Moderno" }] },
      { tipo: "periodo", clave: "cf_boda", etiqueta: "Boda" },
      { tipo: "siNo", clave: "cf_vip", etiqueta: "VIP", si: "Sí", no: "No" },
    ]);
  });

  it("ninguna clave choca con los parámetros reservados del motor", async () => {
    const { filtros, columnas } = await L.camposParaListado(CTX, "CLIENTE");
    for (const r of PARAMETROS_RESERVADOS) {
      expect(r.startsWith(L.PREFIJO_CAMPO)).toBe(false);
      expect([...filtros, ...columnas].map((x) => x.clave)).not.toContain(r);
    }
  });

  it("exportación: todos los activos (no sólo los del listado) como texto legible", async () => {
    const c = await L.camposParaListado(CTX, "CLIENTE");
    expect(c.columnasExport.map((x) => x.titulo)).toEqual(["Archivos", "Estilo", "Monto", "Boda", "VIP", "Notas"]);
    const valores = await c.cargarValores(["c1", "c3"]);
    const fila = { valoresCampos: valores.get("c1") };
    expect(c.columnasExport.map((x) => x.valor(fila))).toEqual(["https://drive.example.com/Boda-Ana", "Clásico", "1500,5", "01/10/2026", "Sí", null]);
    // Una opción archivada se sigue leyendo.
    expect(c.columnasExport[1].valor({ valoresCampos: valores.get("c3") })).toBe("Retro");
  });

  it("celdas como en la ficha: fecha tal cual, Sí/No, enlace clicable y guion si está vacío", async () => {
    const c = await L.camposParaListado(CTX, "CLIENTE");
    const valores = await c.cargarValores(["c1", "c2"]);
    const html = (clave: string, id: string) =>
      renderToStaticMarkup(c.columnas.find((x) => x.clave === clave)!.celda({ valoresCampos: valores.get(id) }));
    expect(html("cf_boda", "c1")).toBe("01/10/2026");
    expect(html("cf_archivos", "c1")).toContain('href="https://drive.example.com/Boda-Ana"');
    expect(html("cf_archivos", "c1")).toContain('rel="noopener noreferrer"');
    expect(html("cf_archivos", "c2")).toContain("—");
  });
});

describe("restricción de filtros y búsqueda", () => {
  it("el filtro por opción se traduce a ids de la subconsulta acotada al workspace", async () => {
    const c = await L.camposParaListado(CTX, "CLIENTE");
    const r = await c.restriccion({ ...BASE, filtros: { cf_estilo: "o-clasico" } });
    expect(r).toEqual({ soloIds: ["c1"], buscarIds: [], excedido: false });
  });

  it("Sí/No y la intersección de varios filtros", async () => {
    const c = await L.camposParaListado(CTX, "CLIENTE");
    expect((await c.restriccion({ ...BASE, filtros: { cf_vip: "no" } })).soloIds).toEqual(["c2"]);
    expect((await c.restriccion({ ...BASE, filtros: { cf_vip: "si", cf_estilo: "o-moderno" } })).soloIds).toEqual([]);
  });

  it("Fecha: el período en hora argentina se compara con el día guardado, sin correrlo", async () => {
    const c = await L.camposParaListado(CTX, "CLIENTE");
    const hoy = resolverPeriodo("hoy", "2026-10-01")!;
    expect((await c.restriccion({ ...BASE, filtros: { cf_boda: "hoy" }, periodos: { cf_boda: hoy } })).soloIds).toEqual(["c1"]);
    const rango = resolverPeriodo("2026-09-01..2026-09-30", "2026-10-01")!;
    expect((await c.restriccion({ ...BASE, filtros: { cf_boda: "x" }, periodos: { cf_boda: rango } })).soloIds).toEqual(["c2"]);
  });

  it("búsqueda: texto, texto largo y enlace, sin distinguir mayúsculas, sólo del workspace", async () => {
    const c = await L.camposParaListado(CTX, "CLIENTE");
    expect((await c.condicionBusqueda("boda"))?.sort()).toEqual(["c1", "c2"]);
    // Número no entra en la búsqueda.
    expect(await c.condicionBusqueda("999")).toEqual([]);
    const r = await c.restriccion({ ...BASE, q: "cuero" });
    expect(r).toEqual({ soloIds: null, buscarIds: ["c2"], excedido: false });
  });

  it("pasado el tope no hay resultados parciales: lista vacía y excedido", async () => {
    demasiados();
    const c = await L.camposParaListado(CTX, "CLIENTE");
    expect(await c.restriccion({ ...BASE, filtros: { cf_vip: "si" } })).toEqual({ soloIds: [], buscarIds: [], excedido: true });
  });
});

type Fila = { id: string; nombre: string };

function definicionFalsa(vistas: ConsultaResuelta[]): DefinicionListado<Fila> {
  const filas: Fila[] = [{ id: "c1", nombre: "Ana" }, { id: "c2", nombre: "Bea" }];
  return {
    clave: "clientes",
    titulo: "Clientes",
    sustantivo: { singular: "cliente", plural: "clientes" },
    placeholderBusqueda: "",
    columnas: [{ clave: "nombre", titulo: "Nombre", celda: (f) => f.nombre }],
    filtros: [{ tipo: "siNo", clave: "movimientos", etiqueta: "Movimientos", si: "Con", no: "Sin" }],
    ordenes: ["numero"],
    ordenPorDefecto: { campo: "numero", desc: true },
    idDe: (f) => f.id,
    hrefFicha: (id) => `/clientes/${id}`,
    contar: async (_ctx, c) => {
      vistas.push(c);
      return filas.length;
    },
    traer: async (_ctx, c) => {
      vistas.push(c);
      return filas;
    },
    traerIds: async () => filas.map((f) => f.id),
    traerPorIds: async (_ctx, ids) => filas.filter((f) => ids.includes(f.id)),
    acciones: [],
    exportar: { columnas: [{ titulo: "Nombre", tipo: "texto", valor: (f) => f.nombre }] },
  };
}

describe("conCampos", () => {
  it("suma columnas, filtros y exportación al final, sin tocar los de la lista", async () => {
    const def = L.conCampos(definicionFalsa([]), await L.camposParaListado(CTX, "CLIENTE"));
    expect(def.columnas.map((c) => c.clave)).toEqual(["nombre", "cf_archivos", "cf_estilo", "cf_boda"]);
    expect(def.filtros.map((f) => f.clave)).toEqual(["movimientos", "cf_estilo", "cf_boda", "cf_vip"]);
    expect(def.exportar.columnas.map((c) => c.titulo)).toEqual(["Nombre", "Archivos", "Estilo", "Monto", "Boda", "VIP", "Notas"]);
  });

  it("sin campos la definición queda igual", async () => {
    B.vaciar();
    const base = definicionFalsa([]);
    expect(L.conCampos(base, await L.camposParaListado(CTX, "CLIENTE"))).toBe(base);
  });

  it("pasa la restricción a contar/traer y carga los valores de la página en una consulta", async () => {
    const vistas: ConsultaResuelta[] = [];
    const def = L.conCampos(definicionFalsa(vistas), await L.camposParaListado(CTX, "CLIENTE"));
    const espia = vi.spyOn(B.tablas.fotofficeCustomValue, "findMany");
    const c = { ...BASE, q: "boda", filtros: { cf_estilo: "o-moderno" } };
    await def.contar(CTX, c);
    const filas = await def.traer(CTX, c, { skip: 0, take: 25 });
    expect(vistas.map((v) => v.campos)).toEqual([
      { soloIds: ["c2"], buscarIds: ["c1", "c2"] },
      { soloIds: ["c2"], buscarIds: ["c1", "c2"] },
    ]);
    // Dos subconsultas (filtro y búsqueda) compartidas entre contar y traer, más una para los valores.
    expect(espia).toHaveBeenCalledTimes(3);
    expect(filas[0].valoresCampos?.get("estilo")).toEqual({ opcionId: "o-clasico" });
    expect(filas[1].valoresCampos?.get("notas")).toEqual({ texto: "Pidió álbum de BODA en cuero" });
    espia.mockRestore();
  });

  it("sin búsqueda ni filtros de campo no hay subconsulta ni restricción", async () => {
    const vistas: ConsultaResuelta[] = [];
    const def = L.conCampos(definicionFalsa(vistas), await L.camposParaListado(CTX, "CLIENTE"));
    await def.contar(CTX, { ...BASE, filtros: { movimientos: "si" } });
    expect(vistas[0].campos).toBeUndefined();
  });

  it("exportar por selección también trae los valores", async () => {
    const def = L.conCampos(definicionFalsa([]), await L.camposParaListado(CTX, "CLIENTE"));
    const filas = await def.traerPorIds(CTX, ["c1"]);
    expect(def.exportar.columnas.map((c) => c.valor(filas[0]))).toEqual(["Ana", "https://drive.example.com/Boda-Ana", "Clásico", "1500,5", "01/10/2026", "Sí", null]);
  });

  it("avisa cuando una subconsulta supera el tope", async () => {
    demasiados();
    const def = L.conCampos(definicionFalsa([]), await L.camposParaListado(CTX, "CLIENTE"));
    expect(await def.aviso!(CTX, { ...BASE, filtros: { cf_vip: "si" } })).toBe(L.avisoDeCampos("clientes"));
    expect(await def.aviso!(CTX, { ...BASE, filtros: { cf_vip: "no" } })).toBeNull();
  });
});

describe("restriccionDeCampos", () => {
  it("acota con AND y suma la alternativa de búsqueda sólo si hay texto e ids", () => {
    expect(L.restriccionDeCampos(BASE)).toEqual({ buscar: null, acotar: null });
    expect(L.restriccionDeCampos({ ...BASE, q: "x", campos: { soloIds: ["a"], buscarIds: ["b"] } })).toEqual({
      buscar: { id: { in: ["b"] } },
      acotar: { id: { in: ["a"] } },
    });
    expect(L.restriccionDeCampos({ ...BASE, q: "x", campos: { soloIds: null, buscarIds: [] } })).toEqual({ buscar: null, acotar: null });
  });
});
